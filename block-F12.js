// Troubleshooting flag: Lee la configuración del servidor, si no existe por defecto es true (Modo Seguro)
const IS_SECURITY_ENABLED = window.SERVER_SECURITY_OVERRIDE !== undefined ? window.SERVER_SECURITY_OVERRIDE : true;

// Block right-click context menu
document.addEventListener('contextmenu', function(e) { 
    if (IS_SECURITY_ENABLED) {
        e.preventDefault();
    }
});

// Block DevTools shortcuts (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U)
document.addEventListener('keydown', function(e) {
    if (!IS_SECURITY_ENABLED) return; // Si entra por el puerto 9000, saldrá aquí de inmediato.

    const isF12 = (e.keyCode === 123);
    const isCtrlU = (e.ctrlKey && (e.key === 'u' || e.key === 'U' || e.keyCode === 85));
    const isDevToolsCombo = (e.ctrlKey && e.shiftKey && (e.key === 'i' || e.key === 'I' || e.key === 'j' || e.key === 'J' || e.keyCode === 73 || e.keyCode === 74));

    if (isF12 || isCtrlU || isDevToolsCombo) {
        e.preventDefault();
        triggerMacAutomatedTerminal();
    }
});

/**
 * Dynamically builds the terminal overlay by reading from the modular 
 * Error templates and adjusting paths based on execution context.
 */
async function triggerMacAutomatedTerminal() {
    if (document.getElementById('nedry-mac-overlay')) return;

    // Context Path Resolver: Detect if we are executing from within the Error folder or the Root
    const isInsideErrorFolder = window.location.pathname.toLowerCase().includes('/error/');
    const basePath = isInsideErrorFolder ? '' : 'Error/';

    // 1. Inject your dedicated external style sheet rules if they aren't loaded yet
    if (!document.getElementById('nedry-error-styles')) {
        const styleLink = document.createElement('link');
        styleLink.id = 'nedry-error-styles';
        styleLink.rel = 'stylesheet';
        styleLink.href = `${basePath}resources/style.css`;
        document.head.appendChild(styleLink);
    }

    // 2. Fetch the clean HTML view template structure
    let htmlContent = '';
    try {
        // If we are already running standalone inside Error/index.html, skip fetch and run sequence
        if (isInsideErrorFolder && document.getElementById('mac-terminal-display')) {
            runTerminalSequence();
            return;
        }

        const response = await fetch(`${basePath}index.html`, { cache: 'no-cache' });
        if (response.ok) {
            htmlContent = await response.text();
        } else {
            throw new Error("Template mapping fetch clearance failure.");
        }
    } catch (err) {
        console.error("Failed to load modular error index content layout template:", err);
        return;
    }

    // 3. Mount the dynamic container layer directly onto the active tab body
    const overlay = document.createElement('div');
    overlay.id = 'nedry-mac-overlay';
    overlay.innerHTML = htmlContent;
    document.body.appendChild(overlay);

    // Fix raw relative media sources inside the newly injected HTML so they map correctly to the subfolder
    if (!isInsideErrorFolder) {
        overlay.querySelectorAll('audio, img, source').forEach(asset => {
            const src = asset.getAttribute('src');
            if (src && !src.startsWith('http') && !src.startsWith('Error/')) {
                asset.setAttribute('src', `Error/${src}`);
            }
        });
    }

    runTerminalSequence();
}

/**
 * Runs the animation and audio sequences once the DOM elements are mounted
 */
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
        { type: "> access main program grid", reply: "\nACCESS DENIED." },
        { type: "\n> access main security grid", reply: "\nACCESS DENIED." },
        { type: "\n> access main program grid", reply: "\nACCESS DENIED.\n...DEVICE LOCKED BY ADMINISTRATIVE LOCKOUT UNIT." }
    ];

    let currentStep = 0;
    log.innerHTML = "SYSTEM READY.\n";

    function typeCommand(lineObj) {
        if (!document.getElementById('mac-terminal-log')) return;

        let textToType = lineObj.type;
        let index = 0;

        function typeChar() {
            if (!document.getElementById('mac-terminal-log')) return;

            if (index < textToType.length) {
                log.innerHTML += textToType[index];
                index++;
                setTimeout(typeChar, 45);
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
                        setTimeout(() => typeCommand(sequence[currentStep]), 800);
                    } else {
                        setTimeout(() => {
                            if (lockdownAudio) lockdownAudio.play().catch(() => {});
                            triggerTrapMatrix();
                        }, 800);
                    }
                }, 350);
            }
        }
        typeChar();
    }

    setTimeout(() => typeCommand(sequence[0]), 500);

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

/**
 * Global safe cleanup process called by interactions or close button triggers
 */
function closeLockoutSystem() {
    const beepAudio = document.getElementById('nedry-beep-audio');
    const lockdownAudio = document.getElementById('nedry-lockdown-audio');
    const loopAudio = document.getElementById('nedry-loop-audio');
    
    if (loopAudio) { loopAudio.pause(); loopAudio.currentTime = 0; }
    if (lockdownAudio) lockdownAudio.pause();
    if (beepAudio) beepAudio.pause();

    // Safely remove the overlay container element if injected dynamically
    const dynamicOverlay = document.getElementById('nedry-mac-overlay');
    if (dynamicOverlay) {
        dynamicOverlay.remove();
    } else {
        // If running directly inside Error/index.html as a standalone page, redirect or clear interface
        console.log("Standalone mode closure triggered.");
        window.location.href = '../index.html';
    }
}

// Attach event listeners globally to catch clicks on any generated elements
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