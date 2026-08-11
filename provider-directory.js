/* provider-directory.js — Master Cross-Reference Search Engine */
'use strict';

(function () {
    let masterList = [];
    let globalScheduleMap = {};
    let npiLookupMap = {};
    let MAIN_PROVIDERS = [];
    let PROVIDERS_NPI = [];
    let PROVIDERS_SCHED = [];

    // Lector de CSV Profesional para manejar comas internas
    function parseStandardCSV(text) {
        if (!text) return [];
        const lines = [];
        let row = [""];
        let inQuotes = false;
        for (let i = 0; i < text.length; i++) {
            const c = text[i];
            const next = text[i+1];
            if (c === '"') {
                if (inQuotes && next === '"') { row[row.length - 1] += '"'; i++; }
                else { inQuotes = !inQuotes; }
            } else if (c === ',' && !inQuotes) {
                row.push('');
            } else if ((c === '\r' || c === '\n') && !inQuotes) {
                if (c === '\r' && next === '\n') { i++; }
                lines.push(row);
                row = [''];
            } else {
                row[row.length - 1] += c;
            }
        }
        if (row.length > 1 || row[0] !== '') { lines.push(row); }
        if (lines.length === 0) return [];

        const headers = lines[0].map(h => h.trim());
        const result = [];
        for (let i = 1; i < lines.length; i++) {
            const currentLine = lines[i];
            if (currentLine.length === 1 && currentLine[0] === '') continue;
            const obj = {};
            headers.forEach((header, index) => {
                obj[header] = currentLine[index] !== undefined ? currentLine[index].trim() : '';
            });
            result.push(obj);
        }
        return result;
    }

    async function preloadProviderData() {
        try {
            console.log("📂 [PROVIDER_LOG] Iniciando lectura de datos de proveedores...");
            
            let mainTxt = null;
            if (typeof window.obtenerArchivo === 'function') {
                // 🎯 Apuntar directamente a la clave exacta que arroja Power Automate
                mainTxt = await window.obtenerArchivo('mainProviders');
            }
            if (!mainTxt) {
                mainTxt = localStorage.getItem('mainProviders');
            }

            if (mainTxt) {
                if (typeof mainTxt === 'string' && (mainTxt.trim().startsWith('[') || mainTxt.trim().startsWith('{'))) {
                    try {
                        const parsed = JSON.parse(mainTxt);
                        masterList = Array.isArray(parsed) ? parsed : (parsed.value || parsed.mainProviders || []);
                    } catch (e) {
                        masterList = parseStandardCSV(mainTxt);
                    }
                } else if (Array.isArray(mainTxt)) {
                    masterList = mainTxt;
                } else {
                    masterList = parseStandardCSV(mainTxt);
                }
            } else {
                console.warn("⚠️ [PROVIDER_LOG] No se encontró la llave mainProviders en el caché.");
                masterList = [];
            }

            console.log(`✅ [PROVIDER_LOG] Registros cargados con éxito: ${masterList.length}`);
            renderDirectory();
            initAutocomplete();

        } catch (error) {
            console.error("❌ [PROVIDER_LOG] Error en precarga de datos:", error);
        }
    }

    // Motor de Autocompletado Predictivo (5 Opciones más probables)
    function initAutocomplete() {
        const searchInput = document.getElementById('masterProviderSearch');
        if (!searchInput) return;

        // Crear contenedor relativo flotante para alinear las sugerencias sin romper el diseño
        let wrapper = document.getElementById('pdir-search-wrapper');
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.id = 'pdir-search-wrapper';
            wrapper.className = 'pdir-wrapper-container';
            searchInput.parentNode.insertBefore(wrapper, searchInput);
            wrapper.appendChild(searchInput);
        }

        let listContainer = document.getElementById('pdir-auto-list');
        if (!listContainer) {
            listContainer = document.createElement('div');
            listContainer.id = 'pdir-auto-list';
            listContainer.className = 'pdir-autocomplete-suggestions';
            wrapper.appendChild(listContainer);
        }

        searchInput.addEventListener('input', function() {
            const val = this.value.toLowerCase().trim();
            listContainer.innerHTML = '';
            if (!val) return;

            // Filtrar candidatos en base a múltiples criterios (Nombre, ID, NPI o Especialidad)
            const matches = masterList.filter(doc => {
                const name = String(doc['Provider'] || '').toLowerCase();
                const id = String(doc['Provider ID'] || '');
                const npi = String(doc['NPI'] || '');
                const spec = String(doc['Specialty'] || '').toLowerCase();
                return name.includes(val) || id.includes(val) || npi.includes(val) || spec.includes(val);
            });

            // Tomar únicamente las 5 opciones con mayor probabilidad
            const top5 = matches.slice(0, 5);

            top5.forEach(doc => {
                const itemHtml = document.createElement('div');
                itemHtml.className = 'pdir-auto-item';
                itemHtml.innerHTML = `<strong>${doc['Provider']}</strong> <span style="font-size:11px; color:#64748b;">(${doc['Specialty'] || 'Staff'})</span>`;
                
                // Acción al dar clic: Autocompletar entrada y renderizar tarjeta elegida
                itemHtml.addEventListener('click', () => {
                    searchInput.value = doc['Provider'];
                    listContainer.innerHTML = '';
                    renderDirectory(doc['Provider']);
                });
                listContainer.appendChild(itemHtml);
            });
        });

        // Cerrar el panel flotante si se da un clic fuera del buscador
        document.addEventListener('click', (e) => {
            if (e.target !== searchInput) listContainer.innerHTML = '';
        });
    }

    // Renderizado dinámico de tarjetas
    function renderDirectory(filterText = '') {
        const grid = document.getElementById('masterProviderGrid');
        if (!grid) return;

        const query = filterText.toLowerCase().trim();
        let htmlArr = [];

        masterList.forEach(doc => {
            // Mapeo flexible para asegurar que encuentre las columnas sin importar variaciones de espacios o símbolos
            const getVal = (keys) => {
                for (const k of keys) {
                    if (doc[k] !== undefined && doc[k] !== '') return String(doc[k]).trim();
                }
                // Búsqueda por coincidencia parcial en las llaves del objeto si fallan las exactas
                const foundKey = Object.keys(doc).find(k => keys.some(target => k.toLowerCase().includes(target.toLowerCase())));
                return foundKey ? String(doc[foundKey]).trim() : '';
            };

            const docId = getVal(['Provider ID', 'provider id', 'ID']);
            const docName = getVal(['Provider', 'provider', 'Name']);
            const docSpec = getVal(['Specialty', 'specialty']) || 'General Medicine';
            const docDegree = getVal(['Dr Degree', 'dr degree', 'Degree']);
            
            const docLocation = getVal(['Location', 'location']);
            const docGender = getVal(['Gender', 'gender']);
            const docLang = getVal(['Languages', 'languages']);
            const docEpic = getVal(['Epic Headers', 'epic headers']);
            
            let docNpi = getVal(['NPI', 'npi']);
            if (!docNpi || docNpi === 'N/A') docNpi = npiLookupMap[docId] || 'N/A';
            
            // Captura estricta para Do's y Don'ts con símbolos
            const docDos = getVal(["Do's ✔", "Dos", "Do's"]);
            const docDonts = getVal(["Don'ts ❌", "Donts", "Don'ts"]);

            if (!docName && !docId) return;

            if (query && !docName.toLowerCase().includes(query) && !docId.includes(query) && !docNpi.includes(query) && !docSpec.toLowerCase().includes(query)) {
                return;
            }

            let guidelinesHtml = '';
            if (docDos || docDonts || docEpic) {
                guidelinesHtml = `
                    <div class="pdir-guidelines-box">
                        ${docEpic ? `<div style="font-size:0.75rem; color:#0284c7; margin-bottom:4px;">💻 <strong>Epic:</strong> ${docEpic}</div>` : ''}
                        ${docDos ? `<div class="pdir-do-line"><strong>Do's ✔:</strong> ${docDos}</div>` : ''}
                        ${docDonts ? `<div class="pdir-dont-line"><strong>Don'ts ❌:</strong> ${docDonts}</div>` : ''}
                    </div>
                `;
            }

            htmlArr.push(`
                <div class="pdir-card">
                    <div class="pdir-card-top">
                        <div class="pdir-meta-left">
                            <h4 class="pdir-doc-name">${docName}${docDegree ? `, ${docDegree}` : ''}</h4>
                            <div class="pdir-ids">
                                <span>🔑 Provider ID: <strong>${docId || 'NOT ASSIGNED'}</strong></span>
                                <span>🌐 NPI: <strong>${docNpi}</strong></span>
                                ${docLocation ? `<span>📍 Location: <strong>${docLocation}</strong></span>` : ''}
                                ${docGender ? `<span>👤 Gender: ${docGender}</span>` : ''}
                                ${docLang ? `<span style="font-size:0.75rem; margin-top:4px; color:#475569;">🗣️ Languages: ${docLang}</span>` : ''}
                            </div>
                        </div>
                        <span class="pdir-badge">${docSpec}</span>
                    </div>
                    ${guidelinesHtml}
                </div>
            `);
        });

        if (htmlArr.length === 0) {
            grid.innerHTML = `<div class="pdir-empty">❌ No providers found matching "${filterText}"</div>`;
        } else {
            grid.innerHTML = htmlArr.join('');
        }
    }

    function initMasterProviderDirectory() {
        const searchInput = document.getElementById('masterProviderSearch');
        if (searchInput && !searchInput.__wired) {
            searchInput.addEventListener('input', (e) => renderDirectory(e.target.value));
            searchInput.__wired = true;
        }
        renderDirectory(searchInput?.value || '');
    }

    preloadProviderData();
    window.initMasterProviderDirectory = initMasterProviderDirectory;
})();