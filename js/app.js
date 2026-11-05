const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

// Wallpaper links (?embed=flip) show only the clock and never touch saved settings
const EMBED = document.documentElement.hasAttribute('data-embed');

const root = document.querySelector('.root-container');
const headerDay = document.querySelector('.clock-header-day');
const headerDate = document.querySelector('.clock-header-date');
const headerMonth = document.querySelector('.clock-header-month');
const headerYear = document.querySelector('.clock-header-year');

const groups = {
    hour: document.querySelector('.group-container[data-type="hour"]'),
    minute: document.querySelector('.group-container[data-type="minute"]'),
    second: document.querySelector('.group-container[data-type="second"]'),
    ampm: document.querySelector('.group-container[data-type="ampm"]'),
};

const labels = {
    hour: groups.hour.querySelector('.digit-item-type'),
    minute: groups.minute.querySelector('.digit-item-type'),
    second: groups.second.querySelector('.digit-item-type'),
    ampm: groups.ampm.querySelector('.digit-item-type'),
};

// Running stopwatch/timer are wall-clock timestamps so they survive reloads and hidden tabs
const state = {
    mode: 'clock',
    stopwatch: { elapsed: 0, running: false, lastStart: 0 },
    timer: { duration: 5 * 60 * 1000, remaining: 5 * 60 * 1000, running: false, endsAt: 0, startedWith: 0 },
};

function pad(n) {
    return String(Math.max(0, Math.floor(n))).padStart(2, '0');
}

// Empty spans whose pseudo-elements draw the split-flap; textContent stays just the digit
function addFlap(digit, prev, next) {
    if (document.documentElement.getAttribute('data-skin') !== 'flip') return;
    const flaps = [['flap-old', prev], ['flap-new', next]].map(([name, value]) => {
        const flap = document.createElement('span');
        flap.className = `flap ${name}`;
        flap.dataset.value = value;
        return flap;
    });
    digit.append(...flaps);
    setTimeout(() => flaps.forEach((flap) => flap.remove()), 500);
}

function setGroupDigits(type, value) {
    const digits = groups[type].querySelectorAll('.digit-item');
    digits.forEach((digit, i) => {
        const ch = value[i] ?? '';
        const prev = digit.textContent;
        if (prev !== ch) {
            digit.classList.add('flipped');
            setTimeout(() => digit.classList.remove('flipped'), 600);
            digit.textContent = ch;
            // Hundredths change every frame, too fast for a flap to ever land
            if (!(type === 'ampm' && state.mode === 'stopwatch')) addFlap(digit, prev, ch);
        }
    });
}

// --- Renderers ---

function renderClock() {
    const now = new Date();
    headerDay.textContent = DAYS[now.getDay()];
    headerDate.textContent = pad(now.getDate());
    headerMonth.textContent = MONTHS[now.getMonth()];
    headerYear.textContent = now.getFullYear();

    let hr = now.getHours();
    let period = "AM";
    if (hr >= 12) { period = "PM"; if (hr > 12) hr -= 12; }
    if (hr === 0) hr = 12;

    setGroupDigits('hour', pad(hr));
    setGroupDigits('minute', pad(now.getMinutes()));
    setGroupDigits('second', pad(now.getSeconds()));
    setGroupDigits('ampm', period);

    labels.hour.textContent = 'Hour';
    labels.minute.textContent = 'Minute';
    labels.second.textContent = 'Second';
    labels.ampm.textContent = 'AM/PM';
}

function splitMs(ms) {
    const total = Math.max(0, ms);
    return {
        hours: Math.floor(total / 3600000),
        minutes: Math.floor((total % 3600000) / 60000),
        seconds: Math.floor((total % 60000) / 1000),
        centi: Math.floor((total % 1000) / 10),
    };
}

function stopwatchElapsed() {
    return state.stopwatch.running
        ? state.stopwatch.elapsed + (Date.now() - state.stopwatch.lastStart)
        : state.stopwatch.elapsed;
}

function renderStopwatch() {
    const { hours, minutes, seconds, centi } = splitMs(stopwatchElapsed());

    setGroupDigits('hour', pad(hours));
    setGroupDigits('minute', pad(minutes));
    setGroupDigits('second', pad(seconds));
    setGroupDigits('ampm', pad(centi));

    labels.hour.textContent = 'Hour';
    labels.minute.textContent = 'Min';
    labels.second.textContent = 'Sec';
    labels.ampm.textContent = '1/100s';
}

function timerRemaining() {
    return state.timer.running ? state.timer.endsAt - Date.now() : state.timer.remaining;
}

function renderTimer() {
    const { hours, minutes, seconds } = splitMs(timerRemaining());

    setGroupDigits('hour', pad(hours));
    setGroupDigits('minute', pad(minutes));
    setGroupDigits('second', pad(seconds));

    labels.hour.textContent = 'Hour';
    labels.minute.textContent = 'Min';
    labels.second.textContent = 'Sec';
}

// --- Saved state + tab title ---

const STATE_KEY = 'clockState';
const BASE_TITLE = document.title;
let timerDoneUnseen = false;

function updateTitle() {
    let title = BASE_TITLE;
    if (timerDoneUnseen) {
        title = `Time's up! - ${BASE_TITLE}`;
    } else if (state.timer.running) {
        const { hours, minutes, seconds } = splitMs(timerRemaining());
        const time = `${hours > 0 ? `${pad(hours)}:` : ''}${pad(minutes)}:${pad(seconds)}`;
        title = `${time} - Timer`;
    }
    if (document.title !== title) document.title = title;
}

function commitState() {
    if (!EMBED) {
        try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch (e) { }
    }
    updateTitle();
}

// --- Timer completion: beep + flash + notification ---

let audioCtx;
function unlockAudio() {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playBeep() {
    try {
        unlockAudio();
        [0, 0.3, 0.6, 0.9].forEach((t) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.value = 880;
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            const start = audioCtx.currentTime + t;
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
            gain.gain.linearRampToValueAtTime(0, start + 0.22);
            osc.start(start);
            osc.stop(start + 0.24);
        });
    } catch (e) { /* audio not available */ }
}

