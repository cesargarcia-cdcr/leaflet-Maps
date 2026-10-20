/* ==========================================================
   LOADING SCREEN & OPFS SYNC ENGINE (SQUADRON EDITION)
   ========================================================== */

// --- 🌌 SQUADRON ROLL-CALL & BRIEFING ---
console.log("🌌 [Squadron Briefing]: All wings report in. Initializing operational flight deck...");
console.log("📢 [Command]: Leader roll-call initiated. Status report requested across all channels.");
console.log("🔴 [Red Leader Bio]: 'Red Leader, standing by. Managing command routing, service worker deployment, and primary trench run sequence navigation.'");
console.log("🟡 [Gold Leader Bio]: 'Gold Leader, standing by. Operating security sweeps, SharePoint token verification, and emergency authentication lock-screen protocols.'");
console.log("🟢 [Green Leader Bio]: 'Green Leader, standing by. Engineering OPFS data synchronization, local cache persistence, lite payload fetching, and background asset cargo bays.'");
console.log("🔵 [Blue Leader Bio]: 'Blue Leader, standing by. Monitoring HUD telemetry, progress bar updates, splash screen deflector shields, and URL payload decoding.'");



(function() {
    let logWriteQueue = Promise.resolve();
    const DEFAULT_LOG_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

    async function removeExpiredLogFiles(directoryHandle, cutoff, removeEmptyDirectories = false) {
        const entries = [];
        for await (const [entryName, entryHandle] of directoryHandle.entries()) {
            entries.push([entryName, entryHandle]);
        }

        let removedCount = 0;
        for (const [entryName, entryHandle] of entries) {
            if (entryHandle.kind === "directory") {
                removedCount += await removeExpiredLogFiles(entryHandle, cutoff, true);
                if (removeEmptyDirectories) {
                    let isEmpty = true;
                    for await (const _ of entryHandle.entries()) {
                        isEmpty = false;
                        break;
                    }
                    if (isEmpty) await directoryHandle.removeEntry(entryName);
                }
                continue;
            }

            const file = await entryHandle.getFile();
            if (file.lastModified < cutoff) {
                await directoryHandle.removeEntry(entryName);
                removedCount++;
            }
        }
        return removedCount;
    }

    async function deleteExpiredLogFiles(maxAgeMs) {
        const rootDir = await navigator.storage.getDirectory();
        const cutoff = Date.now() - maxAgeMs;
        let removedCount = 0;
        for (const directoryName of ["Logs", "logs"]) {
            let logsDir;
            try {
                logsDir = await rootDir.getDirectoryHandle(directoryName);
            } catch (err) {
                if (err.name === "NotFoundError") continue;
                throw err;
            }
            removedCount += await removeExpiredLogFiles(logsDir, cutoff);
        }
        return removedCount;
    }

    // maxAgeMs is a retention duration in milliseconds; older files are removed.
    function clearOPFSLogs(maxAgeMs = DEFAULT_LOG_MAX_AGE_MS) {
        if (!Number.isFinite(maxAgeMs) || maxAgeMs < 0) {
            return Promise.reject(new RangeError("Log retention age must be a non-negative number of milliseconds."));
        }

        const cleanupOperation = logWriteQueue.catch(() => {}).then(() => deleteExpiredLogFiles(maxAgeMs));
        logWriteQueue = cleanupOperation;
        return cleanupOperation;
    }

    async function writeLogToOPFS(logFilename, logContentString) {
        const writeOperation = logWriteQueue.catch(() => {}).then(async () => {
            if (!logContentString.trim()) return false;

            await deleteExpiredLogFiles(DEFAULT_LOG_MAX_AGE_MS);
            const rootDir = await navigator.storage.getDirectory();
            const logsDir = await rootDir.getDirectoryHandle("Logs", { create: true });
            const fileHandle = await logsDir.getFileHandle(logFilename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(logContentString);
            await writable.close();
            return true;
        });
        logWriteQueue = writeOperation;

        try {
            return await writeOperation;
        } catch (err) {
            console.error("💥 [Green Leader]: Error writing auto-log to OPFS:", err);
            return false;
        }
    }

    // Exponer la función de forma segura en el espacio global
    window.GreenLeaderStorage = window.GreenLeaderStorage || {};
    window.GreenLeaderStorage.writeLogToOPFS = writeLogToOPFS;
    window.GreenLeaderStorage.clearOPFSLogs = clearOPFSLogs;

    // Buffer de sesión y nombre de archivo único por instancia de carga
    const sessionTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const sessionLogFilename = `flight_deck_log_${sessionTimestamp}.txt`;
    const logBuffer = [];

    // Interceptor inteligente de la consola para respaldar la actividad en tiempo real
    const originalConsoleLog = console.log;
    const originalConsoleWarn = console.warn;
    const originalConsoleError = console.error;

    console.log = function(...args) {
        logBuffer.push(`[LOG] ${new Date().toISOString()}: ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`);
        originalConsoleLog.apply(console, args);
    };

    console.warn = function(...args) {
        logBuffer.push(`[WARN] ${new Date().toISOString()}: ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`);
        originalConsoleWarn.apply(console, args);
    };

    console.error = function(...args) {
        logBuffer.push(`[ERROR] ${new Date().toISOString()}: ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`);
        originalConsoleError.apply(console, args);
    };

    const flushLogBuffer = () => {
        if (logBuffer.length === 0) return Promise.resolve(true);
        return writeLogToOPFS(sessionLogFilename, logBuffer.join('\n'));
    };
    window.GreenLeaderStorage.flushLogs = flushLogBuffer;
    setInterval(() => { flushLogBuffer(); }, 2000);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flushLogBuffer();
    });
    flushLogBuffer();

    console.log("🟢 [Green Leader]: OPFS Auto-Logging subsystem successfully engaged and monitoring flight channels.");
})();

