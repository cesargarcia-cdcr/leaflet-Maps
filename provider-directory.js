/* provider-directory.js — Master Cross-Reference Search Engine */
'use strict';

(function () {
    let masterList = [];
    let globalScheduleMapCurr = {};
    let globalScheduleMapNext = {};
    let npiLookupMap = {};

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
            console.log("📂 [PROVIDER_LOG] Initializing provider data reading...");
            
            let mainTxt = localStorage.getItem('csv_mainProviders');
            if (!mainTxt && typeof window.obtenerArchivo === 'function') {
                mainTxt = await window.obtenerArchivo('csv_mainProviders');
            }
            masterList = mainTxt ? parseStandardCSV(mainTxt) : [];

            // Load Curr and Next as structured JSON storage
            const parseJsonStorage = (key) => {
                const raw = localStorage.getItem(key) || localStorage.getItem(`json_${key}`);
                if (!raw) return [];
                try { return JSON.parse(raw); } catch (e) { return []; }
            };

            const schedCurrList = parseJsonStorage('providersSchedCurr');
            const schedNextList = parseJsonStorage('providersSchedNext');

            // Quick mapping by provider ID
            globalScheduleMapCurr = {};
            schedCurrList.forEach(row => {
                const pId = String(row["Provider ID"] || "").trim();
                if (pId) globalScheduleMapCurr[pId] = row;
            });

            globalScheduleMapNext = {};
            schedNextList.forEach(row => {
                const pId = String(row["Provider ID"] || "").trim();
                if (pId) globalScheduleMapNext[pId] = row;
            });

            console.log(`✅ [PROVIDER_LOG] Records loaded: ${masterList.length}, Curr: ${schedCurrList.length}, Next: ${schedNextList.length}`);
            
            renderDirectory();
            initAutocomplete();

        } catch (error) {
            console.error("❌ [PROVIDER_LOG] Error in data preloading:", error);
        }
    }

    function initAutocomplete() {
        const searchInput = document.getElementById('masterProviderSearch');
        if (!searchInput) return;

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

            const matches = masterList.filter(doc => {
                const name = String(doc['Provider'] || '').toLowerCase();
                const id = String(doc['Provider ID'] || '');
                const npi = String(doc['NPI'] || '');
                const spec = String(doc['Specialty'] || '').toLowerCase();
                return name.includes(val) || id.includes(val) || npi.includes(val) || spec.includes(val);
            });

            const top5 = matches.slice(0, 5);

            top5.forEach(doc => {
                const itemHtml = document.createElement('div');
                itemHtml.className = 'pdir-auto-item';
                itemHtml.innerHTML = `<strong>${doc['Provider']}</strong> <span style="font-size:11px; color:#64748b;">(${doc['Specialty'] || 'Staff'})</span>`;
                
                itemHtml.addEventListener('click', () => {
                    searchInput.value = doc['Provider'];
                    listContainer.innerHTML = '';
                    renderDirectory(doc['Provider']);
                });
                listContainer.appendChild(itemHtml);
            });
        });

        document.addEventListener('click', (e) => {
            if (e.target !== searchInput) listContainer.innerHTML = '';
        });
    }

    function renderDirectory(filterText = '') {
        const grid = document.getElementById('masterProviderGrid');
        if (!grid) return;

        const query = filterText.toLowerCase().trim();
        let htmlArr = [];

        masterList.forEach(doc => {
            const getVal = (keys) => {
                for (const k of keys) {
                    if (doc[k] !== undefined && doc[k] !== '') return String(doc[k]).trim();
                }
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
            
            const docDos = getVal(["Do's ✔", "Dos", "Do's"]);
            const docDonts = getVal(["Don'ts ❌", "Donts", "Don'ts"]);

            if (!docName && !docId) return;

            if (query && !docName.toLowerCase().includes(query) && !docId.includes(query) && !docNpi.includes(query) && !docSpec.toLowerCase().includes(query)) {
                return;
            }

            // ==========================================================
            // 🎯 Clean merging of Curr + Next (Dates only, no shift hours)
            // ==========================================================
            let scheduleHtml = '';
            const schedRowCurr = globalScheduleMapCurr[docId] || globalScheduleMapCurr[docName.toLowerCase()] || {};
            const schedRowNext = globalScheduleMapNext[docId] || globalScheduleMapNext[docName.toLowerCase()] || {};
            
            // Merge both schedule objects smoothly
            const combinedSchedRow = { ...schedRowCurr, ...schedRowNext };
            
            if (Object.keys(combinedSchedRow).length > 0) {
                const ignoreCols = new Set([
                    "iteminternal id", "iteminternalid", "provider id", "npi", 
                    "code", "health center", "report employee name", "employee name", 
                    "job name", "column1", "specialty"
                ]);

                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const currentYear = today.getFullYear();

                let dateEntries = Object.entries(combinedSchedRow).filter(([key, val]) => {
                    const cleanKey = key.trim().toLowerCase();
                    const cleanVal = String(val || "").trim();
                    // We check that the value exists and is a valid assignment, but we won't print the value (shift)
                    if (ignoreCols.has(cleanKey) || cleanVal === "" || !/\d/.test(cleanVal)) {
                        return false;
                    }

                    let dateStr = key.trim();
                    if (!/\d{4}/.test(dateStr)) {
                        dateStr += ` ${currentYear}`;
                    }

                    let headerDate = new Date(dateStr);
                    if (isNaN(headerDate.getTime())) {
                        return true;
                    }

                    headerDate.setHours(0, 0, 0, 0);
                    
                    // Show from today onwards (remainder of current month + next month)
                    return headerDate >= today;
                });

                dateEntries.sort(([aKey], [bKey]) => {
                    const parseDate = (k) => {
                        let str = k.trim();
                        if (!/\d{4}/.test(str)) str += ` ${currentYear}`;
                        let d = new Date(str);
                        return isNaN(d.getTime()) ? 0 : d.getTime();
                    };
                    return parseDate(aKey) - parseDate(bKey);
                });

                if (dateEntries.length > 0) {
                    // 🎯 Only print the date key, omitting the shift value (`val`)
                    let badges = dateEntries.map(([date]) => `
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:6px 4px; text-align:center; font-size:0.75rem; color:#334155; font-weight:600; box-shadow:0 1px 2px rgba(0,0,0,0.02);">
                            <span style="color:#16a34a; margin-right:2px;">✔</span> ${date}
                        </div>
                    `).join('');

                    scheduleHtml = `
                        <div style="margin-top:14px; padding-top:10px; border-top:1px dashed #cbd5e1;">
                            <div style="font-size:0.75rem; font-weight:700; color:#475569; margin-bottom:8px; display:flex; align-items:center; gap:4px;">
                                📅 Scheduled Presence Days (${dateEntries.length})
                            </div>
                            <div style="display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap:6px; max-height:160px; overflow-y:auto; padding-right:2px;">
                                ${badges}
                            </div>
                        </div>
                    `;
                }
            }
            // ==========================================================
            // ==========================================================

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
                    ${scheduleHtml}
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
    
    window.showProviderModalById = function(providerIdOrName) {
        if (!providerIdOrName) return;
        const target = String(providerIdOrName).trim().toLowerCase();

        const doc = masterList.find(m => {
            if (!m) return false;
            const mId = String(m['Provider ID'] || m['provider id'] || m['ID'] || '').trim().toLowerCase();
            const mName = String(m['Provider'] || m['provider'] || '').trim().toLowerCase();
            return mId === target || mName === target;
        });

        if (!doc) {
            console.warn(`⚠️ Information not found for: ${providerIdOrName}`);
            alert(`No scheduling guidelines registered for: ${providerIdOrName}`);
            return;
        }

        const docName = String(doc['Provider'] || 'Unknown').trim();
        const docDegree = String(doc['Dr Degree'] || '').trim();
        const docSpec = String(doc['Specialty'] || 'General Medicine').trim();
        const docId = String(doc['Provider ID'] || '').trim();
        const docNpi = String(doc['NPI'] || 'N/A').trim();
        const docLang = String(doc['Languages '] || doc['Languages'] || '').trim();
        const docEpic = String(doc['Epic Headers'] || '').trim();
        
        const docDos = String(doc["Do's ✔"] || '').trim();
        const docDonts = String(doc["Don'ts ❌"] || '').trim();

        const backdrop = document.createElement('div');
        backdrop.id = 'pdir-popover-backdrop';
        backdrop.style = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15,23,42,0.3); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(2px);';

        const popover = document.createElement('div');
        popover.id = 'pdir-popover-card';
        popover.style = 'width:460px; max-width:90vw; background:#ffffff; padding:20px; border-radius:10px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.25); border:1px solid #e2e8f0; font-family: system-ui, -apple-system, sans-serif;';

        let guidelinesHtml = '<div style="margin-top:12px; font-size:0.8rem; color:#64748b; text-align:center; font-style:italic;">⚠️ No scheduling guidelines registered.</div>';
        if (docDos || docDonts || docEpic) {
            guidelinesHtml = `
                <div style="margin-top:14px; padding:12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; font-size:0.85rem; line-height:1.5;">
                    ${docEpic ? `<div style="color:#0284c7; margin-bottom:6px; font-size:0.8rem;">💻 <strong>Epic:</strong> ${docEpic}</div>` : ''}
                    ${docDos ? `<div style="color:#16a34a; margin-bottom:6px;"><strong>Do's ✔:</strong> ${docDos}</div>` : ''}
                    ${docDonts ? `<div style="color:#dc2626;"><strong>Don'ts ❌:</strong> ${docDonts}</div>` : ''}
                </div>
            `;
        }

        popover.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:start; gap:10px; border-bottom:1px solid #f1f5f9; padding-bottom:12px;">
                <div style="flex:1;">
                    <h4 style="margin:0; font-size:1.15rem; font-weight:800; color:#0f172a;">${docName}${docDegree ? `, ${docDegree}` : ''}</h4>
                    <div style="font-size:0.75rem; color:#64748b; margin-top:4px; display:flex; flex-direction:column; gap:2px;">
                        <span>🔑 Provider ID: <strong>${docId || 'N/A'}</strong> | 🌐 NPI: <strong>${docNpi}</strong></span>
                        ${docLang ? `<span>🗣️ ${docLang}</span>` : ''}
                    </div>
                </div>
                <span style="background:#e0e7ff; color:#4338ca; font-size:0.7rem; font-weight:700; padding:4px 8px; border-radius:4px; white-space:nowrap;">${docSpec}</span>
            </div>
            ${guidelinesHtml}
            <div style="margin-top:16px; text-align:right;">
                <button onclick="document.getElementById('pdir-popover-backdrop')?.remove()" style="background:#f1f5f9; border:1px solid #cbd5e1; color:#475569; padding:6px 16px; border-radius:6px; font-size:0.8rem; font-weight:600; cursor:pointer;">Close</button>
            </div>
        `;

        backdrop.appendChild(popover);
        document.body.appendChild(backdrop);

        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) backdrop.remove();
        });
    };
    
})();