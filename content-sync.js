// content-sync.js - Sincronizador en segundo plano y gestor de eventos en vivo

(function () {
    'use strict';

    // Función principal que arranca la sincronización secundaria
    async function startBackgroundSync(baseUrl) {
        try {
            console.log("🔄 [Sync] Iniciando sincronización en segundo plano de carpetas secundarias...");
            const rootDir = await navigator.storage.getDirectory();
            
            const response = await fetch(baseUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "READ_MANIFEST" })
            });

            if (!response.ok) return;
            const payload = await response.json();
            const allItems = [...(payload.guidelines || []), ...(payload.directory || [])];

            const fileItems = allItems.filter(item => {
                const type = (item.type || "").toLowerCase();
                return type !== "directory" && type !== "folder" && item.name;
            });

            for (const item of fileItems) {
                try {
                    let rawPath = item.path || "";
                    if (rawPath.endsWith("/") && item.name) {
                        rawPath += item.name;
                    } else if (!rawPath.endsWith("/") && !rawPath.endsWith(item.name)) {
                        rawPath = rawPath + "/" + item.name;
                    }
                    const cleanFilePath = rawPath.replace(/([^:]\/)\/+/g, "$1");

                    const downloadRes = await fetch(baseUrl, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "DOWNLOAD_FILE", filePath: cleanFilePath })
                    });

                    if (downloadRes.ok) {
                        const fileContent = await downloadRes.text();
                        
                        const isGuidelines = cleanFilePath.includes("Guidelines_Info");
                        const targetBaseDir = isGuidelines 
                            ? await rootDir.getDirectoryHandle("Guidelines_Info", { create: true })
                            : rootDir;

                        let subFolder = "";
                        if (isGuidelines) {
                            const parts = cleanFilePath.split("Guidelines_Info/")[1].split("/");
                            if (parts.length > 1) subFolder = parts[0];
                        } else if (cleanFilePath.includes("Directory/")) {
                            subFolder = "Directory";
                        }

                        let targetHandle = targetBaseDir;
                        if (subFolder) {
                            targetHandle = await targetBaseDir.getDirectoryHandle(subFolder, { create: true });
                        }

                        const fileHandle = await targetHandle.getFileHandle(item.name, { create: true });
                        const writable = await fileHandle.createWritable();
                        await writable.write(fileContent);
                        await writable.close();

                        // 🚀 Emitir evento en vivo para que cualquier vista (como directory.js) lo pinte al instante
                        window.dispatchEvent(new CustomEvent("FileSyncedLive", {
                            detail: {
                                category: isGuidelines ? subFolder : "Directory",
                                name: item.name,
                                handle: fileHandle
                            }
                        }));
                    }
                } catch (fileErr) {
                    console.warn(`⚠️ [Sync] Error procesando archivo ${item.name}:`, fileErr);
                }
            }
            console.log("🎉 [Sync] Sincronización secundaria completada con éxito.");
        } catch (bgErr) {
            console.warn("⚠️ [Sync] Error general en segundo plano:", bgErr);
        }
    }

    // Exponer método global o disparar automáticamente cuando la UI principal se libere
    window.ContentSync = {
        init: startBackgroundSync
    };
})();