function flashTimerComplete() {
    root.classList.add('timer-complete');
    setTimeout(() => root.classList.remove('timer-complete'), 3000);
}

function requestTimerNotifications() {
    if (!('Notification' in window) || Notification.permission !== 'default') return;
    try { Notification.requestPermission(); } catch (e) { }
}

async function notifyTimerDone() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const options = { body: 'Your timer has finished.', icon: 'icons/icon-192.png', tag: 'timer-complete' };
    try {
        // Android only allows notifications through a service worker
        if (swRegistration?.active) {
            await swRegistration.showNotification("Time's up!", options);
        } else {
            const notification = new Notification("Time's up!", options);
            notification.onclick = () => { window.focus(); notification.close(); };
        }
    } catch (e) { /* notifications not available */ }
}

function onTimerComplete() {
    root.classList.remove('timer-running');
    playBeep();
    tmToggle.textContent = 'Start';
    if (document.hidden) {
        timerDoneUnseen = true;
        notifyTimerDone();
    } else {
        flashTimerComplete();
    }
    commitState();
}

function checkTimer() {
    if (!state.timer.running || timerRemaining() > 0) return;
    state.timer.running = false;
    state.timer.remaining = 0;
    logTimerRun(state.timer.startedWith);
    onTimerComplete();
}

// --- rAF loop ---

function renderCurrentMode() {
    if (state.mode === 'clock') renderClock();
    else if (state.mode === 'stopwatch') renderStopwatch();
    else if (state.mode === 'timer') renderTimer();
    else if (state.mode === 'game') renderGame();
}

let lastClockRender = 0;
function tick(now) {
    checkTimer();
    if (state.mode === 'clock') {
        if (now - lastClockRender > 250) {
            renderClock();
            checkClockMoments();
            lastClockRender = now;
        }
    } else if (state.mode === 'stopwatch') {
        renderStopwatch();
    } else if (state.mode === 'timer') {
        renderTimer();
    } else if (state.mode === 'game') {
        renderGame();
    }
    playSecondTick();
    requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// --- Background tick ---

// rAF stops in hidden tabs and page timers get throttled to once a minute; worker timers don't
function backgroundTick() {
    checkTimer();
    updateTitle();
    updateTimerPressure();
    checkMinuteChange();
}

try {
    const source = 'setInterval(() => postMessage(0), 250);';
    new Worker(URL.createObjectURL(new Blob([source]))).onmessage = backgroundTick;
} catch (e) {
    setInterval(backgroundTick, 250);
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    checkTimer();
    if (timerDoneUnseen) {
        timerDoneUnseen = false;
        flashTimerComplete();
    }
    updateTitle();
});

// --- Mode switching ---

const modeBtns = document.querySelectorAll('.mode-btn');

function switchMode(mode) {
    if (state.mode === mode) return;
    state.mode = mode;
    // The game borrows the timer's layout: no date headers, no AM/PM group
    root.setAttribute('data-mode', mode === 'game' ? 'timer' : mode);
    root.classList.toggle('game-on', mode === 'game');
    gameDigits.forEach((digit) => {
        if (mode === 'game') digit.setAttribute('tabindex', '0');
        else digit.removeAttribute('tabindex');
    });
    modeBtns.forEach((b) => {
        const active = b.dataset.mode === mode;
        b.classList.toggle('active', active);
        b.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    renderCurrentMode();
    commitState();
}

modeBtns.forEach((btn) => {
    btn.addEventListener('click', () => switchMode(btn.dataset.mode));
});

// --- Stopwatch controls ---

const swToggle = document.getElementById('sw-toggle');
const swReset = document.getElementById('sw-reset');

swToggle.addEventListener('click', () => {
    if (state.stopwatch.running) {
        state.stopwatch.elapsed += Date.now() - state.stopwatch.lastStart;
        state.stopwatch.running = false;
        swToggle.textContent = state.stopwatch.elapsed > 0 ? 'Resume' : 'Start';
    } else {
        state.stopwatch.lastStart = Date.now();
        state.stopwatch.running = true;
        swToggle.textContent = 'Pause';
    }
    commitState();
});

swReset.addEventListener('click', () => {
    state.stopwatch.running = false;
    state.stopwatch.elapsed = 0;
    swToggle.textContent = 'Start';
    renderStopwatch();
    commitState();
});

// --- Timer controls ---

const tmToggle = document.getElementById('tm-toggle');
const tmReset = document.getElementById('tm-reset');
const presetBtns = document.querySelectorAll('.preset-btn');
const adjustBtns = document.querySelectorAll('.adjust-btn');

const TIMER_MAX_MS = 99 * 3600000 + 59 * 60000 + 59 * 1000;
const ADJUST_STEPS = { hour: 3600000, minute: 60000, second: 1000 };

function syncPresetHighlight() {
    presetBtns.forEach((b) => {
        const ms = parseInt(b.dataset.preset, 10) * 1000;
        b.classList.toggle('active', ms === state.timer.duration);
    });
}

function setTimerRunningClass(running) {
    root.classList.toggle('timer-running', running);
}

presetBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
        if (state.timer.running) return;
        const ms = parseInt(btn.dataset.preset, 10) * 1000;
        state.timer.duration = ms;
        state.timer.remaining = ms;
        syncPresetHighlight();
        tmToggle.textContent = 'Start';
        root.classList.remove('timer-complete');
        renderTimer();
        commitState();
    });
});

adjustBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
        if (state.timer.running) return;
        const unit = btn.dataset.adjust;
        const delta = parseInt(btn.dataset.delta, 10);
        const step = ADJUST_STEPS[unit];
        if (!step) return;
        const next = Math.max(0, Math.min(TIMER_MAX_MS, state.timer.duration + delta * step));
        state.timer.duration = next;
        state.timer.remaining = next;
        syncPresetHighlight();
        tmToggle.textContent = 'Start';
        root.classList.remove('timer-complete');
        renderTimer();
        commitState();
    });
});

