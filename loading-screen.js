/* ====================================
   LOADING SCREEN (Con control diario y sincronización manual)
==================================== */

function updateProgress(percent, message, state = "CARGANDO") {
    const bar = document.getElementById("bt-progress-bar");
    const textPercent = document.getElementById("bt-percentage");
    const statusText = document.getElementById("sync-status");
    const stateText = document.getElementById("bt-state-text");

    if (bar) bar.style.width = `${percent}%`;
    if (textPercent) textPercent.innerText = `${percent}%`;
    if (statusText && message) statusText.innerText = message;
    if (stateText) stateText.innerText = state;
}

function getPowerAutomateUrl() {
    try {
        const params = new URLSearchParams(window.location.search);
        const encoded = params.get("data");
        if (!encoded) return null;
        return atob(encoded);
    } catch (err) {
        console.error("Invalid Power Automate URL", err);
        return null;
    }
}

function savePayload(payload) {
    localStorage.setItem("cache_payload", JSON.stringify(payload));
}

function saveIndividualCaches(payload) {
    const keys = Object.keys(payload);
    let count = 0;

    keys.forEach(key => {
        try {
            localStorage.setItem(`cache_${key}`, JSON.stringify(payload[key]));
            count++;
        } catch (err) {
            console.warn(`Unable to cache ${key}`, err);
        }
    });

    return count;
}

function showSplash(splashElement) {
    if (!splashElement) return;
    splashElement.style.display = "flex";
    splashElement.style.opacity = "1";
}

function hideSplash(splashElement) {
    if (!splashElement) return;
    splashElement.style.opacity = "0";
    setTimeout(() => {
        splashElement.style.display = "none";
    }, 400);
}

// --- NÚCLEO DE DESCARGA CON STREAM Y PROGRESO REAL ---
async function fetchAndProcessData(isManual = false) {
    const splash = document.getElementById("sync-splash");
    if (isManual) showSplash(splash);

    try {
        updateProgress(10, "Conectando con Power Automate...", "CONECTANDO");
        const url = getPowerAutomateUrl();

        if (!url) {
            console.warn("No data parameter found.");
            hideSplash(splash);
            return false;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const contentLength = response.headers.get("content-length");
        const total = contentLength ? parseInt(contentLength, 10) : 0;
        let loaded = 0;

        const reader = response.body.getReader();
        const chunks = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            chunks.push(value);
            loaded += value.length;

            if (total > 0) {
                const downloadPercent = Math.min(Math.round((loaded / total) * 50) + 20, 70);
                const mbLoaded = (loaded / (1024 * 1024)).toFixed(1);
                const mbTotal = (total / (1024 * 1024)).toFixed(1);
                
                updateProgress(
                    downloadPercent, 
                    `Descargando datos... (${mbLoaded}MB / ${mbTotal}MB)`, 
                    "DESCARGANDO"
                );
            } else {
                updateProgress(50, `Descargando datos... (${(loaded / 1024).toFixed(0)} KB)`, "DESCARGANDO");
            }
        }

        updateProgress(72, "Ensamblando datos...", "PROCESANDO");

        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const allChunks = new Uint8Array(totalLength);
        let position = 0;
        for (let chunk of chunks) {
            allChunks.set(chunk, position);
            position += chunk.length;
        }

        const decoder = new TextDecoder("utf-8");
        const jsonString = decoder.decode(allChunks);
        const payload = JSON.parse(jsonString);

        updateProgress(82, "Guardando respaldo local...", "GUARDANDO");
        savePayload(payload);

        updateProgress(90, "Indexando datasets...", "INDEXANDO");
        const datasetCount = saveIndividualCaches(payload);

        const todayStr = new Date().toISOString().split("T")[0];
        localStorage.setItem("app_data_version", todayStr);

        updateProgress(100, `Datasets listos: ${datasetCount}`, "LISTO");
        console.log("✅ Payload downloaded & cached successfully");

        setTimeout(() => {
            hideSplash(splash);
            window.dispatchEvent(new CustomEvent("PayloadReady"));
        }, 500);

        return true;

    } catch (error) {
        console.error("⚠️ Sync failed", error);
        updateProgress(100, "Error en descarga / Modo local", "ERROR");

        setTimeout(() => {
            hideSplash(splash);
            if (localStorage.getItem("cache_payload")) {
                window.dispatchEvent(new CustomEvent("PayloadReady"));
            }
        }, 1500);

        return false;
    }
}

// --- COMPROBACIÓN DIARIA ---
async function checkAndSyncData() {
    const splash = document.getElementById("sync-splash");
    const lastVersionDate = localStorage.getItem("app_data_version");
    const todayStr = new Date().toISOString().split("T")[0];
    const hasPayload = localStorage.getItem("cache_payload");

    // Si ya descargó hoy, salta la pantalla de carga y arranca con la caché local
    if (lastVersionDate === todayStr && hasPayload) {
        console.log("⚡ Datos ya actualizados hoy. Usando caché local.");
        if (splash) splash.style.display = "none";
        window.dispatchEvent(new CustomEvent("PayloadReady"));
        return;
    }

    // Si es un día nuevo o falta caché, ejecuta la descarga inicial
    await fetchAndProcessData(false);
}

// --- BOTÓN MANUAL ---
window.triggerManualSync = async function() {
    console.log("🔄 Sincronización manual iniciada por el usuario...");
    await fetchAndProcessData(true);
};

window.addEventListener("DOMContentLoaded", () => {
    checkAndSyncData();
});