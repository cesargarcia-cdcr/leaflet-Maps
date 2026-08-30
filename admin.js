// --- GUARDAR O CREAR ARCHIVOS Y SUBCARPETAS RECURSIVAMENTE EN OPFS ---
async function guardarEnOPFS(rutaRelativa, contenidoTexto) {
    const root = await navigator.storage.getDirectory();
    const partes = rutaRelativa.split('/').filter(Boolean);
    const nombreArchivo = partes.pop();

    let carpetaActual = root;
    for (const sub of partes) {
        carpetaActual = await carpetaActual.getDirectoryHandle(sub, { create: true });
    }

    const fileHandle = await carpetaActual.getFileHandle(nombreArchivo, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(contenidoTexto);
    await writable.close();
}

// --- SUBIR CARPETA MANTENIENDO JERARQUÍA ---
async function subirArchivosAOPFS() {
    const input = document.getElementById('opfs-file-uploader');
    if (!input.files.length) {
        alert("⚠️ Por favor, selecciona una carpeta de guías.");
        return;
    }

    let contador = 0;
    for (const file of input.files) {
        let rutaRelativa = file.webkitRelativePath || file.name;
        if (!rutaRelativa.startsWith("Guidelines_Info/")) {
            rutaRelativa = `Guidelines_Info/${rutaRelativa}`;
        }

        const contenido = await file.text();
        await guardarEnOPFS(rutaRelativa, contenido);
        contador++;
    }
    
    alert(`✅ ¡${contador} archivos guardados correctamente!`);
    input.value = "";
    await renderizarExploradorOPFS(); // Refrescar vista de árbol automáticamente
}

// --- ESCANEAR OPFS PARA EL MANIFEST ---
async function escanearDirectorioOPFS() {
    try {
        const root = await navigator.storage.getDirectory();
        let guidelinesRoot;
        try {
            guidelinesRoot = await root.getDirectoryHandle("Guidelines_Info");
        } catch {
            return null;
        }
        return await recorrerCarpetaOPFS(guidelinesRoot, "Guidelines_Info");
    } catch (e) {
        console.error("Error al escanear OPFS:", e);
        return null;
    }
}

async function recorrerCarpetaOPFS(dirHandle, rutaActual) {
    let nodo = { name: dirHandle.name, path: rutaActual, type: "directory", children: [] };
    for await (const [nombre, handle] of dirHandle.entries()) {
        const nuevaRuta = `${rutaActual}/${nombre}`;
        if (handle.kind === "directory") {
            nodo.children.push(await recorrerCarpetaOPFS(handle, nuevaRuta));
        } else {
            nodo.children.push({ 
                name: nombre, 
                path: nuevaRuta, 
                type: "file",
                downloadUrl: `./${nuevaRuta}` 
            });
        }
    }
    return nodo;
}

// --- GENERAR MANIFEST LOCAL ---
async function generarYGuardarManifestLocal() {
    const manifest = await escanearDirectorioOPFS();
    if (!manifest) {
        alert("⚠️ La carpeta 'Guidelines_Info' no existe en el OPFS todavía.");
        return;
    }

    await guardarEnOPFS("Guidelines_Info/manifest.json", JSON.stringify(manifest, null, 2));
    alert("⚡ ¡manifest.json generado y guardado en el OPFS local!");
}

// --- 🖥️ RENDERIZAR VISTA ÁRBOL (ESTILO EXPLORADOR DE WINDOWS) ---
async function renderizarExploradorOPFS() {
    const container = document.getElementById("opfs-tree-view");
    container.innerHTML = "Cargando estructura...";

    const arbol = await escanearDirectorioOPFS();
    if (!arbol) {
        container.innerHTML = '<span style="color: #ef4444;">No se encontró la carpeta Guidelines_Info en el OPFS.</span>';
        return;
    }

    container.innerHTML = "";
    const ul = document.createElement("ul");
    ul.style.listStyleType = "none";
    ul.style.paddingLeft = "0";
    ul.style.margin = "0";

    construirNodoHTML(arbol, ul);
    container.appendChild(ul);
}

function construirNodoHTML(nodo, parentElement) {
    const li = document.createElement("li");
    li.style.margin = "4px 0";
    li.style.paddingLeft = "12px";

    const fila = document.createElement("div");
    fila.style.display = "flex";
    fila.style.alignItems = "center";
    fila.style.gap = "8px";

    const icono = document.createElement("span");
    icono.textContent = nodo.type === "directory" ? "📁" : "📄";

    const nombre = document.createElement("span");
    nombre.textContent = nodo.name;
    nombre.style.fontWeight = nodo.type === "directory" ? "bold" : "normal";
    nombre.style.color = nodo.type === "directory" ? "#0f172a" : "#334155";

    // Botón de eliminar (papelera) para cada archivo o carpeta
    const btnBorrar = document.createElement("button");
    btnBorrar.textContent = "🗑️";
    btnBorrar.title = `Eliminar ${nodo.name}`;
    btnBorrar.style.background = "transparent";
    btnBorrar.style.border = "none";
    btnBorrar.style.cursor = "pointer";
    btnBorrar.style.fontSize = "11px";
    btnBorrar.onclick = async () => {
        if (confirm(`¿Estás seguro de eliminar '${nodo.name}' y todo su contenido?`)) {
            await eliminarDeOPFS(nodo.path);
            await renderizarExploradorOPFS(); // Refrescar vista
        }
    };

    fila.appendChild(icono);
    fila.appendChild(nombre);
    fila.appendChild(btnBorrar);
    li.appendChild(fila);

    if (nodo.type === "directory" && nodo.children && nodo.children.length > 0) {
        const subUl = document.createElement("ul");
        subUl.style.listStyleType = "none";
        subUl.style.paddingLeft = "18px";
        subUl.style.borderLeft = "1px dashed #cbd5e1";
        subUl.style.marginLeft = "6px";

        for (const hijo of nodo.children) {
            construirNodoHTML(hijo, subUl);
        }
        li.appendChild(subUl);
    }

    parentElement.appendChild(li);
}

// --- 🗑️ ELIMINAR DE OPFS ---
async function eliminarDeOPFS(rutaRelativa) {
    try {
        const root = await navigator.storage.getDirectory();
        const partes = rutaRelativa.split('/').filter(Boolean);
        const objetivo = partes.pop();

        let carpetaActual = root;
        for (const sub of partes) {
            carpetaActual = await carpetaActual.getDirectoryHandle(sub);
        }

        await carpetaActual.removeEntry(objetivo, { recursive: true });
        console.log(`🗑️ Eliminado del OPFS: ${rutaRelativa}`);
    } catch (e) {
        console.error(`❌ Error al eliminar ${rutaRelativa}:`, e);
        alert(`No se pudo eliminar el elemento.`);
    }
}

// --- SUBIR MANIFEST A SHAREPOINT ---
function obtenerWebhookUrlDesdeIframe() {
    try {
        const iframe = window.parent.document.getElementById("app-frame") || document.getElementById("app-frame");
        if (iframe && iframe.src) {
            const urlObj = new URL(iframe.src);
            const dataParam = urlObj.searchParams.get("data");
            if (dataParam) return atob(dataParam);
        }
    } catch (e) {}
    
    try {
        const urlObj = new URL(window.location.href);
        const dataParam = urlObj.searchParams.get("data");
        if (dataParam) return atob(dataParam);
    } catch (e) {}
    
    return null;
}

async function subirManifestASharePoint() {
    const webhookUrl = obtenerWebhookUrlDesdeIframe();
    if (!webhookUrl) {
        alert("❌ Error: No se encontró la URL del Webhook.");
        return;
    }

    const manifest = await escanearDirectorioOPFS();
    if (!manifest) return;

    try {
        const response = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: "UPDATE_MANIFEST",
                manifestContent: JSON.stringify(manifest, null, 2)
            })
        });

        if (response.ok) {
            alert("✅ ¡Éxito! El manifest.json fue publicado a SharePoint.");
        } else {
            alert("⚠️ Error al sincronizar con SharePoint. Código: " + response.status);
        }
    } catch (err) {
        console.error("Error de red al enviar a SharePoint:", err);
    }
}