tmToggle.addEventListener('click', () => {
    if (state.timer.running) {
        state.timer.remaining = timerRemaining();
        state.timer.running = false;
        logTimerRun(state.timer.startedWith - state.timer.remaining);
        setTimerRunningClass(false);
        tmToggle.textContent = 'Resume';
    } else {
        if (state.timer.remaining <= 0) {
            if (state.timer.duration <= 0) return;
            state.timer.remaining = state.timer.duration;
        }
        state.timer.endsAt = Date.now() + state.timer.remaining;
        state.timer.startedWith = state.timer.remaining;
        state.timer.running = true;
        setTimerRunningClass(true);
        tmToggle.textContent = 'Pause';
        root.classList.remove('timer-complete');
        // Both need this click: browsers block sound and permission prompts without a gesture
        try { unlockAudio(); } catch (e) { }
        requestTimerNotifications();
    }
    commitState();
});

tmReset.addEventListener('click', () => {
    if (state.timer.running) logTimerRun(state.timer.startedWith - timerRemaining());
    state.timer.running = false;
    state.timer.remaining = state.timer.duration;
    setTimerRunningClass(false);
    tmToggle.textContent = 'Start';
    root.classList.remove('timer-complete');
    renderTimer();
    commitState();
});

// --- Fullscreen ---

function toggleFullScreen() {
    const el = document.documentElement;
    if (!document.fullscreenElement) {
        (el.requestFullscreen || el.mozRequestFullScreen || el.webkitRequestFullscreen || el.msRequestFullscreen)?.call(el);
    } else {
        (document.exitFullscreen || document.mozCancelFullScreen || document.webkitExitFullscreen || document.msExitFullscreen)?.call(document);
    }
}

document.getElementById('fullscreen-btn')?.addEventListener('click', toggleFullScreen);

// --- Particle toggle (persisted) ---

const particlesBtn = document.getElementById('particles-btn');

function particlesEnabled() {
    return document.documentElement.getAttribute('data-particles') !== 'off';
}

function setParticles(on) {
    if (on) {
        document.documentElement.removeAttribute('data-particles');
    } else {
        document.documentElement.setAttribute('data-particles', 'off');
    }
    if (!EMBED) {
        try { localStorage.setItem('particles', on ? 'on' : 'off'); } catch (e) { }
    }
    if (particlesBtn) particlesBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
}

setParticles(particlesEnabled());

particlesBtn?.addEventListener('click', () => setParticles(!particlesEnabled()));

// --- Keep screen awake (persisted) ---

const wakeBtn = document.getElementById('wake-btn');
const wakeSupported = 'wakeLock' in navigator;
let wakeWanted = false;
let wakeLock = null;

async function acquireWakeLock() {
    if (!wakeWanted || wakeLock || document.hidden) return;
    try {
        const lock = await navigator.wakeLock.request('screen');
        if (!wakeWanted) { lock.release(); return; }
        wakeLock = lock;
        lock.addEventListener('release', () => { wakeLock = null; });
    } catch (e) {
        // Refused, e.g. low battery: show off rather than claim a lock we don't hold
        wakeWanted = false;
        wakeBtn?.setAttribute('aria-pressed', 'false');
    }
}

function setWakeLock(on) {
    wakeWanted = on;
    try { localStorage.setItem('wakeLock', on ? 'on' : 'off'); } catch (e) { }
    wakeBtn?.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) acquireWakeLock();
    else wakeLock?.release();
}

if (wakeSupported) {
    wakeBtn?.addEventListener('click', () => setWakeLock(!wakeWanted));
    // The browser releases the lock whenever the page is hidden
    document.addEventListener('visibilitychange', acquireWakeLock);
    try { setWakeLock(localStorage.getItem('wakeLock') === 'on'); } catch (e) { }
} else {
    wakeBtn?.remove();
    document.getElementById('wake-shortcut')?.remove();
}

// --- Drag-to-spin + click-to-spin on digit cards ---

const allDigits = document.querySelectorAll('.digit-item');
let activeDrag = null;
const DRAG_THRESHOLD = 5;        // pixels before a press is treated as a drag
const DRAG_SCALE = 1.4;          // degrees of rotation per pixel of horizontal drag

function clearDigitDrag(digit) {
    digit.style.transition = '';
    digit.style.transform = '';
}

allDigits.forEach((digit) => {
    digit.addEventListener('pointerdown', (event) => {
        if (event.button !== 0 && event.pointerType === 'mouse') return;
        activeDrag = {
            digit,
            startX: event.clientX,
            rotation: 0,
            moved: false,
            gameSteps: 0,
            pointerId: event.pointerId,
        };
        try { digit.setPointerCapture(event.pointerId); } catch (e) { }
        digit.style.transition = 'none';
        event.preventDefault();
    });

    digit.addEventListener('pointermove', (event) => {
        if (!activeDrag || activeDrag.digit !== digit) return;
        const delta = event.clientX - activeDrag.startX;
        if (!activeDrag.moved && Math.abs(delta) > DRAG_THRESHOLD) activeDrag.moved = true;
        activeDrag.rotation = delta * DRAG_SCALE;
        digit.style.transform = `perspective(500px) rotateY(${activeDrag.rotation}deg)`;
        if (state.mode === 'game') {
            const steps = Math.trunc(delta / GAME_DRAG_STEP);
            if (steps !== activeDrag.gameSteps) {
                adjustGameDigit(digit, steps - activeDrag.gameSteps);
                activeDrag.gameSteps = steps;
            }
        }
    });

    function endDrag(event) {
        if (!activeDrag || activeDrag.digit !== digit) return;
        const wasDrag = activeDrag.moved;
        try { digit.releasePointerCapture(event.pointerId); } catch (e) { }
        clearDigitDrag(digit);
        activeDrag = null;
        if (event.type === 'pointerup' && !wasDrag && state.mode === 'game' && gameDigits.includes(digit)) {
            adjustGameDigit(digit, 1);
            return;
        }
        if (event.type === 'pointerup' && !wasDrag && !digit.classList.contains('spin')) {
            digit.classList.add('spin');
            digit.addEventListener('animationend', () => digit.classList.remove('spin'), { once: true });
        }
    }

    digit.addEventListener('pointerup', endDrag);
    digit.addEventListener('pointercancel', endDrag);
});

