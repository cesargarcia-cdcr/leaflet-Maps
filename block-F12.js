// ==========================================
// SETUP AND BACKDOOR WITH COUNTDOWN
// ==========================================
const IS_SECURITY_ENABLED = window.SERVER_SECURITY_OVERRIDE !== undefined ? window.SERVER_SECURITY_OVERRIDE : true;

let devToolsGracePeriod = false;
let graceTimer = null;

function isDevToolsBackdoor(e) {
    return e.ctrlKey && e.shiftKey && (e.key === 'x' || e.key === 'X' || e.keyCode === 88);
}

// ==========================================
// DYNAMIC ROUTE RESOLUTION (Local / GitHub Pages)
// ==========================================
function getResourceBasePath() {
    const pathname = window.location.pathname;
    const isInsideErrorFolder = pathname.toLowerCase().includes('/error/');
    return isInsideErrorFolder ? '' : 'Error/';
}

// ==========================================
// EVENT AND KEYDOWN BLOCKING (UNIFIED)
// ==========================================
document.addEventListener('contextmenu', function(e) { 
    if (IS_SECURITY_ENABLED) {
        e.preventDefault();
    }
});

document.addEventListener('keydown', function(e) {
    if (!IS_SECURITY_ENABLED) return;

    // 1. Activate countdown with Ctrl + Shift + X
    if (isDevToolsBackdoor(e)) {
        devToolsGracePeriod = true;
        console.log("🔓 Magic Word Accepted: You have 8 seconds to press F12 or open DevTools.");

        if (graceTimer) clearTimeout(graceTimer);

        graceTimer = setTimeout(() => {
            devToolsGracePeriod = false;
            console.log("🔒 Grace period ended. Security restored.");
        }, 8000);

        return;
    }

    // 2. If we are in a grace period, we allow the use of development tools
    if (devToolsGracePeriod) {
        return; 
    }

    // 3. Evaluate common blockages
    const isF12 = (e.keyCode === 123);
    const isCtrlU = (e.ctrlKey && (e.key === 'u' || e.key === 'U' || e.keyCode === 85));
    const isDevToolsCombo = (e.ctrlKey && e.shiftKey && (e.key === 'i' || e.key === 'I' || e.key === 'j' || e.key === 'J' || e.keyCode === 73 || e.keyCode === 74));

    if (isF12 || isCtrlU || isDevToolsCombo) {
        e.preventDefault();
        triggerMacAutomatedTerminal();
    }
});

// ==========================================
// CONSTRUCTION AND DYNAMIC INJECTION OF THE DOM
// ==========================================
async function triggerMacAutomatedTerminal() {
    if (document.getElementById('nedry-mac-overlay')) return;

    const basePath = getResourceBasePath();

    const htmlContent = `
    <div class="mac-window-stage">
        <div class="mac-window background-window">
            <div class="window-header">
                <div class="close-box custom-close-trigger"></div>
                <div class="window-title">NERDLYLAND</div>
            </div>
        </div>

        <div class="mac-window foreground-window">
            <div class="window-header">
                <div class="close-box custom-close-trigger"></div>
                <div class="window-title">THE KING</div>
            </div>
            
            <div class="window-toolbar"><span>Object</span><span>The King</span><span>Loop</span></div>

            <div class="window-body">
                <div class="meme-container">
                    
                    <div id="mac-terminal-display" class="mac-terminal-screen">
                        <div id="mac-terminal-log"></div>
                    </div>

                    <div id="mac-meme-graphic" class="character-graphic hidden">
                        <img src="${basePath}resources/nedry.gif" alt="Dennis Nedry Magic Word Loop">
                    </div>

                    <button id="systemAlertButton">OK</button>
                </div>
            </div>
        </div>
    </div>

    <audio id="nedry-beep-audio" src="${basePath}resources/beep.mp3"></audio>
    <audio id="nedry-lockdown-audio" src="${basePath}resources/lockDown.mp3"></audio>
    <audio id="nedry-loop-audio" src="${basePath}resources/ahahah.mp3" loop></audio>
    `;

    const overlay = document.createElement('div');
    overlay.id = 'nedry-mac-overlay';
    overlay.innerHTML = htmlContent;
    document.body.appendChild(overlay);

    runTerminalSequence();
}