// --- 🔴 RED LEADER: COMMAND, ROUTER & LIFECYCLE MANAGEMENT ---

function registerGuidelinesServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw-guidelines.js')
        .then(() => console.log("🔴 [Red Leader]: Guidelines Service Worker registered successfully, standing by."))
        .catch(err => console.error("💥 [Red Leader Down]: Error registering Service Worker:", err));
    }
}
window.registerGuidelinesServiceWorker = registerGuidelinesServiceWorker;

async function red_leader(steps = [0, 1, 2, 3, 4]) {
    console.log("🔴 [Red Leader]: Red Leader, standing by. Flight path requested:", steps);
    try {
        if (steps.includes(0)) {
            console.log("🟡 [Gold Leader]: Engaging security sweep (SharePoint session verification)...");
            const sessionActive = await verifySharePointSession();
            if (!sessionActive) return false;
        }

        if (steps.includes(1)) {
            if (isOfflineMode()) return true;
            console.log("🟡 [Gold Leader]: Executing step 2 (Lite payload)...");
            if (window.LSEngine && typeof window.LSEngine.taskFetchMainDataLite === 'function') {
                await window.LSEngine.taskFetchMainDataLite();
            }
        }

        if (steps.includes(2)) {
            if (isOfflineMode()) return true;
            console.log("🔴 [Red Leader]: Commencing main trench run (fetching and processing core data)...");
            const success = await fetchAndProcessData(true);
            if (!success) throw new Error("Synchronization process failed.");

            console.log("🔴 [Red Leader]: Executing secondary file sync (Manifest & OPFS files)...");
            if (typeof window.LSEngine.taskSyncFiles === 'function') {
                await window.LSEngine.taskSyncFiles();
            }
        }

        if (steps.includes(3)) {
            console.log("🔵 [Blue Leader]: Lock S-foils in attack position (executing step 3)...");
            if (typeof initializeInteractiveMap === 'function') {
                initializeInteractiveMap();
            }
        }

        if (steps.includes(4)) {
            console.log("🔵 [Blue Leader]: Target area reached. Get out of there, you're clear!");
            if (typeof showAppEntryButton === 'function') {
                showAppEntryButton();
            }
        }
        return true;
    } catch (err) {
        console.error("💥 [Red Leader]: Mission error encountered:", err.message);
        return false;
    }
}
window.red_leader = red_leader;

function isOfflineMode() {
    return window.LSEngine?.offlineMode === true || sessionStorage.getItem("app_offline_mode") === "true";
}

async function ensureOnlineSession() {
    if (isOfflineMode()) return false;
    return verifySharePointSession();
}

async function fetchWithSession(url, options) {
    const response = await fetch(url, options);
    if (response.status !== 401 && response.status !== 403) return response;

    if (!await ensureOnlineSession()) return null;

    if (!options.signal) return fetch(url, options);

    const retryController = new AbortController();
    const retryTimeout = setTimeout(() => retryController.abort(), 60000);
    try {
        return await fetch(url, { ...options, signal: retryController.signal });
    } finally {
        clearTimeout(retryTimeout);
    }
}

async function checkAndSyncData() {
    if (isOfflineMode()) return;

    const splash = document.getElementById("sync-splash");
    const lastTimestamp = parseInt(localStorage.getItem("app_last_sync_timestamp") || "0", 10);
    const hasLocalPayload = localStorage.getItem("cache_payload");

    const ONE_HOUR_MS = 60 * 60 * 1000;
    const now = Date.now();

    const needsLoadingScreen = !lastTimestamp || (now - lastTimestamp >= ONE_HOUR_MS) || !hasLocalPayload;

    if (!needsLoadingScreen) {
        if (splash) splash.style.display = "none";
        window.dispatchEvent(new CustomEvent("PayloadReady"));
        return;
    }

    const sessionActive = await verifySharePointSession().catch(() => false);
    
    if (!sessionActive) {
        if (splash) splash.style.display = "none";
        const restored = await window.GreenLeaderStorage.restoreCacheFromOPFSToLocalStorage();
        if (restored || hasLocalPayload) {
            window.dispatchEvent(new CustomEvent("PayloadReady"));
        } else {
            updateProgress(100, "Connection Error & No Local Backup", "ERROR");
        }
        return;
    }

    try {
        const success = await fetchAndProcessData(true);
        if (!success) {
            await window.GreenLeaderStorage.restoreCacheFromOPFSToLocalStorage();
            if (splash) splash.style.display = "none";
            window.dispatchEvent(new CustomEvent("PayloadReady"));
        }
    } catch (error) {
        await window.GreenLeaderStorage.restoreCacheFromOPFSToLocalStorage();
        if (splash) splash.style.display = "none";
        window.dispatchEvent(new CustomEvent("PayloadReady"));
    }
}
window.red_leader.checkAndSyncData = checkAndSyncData;

