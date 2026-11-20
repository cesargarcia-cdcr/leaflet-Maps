'use strict';

(function () {
    const storageKey = "IFrameVirtualPCFData";
    const iframeShareMode = new URLSearchParams(window.location.search)
        .get("iframeShare") === "1";
    window.IFrameVirtualPCFData = Object.create(null);
    let resolvePayload;
    window.IFrameVirtualPCFDataReady = new Promise(resolve => {
        resolvePayload = resolve;
    });

    function acceptPayload(payload) {
        if (typeof payload === "string") {
            try {
                payload = JSON.parse(payload);
            } catch (error) {
                console.error("Ignoring invalid iframe data payload: expected JSON.", error);
                return false;
            }
        }

        if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
            console.error("Ignoring invalid iframe data payload: expected an object keyed by dataset name.");
            return false;
        }

        let cachePayload = payload["cache_payload.json"];
        if (typeof cachePayload === "string") {
            try {
                cachePayload = JSON.parse(cachePayload);
            } catch (error) {
                console.error("Ignoring iframe data payload: cache_payload.json is not valid JSON.", error);
                return false;
            }
        }

        if (!cachePayload || typeof cachePayload !== "object" || Array.isArray(cachePayload)) {
            console.error("Ignoring iframe data payload: cache_payload.json must contain a JSON object.");
            return false;
        }

        const receivedFiles = Object.create(null);
        receivedFiles["cache_payload.json"] = cachePayload;
        for (const [fileName, content] of Object.entries(payload)) {
            if (fileName.toLowerCase().endsWith(".docx")) {
                receivedFiles[fileName] = content;
            }
        }

        window.IFrameVirtualPCFFiles = receivedFiles;
        window.IFrameVirtualPCFData = cachePayload;
        window.IFrameVirtualPCFDataReceived = true;
        resolvePayload(receivedFiles);
        return true;
    }

    const isLoadingPage = window.location.pathname.includes("loading-screen");
    if (iframeShareMode && !isLoadingPage) {
        try {
            const storedPayload = sessionStorage.getItem(storageKey);
            if (storedPayload) {
                sessionStorage.removeItem(storageKey);
                if (acceptPayload(storedPayload)) {
                    window.addEventListener("DOMContentLoaded", function () {
                        window.dispatchEvent(new Event("AppDataLoaded"));
                    }, { once: true });
                }
            }
        } catch (error) {
            console.error("Unable to restore iframe data from this tab's session storage.", error);
        }
    } else if (!iframeShareMode) {
        try {
            sessionStorage.removeItem(storageKey);
        } catch (error) {
            console.error("Unable to clear stale iframe data from this tab's session storage.", error);
        }
    }

    window.addEventListener("message", function (event) {
        let parentOrigin;
        try {
            parentOrigin = new URL(document.referrer).origin;
        } catch (_) {
            return;
        }

        if (
            !iframeShareMode ||
            window.parent === window ||
            event.source !== window.parent ||
            !parentOrigin ||
            event.origin !== parentOrigin ||
            !event.data ||
            event.data.type !== "IFrameVirtualPCF:data"
        ) {
            return;
        }

        if (!acceptPayload(event.data.payload)) {
            return;
        }

        if (isLoadingPage) {
            try {
                sessionStorage.setItem(
                    storageKey,
                    JSON.stringify(window.IFrameVirtualPCFFiles)
                );
            } catch (error) {
                console.error("Unable to preserve iframe data across the app's loading page.", error);
            }
            return;
        }

        window.dispatchEvent(new Event("AppDataLoaded"));
    });
})();
