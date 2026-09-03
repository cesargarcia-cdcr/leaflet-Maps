/* ====================================
   LOADING SCREEN & OPFS SYNC ENGINE
==================================== */

// 1. Automatically register Service Worker to intercept and serve from OPFS
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw-guidelines.js')
    .then(() => console.log("Guidelines Service Worker registered successfully."))
    .catch(err => console.error("Error registering Service Worker:", err));
}

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

// --- SHAREPOINT SESSION VERIFICATION ---
function checkSharePointLogo() {
    return new Promise((resolve) => {
        const logoUrl = "https://clinicasdelcaminoreal.sharepoint.com/sites/ACSI/_api/siteiconmanager/getsitelogo?type=%271%27&hash=638573522516023947";
        const img = new Image();
        
        const timeout = setTimeout(() => {
            img.src = "";
            resolve(false);
        }, 4000);

        img.onload = () => { clearTimeout(timeout); resolve(true); };
        img.onerror = () => { clearTimeout(timeout); resolve(false); };

        img.src = logoUrl + "&t=" + new Date().getTime();
    });
}

async function verifySharePointSession() {
    console.log("Checking SharePoint session...");
    let active = await checkSharePointLogo();
    if (active) return true;

    await new Promise(r => setTimeout(r, 800));
    active = await checkSharePointLogo();
    if (active) return true;

    console.warn("Session expired. Triggering automatic login lock screen.");
    triggerAutomaticLoginFlow();
    return false;
}

// --- AUTHENTICATION LOCK SCREEN & OFFLINE BYPASS MODE ---
function triggerAutomaticLoginFlow() {
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
    
    const sharePointSiteUrl = "https://clinicasdelcaminoreal.sharepoint.com/sites/ACSI";

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
        console.log("🔓 User requested offline mode bypass...");
        try { if (loginWindow && !loginWindow.closed) loginWindow.close(); } catch (e) {}
        lockScreen.remove();
        
        const restored = await restoreCacheFromOPFSToLocalStorage();
        if (restored || localStorage.getItem("cache_payload")) {
            console.log("✅ Offline mode engaged successfully.");
            window.dispatchEvent(new CustomEvent("PayloadReady"));
        } else {
            alert("No local OPFS backup found. Internet connection and authentication are required for the first run.");
            triggerAutomaticLoginFlow();
        }
    });

    const sessionPollInterval = setInterval(async () => {
        if (await checkSharePointLogo()) {
            console.log("Session detected. Closing popup and continuing...");
            clearInterval(sessionPollInterval);
            try { if (loginWindow && !loginWindow.closed) loginWindow.close(); } catch (e) {}
            lockScreen.remove();
            checkAndSyncData();
        }
    }, 2000);
}

function getPowerAutomateUrl() {
    try {
        const params = new URLSearchParams(window.location.search);
        const encoded = params.get("data");
        return encoded ? atob(encoded) : null;
    } catch (err) {
        console.error("Invalid Power Automate URL", err);
        return null;
    }
}

// --- PURGA QUIRÚRGICA DE DATASETS (SIN TOCAR SESIÓN NI CONFIGS) ---
function clearLocalDatasetsCache() {
    console.log("🧹 Purgando exclusivamente los datasets de caché en localStorage...");
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("csv_") || key === "cache_payload")) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
}

// --- OPFS & LOCALSTORAGE BRIDGE HELPERS ---
async function writeDatasetToOPFS(filename, contentString) {
    const rootDir = await navigator.storage.getDirectory();
    const dataDir = await rootDir.getDirectoryHandle("App_Data", { create: true });
    
    const fileHandle = await dataDir.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(contentString);
    await writable.close();
}

async function restoreCacheFromOPFSToLocalStorage() {
    try {
        console.log("📂 Restoring local storage cache from OPFS master source...");
        const rootDir = await navigator.storage.getDirectory();
        const dataDir = await rootDir.getDirectoryHandle("App_Data");
        const fileHandle = await dataDir.getFileHandle("cache_payload.json");
        const file = await fileHandle.getFile();
        const content = await file.text();

        if (content) {
            localStorage.setItem("cache_payload", content);
            console.log("✅ Successfully mirrored OPFS cache to localStorage.");
            return true;
        }
    } catch (err) {
        console.warn("⚠️ No OPFS cache found to restore:", err);
    }
    return false;
}

// --- UI SPLASH HELPERS ---
function showSplash(splashElement) {
    if (!splashElement) return;
    splashElement.style.pointerEvents = "auto";
    splashElement.style.display = "flex";
    splashElement.style.opacity = "1";
}

function hideSplash(splashElement) {
    if (!splashElement) return;
    splashElement.style.opacity = "0";
    splashElement.style.pointerEvents = "none";
    setTimeout(() => { 
        splashElement.style.display = "none"; 
        if (window.AppMap && typeof window.AppMap.invalidateSize === 'function') {
            window.AppMap.invalidateSize();
        }
    }, 400);
}