// --- 🚨 TRIGGER MANUAL SYNC ---
window.triggerManualSync = async function() {
    console.log("🚨 [Red Leader]: Manual sync override initiated!");
    sessionStorage.removeItem("app_offline_mode");
    if (window.LSEngine) window.LSEngine.offlineMode = false;
    
    // 1. Back up ?data=... to OPFS before clearing everything
    await window.GreenLeaderStorage.backupParamDataToOPFS();
    
    // 2. Clear all local cache using the adjusted function
    window.GreenLeaderStorage.clearLocalDatasetsCache();

    // 3. Clean redirect with reload timestamp
    await new Promise(resolve => setTimeout(resolve, 900));
    await window.GreenLeaderStorage.flushLogs();
    const freshUrl = new URL(window.location.href);
    freshUrl.searchParams.set('reload_ts', Date.now());
    window.location.href = freshUrl.toString();
};


// --- 🔵 BLUE LEADER: UI, HUD TELEMETRY & MONITORING ---
function updateProgress(percent, message, state = "LOADING") {
    const bar = document.getElementById("bt-progress-bar");
    const textPercent = document.getElementById("bt-percentage");
    const statusText = document.getElementById("sync-status");
    const stateText = document.getElementById("bt-state-text");

    if (bar) bar.style.width = `${percent}%`;
    if (textPercent) textPercent.innerText = `${percent}%`;
    if (statusText && message) statusText.innerText = message;
    if (stateText) stateText.innerText = state;
}

function showSplash(splashElement) {
    if (!splashElement) return;
    console.log("🔵 [Blue Leader]: Raising deflector shields (showing splash screen)...");
    splashElement.classList.remove("is-hidden");
    splashElement.style.pointerEvents = "auto";
    splashElement.style.display = "flex";
    splashElement.style.opacity = "1";
}

function hideSplash(splashElement) {
    if (!splashElement) return;
    console.log("🔵 [Blue Leader]: Lowering shields, getting out of there!");
    splashElement.style.opacity = "0";
    splashElement.style.pointerEvents = "none";
    setTimeout(() => { 
        splashElement.style.display = "none"; 
        splashElement.classList.add("is-hidden");
        if (window.AppMap && typeof window.AppMap.invalidateSize === 'function') {
            window.AppMap.invalidateSize();
        }
    }, 400);
}

function getPowerAutomateUrl() {
    try {
        const params = new URLSearchParams(window.location.search);
        const encoded = params.get("data");
        return encoded ? atob(encoded) : null;
    } catch (err) {
        console.error("💥 [Blue Leader]: Invalid Power Automate URL", err);
        return null;
    }
}

window.LSEngine = window.LSEngine || {};
window.LSEngine.getPowerAutomateUrl = getPowerAutomateUrl;

function initAwaySyncMonitor() {
    let awayTimer = null;
    const AWAY_THRESHOLD_MS = 20 * 60 * 1000;
    const ONE_HOUR_MS = 60 * 60 * 1000;

    document.addEventListener('visibilitychange', async () => {
        if (document.hidden) {
            awayTimer = setTimeout(async () => {
                const lastTimestamp = parseInt(localStorage.getItem("app_last_sync_timestamp") || "0", 10);
                const elapsed = Date.now() - lastTimestamp;
                
                if (elapsed < ONE_HOUR_MS) return;

                const sessionActive = await checkSharePointLogo().catch(() => false);
                if (sessionActive) {
                    localStorage.setItem("pending_auto_sync", "true");
                }
            }, AWAY_THRESHOLD_MS);
            
        } else {
            if (awayTimer) {
                clearTimeout(awayTimer);
                awayTimer = null;
            }

            if (localStorage.getItem("pending_auto_sync") === "true") {
                localStorage.removeItem("pending_auto_sync");
                if (typeof window.triggerManualSync === 'function') {
                    window.triggerManualSync();
                }
            }
        }
    });
}
window.BlueLeaderMonitor = { initAwaySyncMonitor };


// --- 🟡 GOLD LEADER: SECURITY & AUTHENTICATION ---
function checkSharePointLogo() {
    console.log("🟡 [Gold Leader]: Scanning target signature (SharePoint logo check), standing by...");
    return new Promise((resolve) => {
        const logoUrl = "https://clinicasdelcaminoreal.sharepoint.com/sites/CDCROperationsHub/_api/siteiconmanager/getsitelogo?type=%271%27&hash=639204304455530335";
        const img = new Image();
        
        const timeout = setTimeout(() => {
            img.src = "";
            console.warn("🟡 [Gold Leader]: Target scan timed out.");
            resolve(false);
        }, 4000);

        img.onload = () => { clearTimeout(timeout); console.log("🟡 [Gold Leader]: Target acquired! Session active."); resolve(true); };
        img.onerror = () => { clearTimeout(timeout); console.warn("🟡 [Gold Leader]: Target visual lost."); resolve(false); };

        img.src = logoUrl + "&t=" + new Date().getTime();
    });
}

async function verifySharePointSession() {
    if (isOfflineMode()) {
        console.log("🔓 [Gold Leader]: Offline mode is active; skipping session verification.");
        return false;
    }

    console.log("🟡 [Gold Leader]: Checking SharePoint session...");
    let active = await checkSharePointLogo();
    if (active) return true;

    await new Promise(r => setTimeout(r, 800));
    active = await checkSharePointLogo();
    if (active) return true;

    console.warn("🟡 [Gold Leader]: Session expired. Triggering automatic login lock screen.");
    return triggerAutomaticLoginFlow();
}

let loginDecisionPromise = null;

