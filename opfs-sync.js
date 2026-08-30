// opfs-sync.js - Utilidad independiente para exportar el OPFS y sincronizarlo via postMessage

async function exportGuidelinesFromOPFS() {
    const rootDir = await navigator.storage.getDirectory();
    
    let guidelinesDir;
    try {
        guidelinesDir = await rootDir.getDirectoryHandle('Guidelines_Info');
    } catch (e) {
        throw new Error("No se encontró el directorio 'Guidelines_Info' en el OPFS local.");
    }
    
    const guidelinesPayload = {};

    for await (const [folderName, folderHandle] of guidelinesDir.entries()) {
        if (folderHandle.kind === 'directory') {
            guidelinesPayload[folderName] = {};
            
            for await (const [fileName, fileHandle] of folderHandle.entries()) {
                if (fileHandle.kind === 'file') {
                    const file = await fileHandle.getFile();
                    const htmlContent = await file.text();
                    guidelinesPayload[folderName][fileName] = htmlContent;
                }
            }
        }
    }

    return {
        guidelines: guidelinesPayload,
        updatedAt: new Date().toISOString(),
        updatedBy: localStorage.getItem("user_email") || "Admin"
    };
}

// Función global que empaqueta y envía el postMessage al parent
async function triggerOPFSSync() {
    try {
        console.log("📦 Empaquetando estructura del OPFS...");
        const payloadData = await exportGuidelinesFromOPFS();

        window.parent.postMessage({
            action: "UPLOAD_GUIDELINES_TO_SP",
            payload: payloadData
        }, window.location.origin);

        console.log("📤 Paquete JSON enviado al entorno principal (parent) con éxito.");
        return true;
    } catch (err) {
        console.error("❌ Error al exportar el OPFS:", err);
        throw err;
    }
}