// --- Particle burst on background click ---

const BURST_COLORS = [
    '#ff6b9d', '#ffa45c', '#ffd166', '#06d6a0', '#4cc9f0', '#7209b7',
    '#f72585', '#fb8500', '#00bbf9', '#c77dff', '#ff006e', '#ffbe0b',
    '#8338ec', '#3a86ff', '#fb5607', '#80ed99'
];

function burstAt(x, y) {
    const count = 9 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
        const p = document.createElement('span');
        p.className = 'burst-particle';
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
        const distance = 70 + Math.random() * 90;
        const size = 6 + Math.random() * 8;
        const color = BURST_COLORS[Math.floor(Math.random() * BURST_COLORS.length)];
        p.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
        p.style.setProperty('--dy', `${Math.sin(angle) * distance}px`);
        p.style.setProperty('--size', `${size}px`);
        p.style.setProperty('--color', color);
        p.style.left = `${x}px`;
        p.style.top = `${y}px`;
        document.body.appendChild(p);
        p.addEventListener('animationend', () => p.remove(), { once: true });
    }
}

document.addEventListener('click', (event) => {
    if (event.target.closest('button, a, input, .digit-item, .shortcuts-card')) return;
    burstAt(event.clientX, event.clientY);
});

// --- Clock skin cycling ---

const SKINS = ['glass', 'led', 'flip', 'terminal'];
const skinBtn = document.getElementById('skin-btn');

function getCurrentSkin() {
    return document.documentElement.getAttribute('data-skin') || 'glass';
}

function setSkin(skin) {
    if (!SKINS.includes(skin)) return;
    if (skin === 'glass') {
        document.documentElement.removeAttribute('data-skin');
    } else {
        document.documentElement.setAttribute('data-skin', skin);
    }
    try { localStorage.setItem('skin', skin); } catch (e) { }
}

skinBtn?.addEventListener('click', () => {
    const current = getCurrentSkin();
    const next = SKINS[(SKINS.indexOf(current) + 1) % SKINS.length];
    setSkin(next);
});

// --- Keyboard shortcuts overlay ---

const shortcutsOverlay = document.getElementById('shortcuts-overlay');
const shortcutsClose = document.getElementById('shortcuts-close');
const shortcutsBtn = document.getElementById('shortcuts-btn');

function toggleShortcuts(show) {
    if (!shortcutsOverlay) return;
    const willShow = show !== undefined ? show : shortcutsOverlay.hasAttribute('hidden');
    if (willShow) shortcutsOverlay.removeAttribute('hidden');
    else shortcutsOverlay.setAttribute('hidden', '');
}

shortcutsBtn?.addEventListener('click', () => toggleShortcuts(true));
shortcutsClose?.addEventListener('click', () => toggleShortcuts(false));
shortcutsOverlay?.addEventListener('click', (event) => {
    if (event.target === shortcutsOverlay) toggleShortcuts(false);
});

// --- Date-aware seasonal themes ---

function detectSeason() {
    const hashMatch = window.location.hash.match(/^#(halloween|christmas|nye|valentines)$/);
    if (hashMatch) return hashMatch[1];

    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();

    if (month === 10 && day >= 28 && day <= 31) return 'halloween';
    if (month === 12 && day >= 20 && day <= 26) return 'christmas';
    if ((month === 12 && day === 31) || (month === 1 && day === 1)) return 'nye';
    if (month === 2 && day >= 13 && day <= 14) return 'valentines';
    return null;
}

const season = detectSeason();
if (season) {
    document.documentElement.setAttribute('data-season', season);
}

window.addEventListener('hashchange', () => {
    const s = detectSeason();
    if (s) document.documentElement.setAttribute('data-season', s);
    else document.documentElement.removeAttribute('data-season');
});

// --- Keyboard shortcuts ---

document.addEventListener('keydown', (event) => {
    if (EMBED) return;
    const tag = event.target.tagName;
    if ((tag === 'INPUT' || tag === 'TEXTAREA') && event.key !== 'Escape') return;
    // Leave browser shortcuts alone: Cmd+R would otherwise reset a saved timer as the page reloads
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (event.key === 'Escape') {
        if (shortcutsOverlay && !shortcutsOverlay.hasAttribute('hidden')) {
            event.preventDefault();
            toggleShortcuts(false);
        } else if (!extrasOverlay.hasAttribute('hidden')) {
            event.preventDefault();
            toggleExtras(false);
        } else if (state.mode === 'game') {
            switchMode('clock');
        }
        return;
    }

    if (state.mode === 'game' && gameDigits.includes(event.target) && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        event.preventDefault();
        adjustGameDigit(event.target, event.key === 'ArrowUp' ? 1 : -1);
        return;
    }

    if (event.key === '?' || (event.key === '/' && event.shiftKey)) {
        event.preventDefault();
        toggleShortcuts();
        return;
    }

    if (event.key === 'f' || event.key === 'F') {
        toggleFullScreen();
    } else if (event.key === 'w' || event.key === 'W') {
        if (wakeSupported) setWakeLock(!wakeWanted);
    } else if (event.key === 'e' || event.key === 'E') {
        toggleExtras();
    } else if (event.key === 'g' || event.key === 'G') {
        startGame();
    } else if (event.key === '1') {
        switchMode('clock');
    } else if (event.key === '2') {
        switchMode('stopwatch');
    } else if (event.key === '3') {
        switchMode('timer');
    } else if (event.code === 'Space') {
        if (tag === 'BUTTON' || tag === 'A') return; // let the focused button activate natively
        if (state.mode === 'stopwatch') { event.preventDefault(); swToggle.click(); }
        else if (state.mode === 'timer') { event.preventDefault(); tmToggle.click(); }
    } else if (event.key === 'r' || event.key === 'R') {
        if (tag === 'BUTTON' || tag === 'A') return;
        if (state.mode === 'stopwatch') swReset.click();
        else if (state.mode === 'timer') tmReset.click();
    }
});

// --- Theme toggle (light/dark) ---

const themeBtn = document.getElementById('theme-btn');
const rootEl = document.documentElement;
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

function currentTheme() {
    const stored = rootEl.getAttribute('data-theme');
    if (stored === 'dark' || stored === 'light') return stored;
    return prefersDark.matches ? 'dark' : 'light';
}

function setTheme(theme) {
    rootEl.setAttribute('data-theme', theme);
    try { localStorage.setItem('theme', theme); } catch (e) { }
}

themeBtn?.addEventListener('click', () => {
    setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
});

prefersDark.addEventListener('change', () => {
    try {
        if (!localStorage.getItem('theme')) rootEl.removeAttribute('data-theme');
    } catch (e) { }
});

// --- Extras: saved settings + small helpers ---

const EXTRAS_KEY = 'extras';
const MOMENTS_KEY = 'moments';
const TIME_LOG_KEY = 'timeLog';
const GAME_BEST_KEY = 'gameBest';

function readJson(key, fallback) {
    try {
        const value = JSON.parse(localStorage.getItem(key));
        return value && typeof value === 'object' ? value : fallback;
    } catch (e) {
        return fallback;
    }
}

function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { }
}