// ==========================================
// ANIMATION AND AUDIO SEQUENCE (CDCR Terminal)
// ==========================================
function runTerminalSequence() {
    const log = document.getElementById('mac-terminal-log');
    const terminalScreen = document.getElementById('mac-terminal-display');
    const memeGraphic = document.getElementById('mac-meme-graphic');
    
    const beepAudio = document.getElementById('nedry-beep-audio');
    const lockdownAudio = document.getElementById('nedry-lockdown-audio');
    const loopAudio = document.getElementById('nedry-loop-audio');
    
    const alertBtn = document.getElementById('systemAlertButton');
    const foreWindow = document.querySelector('.foreground-window');

    const sequence = [
        { type: "CDCR, System Security Interface\nVersion 4.0.5, Alpha E\nReady...\n> access security", reply: "\naccess: PERMISSION DENIED." },
        { type: "\n> access security grid", reply: "\naccess: PERMISSION DENIED." },
        { type: "\n> access main security grid", reply: "\naccess: PERMISSION DENIED.\n...and..." }
    ];

    let currentStep = 0;

    function getTypingDelay(character) {
        const variation = Math.random() * 60;
        if (character === '\n') return 260 + variation;
        if (/[.,!?]/.test(character)) return 180 + variation;
        return 90 + variation;
    }

    function typeCommand(lineObj) {
        if (!document.getElementById('mac-terminal-log')) return;

        let textToType = lineObj.type;
        let index = 0;

        function typeChar() {
            if (!document.getElementById('mac-terminal-log')) return;

            if (index < textToType.length) {
                const character = textToType[index];
                log.innerHTML += character;
                index++;
                setTimeout(typeChar, getTypingDelay(character));
            } else {
                setTimeout(() => {
                    if (!document.getElementById('mac-terminal-log')) return;
                    log.innerHTML += lineObj.reply;
                    currentStep++;
                    
                    if (beepAudio) {
                        beepAudio.currentTime = 0;
                        beepAudio.play().catch(() => {});
                    }
                    
                    if (currentStep < sequence.length) {
                        setTimeout(() => typeCommand(sequence[currentStep]), 900);
                    } else {
                        // Play the infinite loop of "YOU DIDN'T SAY THE MAGIC WORD!"
                        setTimeout(() => {
                            startMagicWordFlood();
                        }, 1000);
                    }
                }, 700);
            }
        }
        typeChar();
    }

    setTimeout(() => typeCommand(sequence[0]), 500);

    // Function to flood the screen with the classic phrase before the trap
    function startMagicWordFlood() {
        const magicText = "\nYOU DIDN'T SAY THE MAGIC WORD!";
        let floodCount = 0;
        
        function addLine() {
            if (!document.getElementById('mac-terminal-log')) return;
            log.innerHTML += magicText;
            
            // Auto-scroll down to simulate the terminal filling up
            if (terminalScreen) {
                terminalScreen.scrollTop = terminalScreen.scrollHeight;
            }

            floodCount++;
            if (floodCount < 12) {
                setTimeout(addLine, 120);
            } else {
                // Once the screen is full, trigger the lockdown audio and Nedry's image.
                setTimeout(() => {
                    if (lockdownAudio) lockdownAudio.play().catch(() => {});
                    triggerTrapMatrix();
                }, 600);
            }
        }
        addLine();
    }

    function triggerTrapMatrix() {
        if (terminalScreen) terminalScreen.classList.add('hidden');
        if (memeGraphic) memeGraphic.classList.remove('hidden');
        if (foreWindow) foreWindow.classList.add('window-flash-alert');

        if (loopAudio) loopAudio.play().catch(err => console.log("Audio pipeline error:", err));
    }

    if (alertBtn) {
        alertBtn.addEventListener('click', () => {
            if (loopAudio) loopAudio.play().catch(() => {});
        });
    }
}

// ==========================================
// SYSTEM CLEANING AND SHUTDOWN
// ==========================================
function closeLockoutSystem() {
    const beepAudio = document.getElementById('nedry-beep-audio');
    const lockdownAudio = document.getElementById('nedry-lockdown-audio');
    const loopAudio = document.getElementById('nedry-loop-audio');
    
    if (loopAudio) { loopAudio.pause(); loopAudio.currentTime = 0; }
    if (lockdownAudio) lockdownAudio.pause();
    if (beepAudio) beepAudio.pause();

    const dynamicOverlay = document.getElementById('nedry-mac-overlay');
    if (dynamicOverlay) {
        dynamicOverlay.remove();
    }
}

document.addEventListener('click', function(e) {
    const overlay = document.getElementById('nedry-mac-overlay');
    if (overlay && e.target === overlay) {
        closeLockoutSystem();
    }
    
    if (e.target.classList.contains('custom-close-trigger')) {
        e.stopPropagation();
        closeLockoutSystem();
    }
});