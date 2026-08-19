function updateProgress(percent, message, state = "CARGANDO") {
    const bar = document.getElementById('bt-progress-bar');
    const textPercent = document.getElementById('bt-percentage');
    const statusText = document.getElementById('sync-status');
    const stateText = document.getElementById('bt-state-text');
    
    if (bar) bar.style.width = `${percent}%`;
    if (textPercent) textPercent.innerText = `${percent}%`;
    if (statusText && message) statusText.innerText = message;
    if (stateText) stateText.innerText = state;
}

async function checkAndSyncData() {
    const splash = document.getElementById('sync-splash');

    try {
        updateProgress(10, "Conectando con Power Automate...", "CONECTANDO");
        
        const urlParams = new URLSearchParams(window.location.search);
        const encodedData = urlParams.get('data');
        
        if (!encodedData) {
            console.warn("⚠️ No hay parámetro 'data'. Saltando sincronización online.");
            hideSplash(splash);
            return;
        }

        const powerAutomateUrl = atob(encodedData);

        // Timeout de seguridad de 8 segundos para evitar bucles infinitos por red lenta
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        updateProgress(30, "Descargando datos de SharePoint...", "DESCARGANDO");
        const response = await fetch(powerAutomateUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const jsonData = await response.json();

        updateProgress(60, "Procesando tablas de datos...", "PROCESANDO");
        const keys = Object.keys(jsonData);
        let count = 0;

        for (let key of keys) {
            const dataValue = jsonData[key];
            const stringContent = typeof dataValue === 'object' ? JSON.stringify(dataValue) : String(dataValue);
            const obfuscatedData = btoa(encodeURIComponent(stringContent));
            
            localStorage.setItem(`cache_${key}`, obfuscatedData);
            count++;
            
            let p = 60 + Math.round((count / keys.length) * 35);
            updateProgress(p, `Guardando: ${key}`, "INDEXANDO");
        }

        localStorage.setItem('app_data_version', new Date().toISOString().split('T')[0]);
        
        updateProgress(100, "¡Sincronización completa!", "¡LISTO!");
        setTimeout(() => hideSplash(splash, true), 500);

    } catch (error) {
        console.error("⚠️ Error o timeout en sincronización. Usando caché local:", error);
        updateProgress(100, "Cargando modo local...", "OFFLINE");
        setTimeout(() => hideSplash(splash), 800);
    }
}

function SairLoopDeCarga() {
    // Función auxiliar global por si necesitas romperlo manualmente desde la consola del navegador
    const splash = document.getElementById('sync-splash');
    if (splash) splash.style.display = 'none';
}

function hideSplash(splashElement, reload = false) {
    if (!splashElement) return;
    splashElement.style.opacity = '0';
    setTimeout(() => {
        splashElement.style.display = 'none';
        if (reload && !localStorage.getItem('loaded_once')) {
            localStorage.setItem('loaded_once', 'true');
            location.reload(); // Recarga limpia una sola vez tras la primera sync
        }
    }, 400);
}

window.addEventListener('DOMContentLoaded', () => {
    checkAndSyncData();
});