const extras = {
    daylight: false,
    minuteParticles: false,
    pressure: true,
    moments: true,
    ticks: false,
    melody: false,
    specialTime: '',
    ...readJson(EXTRAS_KEY, {}),
};

if (EMBED) {
    Object.assign(extras, {
        daylight: false, minuteParticles: false, pressure: false,
        moments: false, ticks: false, melody: false, specialTime: '',
    });
}

const toastEl = document.getElementById('toast');
let toastTimeout;

function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toastEl.classList.remove('show'), 3500);
}

function burstAroundClock() {
    const rect = document.querySelector('.digital-clock-container').getBoundingClientRect();
    [0.2, 0.5, 0.8].forEach((x) => burstAt(rect.left + rect.width * x, rect.top + rect.height / 2));
}

async function copyLink(link, message) {
    try {
        await navigator.clipboard.writeText(link);
        showToast(message);
    } catch (e) {
        window.prompt('Copy this link', link);
    }
}

function baseUrl() {
    return `${location.origin}${location.pathname}`;
}

// --- Daylight fill: rises from 06:00 to 18:00, then drains overnight ---

const dayFill = document.getElementById('day-fill');

function updateDaylight(now = new Date()) {
    dayFill.hidden = !extras.daylight;
    if (!extras.daylight) return;
    const hours = now.getHours() + now.getMinutes() / 60;
    const isDay = hours >= 6 && hours < 18;
    const progress = isDay ? (hours - 6) / 12 : ((hours + 6) % 24) / 12;
    // Amber to sky blue and back to orange, through pink and violet rather than green
    let hue = 240;
    if (isDay) hue = progress < 0.5 ? 30 - progress * 380 : 200 + (progress - 0.5) * 350;
    dayFill.style.height = `${(isDay ? progress : 1 - progress) * 100}%`;
    dayFill.style.setProperty('--day-hue', hue);
}

// --- Minute particles: one on screen per minute of the hour ---

const particlesEl = document.querySelector('.bg-particles');
const PARTICLE_SHAPES = ['', 'square', 'ring', 'triangle', 'diamond', 'hexagon', 'star', 'plus', 'blob'];

function updateMinuteParticles(minute = new Date().getMinutes()) {
    if (!extras.minuteParticles) {
        particlesEl.querySelectorAll('[data-minute-particle]').forEach((p) => p.remove());
        particlesEl.querySelectorAll('.particle').forEach((p) => p.classList.remove('minute-hidden'));
        return;
    }
    for (let i = particlesEl.children.length; i < 59; i++) {
        const p = document.createElement('span');
        p.className = `particle ${PARTICLE_SHAPES[i % PARTICLE_SHAPES.length]}`.trim();
        p.dataset.minuteParticle = '';
        p.style.setProperty('--x', `${(i * 37) % 97 + 1}%`);
        p.style.setProperty('--size', `${14 + (i * 5) % 14}px`);
        p.style.setProperty('--duration', `${18 + (i * 7) % 17}s`);
        p.style.setProperty('--delay', `${-((i * 11) % 30)}s`);
        p.style.setProperty('--color', BURST_COLORS[i % BURST_COLORS.length]);
        particlesEl.appendChild(p);
    }
    [...particlesEl.children].forEach((p, i) => p.classList.toggle('minute-hidden', i >= minute));
}

// --- Timer pressure: particles race and redden, digits tremble at the end ---

const FINAL_COUNTDOWN_MS = 10000;
let pressureLevel = 0;

function updateTimerPressure() {
    let level = 0;
    let final = false;
    if (extras.pressure && state.timer.running) {
        const remaining = timerRemaining();
        const span = Math.min(60000, Math.max(FINAL_COUNTDOWN_MS, state.timer.duration * 0.25));
        if (remaining < span) level = 1 - Math.max(0, remaining) / span;
        final = remaining <= FINAL_COUNTDOWN_MS;
    }
    root.classList.toggle('timer-final', final);
    if (level === pressureLevel) return;
    pressureLevel = level;
    particlesEl.toggleAttribute('data-pressure', level > 0);
    particlesEl.style.setProperty('--pressure', `${Math.round(level * 100)}%`);
    particlesEl.querySelectorAll('.particle').forEach((p) => {
        p.getAnimations().forEach((animation) => { animation.playbackRate = 1 + 3 * level * level; });
    });
}

// --- Sound: skin-matched ticks + a melody built from the time ---

// Any first gesture lets a restored page or a shared link make sound later
['pointerdown', 'keydown'].forEach((type) => {
    document.addEventListener(type, () => {
        try { unlockAudio(); } catch (e) { }
    }, { once: true });
});

