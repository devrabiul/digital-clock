const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

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
    timer: { duration: 5 * 60 * 1000, remaining: 5 * 60 * 1000, running: false, endsAt: 0 },
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

function renderStopwatch() {
    const elapsed = state.stopwatch.running
        ? state.stopwatch.elapsed + (Date.now() - state.stopwatch.lastStart)
        : state.stopwatch.elapsed;
    const { hours, minutes, seconds, centi } = splitMs(elapsed);

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
    try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch (e) { }
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
    onTimerComplete();
}

// --- rAF loop ---

function renderCurrentMode() {
    if (state.mode === 'clock') renderClock();
    else if (state.mode === 'stopwatch') renderStopwatch();
    else if (state.mode === 'timer') renderTimer();
}

let lastClockRender = 0;
function tick(now) {
    checkTimer();
    if (state.mode === 'clock') {
        if (now - lastClockRender > 250) {
            renderClock();
            lastClockRender = now;
        }
    } else if (state.mode === 'stopwatch') {
        renderStopwatch();
    } else if (state.mode === 'timer') {
        renderTimer();
    }
    requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// --- Background tick ---

// rAF stops in hidden tabs and page timers get throttled to once a minute; worker timers don't
function backgroundTick() {
    checkTimer();
    updateTitle();
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
    root.setAttribute('data-mode', mode);
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
        setTimerRunningClass(false);
        tmToggle.textContent = 'Resume';
    } else {
        if (state.timer.remaining <= 0) {
            if (state.timer.duration <= 0) return;
            state.timer.remaining = state.timer.duration;
        }
        state.timer.endsAt = Date.now() + state.timer.remaining;
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
    try { localStorage.setItem('particles', on ? 'on' : 'off'); } catch (e) { }
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
    });

    function endDrag(event) {
        if (!activeDrag || activeDrag.digit !== digit) return;
        const wasDrag = activeDrag.moved;
        try { digit.releasePointerCapture(event.pointerId); } catch (e) { }
        clearDigitDrag(digit);
        activeDrag = null;
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
    const tag = event.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    // Leave browser shortcuts alone: Cmd+R would otherwise reset a saved timer as the page reloads
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (event.key === 'Escape') {
        if (shortcutsOverlay && !shortcutsOverlay.hasAttribute('hidden')) {
            event.preventDefault();
            toggleShortcuts(false);
        }
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
    state.timer.running = tm.running === true && state.timer.endsAt > Date.now();
    // Finished while the page was closed: show it as done, too late to alert about
    if (tm.running === true && !state.timer.running) state.timer.remaining = 0;

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
restoreState();
renderCurrentMode();
updateTitle();
