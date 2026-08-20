/* ====================================
   LOADING SCREEN
   Descarga payload y lo almacena
==================================== */

function updateProgress(percent, message, state = "CARGANDO") {

    const bar =
        document.getElementById(
            "bt-progress-bar"
        );

    const textPercent =
        document.getElementById(
            "bt-percentage"
        );

    const statusText =
        document.getElementById(
            "sync-status"
        );

    const stateText =
        document.getElementById(
            "bt-state-text"
        );

    if (bar) {
        bar.style.width =
            `${percent}%`;
    }

    if (textPercent) {
        textPercent.innerText =
            `${percent}%`;
    }

    if (statusText && message) {
        statusText.innerText =
            message;
    }

    if (stateText) {
        stateText.innerText =
            state;
    }
}

function getPowerAutomateUrl() {

    try {

        const params =
            new URLSearchParams(
                window.location.search
            );

        const encoded =
            params.get("data");

        if (!encoded) {
            return null;
        }

        return atob(encoded);

    } catch (err) {

        console.error(
            "Invalid Power Automate URL",
            err
        );

        return null;
    }
}

function savePayload(payload) {

    localStorage.setItem(
        "cache_payload",
        JSON.stringify(payload)
    );
}

function saveIndividualCaches(payload) {

    const keys =
        Object.keys(payload);

    let count = 0;

    keys.forEach(key => {

        try {

            localStorage.setItem(

                `cache_${key}`,

                JSON.stringify(
                    payload[key]
                )

            );

            count++;

        } catch (err) {

            console.warn(
                `Unable to cache ${key}`,
                err
            );

        }

    });

    return count;
}

function hideSplash(
    splashElement,
    reload = false
) {

    if (!splashElement) {
        return;
    }

    splashElement.style.opacity =
        "0";

    setTimeout(() => {

        splashElement.style.display =
            "none";

        if (
            reload &&
            !localStorage.getItem(
                "loaded_once"
            )
        ) {

            localStorage.setItem(
                "loaded_once",
                "true"
            );

            location.reload();
        }

    }, 400);

}

async function checkAndSyncData() {

    const splash =
        document.getElementById(
            "sync-splash"
        );

    try {

        updateProgress(
            10,
            "Conectando con Power Automate...",
            "CONECTANDO"
        );

        const url =
            getPowerAutomateUrl();

        if (!url) {

            console.warn(
                "No data parameter found."
            );

            hideSplash(splash);

            return;
        }

        const controller =
            new AbortController();

        const timeoutId =
            setTimeout(
                () => controller.abort(),
                10000
            );

        updateProgress(
            30,
            "Descargando datos...",
            "DESCARGANDO"
        );

        const response =
            await fetch(
                url,
                {
                    signal:
                        controller.signal
                }
            );

        clearTimeout(
            timeoutId
        );

        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );

        }

        const payload =
            await response.json();

        updateProgress(
            60,
            "Guardando payload...",
            "PROCESANDO"
        );

        savePayload(payload);

        updateProgress(
            75,
            "Indexando datasets...",
            "INDEXANDO"
        );

        const datasetCount =
            saveIndividualCaches(
                payload
            );

        localStorage.setItem(
            "app_data_version",
            new Date()
                .toISOString()
                .split("T")[0]
        );

        updateProgress(
            100,
            `Datasets: ${datasetCount}`,
            "LISTO"
        );

        console.log(
            "✅ Payload downloaded"
        );

        console.log(
            "✅ cache_payload saved"
        );

        window.dispatchEvent(
            new CustomEvent(
                "PayloadReady"
            )
        );

        setTimeout(() => {

            hideSplash(
                splash
            );

        }, 500);

    } catch (error) {

        console.error(
            "⚠️ Sync failed",
            error
        );

        updateProgress(
            100,
            "Modo local",
            "OFFLINE"
        );

        setTimeout(() => {

            hideSplash(
                splash
            );

        }, 1000);
    }
}

window.addEventListener(
    "DOMContentLoaded",
    () => {

        checkAndSyncData();

    }
);