/* ==========================================================
   LOADING SCREEN & OPFS SYNC ENGINE - CONTROLLED FLOW
   ========================================================== */

/* // 1. Service Worker Registration
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw-guidelines.js')
    .then(() => console.log("Guidelines Service Worker registered successfully."))
    .catch(err => console.error("Error registering Service Worker:", err));
} */

// --- UI CONTROLS ---
function setProgress(percent, message, state = "LOADING") {
    const bar = document.getElementById("bt-progress-bar");
    const textPercent = document.getElementById("bt-percentage");
    const statusText = document.getElementById("sync-status");
    const stateText = document.getElementById("bt-state-text");

    if (bar) bar.style.width = `${percent}%`;
    if (textPercent) textPercent.innerText = `${percent}%`;
    if (statusText && message) statusText.innerText = message;
    if (stateText) stateText.innerText = state;
}

// --- CONFIG & UTILS ---
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

async function writeDatasetToOPFS(filename, contentString) {
    const rootDir = await navigator.storage.getDirectory();
    const dataDir = await rootDir.getDirectoryHandle("App_Data", { create: true });
    const fileHandle = await dataDir.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(contentString);
    await writable.close();
}

async function restoreCacheFromOPFSToLocalStorage(filename = "cache_payload.json") {
    try {
        console.log(`📂 Restoring local storage cache from OPFS source (${filename})...`);
        const rootDir = await navigator.storage.getDirectory();
        const dataDir = await rootDir.getDirectoryHandle("App_Data", { create: true });
        const fileHandle = await dataDir.getFileHandle(filename);
        const file = await fileHandle.getFile();
        const content = await file.text();

        if (content) {
            // Parseamos de forma segura por si el archivo estuviera incompleto
            const parsedData = JSON.parse(content);
            
            // Guardamos la versión cruda en el localStorage correspondiente
            localStorage.setItem("cache_payload", content);

            // Inicializamos el estado global de forma segura validando sección por sección
            window.LSEngine.state = window.LSEngine.state || {};
            
            // Verificamos y asignamos solo lo que exista (evitando errores por secciones faltantes en lite_payload)
            window.LSEngine.state.globalClinics = parsedData.clinics || [];
            window.LSEngine.state.globalExtensions = parsedData.extensions || [];
            window.LSEngine.state.globalClinicLookup = parsedData.clinicLookup || [];
            
            // Ejemplo de secciones adicionales que podría tener el archivo completo pero no el lite
            /* if (parsedData.additionalSettings) {
                window.LSEngine.state.globalSettings = parsedData.additionalSettings;
            } else {
                console.warn(`⚠️ La sección 'additionalSettings' no está presente en ${filename} (modo parcial/lite). Omitiendo de forma segura.`);
            }
 */
            console.log(`✅ Successfully mirrored and sanitized OPFS (${filename}) cache.`);
            return true;
        }
    } catch (err) {
        console.warn(`⚠️ No OPFS cache found for '${filename}' or error parsing it:`, err);
    }
    return false;
}

// --- CORE TASKS WITH CACHE BUSTING & OPFS SYNC ---

async function taskFetchMainData(overrideUrl = null) {
    let baseUrl = overrideUrl || getPowerAutomateUrl();
    if (!baseUrl) throw new Error("No URL provided for main fetch.");
    
    // Aplicación del Cache Busting Token con Date.now()
    const cacheBusterToken = `_cb=${Date.now()}`;
    console.log("⚡ [Cache Busting] Aplicado a principal:", cacheBusterToken);
    const separator = baseUrl.includes('?') ? '&' : '?';
    const finalEndpointUrl = `${baseUrl}${separator}${cacheBusterToken}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35000);

    const response = await fetch(finalEndpointUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ action: "load" }),
        signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) throw new Error(`Data fetch error (HTTP ${response.status})`);

    const payload = await response.json();
    const payloadString = JSON.stringify(payload);
    
    await writeDatasetToOPFS("cache_payload.json", payloadString);
    await restoreCacheFromOPFSToLocalStorage();
    
    localStorage.setItem("app_data_version", new Date().toISOString().split("T")[0]);
    localStorage.setItem("app_last_sync_date", new Date().toISOString().split("T")[0]);
    localStorage.setItem("app_last_sync_timestamp", Date.now().toString());
    return payload;
}


// --- MASTER FLOW CONTROL ---
async function iniciarProcesoCargaTotal() {
    try {
        setProgress(20, "Descargando datos principales del sistema...", "FETCHING");
        await taskFetchMainData();

        setProgress(55, "Sincronizando archivos y directivas (OPFS)...", "SYNCING");
        await taskSyncFiles();

        setProgress(85, "Procesando estructuras locales (ETL)...", "PROCESSING");
        // Disparamos el evento para que data-loader.js procese todo de forma limpia
        window.dispatchEvent(new CustomEvent("PayloadReady"));

        // Todo completado con éxito, revelamos el botón final y bloqueamos acceso prematuro
        setProgress(100, "Sincronización completa", "READY");
        mostrarBotonEntradaApp();

    } catch (err) {
        console.error("Error crítico en la sincronización:", err);
        setProgress(100, "Error en la sincronización. Verifique conexión.", "ERROR");
    }
}

function mostrarBotonEntradaApp() {
    const footerPanel = document.getElementById('sync-footer-panel');
    if (!footerPanel) return;
    
    footerPanel.innerHTML = `
        <button id="enter-app-btn" style="width: 100%; padding: 10px; background: #38bdf8; color: #0f172a; border: none; border-radius: 6px; font-weight: bold; font-size: 13px; cursor: pointer; box-shadow: 0 4px 12px rgba(56, 189, 248, 0.3);">
            🚀 Enter Main Application
        </button>
    `;
    
    document.getElementById('enter-app-btn').onclick = () => {
        window.location.replace('index.html' + window.location.search);
    };
}

/* // Inicialización automática al cargar el DOM
window.addEventListener('DOMContentLoaded', () => {
    iniciarProcesoCargaTotal();
}); */