// --- BACKGROUND OPFS SYNC (GENERIC) ---
async function syncContentInBackground(baseUrl) {
    try {
        const rootDir = await navigator.storage.getDirectory();
        const guidelinesDir = await rootDir.getDirectoryHandle("Guidelines_Info", { create: true });
        const directoryDir = await guidelinesDir.getDirectoryHandle("Directory", { create: true });

        const manifestController = new AbortController();
        const manifestTimeout = setTimeout(() => manifestController.abort(), 35000);
        
        const manifestResponse = await fetch(baseUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "READ_MANIFEST" }),
            signal: manifestController.signal
        });
        clearTimeout(manifestTimeout);
        
        if (!manifestResponse.ok) return;
        
        const payload = await manifestResponse.json();
        const guidelinesItems = payload.guidelines || [];
        const directoryItems = payload.directory || [];
        const fallbackItems = (!payload.guidelines && !payload.directory) 
            ? (payload.manifest || payload.files || payload.data || payload.items || payload) 
            : [];

        let generalArray = Array.isArray(fallbackItems) ? fallbackItems : Object.values(fallbackItems).flat();

        async function processAndDownloadFiles(items, targetDir) {
            if (!Array.isArray(items)) return;

            const fileItems = items.filter(item => {
                const type = (item.type || "").toLowerCase();
                const name = item.name || "";
                return type !== "directory" && type !== "folder" && name.includes(".");
            });

            for (const item of fileItems) {
                try {
                    let rawPath = item.path || "";
                    if (rawPath.endsWith("/") && item.name) rawPath += item.name;
                    const cleanFilePath = rawPath.replace(/([^:]\/)\/+/g, "$1");

                    const downloadController = new AbortController();
                    const downloadTimeout = setTimeout(() => downloadController.abort(), 20000);
                    
                    const downloadResponse = await fetch(baseUrl, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "DOWNLOAD_FILE", filePath: cleanFilePath }),
                        signal: downloadController.signal
                    });
                    clearTimeout(downloadTimeout);

                    if (downloadResponse.ok) {
                        item.content = await downloadResponse.text();
                        await writeItemToOPFS_Helper(item, targetDir);
                    }
                } catch (err) {}
            }
        }

        await processAndDownloadFiles(guidelinesItems.length > 0 ? guidelinesItems : generalArray, guidelinesDir);
        await processAndDownloadFiles(directoryItems, directoryDir);

    } catch (bgErr) {
        console.warn("⚠️ Error en la sincronización en segundo plano:", bgErr);
    }
}

async function writeItemToOPFS_Helper(item, guidelinesDir) {
    let rawPath = item.path || "";
    const marker = "Guidelines_Info/";
    const markerIndex = rawPath.indexOf(marker);
    let relativePath = markerIndex !== -1 ? rawPath.substring(markerIndex + marker.length) : rawPath;
    
    if (!relativePath.endsWith(item.name)) {
        relativePath = relativePath.endsWith("/") ? relativePath + item.name : relativePath + "/" + item.name;
    }
    relativePath = relativePath.replace(/([^:]\/)\/+/g, "$1");
    
    const parts = relativePath.split("/").filter(Boolean);
    const fileName = parts.pop();
    if (!fileName) return;

    let targetFolder = guidelinesDir;
    for (const folderPart of parts) {
        targetFolder = await targetFolder.getDirectoryHandle(folderPart, { create: true });
    }

    const fileHandle = await targetFolder.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(String(item.content || ""));
    await writable.close();
}

// --- MAIN FETCH ENGINE (OPFS as Master Source) ---
async function fetchAndProcessData(isManual = false) {
    const splash = document.getElementById("sync-splash");
    if (isManual) showSplash(splash);
    
    try {
        updateProgress(20, "Loading core application records from cloud...", "CONNECTING");
        
        let baseUrl = getPowerAutomateUrl();
        if (!baseUrl) {
            console.warn("Power Automate URL not found.");
            hideSplash(splash);
            return false;
        }
        
        const csvController = new AbortController();
        const csvTimeout = setTimeout(() => csvController.abort(), 35000);

        const csvResponse = await fetch(baseUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}), 
            signal: csvController.signal
        });
        clearTimeout(csvTimeout);

        if (!csvResponse.ok) throw new Error(`Data fetch error (HTTP ${csvResponse.status})`);

        const csvPayload = await csvResponse.json();
        const payloadString = JSON.stringify(csvPayload);
        
        // 🧹 Purga limpia de datasets viejos antes de escribir los nuevos
        clearLocalDatasetsCache();

        // 💾 1. GUARDAR EN OPFS COMO FUENTE DE VERDAD PRINCIPAL
        await writeDatasetToOPFS("cache_payload.json", payloadString);
        
        // 🔄 2. CREAR ESPEJO EN LOCALSTORAGE DESDE EL OPFS
        await restoreCacheFromOPFSToLocalStorage();
        
        localStorage.setItem("app_data_version", new Date().toISOString().split("T")[0]);
        localStorage.setItem("app_last_sync_date", new Date().toISOString().split("T")[0]);
        localStorage.setItem("app_last_sync_timestamp", Date.now().toString());

        updateProgress(100, "Ready!", "READY");

        setTimeout(() => {
            hideSplash(splash);
            window.dispatchEvent(new CustomEvent("PayloadReady"));
        }, 300);

        setTimeout(() => syncContentInBackground(baseUrl), 1000);

        return true;

    } catch (error) {
        console.log("Synchronization failure:", error);
        updateProgress(100, error.message || "Synchronization Error", "ERROR");
        setTimeout(() => hideSplash(splash), 1500);
        return false;
    }
}