const TICK_SOUNDS = {
    glass: { wave: 'sine', frequency: 1400, length: 0.03, volume: 0.05 },
    led: { wave: 'square', frequency: 1000, length: 0.015, volume: 0.02 },
    flip: { frequency: 1800, length: 0.05, volume: 0.25 },
    terminal: { frequency: 4500, length: 0.012, volume: 0.14 },
};

let noiseBuffer;
function makeTickSource(sound) {
    if (sound.wave) {
        const osc = audioCtx.createOscillator();
        osc.type = sound.wave;
        osc.frequency.value = sound.frequency;
        return osc;
    }
    if (!noiseBuffer) {
        noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.1, audioCtx.sampleRate);
        const samples = noiseBuffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    return noise;
}

function playTick(skin) {
    try {
        unlockAudio();
        const sound = TICK_SOUNDS[skin];
        const start = audioCtx.currentTime;
        const source = makeTickSource(sound);
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(sound.volume, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + sound.length);
        if (sound.wave) {
            source.connect(gain);
        } else {
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = sound.frequency;
            source.connect(filter);
            filter.connect(gain);
        }
        gain.connect(audioCtx.destination);
        source.start(start);
        source.stop(start + sound.length);
    } catch (e) { /* audio not available */ }
}

let lastTickKey = null;
function playSecondTick() {
    if (!extras.ticks) { lastTickKey = null; return; }
    let key = null;
    if (state.mode === 'clock') key = `c${new Date().getSeconds()}`;
    else if (state.mode === 'stopwatch' && state.stopwatch.running) key = `s${Math.floor(stopwatchElapsed() / 1000)}`;
    else if (state.mode === 'timer' && state.timer.running) key = `t${Math.floor(timerRemaining() / 1000)}`;
    if (key && lastTickKey && key !== lastTickKey) playTick(getCurrentSkin());
    lastTickKey = key;
}

const MELODY_SCALE = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99, 880];

// Each digit of HH:MM picks a note, so a given time always plays the same tune
function melodyNotes(now) {
    const digits = `${pad(now.getHours())}${pad(now.getMinutes())}`.split('').map(Number);
    const resolve = (now.getHours() + now.getMinutes()) % 5;
    return [...digits.map((digit) => MELODY_SCALE[digit]), MELODY_SCALE[resolve]];
}

function playTimeMelody(now = new Date()) {
    try {
        unlockAudio();
        melodyNotes(now).forEach((frequency, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            const start = audioCtx.currentTime + i * 0.28;
            osc.type = 'triangle';
            osc.frequency.value = frequency;
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.14, start + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.6);
            osc.start(start);
            osc.stop(start + 0.62);
        });
    } catch (e) { /* audio not available */ }
}

let lastMinute = new Date().getMinutes();
function checkMinuteChange() {
    const now = new Date();
    const minute = now.getMinutes();
    if (minute === lastMinute) return;
    lastMinute = minute;
    updateDaylight(now);
    updateMinuteParticles(minute);
    if (minute !== 0) return;
    if (extras.melody) playTimeMelody(now);
    if (extras.minuteParticles && !document.hidden) burstAroundClock();
}

// --- Moment catcher: lucky times are collected, your own time gets a burst ---

const MOMENT_STRAIGHTS = { '012345': 'Straight', '123456': 'Straight', '054321': 'Countdown' };

function classifyMoment(hour, minute, second) {
    const hh = pad(hour);
    const mm = pad(minute);
    const ss = pad(second);
    const digits = `${hh}${mm}${ss}`;
    if (digits === '120000') return "Twelve o'clock";
    if (digits === '111111') return 'All ones';
    if (MOMENT_STRAIGHTS[digits]) return MOMENT_STRAIGHTS[digits];
    if (hh === mm && mm === ss) return 'Triple';
    if (hh[0] === hh[1] && mm[0] === mm[1] && ss[0] === ss[1]) return 'Doubles';
    if (digits === [...digits].reverse().join('')) return 'Mirror';
    return null;
}

let lastMomentSecond = null;
let lastSpecialKey = null;

function catchMoment(time, name) {
    const caught = readJson(MOMENTS_KEY, {});
    const isNew = !caught[time];
    if (isNew) {
        caught[time] = Date.now();
        writeJson(MOMENTS_KEY, caught);
    }
    burstAroundClock();
    showToast(`${time} · ${name}${isNew ? ' · New catch!' : ''}`);
}

function checkClockMoments() {
    const now = new Date();
    const second = now.getSeconds();
    if (second === lastMomentSecond) return;
    lastMomentSecond = second;
    const hour = now.getHours() % 12 || 12;
    const minute = now.getMinutes();

    if (extras.moments) {
        const name = classifyMoment(hour, minute, second);
        if (name) catchMoment(`${pad(hour)}:${pad(minute)}:${pad(second)}`, name);
    }

    const special = /^(\d\d):(\d\d)$/.exec(extras.specialTime);
    if (!special) return;
    const specialHour = Number(special[1]);
    const key = `${now.getHours()}:${minute}`;
    const matches = minute === Number(special[2])
        && (now.getHours() === specialHour || hour === (specialHour % 12 || 12));
    if (matches && key !== lastSpecialKey) {
        burstAroundClock();
        showToast(`${special[0]} · Your moment`);
    }
    if (matches) lastSpecialKey = key;
}

function allMomentsCount() {
    let count = 0;
    for (let hour = 1; hour <= 12; hour++) {
        for (let minute = 0; minute < 60; minute++) {
            for (let second = 0; second < 60; second++) {
                if (classifyMoment(hour, minute, second)) count++;
            }
        }
    }
    return count;
}

// --- Digit Scrub Game: spin the digits to the current time before the round ends ---

const GAME_DRAG_STEP = 30;       // pixels of horizontal drag per digit step
const gameDigits = [
    ...groups.hour.querySelectorAll('.digit-item'),
    ...groups.minute.querySelectorAll('.digit-item'),
];
const gameStatus = document.getElementById('game-status');
const game = { digits: [0, 0, 0, 0], deadline: 0, streak: 0, best: 0 };