function triggerAutomaticLoginFlow() {
    console.log("🟡 [Gold Leader]: Deploying authentication lock screen...");
    const splash = document.getElementById("sync-splash");
    if (splash) splash.style.display = "none";

    if (loginDecisionPromise) return loginDecisionPromise;

    loginDecisionPromise = new Promise(resolve => {
        let isResolved = false;
        let sessionPollInterval;
        let loginWindow = null;
        const completeLoginDecision = isOnline => {
            if (isResolved) return;
            isResolved = true;
            clearInterval(sessionPollInterval);
            try { if (loginWindow && !loginWindow.closed) loginWindow.close(); } catch (e) {}
            document.getElementById("sp-lock-screen")?.remove();
            loginDecisionPromise = null;
            resolve(isOnline);
        };

        const lockScreen = document.createElement("div");
        lockScreen.id = "sp-lock-screen";
        lockScreen.className = "loading-auth-overlay";
    
        const sharePointSiteUrl = "https://clinicasdelcaminoreal.sharepoint.com/sites/CDCROperationsHub";

        lockScreen.innerHTML = `
        <div class="loading-auth-card">
            <h2 class="loading-auth-title">Sign-In Required / Offline</h2>
            <p id="lock-status-text" class="loading-auth-status">
                Your corporate session could not be verified automatically. Authenticate via popup or continue in offline mode using local OPFS backups.
            </p>
            <div class="loading-auth-waiting">
                <div class="loading-auth-spinner"></div>
                Waiting for authentication...
            </div>
            
            <button id="btn-offline-mode" class="loading-auth-offline-button">
                🔓 Continue in Offline Mode (Use OPFS Cache)
            </button>
            <button id="btn-reopen-popup" class="loading-auth-popup-button">
                Reopen Login Window
            </button>
        </div>
        `;
    
        document.body.appendChild(lockScreen);

        const openPopup = () => {
            console.log("🟡 [Gold Leader]: Opening authentication window in a normal browser session...");
        
            // Al NO pasar dimensiones (width, height, etc.), Chrome en modo --app
            // abre el enlace en una ventana normal del navegador, usando el perfil
            // principal y evitando el aislamiento de cookies.
            loginWindow = window.open(sharePointSiteUrl, "_blank");

            if (!loginWindow || loginWindow.closed || typeof loginWindow.closed == 'undefined') {
                console.warn("🟡 [Gold Leader]: Popup blocked or restricted by browser settings.");
            }
        };

        openPopup();
    
        document.getElementById("btn-reopen-popup").addEventListener("click", () => {
            if (!loginWindow || loginWindow.closed) openPopup();
        });

        document.getElementById("btn-offline-mode").addEventListener("click", async () => {
            console.log("🔓 [Gold Leader]: User selected offline mode; skipping all remote synchronization.");
            sessionStorage.setItem("app_offline_mode", "true");
            window.LSEngine = window.LSEngine || {};
            window.LSEngine.offlineMode = true;
            clearInterval(sessionPollInterval);
            try { if (loginWindow && !loginWindow.closed) loginWindow.close(); } catch (e) {}
        
            const restored = await window.GreenLeaderStorage.restoreOfflineData();
            if (!restored) {
                console.warn("⚠️ [Gold Leader]: No cached payload was found. Continuing offline without downloaded data.");
            }
            window.dispatchEvent(new CustomEvent("PayloadReady"));
            completeLoginDecision(false);
        });

        sessionPollInterval = setInterval(async () => {
            if (isResolved || isOfflineMode()) return;
            const sessionActive = await checkSharePointLogo();
            if (sessionActive && !isResolved && !isOfflineMode()) {
                console.log("🟡 [Gold Leader]: Session detected. Closing popup and continuing...");
                completeLoginDecision(true);
            }
        }, 2000);
    });

    return loginDecisionPromise;
}


// --- 🟢 GREEN LEADER: OPFS & STORAGE ENGINEERING ---
window.GreenLeaderStorage.clearLocalDatasetsCache = function() {
    console.log("🟢 [Green Leader]: Purging all localStorage cache via clear()...");
    localStorage.clear();
};