// --- LIFECYCLE BOOTSTRAP & OFFLINE FALLBACK ---
async function checkAndSyncData() {
    const splash = document.getElementById("sync-splash");
    const todayStr = new Date().toISOString().split("T")[0];
    const lastSyncDate = localStorage.getItem("app_last_sync_date");
    const lastTimestamp = parseInt(localStorage.getItem("app_last_sync_timestamp") || "0", 10);
    const hasLocalPayload = localStorage.getItem("cache_payload");

    const ONE_HOUR_MS = 60 * 60 * 1000;
    const isDifferentDay = (lastSyncDate !== todayStr);
    const isFresh = (Date.now() - lastTimestamp) < ONE_HOUR_MS;

    // 1. Si es el mismo día y la información tiene menos de 1 hora, cargamos instantáneamente
    if (!isDifferentDay && isFresh && hasLocalPayload) {
        console.log("⚡ Same-day & fresh cache (< 1 hour). Loading instantly...");
        if (splash) splash.style.display = "none";
        window.dispatchEvent(new CustomEvent("PayloadReady"));
        
        const baseUrl = getPowerAutomateUrl();
        if (baseUrl) setTimeout(() => syncContentInBackground(baseUrl), 2000);
        return;
    }

    // 2. Si es día diferente o ya pasó más de 1 hora, verificamos sesión y sincronizamos
    console.log("🌅 Verifying SharePoint session for sync...");
    const sessionActive = await verifySharePointSession().catch(() => false);
    
    if (!sessionActive) {
        console.warn("⚠️ SharePoint session inactive or offline. Falling back to OPFS backup...");
        if (splash) splash.style.display = "none";
        
        const restored = await restoreCacheFromOPFSToLocalStorage();
        if (restored || hasLocalPayload) {
            window.dispatchEvent(new CustomEvent("PayloadReady"));
        } else {
            updateProgress(100, "Connection Error & No Local Backup", "ERROR");
        }
        return;
    }

    // 3. Online & Authenticated -> Fetch fresh data
    try {
        const success = await fetchAndProcessData(true);
        if (!success) {
            await restoreCacheFromOPFSToLocalStorage();
            if (splash) splash.style.display = "none";
            window.dispatchEvent(new CustomEvent("PayloadReady"));
        }
    } catch (error) {
        console.error("❌ Sync error. Restoring from OPFS...", error);
        await restoreCacheFromOPFSToLocalStorage();
        if (splash) splash.style.display = "none";
        window.dispatchEvent(new CustomEvent("PayloadReady"));
    }
}

// --- 20-MINUTE AWAY BACKGROUND SYNC MONITOR (COMBINED WITH 1-HOUR RULE) ---
let awayTimer = null;
const AWAY_THRESHOLD_MS = 20 * 60 * 1000; // 20 Minutes
const ONE_HOUR_MS = 60 * 60 * 1000;

function initAwaySyncMonitor() {
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            awayTimer = setTimeout(async () => {
                console.log("🌙 App hidden for 20+ minutes. Evaluating freshness for background sync...");
                
                const lastTimestamp = parseInt(localStorage.getItem("app_last_sync_timestamp") || "0", 10);
                const elapsed = Date.now() - lastTimestamp;
                
                if (elapsed < ONE_HOUR_MS) {
                    console.log("⚡ Data is still fresh (< 1 hour). Skipping background sync.");
                    return;
                }

                const sessionActive = await checkSharePointLogo().catch(() => false);
                if (sessionActive) {
                    const baseUrl = getPowerAutomateUrl();
                    if (baseUrl) {
                        try {
                            console.log("🔄 Background sync triggered: Data older than 1 hour.");
                            await fetchAndProcessData(false);
                            await syncContentInBackground(baseUrl);
                        } catch (err) {
                            console.warn("Silent background sync network error:", err);
                        }
                    }
                }
            }, AWAY_THRESHOLD_MS);
            
        } else {
            if (awayTimer) {
                clearTimeout(awayTimer);
                awayTimer = null;
                console.log("☀️ User returned within threshold. Away sync timer canceled.");
            }
        }
    });
}

window.triggerManualSync = async function() {
    console.log("Manual synchronization requested by user...");
    localStorage.removeItem("app_last_sync_date");
    localStorage.removeItem("app_last_sync_timestamp");
    
    if (await verifySharePointSession()) {
        await fetchAndProcessData(true);
    }
};

window.addEventListener("DOMContentLoaded", () => {
    checkAndSyncData();
    initAwaySyncMonitor();
});