function gameTarget() {
    const now = new Date();
    return `${pad(now.getHours() % 12 || 12)}${pad(now.getMinutes())}`;
}

function paintGameDigits() {
    setGroupDigits('hour', `${game.digits[0]}${game.digits[1]}`);
    setGroupDigits('minute', `${game.digits[2]}${game.digits[3]}`);
}

function newGameRound() {
    do {
        game.digits = game.digits.map(() => Math.floor(Math.random() * 10));
    } while (game.digits.join('') === gameTarget());
    game.deadline = Date.now() + Math.max(6000, 20000 - game.streak * 1000);
    paintGameDigits();
}

function startGame() {
    if (state.mode === 'game') return;
    toggleExtras(false);
    game.streak = 0;
    try { game.best = parseInt(localStorage.getItem(GAME_BEST_KEY), 10) || 0; } catch (e) { game.best = 0; }
    newGameRound();
    switchMode('game');
}

function checkGameWin() {
    if (game.digits.join('') !== gameTarget()) return;
    game.streak++;
    if (game.streak > game.best) {
        game.best = game.streak;
        try { localStorage.setItem(GAME_BEST_KEY, game.best); } catch (e) { }
    }
    burstAroundClock();
    newGameRound();
}

function adjustGameDigit(digit, delta) {
    const index = gameDigits.indexOf(digit);
    if (index === -1) return;
    game.digits[index] = (game.digits[index] + delta + 100) % 10;
    paintGameDigits();
    checkGameWin();
}

function renderGame() {
    const left = game.deadline - Date.now();
    if (left <= 0) {
        if (game.streak > 0) showToast(`Too slow! Your streak ended at ${game.streak}`);
        game.streak = 0;
        newGameRound();
    }
    checkGameWin();
    setGroupDigits('second', pad(Math.ceil((game.deadline - Date.now()) / 1000)));

    labels.hour.textContent = 'Hour';
    labels.minute.textContent = 'Min';
    labels.second.textContent = 'Left';

    const target = gameTarget();
    const status = `Match ${target.slice(0, 2)}:${target.slice(2)} · Streak ${game.streak} · Best ${game.best}`;
    if (gameStatus.textContent !== status) gameStatus.textContent = status;
}

document.getElementById('game-exit').addEventListener('click', () => switchMode('clock'));

// --- Time well spent: minutes of timer use per day, kept on this device ---

function dateKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function logTimerRun(ms, when = Date.now()) {
    if (EMBED || !(ms >= 1000)) return;
    const log = readJson(TIME_LOG_KEY, {});
    const key = dateKey(new Date(when));
    log[key] = (Number(log[key]) || 0) + ms;
    writeJson(TIME_LOG_KEY, log);
}

function formatFocus(ms) {
    if (ms > 0 && ms < 60000) return 'under 1m';
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return `${minutes}m`;
    return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

const HEATMAP_WEEKS = 26;
const HEATMAP_LEVELS_MINUTES = [30, 60, 120];
const heatmapEl = document.getElementById('heatmap');
const heatmapReadout = document.getElementById('heatmap-readout');
let heatmapSummary = '';

function renderHeatmap() {
    const log = readJson(TIME_LOG_KEY, {});
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const day = new Date(today);
    day.setDate(today.getDate() - today.getDay() - (HEATMAP_WEEKS - 1) * 7);

    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 6);
    let weekTotal = 0;
    let activeDays = 0;
    const cells = [];

    while (day <= today) {
        const ms = Number(log[dateKey(day)]) || 0;
        const minutes = ms / 60000;
        const level = ms <= 0 ? 0 : HEATMAP_LEVELS_MINUTES.filter((limit) => minutes >= limit).length + 1;
        if (ms > 0) activeDays++;
        if (day >= weekAgo) weekTotal += ms;
        const label = `${day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}: ${formatFocus(ms)}`;
        const cell = document.createElement('span');
        cell.className = `heat-cell heat-level-${level}`;
        cell.title = label;
        cell.dataset.label = label;
        cells.push(cell);
        day.setDate(day.getDate() + 1);
    }

    heatmapEl.replaceChildren(...cells);
    const todayMs = Number(log[dateKey(today)]) || 0;
    heatmapSummary = `Today ${formatFocus(todayMs)} · Last 7 days ${formatFocus(weekTotal)} · ${activeDays} active ${activeDays === 1 ? 'day' : 'days'}`;
    heatmapEl.setAttribute('aria-label', `Timer use over the last ${HEATMAP_WEEKS} weeks. ${heatmapSummary}`);
    heatmapReadout.textContent = heatmapSummary;
}

['pointerover', 'click'].forEach((type) => {
    heatmapEl.addEventListener(type, (event) => {
        if (event.target.dataset.label) heatmapReadout.textContent = event.target.dataset.label;
    });
});
heatmapEl.addEventListener('pointerleave', () => { heatmapReadout.textContent = heatmapSummary; });

// --- Together timer: a link carrying the end time, so everyone shares one countdown ---

document.getElementById('tm-share').addEventListener('click', () => {
    if (!state.timer.running) tmToggle.click();
    if (!state.timer.running) return;
    const link = `${baseUrl()}?together=${Math.round(state.timer.endsAt)}&d=${Math.round(state.timer.duration)}`;
    copyLink(link, 'Link copied. Anyone who opens it joins this countdown.');
});

function applyTogetherLink() {
    const params = new URLSearchParams(location.search);
    if (!params.has('together')) return;
    const endsAt = Number(params.get('together'));
    // Drop it from the URL so a later reload doesn't undo a local pause or reset
    history.replaceState(null, '', `${location.pathname}${location.hash}`);

    const remaining = endsAt - Date.now();
    if (!Number.isFinite(remaining) || remaining > TIMER_MAX_MS) return;
    if (remaining <= 0) {
        showToast('That shared countdown has already finished.');
        return;
    }
    if (state.timer.running) logTimerRun(state.timer.startedWith - timerRemaining());
    const duration = Number(params.get('d'));
    state.timer.duration = Number.isFinite(duration) && duration >= remaining && duration <= TIMER_MAX_MS
        ? duration
        : Math.ceil(remaining);
    state.timer.remaining = remaining;
    state.timer.startedWith = remaining;
    state.timer.endsAt = endsAt;
    state.timer.running = true;
    setTimerRunningClass(true);
    tmToggle.textContent = 'Pause';
    syncPresetHighlight();
    switchMode('timer');
    commitState();
    showToast('You joined a shared countdown.');
}

