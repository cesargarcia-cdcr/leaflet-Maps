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

// --- AUTHENTICATION LOCK SCREEN & POPUP LOOP ---
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
            <h2 style="margin-top: 0; color: #f87171; font-size: 22px;">Sign-In Required</h2>
            <p id="lock-status-text" style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
                A popup window has been opened to authenticate your corporate session. Complete your sign-in there.
            </p>
            <div style="display: flex; align-items: center; justify-content: center; gap: 10px; color: #38bdf8; font-size: 13px; font-weight: 500;">
                <div style="width: 14px; height: 14px; border: 2px solid #38bdf8; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                Waiting for authentication...
            </div>
            <button id="btn-reopen-popup" style="margin-top: 20px; background: #334155; color: #cbd5e1; border: none; padding: 8px 14px; border-radius: 6px; font-size: 12px; cursor: pointer; width: 100%;">
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

// --- OPFS WRITER HELPER ---
async function writeItemToOPFS(item, guidelinesDir) {
    let rawPath = item.path || "";
    const marker = "Guidelines_Info/";
    const markerIndex = rawPath.indexOf(marker);
    
    let relativePath = rawPath;
    if (markerIndex !== -1) {
        relativePath = rawPath.substring(markerIndex + marker.length);
    }
    
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

// --- UI SPLASH HELPERS ---
function showSplash(splashElement) {
    if (!splashElement) return;
    splashElement.style.display = "flex";
    splashElement.style.opacity = "1";
}

function hideSplash(splashElement) {
    if (!splashElement) return;
    splashElement.style.opacity = "0";
    setTimeout(() => { splashElement.style.display = "none"; }, 400);
}

// --- BACKGROUND OPFS SYNC (Guidelines & Files) ---
async function syncGuidelinesInBackground(baseUrl) {
    try {
        console.log("Background sync: Starting guidelines manifest read...");
        const rootDir = await navigator.storage.getDirectory();
        const guidelinesDir = await rootDir.getDirectoryHandle("Guidelines_Info", { create: true });

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
        
        const manifestPayload = await manifestResponse.json();
        const manifestData = manifestPayload.manifest || 
                             manifestPayload.files || 
                             manifestPayload.data || 
                             manifestPayload.items || 
                             manifestPayload;
        
        let itemsArray = manifestData;
        if (!Array.isArray(manifestData) && typeof manifestData === 'object') {
            itemsArray = Object.values(manifestData).flat();
        }

        if (!Array.isArray(itemsArray)) return;

        const fileItems = itemsArray.filter(item => {
            const type = (item.type || "").toLowerCase();
            const name = item.name || "";
            return type !== "directory" && type !== "folder" && name.includes(".");
        });

        for (const item of fileItems) {
            try {
                let rawPath = item.path || "";
                if (rawPath.endsWith("/") && item.name) {
                    rawPath = rawPath + item.name;
                }
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
                    await writeItemToOPFS(item, guidelinesDir);
                }
            } catch (err) {
                // Silent catch for background file downloads
            }
        }
        console.log("Background OPFS guidelines sync completed successfully.");
    } catch (bgErr) {
        console.warn("Background sync error (non-blocking):", bgErr);
    }
}

// --- MAIN FETCH ENGINE ---
async function fetchAndProcessData(isManual = false) {
    const splash = document.getElementById("sync-splash");
    
    if (isManual) {
        showSplash(splash);
    }
    
    try {
        updateProgress(20, "Loading core application records...", "CONNECTING");
        
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

        if (!csvResponse.ok) {
            throw new Error(`Data fetch error (HTTP ${csvResponse.status})`);
        }

        const csvPayload = await csvResponse.json();
        
        // Sobrescribe limpiamente el payload y actualiza la marca de tiempo exacta de la descarga
        localStorage.setItem("cache_payload", JSON.stringify(csvPayload));
        localStorage.setItem("app_data_version", new Date().toISOString().split("T")[0]);
        localStorage.setItem("app_last_sync_timestamp", Date.now().toString());

        updateProgress(100, "Ready!", "READY");

        setTimeout(() => {
            hideSplash(splash);
            window.dispatchEvent(new CustomEvent("PayloadReady"));
        }, 300);

        // Dispara la sincronización silenciosa de OPFS en segundo plano
        setTimeout(() => {
            syncGuidelinesInBackground(baseUrl);
        }, 1000);

        return true;

    } catch (error) {
        console.log("Synchronization failure:", error);
        updateProgress(100, error.message || "Synchronization Error", "ERROR");
        setTimeout(() => hideSplash(splash), 1500);
        return false;
    }
}

// --- RESTRUCTURED LIFECYCLE BOOTSTRAP (1-HOUR FRESHNESS RULE) ---
const CACHE_EXPIRATION_MS = 60 * 60 * 1000; // 1 hora de vigencia

async function checkAndSyncData() {
    const splash = document.getElementById("sync-splash");
    const lastSyncStr = localStorage.getItem("app_last_sync_timestamp");
    const hasPayload = localStorage.getItem("cache_payload");
    const now = Date.now();

    // 1. REGLA DE 1 HORA: Si el caché existe y tiene menos de 1 hora, se carga instantáneamente sin splash screen
    if (hasPayload && lastSyncStr && (now - parseInt(lastSyncStr, 10) < CACHE_EXPIRATION_MS)) {
        console.log("⚡ Caché vigente (< 1 hora). Cargando datos locales instantáneamente...");
        if (splash) splash.style.display = "none";
        window.dispatchEvent(new CustomEvent("PayloadReady"));
        
        // Ejecuta la sincronización de guías en OPFS silenciosamente en el fondo
        const baseUrl = getPowerAutomateUrl();
        if (baseUrl) {
            setTimeout(() => syncGuidelinesInBackground(baseUrl), 1500);
        }
        return;
    }

    // 2. Si expiró la hora (o no hay caché), verificamos sesión y descargamos datos frescos
    const sessionActive = await verifySharePointSession().catch(() => false);
    
    if (!sessionActive) {
        console.warn("⚠️ Sesión de SharePoint inactiva. Resguardando caché anterior...");
        if (splash) splash.style.display = "none";
        
        if (hasPayload) {
            window.dispatchEvent(new CustomEvent("PayloadReady"));
        } else {
            console.error("❌ No hay caché local disponible y la verificación de sesión falló.");
            updateProgress(100, "Connection Error & No Local Cache", "ERROR");
        }
        return;
    }

    try {
        console.log("🌐 Caché expirado o ausente. Descargando datos frescos de SharePoint...");
        const success = await fetchAndProcessData(false);
        
        if (!success && hasPayload) {
            console.warn("⚠️ Falló la descarga, respaldando con caché anterior...");
            if (splash) splash.style.display = "none";
            window.dispatchEvent(new CustomEvent("PayloadReady"));
        }
    } catch (error) {
        console.error("❌ Error en el proceso de sincronización. Manteniendo caché previo...", error);
        if (splash) splash.style.display = "none";
        if (hasPayload) {
            window.dispatchEvent(new CustomEvent("PayloadReady"));
        }
    }
}

window.triggerManualSync = async function() {
    console.log("Sincronización manual solicitada por el usuario...");
    // Al ser manual, limpiamos el timestamp para forzar la descarga independientemente del tiempo transcurrido
    localStorage.removeItem("app_last_sync_timestamp");
    if (await verifySharePointSession()) {
        await fetchAndProcessData(true);
    }
};

window.addEventListener("DOMContentLoaded", () => {
    checkAndSyncData();
});