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

const state = {
    mode: 'clock',
    stopwatch: { elapsed: 0, running: false, lastStart: 0 },
    timer: { duration: 5 * 60 * 1000, remaining: 5 * 60 * 1000, running: false, lastStart: 0 },
};

function pad(n) {
    return String(Math.max(0, Math.floor(n))).padStart(2, '0');
}

function setGroupDigits(type, value) {
    const digits = groups[type].querySelectorAll('.digit-item');
    digits.forEach((digit, i) => {
        const ch = value[i] ?? '';
        if (digit.textContent !== ch) {
            digit.classList.add('flipped');
            setTimeout(() => digit.classList.remove('flipped'), 600);
            digit.textContent = ch;
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
        ? state.stopwatch.elapsed + (performance.now() - state.stopwatch.lastStart)
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

function renderTimer() {
    let remaining = state.timer.remaining;
    if (state.timer.running) {
        remaining = state.timer.remaining - (performance.now() - state.timer.lastStart);
        if (remaining <= 0) {
            remaining = 0;
            state.timer.running = false;
            state.timer.remaining = 0;
            onTimerComplete();
        }
    }
    const { hours, minutes, seconds } = splitMs(remaining);

    setGroupDigits('hour', pad(hours));
    setGroupDigits('minute', pad(minutes));
    setGroupDigits('second', pad(seconds));

    labels.hour.textContent = 'Hour';
    labels.minute.textContent = 'Min';
    labels.second.textContent = 'Sec';
}

// --- Timer completion: beep + flash ---

let audioCtx;
function playBeep() {
    try {
        audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
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

function onTimerComplete() {
    root.classList.add('timer-complete');
    root.classList.remove('timer-running');
    playBeep();
    tmToggle.textContent = 'Start';
    setTimeout(() => root.classList.remove('timer-complete'), 3000);
}

// --- rAF loop ---

let lastClockRender = 0;
function tick(now) {
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
    if (mode === 'clock') renderClock();
    else if (mode === 'stopwatch') renderStopwatch();
    else if (mode === 'timer') renderTimer();
}

modeBtns.forEach((btn) => {
    btn.addEventListener('click', () => switchMode(btn.dataset.mode));
});

// --- Stopwatch controls ---

const swToggle = document.getElementById('sw-toggle');
const swReset = document.getElementById('sw-reset');

swToggle.addEventListener('click', () => {
    if (state.stopwatch.running) {
        state.stopwatch.elapsed += performance.now() - state.stopwatch.lastStart;
        state.stopwatch.running = false;
        swToggle.textContent = state.stopwatch.elapsed > 0 ? 'Resume' : 'Start';
    } else {
        state.stopwatch.lastStart = performance.now();
        state.stopwatch.running = true;
        swToggle.textContent = 'Pause';
    }
});

swReset.addEventListener('click', () => {
    state.stopwatch.running = false;
    state.stopwatch.elapsed = 0;
    swToggle.textContent = 'Start';
    renderStopwatch();
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
    });
});

tmToggle.addEventListener('click', () => {
    if (state.timer.running) {
        state.timer.remaining -= performance.now() - state.timer.lastStart;
        state.timer.running = false;
        setTimerRunningClass(false);
        tmToggle.textContent = 'Resume';
    } else {
        if (state.timer.remaining <= 0) {
            if (state.timer.duration <= 0) return;
            state.timer.remaining = state.timer.duration;
        }
        state.timer.lastStart = performance.now();
        state.timer.running = true;
        setTimerRunningClass(true);
        tmToggle.textContent = 'Pause';
        root.classList.remove('timer-complete');
    }
});

tmReset.addEventListener('click', () => {
    state.timer.running = false;
    state.timer.remaining = state.timer.duration;
    setTimerRunningClass(false);
    tmToggle.textContent = 'Start';
    root.classList.remove('timer-complete');
    renderTimer();
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

// --- Click-to-spin easter egg on digit cards ---

document.querySelectorAll('.digit-item').forEach((digit) => {
    digit.addEventListener('click', () => {
        if (digit.classList.contains('spin')) return; // ignore mid-spin clicks
        digit.classList.add('spin');
        digit.addEventListener('animationend', () => digit.classList.remove('spin'), { once: true });
    });
});

// --- Keyboard shortcuts ---

document.addEventListener('keydown', (event) => {
    const tag = event.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    if (event.key === 'f' || event.key === 'F') {
        toggleFullScreen();
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

// --- Initial paint ---
renderClock();
renderTimer();
