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


// --- 🔴 RED LEADER: COMMAND & ROUTER ---
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw-guidelines.js')
    .then(() => console.log("🔴 [Red Leader]: Guidelines Service Worker registered successfully, standing by."))
    .catch(err => console.error("💥 [Red Leader Down]: Error registering Service Worker:", err));
}

// Menú / Enrutador maestro estilo Escuadrón Rojo
async function red_leader(steps = [0, 1, 2, 3, 4]) {
    console.log("🔴 [Red Leader]: Red Leader, standing by. Flight path requested:", steps);
    try {
        if (steps.includes(0)) {
            console.log("🟡 [Gold Leader]: Engaging security sweep (SharePoint session verification)...");
            const sessionActive = await verifySharePointSession();
            if (!sessionActive) throw new Error("Security breach: Session expired.");
        }

        if (steps.includes(1)) {
            console.log("🟡 [Gold Leader]: Executing step 2 (Lite payload)...");
            if (typeof taskFetchLitePayload === 'function') {
                await taskFetchLitePayload();
            }
        }

        if (steps.includes(2)) {
            console.log("🔴 [Red Leader]: Commencing main trench run (fetching and processing core data)...");
            const success = await fetchAndProcessData(true);
            if (!success) throw new Error("Synchronization process failed.");

            console.log("🔴 [Red Leader]: Executing secondary file sync (Manifest & OPFS files)...");
            if (typeof window.LSEngine.taskSyncFiles === 'function') {
                await window.LSEngine.taskSyncFiles();
            } else if (typeof taskSyncFiles === 'function') {
                await taskSyncFiles();
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
    } catch (err) {
        console.error("💥 [Red Leader]: Mission error encountered:", err.message);
    }
}
window.red_leader = red_leader;


// --- 🔵 BLUE LEADER: UI & HUD TELEMETRY ---
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
    console.log("🟡 [Gold Leader]: Checking SharePoint session...");
    let active = await checkSharePointLogo();
    if (active) return true;

    await new Promise(r => setTimeout(r, 800));
    active = await checkSharePointLogo();
    if (active) return true;

    console.warn("🟡 [Gold Leader]: Session expired. Triggering automatic login lock screen.");
    triggerAutomaticLoginFlow();
    return false;
}

function triggerAutomaticLoginFlow() {
    console.log("🟡 [Gold Leader]: Deploying authentication lock screen...");
    const splash = document.getElementById("sync-splash");
    if (splash) splash.style.display = "none";

    if (document.getElementById("sp-lock-screen")) return;

    const lockScreen = document.createElement("div");
    lockScreen.id = "sp-lock-screen";
    lockScreen.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(15, 23, 42, 0.98); z-index: 999999;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        color: white; font-family: system-ui, sans-serif; text-align: center; padding: 20px;
    `;
    
    const sharePointSiteUrl = "https://clinicasdelcaminoreal.sharepoint.com/sites/CDCROperationsHub";

    lockScreen.innerHTML = `
        <div style="max-width: 440px; background: #1e293b; padding: 35px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid #334155;">
            <h2 style="margin-top: 0; color: #f87171; font-size: 22px;">Sign-In Required / Offline</h2>
            <p id="lock-status-text" style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
                Your corporate session could not be verified automatically. Authenticate via popup or continue in offline mode using local OPFS backups.
            </p>
            <div style="display: flex; align-items: center; justify-content: center; gap: 10px; color: #38bdf8; font-size: 13px; font-weight: 500; margin-bottom: 20px;">
                <div style="width: 14px; height: 14px; border: 2px solid #38bdf8; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                Waiting for authentication...
            </div>
            
            <button id="btn-offline-mode" style="background: #0284c7; color: white; border: none; padding: 10px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; width: 100%; margin-bottom: 10px;">
                🔓 Continue in Offline Mode (Use OPFS Cache)
            </button>
            <button id="btn-reopen-popup" style="background: #334155; color: #cbd5e1; border: none; padding: 8px 14px; border-radius: 6px; font-size: 12px; cursor: pointer; width: 100%;">
                Reopen Login Window
            </button>
        </div>
        <style> @keyframes spin { to { transform: rotate(360deg); } } </style>
    `;
    
    document.body.appendChild(lockScreen);

    let loginWindow = null;
    const openPopup = () => {
        console.log("🟡 [Gold Leader]: Opening authentication popup window...");
        const width = 600, height = 700;
        const left = (window.screen.width / 2) - (width / 2);
        const top = (window.screen.height / 2) - (height / 2);
        loginWindow = window.open(sharePointSiteUrl, "SharePointLoginPopup", `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`);
    };

    openPopup();
    
    document.getElementById("btn-reopen-popup").addEventListener("click", () => {
        if (!loginWindow || loginWindow.closed) openPopup();
    });

    document.getElementById("btn-offline-mode").addEventListener("click", async () => {
        console.log("🔓 [Gold Leader]: User requested offline mode bypass. Getting out of lock screen!");
        try { if (loginWindow && !loginWindow.closed) loginWindow.close(); } catch (e) {}
        lockScreen.remove();
        
        const restored = await restoreCacheFromOPFSToLocalStorage();
        if (restored || localStorage.getItem("cache_payload")) {
            console.log("✅ [Gold Leader]: Offline mode engaged successfully.");
            window.dispatchEvent(new CustomEvent("PayloadReady"));
        } else {
            alert("No local OPFS backup found. Internet connection and authentication are required for the first run.");
            triggerAutomaticLoginFlow();
        }
    });

    const sessionPollInterval = setInterval(async () => {
        if (await checkSharePointLogo()) {
            console.log("🟡 [Gold Leader]: Session detected. Closing popup and continuing...");
            clearInterval(sessionPollInterval);
            try { if (loginWindow && !loginWindow.closed) loginWindow.close(); } catch (e) {}
            lockScreen.remove();
            checkAndSyncData();
        }
    }, 2000);
}


// --- 🟢 GREEN LEADER: OPFS & STORAGE ENGINEERING ---
function clearLocalDatasetsCache() {
    console.log("🟢 [Green Leader]: Purgando exclusivamente los datasets de caché en localStorage...");
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("csv_") || key === "cache_payload")) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
}

async function writeDatasetToOPFS(filename, contentString) {
    console.log("🟢 [Green Leader]: Stowing cargo safely into OPFS bay:", filename);
    const rootDir = await navigator.storage.getDirectory();
    const dataDir = await rootDir.getDirectoryHandle("App_Data", { create: true });
    
    const fileHandle = await dataDir.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(contentString);
    await writable.close();
}

async function restoreCacheFromOPFSToLocalStorage(filename = "cache_payload.json") {
    try {
        console.log(`🟢 [Green Leader]: 📂 Leyendo y mapeando dinámicamente desde OPFS usando el archivo: (${filename})...`);
        
        const rootDir = await navigator.storage.getDirectory();
        const dataDir = await rootDir.getDirectoryHandle("App_Data", { create: true });
        
        const fileHandle = await dataDir.getFileHandle(filename);
        const file = await fileHandle.getFile();
        const content = await file.text();

        if (!content) {
            console.warn(`⚠️ [Green Leader]: El archivo en OPFS '${filename}' está vacío.`);
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
                console.log(`📊 [Green Leader Dinámico]: Sección detectada en '${filename}' -> Generado caché 'csv_${sectionKey}' (${sectionData.length} registros).`);
            } else {
                console.log(`⚙️ [Green Leader Dinámico]: Propiedad de objeto/configuración '${sectionKey}' mapeada desde '${filename}'.`);
            }
        }

        console.log(`✅ [Green Leader]: Sincronización y mapeo dinámico completado con éxito para '${filename}'.`);
        return true;

    } catch (err) {
        console.warn(`⚠️ [Green Leader]: No se pudo encontrar o procesar el archivo '${filename}' en OPFS:`, err);
    }
    return false;
}

window.LSEngine = window.LSEngine || {};
window.LSEngine.state = window.LSEngine.state || {};

// --- CORE LITE REQUEST ---
window.LSEngine.taskFetchMainDataLite = async function(overrideUrl = null, targetFilename = "lite_payload.json") {
    let baseUrl = overrideUrl || getPowerAutomateUrl();
    
    if (!baseUrl) {
        console.log(`📂 [LSEngine] No URL provided. Attempting offline fallback from OPFS using '${targetFilename}'...`);
        const restored = await restoreCacheFromOPFSToLocalStorage(targetFilename);
        if (!restored && targetFilename !== "cache_payload.json") {
            console.log("🔄 Intentando respaldo de emergencia con 'cache_payload.json'...");
            await restoreCacheFromOPFSToLocalStorage("cache_payload.json");
        }
        return;
    }
    
    const cacheBusterToken = `_cb=${Date.now()}`;
    console.log("⚡ [Cache Busting] Aplicado a Lite Payload:", cacheBusterToken);
    const separator = baseUrl.includes('?') ? '&' : '?';
    const finalEndpointUrl = `${baseUrl}${separator}${cacheBusterToken}`;

    if (typeof updateProgress === 'function') {
        updateProgress(30, "Downloading system data...", "FETCHING");
    }

    const response = await fetch(finalEndpointUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ action: "load" })
    });

    if (!response.ok) throw new Error(`Data fetch error (HTTP ${response.status})`);

    const payload = await response.json();
    const payloadString = JSON.stringify(payload);
    
    await writeDatasetToOPFS(targetFilename, payloadString);
    
    window.LSEngine.state.globalClinics = payload.clinics || [];
    window.LSEngine.state.globalExtensions = payload.extensions || [];
    window.LSEngine.state.globalClinicLookup = payload.clinicLookup || [];

    return payload;
};


// --- MAIN FETCH ENGINE (ACTUALIZADO CON LOGS Y CONTROL DE ABORT / TIMEOUT) ---
async function fetchAndProcessData(isManual = false) {
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
        
        const csvController = new AbortController();
        // Aumentamos el tiempo de espera a 60 segundos por la cantidad masiva de datos (ej. 256 NPIs, etc.)
        const TIMEOUT_LIMIT_MS = 60000; 
        const csvTimeout = setTimeout(() => {
            console.warn(`⏱️ [Red Leader]: Transmission timeout reached (${TIMEOUT_LIMIT_MS / 1000}s). Aborting trench run connection...`);
            csvController.abort();
        }, TIMEOUT_LIMIT_MS);

        console.log("⚡ [Red Leader]: Transmitting HTTP POST request for core dataset payload...");
        
        let csvResponse;
        try {
            csvResponse = await fetch(baseUrl, {
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

        if (!csvResponse.ok) {
            console.error(`💥 [Red Leader Error]: Server rejected payload transmission. HTTP Status: ${csvResponse.status} ${csvResponse.statusText}`);
            throw new Error(`Data fetch error (HTTP ${csvResponse.status})`);
        }

        console.log("🟢 [Green Leader]: Payload transmission received successfully. Processing and writing to OPFS cargo bays...");
        const csvPayload = await csvResponse.json();
        const payloadString = JSON.stringify(csvPayload);

        await writeDatasetToOPFS("cache_payload.json", payloadString);
        await writeDatasetToOPFS("lite_payload.json", payloadString);

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

// --- SECONDARY SYNC TASK (VALIDACIÓN PURA POR FECHA DE SHAREPOINT) ---
window.LSEngine.taskSyncFiles = async function(overrideUrl = null) {
    let baseUrl = overrideUrl || window.LSEngine.getPowerAutomateUrl();
    if (!baseUrl) return;

    try {
        const rootDir = await navigator.storage.getDirectory();
        
        const cacheBusterToken = `_cb=${Date.now()}`;
        const separator = baseUrl.includes('?') ? '&' : '?';
        const manifestUrl = `${baseUrl}${separator}${cacheBusterToken}`;

        if (typeof window.LSEngine.setProgress === 'function') {
            window.LSEngine.setProgress(50, "Fetching manifest for background assets...", "SYNCING");
        }

        const response = await fetch(manifestUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({ action: "READ_MANIFEST" })
        });

        if (!response.ok) return;

        const payload = await response.json();
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

        for (const item of fileItems) {
            processedCount++;
            const progressPercent = Math.min(50 + Math.floor((processedCount / totalFiles) * 45), 95);

            try {
                let rawPath = item.path || "";
                if (rawPath.endsWith("/") && item.name) {
                    rawPath += item.name;
                } else if (!rawPath.endsWith("/") && !rawPath.endsWith(item.name)) {
                    rawPath = rawPath + "/" + item.name;
                }
                const cleanFilePath = rawPath.replace(/([^:]\/)\/+/g, "$1");

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

                let currentDirHandle = targetBaseDir;
                if (relativeSubFolder) {
                    currentDirHandle = await targetBaseDir.getDirectoryHandle(relativeSubFolder, { create: true });
                }

                const fileHandle = await currentDirHandle.getFileHandle(item.name, { create: true });

                try {
                    const existingFile = await fileHandle.getFile();
                    
                    const serverLastModified = item.lastModified ? new Date(item.lastModified).getTime() : 0;
                    const localLastModified = existingFile.lastModified || 0;

                    console.log(`🔎 [OPFS Eval] Evaluando: "${item.name}"`, {
                        serverDate: new Date(serverLastModified).toISOString(),
                        localDate: new Date(localLastModified).toISOString(),
                        isServerOlderOrEqual: serverLastModified <= localLastModified
                    });

                    // VALIDACIÓN PURA POR FECHA: 
                    // Si el archivo existe localmente y la fecha de SharePoint NO es más nueva que la local, nos lo saltamos.
                    // Si en SharePoint modificaron el archivo (fecha mayor), serverLastModified <= localLastModified dará false y procederá a descargar.
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

                const downloadRes = await fetch(baseUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    cache: "no-store",
                    body: JSON.stringify({ action: "DOWNLOAD_FILE", filePath: cleanFilePath })
                });

                if (downloadRes.ok) {
                    const fileContent = await downloadRes.text();
                    const writable = await fileHandle.createWritable();
                    await writable.write(fileContent);
                    await writable.close();
                    console.log(`[OPFS] ✅ Updated/Downloaded new: ${item.name}`);
                }
            } catch (fileErr) {
                console.warn(`Error processing individual file:`, fileErr);
            }
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

// --- LIFECYCLE BOOTSTRAP & OFFLINE FALLBACK ---
async function checkAndSyncData() {
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
        const restored = await restoreCacheFromOPFSToLocalStorage();
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
            await restoreCacheFromOPFSToLocalStorage();
            if (splash) splash.style.display = "none";
            window.dispatchEvent(new CustomEvent("PayloadReady"));
        }
    } catch (error) {
        await restoreCacheFromOPFSToLocalStorage();
        if (splash) splash.style.display = "none";
        window.dispatchEvent(new CustomEvent("PayloadReady"));
    }
}


// --- MONITOR DE INACTIVIDAD ---
let awayTimer = null;
const AWAY_THRESHOLD_MS = 20 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

function initAwaySyncMonitor() {
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

window.triggerManualSync = async function() {
    console.log("🚨 [Red Leader]: Manual sync override initiated!");
    localStorage.removeItem("app_last_sync_date");
    localStorage.removeItem("app_last_sync_timestamp");
    
    if (await verifySharePointSession()) {
        const success = await fetchAndProcessData(true);
        
        if (success) {
            await new Promise(resolve => setTimeout(resolve, 900));
            const freshUrl = new URL(window.location.href);
            freshUrl.searchParams.set('reload_ts', Date.now());
            window.location.href = freshUrl.toString();
        } else {
            alert("⚠️ La sincronización no pudo completarse correctamente.");
        }
    } else {
        alert("⚠️ No se pudo verificar la sesión activa con SharePoint.");
    }
};

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
        console.log("🚀 [Sync]: Sincronización completada al 100%. Redirigiendo limpiamente...");
        const currentSearchParams = window.location.search;
        
        let basePath = window.location.pathname;
        
        if (basePath.endsWith('.html')) {
            basePath = basePath.substring(0, basePath.lastIndexOf('/') + 1);
        } else if (!basePath.endsWith('/')) {
            basePath += '/';
        }

        setTimeout(() => {
            window.location.replace(basePath + currentSearchParams);
        }, 500);
    }
};