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
// INJECTION OF DYNAMIC CSS STYLES
// ==========================================
const nedryStyles = `
#nedry-mac-overlay {
    position: fixed !important;
    top: 0 !important; left: 0 !important;
    width: 100vw !important; height: 100vh !important;
    z-index: 9999999 !important;
    background: rgba(0, 0, 0, 0.4) !important;
    backdrop-filter: blur(5px) !important;
    display: flex !important; justify-content: center !important; align-items: center !important;
}

#nedry-mac-overlay * {
    box-sizing: border-box; margin: 0; padding: 0;
    font-family: "Geneva", "Chicago", "Monaco", "Courier New", monospace;
}

.mac-window-stage {
    position: relative;
    width: 550px;
    height: 390px;
    user-select: none;
}

.mac-window { 
    background-color: #ffffff; border: 1px solid #000000; position: absolute; 
    box-shadow: 2px 2px 0px #000000; display: flex; flex-direction: column; 
}

.background-window { 
    width: 95%; height: 90%; top: 0; left: 0; z-index: 3; 
}

.foreground-window { 
    width: 95%; height: 90%; top: 35px; left: 25px; z-index: 4; 
}

.window-header { 
    height: 18px; flex-shrink: 0; border-bottom: 1px solid #000000; position: relative; 
    display: flex; justify-content: center; align-items: center; 
    background: linear-gradient(to bottom, #fff 0px, #fff 2px, #000 2px, #000 3px, #fff 3px, #fff 5px, #000 5px, #000 6px, #fff 6px, #fff 8px, #000 8px, #000 9px, #fff 9px, #fff 11px, #000 11px, #000 12px, #fff 12px); 
}

.window-title { background-color: #ffffff; padding: 0 8px; font-size: 10px; font-weight: bold; letter-spacing: 0.5px; }
.close-box { width: 11px; height: 11px; border: 1px solid #000; background-color: #fff; position: absolute; left: 12px; top: 3px; cursor: pointer; }
.window-toolbar { height: 16px; flex-shrink: 0; border-bottom: 1px solid #000; display: flex; padding: 0 12px; font-size: 9px; align-items: center; background-color: #fff; gap: 40px; }
.window-body { flex-grow: 1; width: 100%; display: flex; flex-direction: column; justify-content: space-between; align-items: center; background-color: #ffffff; position: relative; overflow: hidden; padding: 10px 0; }
.meme-container { text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: space-between; width: 100%; height: 100%; padding: 0 15px; }
.character-graphic { flex-grow: 1; width: 100%; max-height: 75%; border: none; background-color: #ffffff; display: flex; justify-content: center; align-items: center; position: relative; overflow: hidden; }
.character-graphic img { width: 100%; height: 100%; object-fit: contain; }

#systemAlertButton { 
    margin-top: 5px; margin-bottom: 5px; padding: 4px 24px; 
    font-family: "Geneva", "Chicago", "Monaco", monospace; font-size: 11px; font-weight: bold; 
    background-color: #ffffff; color: #000000; border: 1px solid #000000; border-radius: 3px; 
    cursor: pointer; outline: none; box-shadow: 0 0 0 2px #ffffff, 0 0 0 3px #000000; flex-shrink: 0; 
}

#systemAlertButton:active { background-color: #000000; color: #ffffff; box-shadow: 0 0 0 2px #000000, 0 0 0 3px #000000; }

.mac-terminal-screen {
    flex-grow: 1; width: 100%; max-height: 75%; background: #0000aa; border: 1px solid #000000;
    padding: 10px; display: flex; flex-direction: column; text-align: left; overflow: hidden;
}

#mac-terminal-log {
    font-size: 11px; font-weight: bold; color: #ffffff; line-height: 1.5; white-space: pre-wrap; font-family: "Monaco", "Courier New", monospace;
}

.hidden { display: none !important; }
.window-flash-alert { animation: mac-system-flash 0.25s infinite alternate; }
@keyframes mac-system-flash { from { background-color: #ffffff; } to { background-color: #ffcccc; } }
`;

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
        console.log("🔓 Backdoor enabled: You have 5 seconds to press F12 or open DevTools.");

        if (graceTimer) clearTimeout(graceTimer);

        graceTimer = setTimeout(() => {
            devToolsGracePeriod = false;
            console.log("🔒 Grace period ended. Security restored.");
        }, 5000);

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

    if (!document.getElementById('nedry-error-styles')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'nedry-error-styles';
        styleEl.textContent = nedryStyles;
        document.head.appendChild(styleEl);
    }

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

    function typeCommand(lineObj) {
        if (!document.getElementById('mac-terminal-log')) return;

        let textToType = lineObj.type;
        let index = 0;

        function typeChar() {
            if (!document.getElementById('mac-terminal-log')) return;

            if (index < textToType.length) {
                log.innerHTML += textToType[index];
                index++;
                setTimeout(typeChar, 35);
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
                        setTimeout(() => typeCommand(sequence[currentStep]), 600);
                    } else {
                        // Play the infinite loop of "YOU DIDN'T SAY THE MAGIC WORD!"
                        setTimeout(() => {
                            startMagicWordFlood();
                        }, 800);
                    }
                }, 250);
            }
        }
        typeChar();
    }

    setTimeout(() => typeCommand(sequence[0]), 300);

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