// --- Extras panel ---

const extrasOverlay = document.getElementById('extras-overlay');
const extrasBtn = document.getElementById('extras-btn');
const extrasClose = document.getElementById('extras-close');
const extraToggles = document.querySelectorAll('[data-extra]');
const specialTimeInput = document.getElementById('special-time');
const wallpaperTransparent = document.getElementById('wallpaper-transparent');
let momentsTotal = 0;

function renderMoments() {
    const caught = readJson(MOMENTS_KEY, {});
    const times = Object.keys(caught).sort((a, b) => caught[b] - caught[a]);
    momentsTotal = momentsTotal || allMomentsCount();
    document.getElementById('moments-count').textContent = `${times.length} of ${momentsTotal} caught`;
    document.getElementById('moments-list').replaceChildren(...times.map((time) => {
        const chip = document.createElement('li');
        const [hour, minute, second] = time.split(':').map(Number);
        chip.textContent = time;
        chip.title = classifyMoment(hour, minute, second) || '';
        return chip;
    }));
}

function renderExtrasPanel() {
    extraToggles.forEach((input) => { input.checked = extras[input.dataset.extra] === true; });
    specialTimeInput.value = /^\d\d:\d\d$/.test(extras.specialTime) ? extras.specialTime : '';
    let best = 0;
    try { best = parseInt(localStorage.getItem(GAME_BEST_KEY), 10) || 0; } catch (e) { }
    document.getElementById('game-best').textContent = `Best streak: ${best}`;
    renderMoments();
    renderHeatmap();
}

function toggleExtras(show) {
    const willShow = show !== undefined ? show : extrasOverlay.hasAttribute('hidden');
    if (willShow === !extrasOverlay.hasAttribute('hidden')) return;
    if (willShow) {
        renderExtrasPanel();
        extrasOverlay.removeAttribute('hidden');
        extrasClose.focus();
    } else {
        extrasOverlay.setAttribute('hidden', '');
        extrasBtn.focus();
    }
}

function applyExtras() {
    updateDaylight();
    updateMinuteParticles();
    updateTimerPressure();
}

extrasBtn.addEventListener('click', () => toggleExtras(true));
extrasClose.addEventListener('click', () => toggleExtras(false));
extrasOverlay.addEventListener('click', (event) => {
    if (event.target === extrasOverlay) toggleExtras(false);
});

extraToggles.forEach((input) => {
    input.addEventListener('change', () => {
        extras[input.dataset.extra] = input.checked;
        writeJson(EXTRAS_KEY, extras);
        if (input.dataset.extra === 'minuteParticles' && input.checked) setParticles(true);
        applyExtras();
    });
});

specialTimeInput.addEventListener('change', () => {
    extras.specialTime = specialTimeInput.value;
    lastSpecialKey = null;
    writeJson(EXTRAS_KEY, extras);
});

document.getElementById('melody-preview').addEventListener('click', () => playTimeMelody());
document.getElementById('game-start').addEventListener('click', startGame);

document.getElementById('wallpaper-copy').addEventListener('click', () => {
    const params = new URLSearchParams({ embed: getCurrentSkin(), theme: currentTheme() });
    if (!particlesEnabled()) params.set('particles', 'off');
    if (wallpaperTransparent.checked) params.set('bg', 'transparent');
    copyLink(`${baseUrl()}?${params}`, 'Wallpaper link copied.');
});

// --- Restore saved state ---

function restoreState() {
    let saved;
    try { saved = JSON.parse(localStorage.getItem(STATE_KEY)); } catch (e) { return; }
    if (!saved) return;

    const num = (value) => (Number.isFinite(value) ? value : 0);
    const { stopwatch: sw = {}, timer: tm = {} } = saved;

    state.stopwatch.elapsed = Math.max(0, num(sw.elapsed));
    state.stopwatch.lastStart = num(sw.lastStart);
    state.stopwatch.running = sw.running === true && state.stopwatch.lastStart > 0;

    if (Number.isFinite(tm.duration)) {
        state.timer.duration = Math.max(0, Math.min(TIMER_MAX_MS, tm.duration));
        state.timer.remaining = Math.max(0, Math.min(state.timer.duration, num(tm.remaining)));
    }
    state.timer.endsAt = num(tm.endsAt);
    state.timer.startedWith = Math.max(0, Math.min(TIMER_MAX_MS, num(tm.startedWith)));
    state.timer.running = tm.running === true && state.timer.endsAt > Date.now();
    // Finished while the page was closed: show it as done, too late to alert about
    if (tm.running === true && !state.timer.running) {
        state.timer.remaining = 0;
        logTimerRun(state.timer.startedWith, state.timer.endsAt);
        commitState();
    }

    swToggle.textContent = state.stopwatch.running ? 'Pause' : state.stopwatch.elapsed > 0 ? 'Resume' : 'Start';
    const paused = state.timer.remaining > 0 && state.timer.remaining < state.timer.duration;
    tmToggle.textContent = state.timer.running ? 'Pause' : paused ? 'Resume' : 'Start';
    setTimerRunningClass(state.timer.running);
    syncPresetHighlight();

    if (['clock', 'stopwatch', 'timer'].includes(saved.mode)) switchMode(saved.mode);
}

// --- Service worker (offline + installable) ---

let swRegistration = null;
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then((registration) => {
        swRegistration = registration;
    }).catch(() => { /* e.g. opened from file:// */ });
}

// --- Initial paint ---
renderClock();
if (!EMBED) {
    restoreState();
    applyTogetherLink();
}
applyExtras();
renderCurrentMode();
updateTitle();