window.GreenLeaderStorage.backupParamDataToOPFS = async function() {
    const rawDataParam = new URLSearchParams(window.location.search).get("data");
    if (rawDataParam) {
        const rootDir = await navigator.storage.getDirectory();
        const dataDir = await rootDir.getDirectoryHandle("App_Data", { create: true });
        const fileHandle = await dataDir.getFileHandle("param_data.txt", { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(rawDataParam);
        await writable.close();
        console.log("🟢 [Green Leader]: Parameter ?data=... successfully backed up to OPFS.");
    }
};

window.GreenLeaderStorage.writeDatasetToOPFS = async function(filename, contentString) {
    console.log("🟢 [Green Leader]: Stowing cargo safely into OPFS bay:", filename);
    const rootDir = await navigator.storage.getDirectory();
    const dataDir = await rootDir.getDirectoryHandle("App_Data", { create: true });
    
    const fileHandle = await dataDir.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(contentString);
    await writable.close();
};

window.GreenLeaderStorage.restoreCacheFromOPFSToLocalStorage = async function(filename = "cache_payload.json") {
    try {
        console.log(`🟢 [Green Leader]: 📂 Reading and mapping dynamically from OPFS using file: (${filename})...`);
        
        const rootDir = await navigator.storage.getDirectory();
        const dataDir = await rootDir.getDirectoryHandle("App_Data", { create: true });
        
        const fileHandle = await dataDir.getFileHandle(filename);
        const file = await fileHandle.getFile();
        const content = await file.text();

        if (!content) {
            console.warn(`⚠️ [Green Leader]: OPFS file '${filename}' is empty.`);
            return false;
        }

        const parsedData = JSON.parse(content);
        const storageKey = filename.includes("lite") ? "lite_payload_cache" : "cache_payload";
        
        localStorage.setItem(storageKey, content);
        if (filename === "cache_payload.json") {
            localStorage.setItem("cache_payload", content);
        }

        window.LSEngine = window.LSEngine || {};
        window.LSEngine.state = window.LSEngine.state || {};
        
        for (const [sectionKey, sectionData] of Object.entries(parsedData)) {
            const globalPropName = `global${sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1)}`;
            window.LSEngine.state[globalPropName] = sectionData;
            
            if (Array.isArray(sectionData)) {
                localStorage.setItem(`csv_${sectionKey}`, JSON.stringify(sectionData));
                console.log(`📊 [Green Leader Dynamic]: Section detected in '${filename}' -> Generated cache 'csv_${sectionKey}' (${sectionData.length} records).`);
            } else {
                console.log(`⚙️ [Green Leader Dynamic]: Object/config property '${sectionKey}' mapped from '${filename}'.`);
            }
        }

        console.log(`✅ [Green Leader]: Dynamic synchronization and mapping completed successfully for '${filename}'.`);
        return true;

    } catch (err) {
        console.warn(`⚠️ [Green Leader]: Could not find or process file '${filename}' in OPFS:`, err);
    }
    return false;
};

window.GreenLeaderStorage.restoreOfflineData = async function() {
    let restored = await window.GreenLeaderStorage.restoreCacheFromOPFSToLocalStorage("lite_payload.json");
    if (!restored) restored = await window.GreenLeaderStorage.restoreCacheFromOPFSToLocalStorage("cache_payload.json");
    if (restored) return true;

    for (const storageKey of ["lite_payload_cache", "cache_payload"]) {
        const content = localStorage.getItem(storageKey);
        if (!content) continue;

        try {
            const parsedData = JSON.parse(content);
            if (!parsedData || typeof parsedData !== "object") continue;

            window.LSEngine = window.LSEngine || {};
            window.LSEngine.state = window.LSEngine.state || {};
            for (const [sectionKey, sectionData] of Object.entries(parsedData)) {
                const globalPropName = `global${sectionKey.charAt(0).toUpperCase()}${sectionKey.slice(1)}`;
                window.LSEngine.state[globalPropName] = sectionData;
                if (Array.isArray(sectionData)) {
                    localStorage.setItem(`csv_${sectionKey}`, JSON.stringify(sectionData));
                }
            }
            return true;
        } catch (err) {
            console.warn(`⚠️ [Green Leader]: Ignoring invalid local offline cache '${storageKey}':`, err);
        }
    }

    return false;
};

window.LSEngine = window.LSEngine || {};
window.LSEngine.state = window.LSEngine.state || {};

// --- CORE LITE REQUEST ---
window.LSEngine.taskFetchMainDataLite = async function(overrideUrl = null, targetFilename = "lite_payload.json") {
    if (isOfflineMode()) {
        await window.GreenLeaderStorage.restoreOfflineData();
        return;
    }

    let baseUrl = overrideUrl || getPowerAutomateUrl();
    
    if (!baseUrl) {
        console.log(`📂 [LSEngine] No URL provided. Attempting offline fallback from OPFS using '${targetFilename}'...`);
        const restored = await window.GreenLeaderStorage.restoreCacheFromOPFSToLocalStorage(targetFilename);
        if (!restored && targetFilename !== "cache_payload.json") {
            console.log("🔄 Attempting emergency fallback with 'cache_payload.json'...");
            await window.GreenLeaderStorage.restoreCacheFromOPFSToLocalStorage("cache_payload.json");
        }
        return;
    }

    if (!await ensureOnlineSession()) return;
    
    const cacheBusterToken = `_cb=${Date.now()}`;
    console.log("⚡ [Cache Busting] Applied to Lite Payload:", cacheBusterToken);
    const separator = baseUrl.includes('?') ? '&' : '?';
    const finalEndpointUrl = `${baseUrl}${separator}${cacheBusterToken}`;

    if (typeof updateProgress === 'function') {
        updateProgress(30, "Downloading system data...", "FETCHING");
    }

    const response = await fetchWithSession(finalEndpointUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ action: "load" })
    });

    if (!response) return;
    if (!response.ok) throw new Error(`Data fetch error (HTTP ${response.status})`);

    const payload = await response.json();
    const payloadString = JSON.stringify(payload);
    
    await window.GreenLeaderStorage.writeDatasetToOPFS(targetFilename, payloadString);
    
    window.LSEngine.state.globalClinics = payload.clinics || [];
    window.LSEngine.state.globalExtensions = payload.extensions || [];
    window.LSEngine.state.globalClinicLookup = payload.clinicLookup || [];

    return payload;
};


