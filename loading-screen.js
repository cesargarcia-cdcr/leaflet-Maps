/* ====================================
   LOADING SCREEN (Con Popup Automático y Loop de Cierre)
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

// --- VERIFICACIÓN PURA DE LA URL DEL LOGO ---
function checkSharePointLogo() {
    return new Promise((resolve) => {
        const logoUrl = "https://clinicasdelcaminoreal.sharepoint.com/sites/ACSI/_api/siteiconmanager/getsitelogo?type=%271%27&hash=638573522516023947";
        const img = new Image();
        
        const timeout = setTimeout(() => {
            img.src = "";
            resolve(false);
        }, 4000);

        img.onload = function() {
            clearTimeout(timeout);
            resolve(true);
        };

        img.onerror = function() {
            clearTimeout(timeout);
            resolve(false);
        };

        img.src = logoUrl + "&t=" + new Date().getTime();
    });
}

// --- FLUJO INTELIGENTE EN CASCADA ---
async function verifySharePointSession() {
    console.log("🔍 Verificando sesión de SharePoint...");

    // 1. Intento inicial
    let active = await checkSharePointLogo();
    if (active) return true;

    // 2. Segundo intento rápido por si fue un fallo de red momentáneo
    await new Promise(r => setTimeout(r, 800));
    active = await checkSharePointLogo();
    if (active) return true;

    // 3. Si falla totalmente, activa el bloqueo y el popup automático
    console.warn("⚠️ Sesión expirada. Activando bloqueo y lanzando popup automático.");
    triggerAutomaticLoginFlow();
    return false;
}

// --- BLOQUEO Y LOOP AUTOMÁTICO DE VALIDACIÓN ---
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
            <h2 style="margin-top: 0; color: #f87171; font-size: 22px;">Iniciando Sesión</h2>
            <p id="lock-status-text" style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
                Se ha abierto una ventana emergente para autenticar tu sesión corporativa. Completa tu acceso allí.
            </p>
            <div style="display: flex; align-items: center; justify-content: center; gap: 10px; color: #38bdf8; font-size: 13px; font-weight: 500;">
                <div style="width: 14px; height: 14px; border: 2px solid #38bdf8; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                Esperando a que inicies sesión...
            </div>
            <button id="btn-reopen-popup" style="margin-top: 20px; background: #334155; color: #cbd5e1; border: none; padding: 8px 14px; border-radius: 6px; font-size: 12px; cursor: pointer; width: 100%;">
                Volver a abrir ventana de login si se cerró
            </button>
        </div>
        <style>
            @keyframes spin { to { transform: rotate(360deg); } }
        </style>
    `;
    
    document.body.appendChild(lockScreen);

    let loginWindow = null;

    // Función para abrir la ventana emergente
    const openPopup = () => {
        const width = 600;
        const height = 700;
        const left = (window.screen.width / 2) - (width / 2);
        const top = (window.screen.height / 2) - (height / 2);

        loginWindow = window.open(
            sharePointSiteUrl, 
            "SharePointLoginPopup", 
            `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`
        );

        if (!loginWindow) {
            document.getElementById("lock-status-text").innerHTML = "El navegador bloqueó la ventana automática.<br><b>Por favor haz clic abajo para abrirla:</b>";
            const btn = document.getElementById("btn-reopen-popup");
            btn.style.background = "#3b82f6";
            btn.style.color = "white";
            btn.innerText = "Abrir Ventana de Login";
        }
    };

    // 1. Lanzar el popup automáticamente de inmediato
    openPopup();

    // Botón manual de respaldo por si el navegador bloquea el popup inicial
    document.getElementById("btn-reopen-popup").addEventListener("click", () => {
        if (!loginWindow || loginWindow.closed) {
            openPopup();
        }
    });

    // 2. Loop de sondeo (Polling): Comprueba el logo cada 2 segundos en segundo plano
    const sessionPollInterval = setInterval(async () => {
        const active = await checkSharePointLogo();
        
        if (active) {
            console.log("✅ ¡Sesión detectada exitosamente en el loop! Cerrando popup y continuando...");
            
            // Detener el loop
            clearInterval(sessionPollInterval);

            // Cerrar la ventana del popup si sigue abierta
            try {
                if (loginWindow && !loginWindow.closed) {
                    loginWindow.close();
                }
            } catch (e) {
                console.warn("No se pudo cerrar el popup automáticamente:", e);
            }

            // Quitar la pantalla de bloqueo y reanudar la app
            lockScreen.remove();
            checkAndSyncData();
        }
    }, 2000);
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

// --- NÚCLEO DE DESCARGA CON ENVÍO DE USUARIO A POWER AUTOMATE ---
async function fetchAndProcessData(isManual = false) {
    const splash = document.getElementById("sync-splash");
    if (isManual) showSplash(splash);

    try {
        updateProgress(10, "Verificando credenciales...", "VERIFICANDO");
        
        let baseUrl = getPowerAutomateUrl();
        if (!baseUrl) {
            console.warn("No data parameter found.");
            hideSplash(splash);
            return false;
        }

        // 1. Obtener el correo del usuario (puedes extraerlo del perfil de SharePoint o usar una variable temporal/almacenada)
        // Por ahora, puedes usar una variable o recuperarlo de donde lo tengas guardado tras el login:
        const currentUserEmail = localStorage.getItem("user_email") || "cgarcia@clinicasdelcaminoreal.com";

        // 2. Adjuntar el correo como parámetro query (?userEmail=...) a la URL del flujo
        const separator = baseUrl.includes("?") ? "&" : "?";
        const secureUrlWithUser = `${baseUrl}${separator}userEmail=${encodeURIComponent(currentUserEmail)}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        // 3. Llamar al flujo de Power Automate pasando la URL con el correo integrado
        const response = await fetch(secureUrlWithUser, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Acceso denegado o error en el servidor (HTTP ${response.status})`);
        }

        const reader = response.body.getReader();
        const chunks = [];
        let loaded = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            loaded += value.length;
            updateProgress(50, `Descargando datos... (${(loaded / 1024).toFixed(0)} KB)`, "DESCARGANDO");
        }

        updateProgress(72, "Procesando paquetes...", "PROCESANDO");

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

        updateProgress(90, "Guardando datasets...", "GUARDANDO");
        savePayload(payload);
        saveIndividualCaches(payload);

        localStorage.setItem("app_data_version", new Date().toISOString().split("T")[0]);

        updateProgress(100, "¡Sincronización exitosa!", "LISTO");

        setTimeout(() => {
            hideSplash(splash);
            window.dispatchEvent(new CustomEvent("PayloadReady"));
        }, 500);

        return true;

    } catch (error) {
        console.error("⚠️ Validación o sincronización fallida:", error);
        updateProgress(100, "Acceso no autorizado / Error", "ERROR");

        setTimeout(() => {
            hideSplash(splash);
            triggerAutomaticLogonFlow(); // Si falla, abre el popup de nuevo
        }, 1500);

        return false;
    }
}

// --- COMPROBACIÓN DIARIA ---
async function checkAndSyncData() {
    const splash = document.getElementById("sync-splash");
    
    const sessionActive = await verifySharePointSession();
    if (!sessionActive) return; // Si la sesión no está activa, detiene el flujo y lanza el popup automático

    const lastVersionDate = localStorage.getItem("app_data_version");
    const todayStr = new Date().toISOString().split("T")[0];
    const hasPayload = localStorage.getItem("cache_payload");

    if (lastVersionDate === todayStr && hasPayload) {
        console.log("⚡ Datos ya actualizados hoy. Usando caché local.");
        if (splash) splash.style.display = "none";
        window.dispatchEvent(new CustomEvent("PayloadReady"));
        return;
    }

    await fetchAndProcessData(false);
}

// --- BOTÓN MANUAL ---
window.triggerManualSync = async function() {
    console.log("🔄 Sincronización manual iniciada por el usuario...");
    
    const sessionActive = await verifySharePointSession();
    if (!sessionActive) return;

    await fetchAndProcessData(true);
};

window.addEventListener("DOMContentLoaded", () => {
    checkAndSyncData();
});