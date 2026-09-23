document.addEventListener("DOMContentLoaded", async function() {
    const infoSectionBody = document.querySelector('#info-section .card-body');
    if (!infoSectionBody) return;

    infoSectionBody.innerHTML = '<span style="font-size: 0.75rem; color: #64748b; padding: 10px;">Escaneando directorios clínicos desde OPFS...</span>';

    // Función auxiliar para extraer el peso numérico, evaluar la regla de Critical y limpiar el nombre visual
    function parseSortingName(rawName) {
        let order = Infinity;
        let remainder = rawName;

        const numMatch = rawName.match(/^(\d+)_(.+)$/);
        if (numMatch) {
            order = parseInt(numMatch[1], 10);
            remainder = numMatch[2];
        }

        // Regla de la palabra "Critical"
        const criticalRegex = /^critical_(.+)$/i;
        const critMatch = remainder.match(criticalRegex);

        let isCritical = false;
        let displayName = remainder.replace(/_/g, ' ');

        // Si es solo "Critical" o empieza con "Critical_", aplicamos el flag crítico
        if (remainder.toLowerCase() === 'critical' || remainder.toLowerCase().startsWith('critical_')) {
            isCritical = true;
            if (critMatch) {
                // Si hay texto adicional (ej: 01_Critical_text), ocultamos la numeración y la palabra Critical, mostrando solo el texto restante.
                displayName = critMatch[1].replace(/_/g, ' ');
            }
        }

        return {
            order: order,
            cleanName: remainder.replace(/_/g, ' '),
            displayName: displayName,
            isCritical: isCritical
        };
    }

    // Función de comparación para el ordenamiento
    function sortItems(a, b) {
        const itemA = parseSortingName(a);
        const itemB = parseSortingName(b);

        if (itemA.order !== itemB.order) {
            return itemA.order - itemB.order;
        }
        return itemA.cleanName.localeCompare(itemB.cleanName);
    }

    // Función para leer la estructura de directorios y archivos HTML desde el OPFS
    async function loadGuidelinesFromOPFS() {
        try {
            const rootDir = await navigator.storage.getDirectory();
            const guidelinesDir = await rootDir.getDirectoryHandle("Guidelines_Info", { create: false });
            
            const guidelinesData = {};

            // Iterar sobre las carpetas dentro de Guidelines_Info
            for await (const [folderName, folderHandle] of guidelinesDir.entries()) {
                if (folderHandle.kind === 'directory') {
                    const htmlFiles = [];
                    
                    // Iterar dentro de cada subcarpeta buscando únicamente archivos .html
                    for await (const [fileName, fileHandle] of folderHandle.entries()) {
                        if (fileHandle.kind === 'file' && fileName.toLowerCase().endsWith('.html')) {
                            htmlFiles.push(fileName);
                        }
                    }

                    guidelinesData[folderName] = htmlFiles;
                }
            }

            return guidelinesData;
        } catch (err) {
            console.warn("⚠️ No se encontró la carpeta Guidelines_Info en OPFS o está vacía:", err);
            return null;
        }
    }

    // Función para leer el contenido de un archivo HTML específico desde el OPFS
    async function fetchHtmlFromOPFS(folderName, fileName) {
        try {
            const rootDir = await navigator.storage.getDirectory();
            const guidelinesDir = await rootDir.getDirectoryHandle("Guidelines_Info");
            const folderHandle = await guidelinesDir.getDirectoryHandle(folderName);
            const fileHandle = await folderHandle.getFileHandle(fileName);
            const file = await fileHandle.getFile();
            return await file.text();
        } catch (err) {
            throw new Error(`No se pudo leer el archivo local: ${err.message}`);
        }
    }

    // 1. Cargar la estructura directamente desde el OPFS
    const guidelines = await loadGuidelinesFromOPFS();

    if (!guidelines || Object.keys(guidelines).length === 0) {
        infoSectionBody.innerHTML = '<div style="padding: 6px; font-style: italic; color: #94a3b8; font-size: 0.7rem;">No se encontraron carpetas o archivos HTML en Guidelines_Info del OPFS.</div>';
        return;
    }

    infoSectionBody.innerHTML = '';

    // 2. ORDENAR LAS CARPETAS
    const sortedFolders = Object.keys(guidelines).sort(sortItems);

    // 3. Iterar sobre las carpetas ordenadas
    sortedFolders.forEach(folderName => {
        const folderInfo = parseSortingName(folderName);
        
        const infoGroup = document.createElement('div');
        infoGroup.className = 'info-group';
        
        // DETECCIÓN CRÍTICA: Usamos el flag evaluado en parseSortingName
        const isCritical = folderInfo.isCritical;
        
        if (isCritical) {
            infoGroup.style.cssText = 'border: 1px solid #f5c6cb; border-radius: 4px; background: #fff5f5; margin-bottom: 6px; border-left: 4px solid var(--cpe-infant);';
        } else {
            infoGroup.style.cssText = 'border: 1px solid #cbd5e1; border-radius: 4px; background: #f8fafc; margin-bottom: 6px;';
        }
        
        const headerColor = isCritical ? '#721c24' : '#1a365d';
        const borderBottomColor = isCritical ? '#f5c6cb' : '#e2e8f0';
        
        infoGroup.innerHTML = `
            <div style="padding: 4px 8px; font-size: 0.75rem; font-weight: bold; color: ${headerColor}; border-bottom: 1px solid ${borderBottomColor};">
                📁 ${folderInfo.displayName}
            </div>
            <div class="group-content" style="padding: 4px;"></div>
        `;
        
        const groupContent = infoGroup.querySelector('.group-content');
        const rawFiles = guidelines[folderName];

        if (rawFiles.length === 0) {
            groupContent.innerHTML = '<div style="padding: 4px; font-style: italic; color: #94a3b8; font-size: 0.7rem;">No hay documentos HTML en esta carpeta.</div>';
        }

        // 4. ORDENAR LOS ARCHIVOS HTML
        const sortedFiles = rawFiles.sort(sortItems);

        // 5. Iterar sobre los archivos HTML ordenados
        sortedFiles.forEach(fileName => {
            const nameWithoutExt = fileName.replace('.html', '');
            const fileInfo = parseSortingName(nameWithoutExt);
            
            const details = document.createElement('details');
            details.style.cssText = 'background: #ffffff; border: 1px solid #e2e8f0; border-radius: 3px; margin-bottom: 4px;';
            
            const lowerName = fileInfo.cleanName.toLowerCase();
            const isHighRisk = lowerName.includes('dea') || lowerName.includes('fraud') || lowerName.includes('compliance');
            
            const summaryColor = isHighRisk ? '#c53030' : '#4a5568';
            const fileIcon = isHighRisk ? '🛡️' : '📄';
            const extraWeight = isHighRisk ? 'font-weight: 700;' : 'font-weight: 600;';
            
            const targetId = `dynamic-${folderName}-${nameWithoutExt}`.replace(/\s+/g, '-');
            
            details.innerHTML = `
                <summary style="font-size: 0.75rem; ${extraWeight} padding: 4px 6px; cursor: pointer; color: ${summaryColor}; outline: none;">
                    ${fileIcon} ${fileInfo.displayName}
                </summary>
                <div id="${targetId}" style="padding: 6px; border-top: 1px solid #f1f5f9; max-height: 55vh; overflow-y: auto;">
                    <span style="font-size: 0.7rem; color: #94a3b8;">Cargando contenido local...</span>
                </div>
            `;
            
            groupContent.appendChild(details);

            // 6. Leer el contenido del archivo HTML directamente desde el OPFS de forma asíncrona
            // En lugar de usar únicamente .innerHTML, asegurémonos de evaluar los scripts:
            fetchHtmlFromOPFS(folderName, fileName)
                .then(htmlContent => {
                    const container = document.getElementById(targetId);
                    container.innerHTML = htmlContent;

                    // Extraer y re-ejecutar manualmente las etiquetas <script> que vengan dentro del HTML inyectado
                    const scripts = container.querySelectorAll('script');
                    scripts.forEach(oldScript => {
                        const newScript = document.createElement('script');
                        Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                        newScript.appendChild(document.createTextNode(oldScript.innerHTML));
                        oldScript.parentNode.replaceChild(newScript, oldScript);
                    });
                })
                .catch(err => {
                    document.getElementById(targetId).innerHTML = `<span style="color:#ef4444; font-size:0.7rem;">⚠️ Error al cargar desde OPFS: ${err.message}</span>`;
                });
});
        
        infoSectionBody.appendChild(infoGroup);
    });
});