// --- MAIN FETCH ENGINE ---
async function fetchAndProcessData(isManual = false) {
    if (isOfflineMode()) {
        console.log("🔓 [Red Leader]: Skipping data request because offline mode is active.");
        return false;
    }

    const splash = document.getElementById("sync-splash");
    if (isManual) showSplash(splash);
    
    console.log("🔴 [Red Leader]: Preparing telemetry payload request to command base...");
    
    try {
        updateProgress(20, "Loading core application records from cloud...", "CONNECTING");
        
        let baseUrl = getPowerAutomateUrl();
        if (!baseUrl) {
            console.warn("💥 [Red Leader Down]: Power Automate URL telemetry link not found in query parameters.");
            hideSplash(splash);
            return false;
        }

        if (!await ensureOnlineSession()) return false;

        try {
            await window.GreenLeaderStorage.clearOPFSLogs();
        } catch (err) {
            console.error("💥 [Green Leader]: Could not clear previous OPFS logs before synchronization:", err);
        }
        
        const csvController = new AbortController();
        const TIMEOUT_LIMIT_MS = 60000; 
        const csvTimeout = setTimeout(() => {
            console.warn(`⏱️ [Red Leader]: Transmission timeout reached (${TIMEOUT_LIMIT_MS / 1000}s). Aborting trench run connection...`);
            csvController.abort();
        }, TIMEOUT_LIMIT_MS);

        console.log("⚡ [Red Leader]: Transmitting HTTP POST request for core dataset payload...");
        
        let csvResponse;
        try {
            csvResponse = await fetchWithSession(baseUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}), 
                signal: csvController.signal
            });
        } catch (fetchErr) {
            clearTimeout(csvTimeout);
            if (fetchErr.name === 'AbortError') {
                console.error("💥 [Red Leader Abort]: Trench run aborted. The server took too long to respond or the signal was cancelled.");
                throw new Error("Synchronization timeout: Server response took too long.");
            } else {
                console.error("💥 [Red Leader Network Error]: Connection dropped during data retrieval:", fetchErr);
                throw fetchErr;
            }
        }
        
        clearTimeout(csvTimeout);

        if (!csvResponse) return false;
        if (!csvResponse.ok) {
            console.error(`💥 [Red Leader Error]: Server rejected payload transmission. HTTP Status: ${csvResponse.status} ${csvResponse.statusText}`);
            throw new Error(`Data fetch error (HTTP ${csvResponse.status})`);
        }

        console.log("🟢 [Green Leader]: Payload transmission received successfully. Processing and writing to OPFS cargo bays...");
        const csvPayload = await csvResponse.json();
        const payloadString = JSON.stringify(csvPayload);

        await window.GreenLeaderStorage.writeDatasetToOPFS("cache_payload.json", payloadString);
        await window.GreenLeaderStorage.writeDatasetToOPFS("lite_payload.json", payloadString);

        localStorage.setItem("app_data_version", new Date().toISOString().split("T")[0]);
        localStorage.setItem("app_last_sync_date", new Date().toISOString().split("T")[0]);
        localStorage.setItem("app_last_sync_timestamp", Date.now().toString());

        console.log("✅ [Red Leader]: Trench run successful! Core datasets safely stored locally.");
        updateProgress(100, "Ready!", "READY");

        setTimeout(() => {
            hideSplash(splash);
            window.dispatchEvent(new CustomEvent("PayloadReady"));
        }, 300);

        return true;

    } catch (error) {
        console.error("💥 [Red Leader Mission Failure]: Critical error in fetchAndProcessData:", error.message || error);
        updateProgress(100, error.message || "Synchronization Error", "ERROR");
        setTimeout(() => hideSplash(splash), 1500);
        return false;
    }
}


window.GreenLeaderStorage.getSyncedAssetPath = function(item) {
    let rawPath = item.path || "";
    if (rawPath.endsWith("/") && item.name) {
        rawPath += item.name;
    } else if (!rawPath.endsWith("/") && !rawPath.endsWith(item.name)) {
        rawPath = rawPath + "/" + item.name;
    }
    return rawPath.replace(/([^:]\/)\/+/g, "$1");
};

window.GreenLeaderStorage.removeStaleSyncedFiles = async function(directoryHandle, expectedFiles, parentPath = "") {
    const entries = [];
    for await (const [entryName, entryHandle] of directoryHandle.entries()) {
        entries.push([entryName, entryHandle]);
    }

    let removedCount = 0;
    for (const [entryName, entryHandle] of entries) {
        const relativePath = parentPath ? `${parentPath}/${entryName}` : entryName;
        if (entryHandle.kind === "directory") {
            removedCount += await window.GreenLeaderStorage.removeStaleSyncedFiles(entryHandle, expectedFiles, relativePath);
        } else if (!expectedFiles.has(relativePath)) {
            await directoryHandle.removeEntry(entryName);
            removedCount++;
        }
    }
    return removedCount;
};

window.GreenLeaderStorage.reconcileSyncedAssetDirectory = async function(rootDir, directoryName, expectedFiles) {
    let directoryHandle;
    try {
        directoryHandle = await rootDir.getDirectoryHandle(directoryName);
    } catch (err) {
        if (err.name === "NotFoundError") return 0;
        throw err;
    }
    return window.GreenLeaderStorage.removeStaleSyncedFiles(directoryHandle, expectedFiles);
};

window.GreenLeaderStorage.loadSyncedAssetInventory = async function(rootDir) {
    try {
        const appDataDir = await rootDir.getDirectoryHandle("App_Data");
        const inventoryHandle = await appDataDir.getFileHandle("asset_sync_inventory.json");
        const inventory = JSON.parse(await (await inventoryHandle.getFile()).text());
        if (!Array.isArray(inventory.Guidelines_Info) || !Array.isArray(inventory.Directory)) {
            throw new Error("Asset sync inventory has an invalid format.");
        }
        return {
            Guidelines_Info: new Set(inventory.Guidelines_Info),
            Directory: new Set(inventory.Directory)
        };
    } catch (err) {
        if (err.name !== "NotFoundError") {
            console.warn("⚠️ [OPFS Sync]: Could not read the cached asset inventory; rebuilding it after this sync.", err);
        }
        return null;
    }
};

