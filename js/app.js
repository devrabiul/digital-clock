function updateClock() {
    const now = new Date();

    // Get day of the week (e.g., Saturday, Sunday)
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayName = days[now.getDay()];

    // Get month (e.g., January, February)
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthName = months[now.getMonth()];

    // Get year
    const currentYear = now.getFullYear();

    // Get day of the month, ensuring it's two digits
    const dayOfMonth = String(now.getDate()).padStart(2, '0');

    let hr = now.getHours();
    let min = now.getMinutes();
    let sec = now.getSeconds();
    let period = "AM";

    if (hr >= 12) {
        period = "PM";
        if (hr > 12) hr -= 12;
    }

    if (hr === 0) hr = 12;

    // Convert values to two-digit format
    hr = hr.toString().padStart(2, '0');
    min = min.toString().padStart(2, '0');
    sec = sec.toString().padStart(2, '0');

    // Function to update digit items in each group with flip effect
    function updateGroup(type, value) {
        const group = document.querySelector(`.group-container[data-type="${type}"]`);
        if (group) {
            const digits = group.querySelectorAll(".digit-item");
            digits.forEach((digit, index) => {
                if (digit.textContent !== value[index]) {
                    digit.classList.add("flipped"); // Add flip effect class
                    setTimeout(() => {
                        digit.classList.remove("flipped"); // Remove after animation
                    }, 600); // Duration of flip animation
                }
                digit.textContent = value[index];
            });
        }
    }

    // Update the time
    updateGroup("hour", hr);
    updateGroup("minute", min);
    updateGroup("second", sec);

    // Update AM/PM
    const ampmGroup = document.querySelector('.group-container[data-type="ampm"]');
    if (ampmGroup) {
        const ampmDigits = ampmGroup.querySelectorAll(".digit-item");
        if (ampmDigits[0].textContent !== period[0]) {
            ampmDigits[0].classList.add("flipped");
            setTimeout(() => {
                ampmDigits[0].classList.remove("flipped");
            }, 600);
        }
        ampmDigits[0].textContent = period[0];
        ampmDigits[1].textContent = period[1];
    }

    document.querySelector(`.clock-header-day`).textContent = dayName;
    document.querySelector(`.clock-header-date`).textContent = dayOfMonth;
    document.querySelector(`.clock-header-month`).textContent = monthName;
    document.querySelector(`.clock-header-year`).textContent = currentYear;
}

// Update clock every second
setInterval(updateClock, 1000);

// Initialize clock immediately
updateClock();


// Function to toggle full-screen mode (like F11)
function toggleFullScreen() {
    if (!document.fullscreenElement) {
        // Enter full-screen mode for the entire document
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        } else if (document.documentElement.mozRequestFullScreen) { // Firefox
            document.documentElement.mozRequestFullScreen();
        } else if (document.documentElement.webkitRequestFullscreen) { // Chrome, Safari, and Opera
            document.documentElement.webkitRequestFullscreen();
        } else if (document.documentElement.msRequestFullscreen) { // IE/Edge
            document.documentElement.msRequestFullscreen();
        }
    } else {
        // Exit full-screen mode
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.mozCancelFullScreen) { // Firefox
            document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) { // Chrome, Safari, and Opera
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) { // IE/Edge
            document.msExitFullscreen();
        }
    }
}

// Add event listener for full-screen toggle (F11 behavior)
document.addEventListener('keydown', (event) => {
    if (event.key === 'f' || event.key === 'F') {
        toggleFullScreen();
    }
});

const fullscreenBtn = document.getElementById('fullscreen-btn');
if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', toggleFullScreen);
}