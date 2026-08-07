/* provider-directory.js — Master Cross-Reference Search Engine */
'use strict';

(function () {
    let masterList = [];
    let globalScheduleMap = {};
    let npiLookupMap = {};

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

    // Auto-carga asíncrona directa desde el disco
    async function preloadProviderData() {
        try {
            console.log("📂 Cargando bases de datos de proveedores desde la raíz...");
            
            const responseMain = await fetch('/Main-Providers.csv');
            if (responseMain.ok) {
                masterList = parseStandardCSV(await responseMain.text());
            }

            const responseSched = await fetch('/PROVIDERS-Sched.csv');
            if (responseSched.ok) {
                const schedList = parseStandardCSV(await responseSched.text());
                
                // 🕒 OBTENER FECHA REAL HOY (Se desplaza sola día con día en tiempo real)
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const currentYear = today.getFullYear();

                globalScheduleMap = {};
                schedList.forEach(slot => {
                    const pId = String(slot['Provider ID'] || '').trim();
                    if (!pId) return;

                    const dateStr = String(slot['Date'] || '').trim();
                    let isFuture = true;
                    
                    if (dateStr) {
                        // 🛠️ LIMPIEZA DE FECHA: Remueve el prefijo del día de la semana (ej: "Mon Jun 1" -> "Jun 1")
                        const cleanDateStr = dateStr.replace(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+/i, '');
                        
                        // Combinar con el año actual asumido de forma segura
                        const parsedDate = Date.parse(`${cleanDateStr} ${currentYear}`);
                        
                        if (!isNaN(parsedDate)) {
                            const slotDate = new Date(parsedDate);
                            // Comparación estricta: Si la rotación es menor al día de hoy, se descarta
                            if (slotDate < today) {
                                isFuture = false;
                            }
                        }
                    }

                    if (!isFuture) return;

                    if (!globalScheduleMap[pId]) globalScheduleMap[pId] = [];
                    globalScheduleMap[pId].push({
                        date: dateStr,
                        clinic: slot['Health Center'] || 'On-Site',
                        role: slot['JOB NAME'] || 'Provider'
                    });
                });
                // console.log("✅ PROVIDERS-Sched.csv filtrado: Solo mostrando turnos vigentes y futuros.");
            }

            const responseNpi = await fetch('/Providers-npi.csv');
            if (responseNpi.ok) {
                const npiList = parseStandardCSV(await responseNpi.text());
                npiList.forEach(item => {
                    const pId = String(item['Provider ID'] || '').trim();
                    const npi = String(item['NPI'] || '').trim();
                    if (pId && npi) npiLookupMap[pId] = npi;
                });
            }

            renderDirectory();
            initAutocomplete();

        } catch (error) {
            console.error("❌ Error en precarga de datos:", error);
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
            const docId = String(doc['Provider ID'] || '').trim();
            const docName = String(doc['Provider'] || '').trim();
            const docSpec = String(doc['Specialty'] || 'General Medicine').trim();
            const docDegree = String(doc['Dr Degree'] || '').trim();
            const docLang = String(doc['Languages '] || doc['Languages'] || '').trim();
            
            let docNpi = String(doc['NPI'] || '').trim();
            if (!docNpi || docNpi === 'N/A') docNpi = npiLookupMap[docId] || 'N/A';
            
            const docDos = String(doc["Do's ✔"] || '').trim();
            const docDonts = String(doc["Don'ts ❌"] || '').trim();

            if (!docName && !docId) return;

            if (query && !docName.toLowerCase().includes(query) && !docId.includes(query) && !docNpi.includes(query) && !docSpec.toLowerCase().includes(query)) {
                return;
            }

            const scheduleSlots = docId ? (globalScheduleMap[docId] || []) : [];
            let scheduleHtml = '';

            if (scheduleSlots.length > 0) {
                const uniqueClinics = [...new Set(scheduleSlots.map(s => s.clinic))];
                scheduleHtml = `
                    <div class="pdir-sched-box">
                        <span class="pdir-sched-title">📍 Active Rotations (From Today): ${uniqueClinics.join(', ')}</span>
                        <div class="pdir-sched-list pdir-scrollable-sched">
                            ${scheduleSlots.map(s => `• ${s.date} &rarr; <strong>${s.clinic}</strong> (${s.role})`).join('<br>')}
                        </div>
                    </div>
                `;
            } else {
                scheduleHtml = `
                    <div class="pdir-sched-box pdir-empty-sched">
                        📅 No upcoming clinical shifts scheduled for the rest of this month.
                    </div>
                `;
            }

            let guidelinesHtml = '';
            if (docDos || docDonts) {
                guidelinesHtml = `
                    <div class="pdir-guidelines-box">
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
                                ${docLang ? `<span style="font-size:0.75rem; margin-top:4px; color:#475569;">🗣️ ${docLang}</span>` : ''}
                            </div>
                        </div>
                        <span class="pdir-badge">${docSpec}</span>
                    </div>
                    ${scheduleHtml}
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