window.GreenLeaderStorage.saveSyncedAssetInventory = async function(rootDir, inventory) {
    const appDataDir = await rootDir.getDirectoryHandle("App_Data", { create: true });
    const inventoryHandle = await appDataDir.getFileHandle("asset_sync_inventory.json", { create: true });
    const writable = await inventoryHandle.createWritable();
    await writable.write(JSON.stringify({
        Guidelines_Info: [...inventory.get("Guidelines_Info")],
        Directory: [...inventory.get("Directory")]
    }));
    await writable.close();
};

window.GreenLeaderStorage.removeTrackedAsset = async function(rootDir, directoryName, relativePath) {
    const pathParts = relativePath.split("/");
    if (pathParts.length === 0 || pathParts.some(part => !part || part === "." || part === "..")) {
        throw new Error(`Invalid tracked asset path '${relativePath}'.`);
    };

    let currentDir;
    try {
        currentDir = await rootDir.getDirectoryHandle(directoryName);
        for (const folderName of pathParts.slice(0, -1)) {
            currentDir = await currentDir.getDirectoryHandle(folderName);
        }
        await currentDir.removeEntry(pathParts[pathParts.length - 1]);
        return true;
    } catch (err) {
        if (err.name === "NotFoundError") return false;
        throw err;
    }
}

// --- SECONDARY SYNC TASK ---
window.LSEngine.taskSyncFiles = async function(overrideUrl = null) {
    if (isOfflineMode()) {
        console.log("🔓 [Green Leader]: Skipping manifest and asset sync because offline mode is active.");
        return;
    }

    let baseUrl = overrideUrl || window.LSEngine.getPowerAutomateUrl();
    if (!baseUrl) return;

    try {
        if (!await ensureOnlineSession()) return;

        const rootDir = await navigator.storage.getDirectory();
        
        const cacheBusterToken = `_cb=${Date.now()}`;
        const separator = baseUrl.includes('?') ? '&' : '?';
        const manifestUrl = `${baseUrl}${separator}${cacheBusterToken}`;

        if (typeof window.LSEngine.setProgress === 'function') {
            window.LSEngine.setProgress(50, "Fetching manifest for background assets...", "SYNCING");
        }

        const previousInventory = await window.GreenLeaderStorage.loadSyncedAssetInventory(rootDir);
        const response = await fetchWithSession(manifestUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({ action: "READ_MANIFEST" })
        });

        if (!response) return;
        if (!response.ok) return;

        const payload = await response.json();
        if (!Array.isArray(payload.guidelines) || !Array.isArray(payload.directory)) {
            console.warn("⚠️ [OPFS Sync]: Manifest is missing its guidelines or directory file list; leaving local files unchanged.");
            return;
        }

        const allItems = [
            ...(payload.guidelines || []),
            ...(payload.directory || [])
        ];

        const fileItems = allItems.filter(item => {
            const type = (item.type || "").toLowerCase();
            return type !== "directory" && type !== "folder" && item.name;
        });

        const totalFiles = fileItems.length;
        let processedCount = 0;
        let syncFailed = false;
        const expectedFilesByDirectory = new Map([
            ["Guidelines_Info", new Set()],
            ["Directory", new Set()]
        ]);

        for (const item of fileItems) {
            if (!await ensureOnlineSession()) return;

            processedCount++;
            const progressPercent = Math.min(50 + Math.floor((processedCount / totalFiles) * 45), 95);

            try {
                const cleanFilePath = window.GreenLeaderStorage.getSyncedAssetPath(item);

                const targetBaseDir = cleanFilePath.includes("Guidelines_Info") 
                    ? await rootDir.getDirectoryHandle("Guidelines_Info", { create: true })
                    : rootDir;

                let relativeSubFolder = "";
                if (cleanFilePath.includes("Guidelines_Info/")) {
                    const parts = cleanFilePath.split("Guidelines_Info/")[1].split("/");
                    if (parts.length > 1) relativeSubFolder = parts[0];
                } else if (cleanFilePath.includes("Directory/")) {
                    relativeSubFolder = "Directory";
                }

                let managedDirectory = null;
                let expectedRelativePath = item.name;
                if (cleanFilePath.includes("Guidelines_Info")) {
                    managedDirectory = "Guidelines_Info";
                    if (relativeSubFolder) expectedRelativePath = `${relativeSubFolder}/${item.name}`;
                } else if (cleanFilePath.includes("Directory/")) {
                    managedDirectory = "Directory";
                }
                if (managedDirectory) {
                    expectedFilesByDirectory.get(managedDirectory).add(expectedRelativePath);
                }

                let currentDirHandle = targetBaseDir;
                if (relativeSubFolder) {
                    currentDirHandle = await targetBaseDir.getDirectoryHandle(relativeSubFolder, { create: true });
                }

                const fileHandle = await currentDirHandle.getFileHandle(item.name, { create: true });

                try {
                    const existingFile = await fileHandle.getFile();
                    
                    const serverLastModified = item.lastModified ? new Date(item.lastModified).getTime() : 0;
                    const localLastModified = existingFile.lastModified || 0;

                    console.log(`🔎 [OPFS Eval] Evaluating: "${item.name}"`, {
                        serverDate: new Date(serverLastModified).toISOString(),
                        localDate: new Date(localLastModified).toISOString(),
                        isServerOlderOrEqual: serverLastModified <= localLastModified
                    });

                    if (
                        existingFile.size > 0 && 
                        serverLastModified <= localLastModified
                    ) {
                        console.log(`[OPFS] ⏭️ Skipping download (unchanged & up-to-date): ${item.name}`);
                        if (typeof window.LSEngine.setProgress === 'function') {
                            window.LSEngine.setProgress(progressPercent, `Verifying asset (${processedCount}/${totalFiles}): ${item.name}`, "SYNCING");
                        }
                        continue; 
                    } else {
                        console.log(`[OPFS] 📥 Downloading required for: ${item.name} (Newer version detected on SharePoint).`);
                    }
                } catch (e) {
                    console.log(`[OPFS] ⚠️ File does not exist locally yet for: ${item.name}`);
                }

                if (typeof window.LSEngine.setProgress === 'function') {
                    window.LSEngine.setProgress(progressPercent, `Downloading asset (${processedCount}/${totalFiles}): ${item.name}`, "DOWNLOADING");
                }

                const downloadRes = await fetchWithSession(baseUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    cache: "no-store",
                    body: JSON.stringify({ action: "DOWNLOAD_FILE", filePath: cleanFilePath })
                });

                if (!downloadRes) return;
                if (!downloadRes.ok) throw new Error(`Asset download failed (HTTP ${downloadRes.status})`);
                const fileContent = await downloadRes.text();
                const writable = await fileHandle.createWritable();
                await writable.write(fileContent);
                await writable.close();
                console.log(`[OPFS] ✅ Updated/Downloaded new: ${item.name}`);
            } catch (fileErr) {
                syncFailed = true;
                console.warn(`Error processing individual file:`, fileErr);
            }
        }

        if (syncFailed) {
            console.warn("⚠️ [OPFS Sync]: At least one manifest file failed; skipping stale-file cleanup to avoid deleting valid local copies.");
        } else {
            for (const [directoryName, expectedFiles] of expectedFilesByDirectory) {
                let removedCount = 0;
                if (previousInventory) {
                    const previousFiles = previousInventory[directoryName];
                    for (const stalePath of previousFiles) {
                        if (!expectedFiles.has(stalePath)) {
                            if (await window.GreenLeaderStorage.removeTrackedAsset(rootDir, directoryName, stalePath)) removedCount++;
                        }
                    }
                } else {
                    removedCount = await window.GreenLeaderStorage.reconcileSyncedAssetDirectory(rootDir, directoryName, expectedFiles);
                }
                console.log(`🧹 [OPFS Sync]: Removed ${removedCount} stale file(s) from ${directoryName}.`);
            }
            await window.GreenLeaderStorage.saveSyncedAssetInventory(rootDir, expectedFilesByDirectory);
        }

        if (typeof window.LSEngine.setProgress === 'function') {
            window.LSEngine.setProgress(100, "Background synchronization complete!", "READY");
        }

    } catch (err) {
        console.warn("⚠️ Error in secondary file synchronization (OPFS):", err);
        if (typeof window.LSEngine.setProgress === 'function') {
            window.LSEngine.setProgress(100, "Sync completed with warnings", "WARNING");
        }
    }
};


