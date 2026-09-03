document.addEventListener("DOMContentLoaded", function() {
    const infoSectionBody = document.querySelector('#info-section .card-body');
    if (!infoSectionBody) return;

    infoSectionBody.innerHTML = '<span style="font-size: 0.75rem; color: #64748b; padding: 10px;">Escaneando directorios clínicos...</span>';

    // Función auxiliar para extraer el peso numérico y limpiar el nombre visual
    function parseSortingName(rawName) {
        // Busca si empieza con números seguidos de un guion bajo (ej: "1_Scheduling_Templates" o "02_Family_Practice")
        const match = rawName.match(/^(\d+)_(.+)$/);
        if (match) {
            return {
                order: parseInt(match[1], 10),
                cleanName: match[2].replace(/_/g, ' ') // Quita guiones bajos
            };
        }
        return {
            order: Infinity, // Si no tiene número, va al final
            cleanName: rawName.replace(/_/g, ' ')
        };
    }

    // Función de comparación para el ordenamiento (Sort)
    function sortItems(a, b) {
        const itemA = parseSortingName(a);
        const itemB = parseSortingName(b);

        // Si ambos tienen número, ordenamos por el número
        if (itemA.order !== itemB.order) {
            return itemA.order - itemB.order;
        }
        // Si no tienen número (o es el mismo), ordenamos alfabéticamente por su nombre limpio
        return itemA.cleanName.localeCompare(itemB.cleanName);
    }

    // 1. Pedir la estructura viva al servidor
    fetch('/data-files')
        .then(response => response.json())
        .then(data => {
            const guidelines = data.guidelines;
            
            if (!guidelines || Object.keys(guidelines).length === 0) {
                infoSectionBody.innerHTML = '<div style="padding: 6px; font-style: italic; color: #94a3b8; font-size: 0.7rem;">No se encontraron carpetas en Guidelines_Info/</div>';
                return;
            }

            infoSectionBody.innerHTML = '';

            // 2. ORDENAR LAS CARPETAS basándose en tu nueva regla
            const sortedFolders = Object.keys(guidelines).sort(sortItems);

            // 3. Iterar sobre las carpetas ya ordenadas
            sortedFolders.forEach(folderName => {
                const folderInfo = parseSortingName(folderName);
                
                // Creamos el contenedor del grupo clínico
                const infoGroup = document.createElement('div');
                infoGroup.className = 'info-group';
                
                // DETECCIÓN CRÍTICA: Si la carpeta contiene "Critical", aplicamos un estilo destacado pero sutil
                const isCritical = folderInfo.cleanName.toLowerCase().includes('critical');
                
                if (isCritical) {
                    infoGroup.style.cssText = 'border: 1px solid #f5c6cb; border-radius: 4px; background: #fff5f5; margin-bottom: 6px; border-left: 4px solid var(--cpe-infant);';
                } else {
                    infoGroup.style.cssText = 'border: 1px solid #cbd5e1; border-radius: 4px; background: #f8fafc; margin-bottom: 6px;';
                }
                
                // Ajustamos también el color del texto del encabezado si es crítico
                const headerColor = isCritical ? '#721c24' : '#1a365d';
                const borderBottomColor = isCritical ? '#f5c6cb' : '#e2e8f0';
                
                infoGroup.innerHTML = `
                    <div style="padding: 4px 8px; font-size: 0.75rem; font-weight: bold; color: ${headerColor}; border-bottom: 1px solid ${borderBottomColor};">
                        📁 ${folderInfo.cleanName}
                    </div>
                    <div class="group-content" style="padding: 4px;"></div>
                `;
                
                const groupContent = infoGroup.querySelector('.group-content');
                const rawFiles = guidelines[folderName];

                if (rawFiles.length === 0) {
                    groupContent.innerHTML = '<div style="padding: 4px; font-style: italic; color: #94a3b8; font-size: 0.7rem;">No hay documentos en esta carpeta.</div>';
                }

                // 4. ORDENAR LOS ARCHIVOS HTML dentro de esta carpeta
                const sortedFiles = rawFiles.sort(sortItems);

                // 5. Iterar sobre los archivos ya ordenados
                sortedFiles.forEach(fileName => {
                    const nameWithoutExt = fileName.replace('.html', '');
                    const fileInfo = parseSortingName(nameWithoutExt);
                    
                    const details = document.createElement('details');
                    details.style.cssText = 'background: #ffffff; border: 1px solid #e2e8f0; border-radius: 3px; margin-bottom: 4px;';
                    
                    // Evaluar si el archivo es de alta prioridad/seguridad crítica
                    const lowerName = fileInfo.cleanName.toLowerCase();
                    const isHighRisk = lowerName.includes('dea') || lowerName.includes('fraud') || lowerName.includes('compliance');
                    
                    // Si es de alto riesgo, cambiamos el color del texto del resumen y añadimos un aviso visual
                    const summaryColor = isHighRisk ? '#c53030' : '#4a5568';
                    const fileIcon = isHighRisk ? '🛡️' : '📄';
                    const extraWeight = isHighRisk ? 'font-weight: 700;' : 'font-weight: 600;';
                    
                    // ID único para evitar colisiones
                    const targetId = `dynamic-${folderName}-${nameWithoutExt}`.replace(/\s+/g, '-');
                    
                    details.innerHTML = `
                        <summary style="font-size: 0.75rem; ${extraWeight} padding: 4px 6px; cursor: pointer; color: ${summaryColor}; outline: none;">
                            ${fileIcon} ${fileInfo.cleanName}
                        </summary>
                        <div id="${targetId}" style="padding: 6px; border-top: 1px solid #f1f5f9; max-height: 55vh; overflow-y: auto;">
                            <span style="font-size: 0.7rem; color: #94a3b8;">Cargando contenido...</span>
                        </div>
                    `;
                    
                    groupContent.appendChild(details);

                    // 6. Hacer el fetch usando la ruta original del disco (con números y todo)
                    const fileUrl = `Guidelines_Info/${folderName}/${fileName}`;
                    fetch(fileUrl)
                        .then(res => {
                            if (!res.ok) throw new Error(`HTTP ${res.status}`);
                            return res.text();
                        })
                        .then(htmlContent => {
                            document.getElementById(targetId).innerHTML = htmlContent;
                        })
                        .catch(err => {
                            document.getElementById(targetId).innerHTML = `<span style="color:#ef4444; font-size:0.7rem;">⚠️ Error al cargar contenido: ${err.message}</span>`;
                        });
                });
                infoSectionBody.appendChild(infoGroup);
            });
        })
        .catch(error => {
            console.error("Error al mapear directorios clínicos:", error);
            infoSectionBody.innerHTML = `<div style="color:#ef4444; padding:6px; font-size:0.75rem;">❌ Error crítico del sistema de archivos: ${error.message}</div>`;
        });
});