// --- LSENGINE SET PROGRESS & REDIRECT CONTROLLER ---
window.LSEngine = window.LSEngine || {};

window.LSEngine.setProgress = function(percent, message, stateText) {
    const progressBar = document.getElementById('bt-progress-bar');
    const percentageText = document.getElementById('bt-percentage');
    const statusText = document.getElementById('sync-status');
    const stateBadge = document.getElementById('bt-state-text');

    if (progressBar) {
        progressBar.style.width = `${percent}%`;
    }
    if (percentageText) {
        percentageText.textContent = `${percent}%`;
    }
    if (statusText && message) {
        statusText.textContent = message;
    }
    if (stateBadge && stateText) {
        stateBadge.textContent = stateText;
        
        if (stateText === 'ERROR' || stateText === 'WARNING') {
            stateBadge.style.color = '#ef4444';
        } else if (stateText === 'READY') {
            stateBadge.style.color = '#22c55e';
        } else {
            stateBadge.style.color = '#38bdf8';
        }
    }

    const todayStr = new Date().toISOString().split("T")[0];
    localStorage.setItem("app_last_sync_date", todayStr);
    localStorage.setItem("app_last_sync_timestamp", Date.now().toString());

    if (!localStorage.getItem("lite_payload_cache")) {
        localStorage.setItem("lite_payload_cache", "synced_via_opfs");
    }

    if (stateText === "READY" && percent === 100) {
        console.log("🚀 [Sync]: Synchronization completed 100%. Redirecting cleanly...");
        const currentSearchParams = window.location.search;
        
        let basePath = window.location.pathname;
        
        if (basePath.endsWith('.html')) {
            basePath = basePath.substring(0, basePath.lastIndexOf('/') + 1);
        } else if (!basePath.endsWith('/')) {
            basePath += '/';
        }

        setTimeout(() => {
            window.GreenLeaderStorage.flushLogs().finally(() => {
                window.location.replace(basePath + currentSearchParams);
            });
        }, 500);
    }
};