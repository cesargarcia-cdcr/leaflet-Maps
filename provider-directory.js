/* provider-directory.js — Master Cross-Reference Search Engine */
'use strict';

(function () {
    let masterList = [];
    let globalScheduleMapCurr = {};
    let globalScheduleMapNext = {};
    let npiLookupMap = {};

    let activeKeywordTag = "";

    function parseStandardCSV(text) {
        if (!text)
            return [];
        const lines = [];
        let row = [""];
        let inQuotes = false;
        for (let i = 0; i < text.length; i++) {
            const c = text[i];
            const next = text[i + 1];
            if (c === '"') {
                if (inQuotes && next === '"') {
                    row[row.length - 1] += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (c === ',' && !inQuotes) {
                row.push('');
            } else if ((c === '\r' || c === '\n') && !inQuotes) {
                if (c === '\r' && next === '\n') {
                    i++;
                }
                lines.push(row);
                row = [''];
            } else {
                row[row.length - 1] += c;
            }
        }
        if (row.length > 1 || row[0] !== '') {
            lines.push(row);
        }
        if (lines.length === 0)
            return [];

        const headers = lines[0].map(h => h.trim());
        const result = [];
        for (let i = 1; i < lines.length; i++) {
            const currentLine = lines[i];
            if (currentLine.length === 1 && currentLine[0] === '')
                continue;
            const obj = {};
            headers.forEach((header, index) => {
                obj[header] = currentLine[index] !== undefined ? currentLine[index].trim() : '';
            });
            result.push(obj);
        }
        return result;
    }

    function ensureFiltersDOM() {
        const filterRow = document.getElementById('pdirInlineFiltersRow');
        if (!filterRow)
            return;

        filterRow.innerHTML = '';
        filterRow.innerHTML = `
            <div class="pdir-filter-group">
                <select id="pdir-filter-location" class="pdir-inline-select">
                    <option value="">📍 All Clinics</option>
                </select>
                <select id="pdir-filter-specialty" class="pdir-inline-select">
                    <option value="">🩺 All Specialties</option>
                </select>
                <div class="pdir-input-wrapper">
                    <input type="text" id="masterDosSearch" class="pdir-inline-input" placeholder="✨ Search guidelines / do's..." />
                </div>
            </div>
            <button id="pdir-reset-btn" class="pdir-panel-reset" title="Clear all filters">
                <span>🔄</span> Reset Filters
            </button>
        `;
    }

    function extractUniqueKeywords() {
        const keywordsSet = new Set();
        
        try {
            // Intentar obtener y parsear csv_Procedures desde localStorage
            const rawProcedures = localStorage.getItem('csv_Procedures');
            if (rawProcedures) {
                const proceduresArray = JSON.parse(rawProcedures);
                if (Array.isArray(proceduresArray)) {
                    proceduresArray.forEach(item => {
                        // Extraer el campo exacto "Filter Tag"
                        const tag = item["Filter Tag"] || item["filter tag"] || "";
                        const cleanTag = String(tag).trim();
                        if (cleanTag) {
                            keywordsSet.add(cleanTag);
                        }
                    });
                }
            }
        } catch (e) {
            console.error("❌ [PROVIDER_LOG] Error parsing csv_Procedures from localStorage:", e);
        }

        // Si por alguna razón el localStorage estuviera vacío, respaldamos con el comportamiento anterior de los Do's
        /* if (keywordsSet.size === 0) {
            masterList.forEach(doc => {
                const rawDos = doc["Do's ✔"] || doc["Dos"] || doc["Do's"] || "";
                if (!rawDos) return;
                const items = rawDos.split('•');
                items.forEach(item => {
                    let cleanItem = item.trim();
                    if (!cleanItem) return;
                    if (cleanItem.includes('-')) {
                        cleanItem = cleanItem.split('-')[0].trim();
                    }
                    if (cleanItem.includes('(')) {
                        cleanItem = cleanItem.split('(')[0].trim();
                    }
                    const isInstructional = /guideline|schedule|refer to|update/i.test(cleanItem);
                    if (cleanItem.length > 2 && cleanItem.length < 40 && !isInstructional) {
                        keywordsSet.add(cleanItem);
                    }
                });
            });
        } */

        return Array.from(keywordsSet).sort();
    }

    function renderKeywordCloud() {
        const cloudContainer = document.getElementById('pdirKeywordsCloud');
        if (!cloudContainer)
            return;
        const uniqueKeywords = extractUniqueKeywords();
        if (uniqueKeywords.length === 0) {
            cloudContainer.style.display = 'none';
            return;
        }
        cloudContainer.style.display = 'flex';
        cloudContainer.innerHTML = '';
        uniqueKeywords.forEach(keyword => {
            const tagButton = document.createElement('button');
            tagButton.className = `pdir-tag-pill ${activeKeywordTag === keyword ? 'is-active' : ''}`;
            tagButton.textContent = keyword;
            tagButton.addEventListener('click', () => {
                if (activeKeywordTag === keyword) {
                    activeKeywordTag = "";
                    tagButton.classList.remove('is-active');
                } else {
                    document.querySelectorAll('.pdir-tag-pill').forEach(btn => btn.classList.remove('is-active'));
                    activeKeywordTag = keyword;
                    tagButton.classList.add('is-active');
                }
                renderDirectory();
            });
            cloudContainer.appendChild(tagButton);
        });
    }

    async function preloadProviderData() {
        try {
            ensureFiltersDOM();
            let rawProviders = localStorage.getItem('csv_mainProviders') ||
                localStorage.getItem('masterProviders') ||
                (typeof obtenerCsv === 'function' ? obtenerCsv("mainProviders") : null);

            if (!rawProviders && window.APP_DATA && window.APP_DATA.mainProviders) {
                rawProviders = window.APP_DATA.mainProviders;
            }
            if (typeof rawProviders === 'string' && (rawProviders.trim().startsWith('[') || rawProviders.trim().startsWith('{'))) {
                try {
                    rawProviders = JSON.parse(rawProviders);
                } catch (e) {}
            }
            if (!rawProviders) {
                masterList = [];
            } else if (Array.isArray(rawProviders)) {
                masterList = rawProviders;
            } else if (typeof rawProviders === 'object' && rawProviders !== null) {
                const values = Object.values(rawProviders);
                masterList = Array.isArray(values[0]) ? values[0] : values;
            } else {
                masterList = parseStandardCSV(rawProviders);
            }

            const parseJsonStorage = (key) => {
                if (window.APP_DATA && window.APP_DATA[key])
                    return window.APP_DATA[key];
                const raw = localStorage.getItem(key) || localStorage.getItem(`json_${key}`);
                if (!raw)
                    return [];
                try {
                    return JSON.parse(raw);
                } catch (e) {
                    return [];
                }
            };

            const schedCurrList = parseJsonStorage('providersSchedCurr');
            const schedNextList = parseJsonStorage('providersSchedNext');

            globalScheduleMapCurr = {};
            schedCurrList.forEach(row => {
                const pId = String(row["Provider ID"] || "").trim();
                if (pId)
                    globalScheduleMapCurr[pId] = row;
            });

            globalScheduleMapNext = {};
            schedNextList.forEach(row => {
                const pId = String(row["Provider ID"] || "").trim();
                if (pId)
                    globalScheduleMapNext[pId] = row;
            });

            populateDropdownFilters();
            initMasterProviderDirectory();
            initAutocomplete();
            renderKeywordCloud();

            const searchInput = document.getElementById('masterProviderSearch');
            if (searchInput) {
                setTimeout(() => searchInput.focus(), 150);
            }
        } catch (error) {
            console.error("❌ [PROVIDER_LOG] Error in data preloading:", error);
        }
    }

    function populateDropdownFilters() {
        const locationSelect = document.getElementById('pdir-filter-location');
        const specialtySelect = document.getElementById('pdir-filter-specialty');
        if (!locationSelect && !specialtySelect)
            return;

        const locationsSet = new Set();
        const specialtiesSet = new Set();
        masterList.forEach(doc => {
            const loc = String(doc['Location'] || doc['location'] || '').trim();
            const spec = String(doc['Specialty'] || doc['specialty'] || '').trim();
            if (loc) locationsSet.add(loc);
            if (spec) specialtiesSet.add(spec);
        });

        if (locationSelect) {
            locationSelect.innerHTML = '<option value="">📍 All Clinics</option>';
            Array.from(locationsSet).sort().forEach(loc => {
                const opt = document.createElement('option');
                opt.value = loc;
                opt.textContent = loc;
                locationSelect.appendChild(opt);
            });
        }

        if (specialtySelect) {
            specialtySelect.innerHTML = '<option value="">🩺 All Specialties</option>';
            Array.from(specialtiesSet).sort().forEach(spec => {
                const opt = document.createElement('option');
                opt.value = spec;
                opt.textContent = spec;
                specialtySelect.appendChild(opt);
            });
        }
    }

    function initAutocomplete() {
        const searchInput = document.getElementById('masterProviderSearch');
        if (!searchInput)
            return;
        let wrapper = document.getElementById('pdir-search-wrapper');
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.id = 'pdir-search-wrapper';
            wrapper.style.position = 'relative';
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
        searchInput.addEventListener('input', function () {
            const val = this.value.toLowerCase().trim();
            listContainer.innerHTML = '';
            if (!val)
                return;
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
                itemHtml.innerHTML = `<strong>${doc['Provider']}</strong> <span class="pdir-auto-spec">(${doc['Specialty'] || 'Staff'})</span>`;
                itemHtml.addEventListener('click', () => {
                    searchInput.value = doc['Provider'];
                    listContainer.innerHTML = '';
                    renderDirectory();
                });
                listContainer.appendChild(itemHtml);
            });
        });
        document.addEventListener('click', (e) => {
            if (e.target !== searchInput)
                listContainer.innerHTML = '';
        });
    }

    function renderDirectory() {
        const grid = document.getElementById('masterProviderGrid');
        if (!grid)
            return;
        const searchInput = document.getElementById('masterProviderSearch');
        const dosSearchInput = document.getElementById('masterDosSearch');
        const locationSelect = document.getElementById('pdir-filter-location');
        const specialtySelect = document.getElementById('pdir-filter-specialty');
        const query = (searchInput?.value || '').toLowerCase().trim();
        const dosQuery = (dosSearchInput?.value || '').toLowerCase().trim();
        const selectedLocation = (locationSelect?.value || '').toLowerCase().trim();
        const selectedSpecialty = (specialtySelect?.value || '').toLowerCase().trim();
        let htmlArr = [];

        masterList.forEach(doc => {
            const getVal = (keys) => {
                for (const k of keys) {
                    if (doc[k] !== undefined && doc[k] !== '')
                        return String(doc[k]).trim();
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
            if (!docNpi || docNpi === 'N/A')
                docNpi = npiLookupMap[docId] || 'N/A';
            const docDos = getVal(["Do's ✔", "Dos", "Do's"]);
            const docDonts = getVal(["Don'ts ❌", "Donts", "Don'ts"]);

            if (!docName && !docId)
                return;

            const matchesQuery = !query ||
                docName.toLowerCase().includes(query) ||
                docId.includes(query) ||
                docNpi.includes(query) ||
                docSpec.toLowerCase().includes(query);
            const matchesDos = !dosQuery || docDos.toLowerCase().includes(dosQuery);
            const matchesLocation = !selectedLocation || docLocation.toLowerCase() === selectedLocation;
            const matchesSpecialty = !selectedSpecialty || docSpec.toLowerCase() === selectedSpecialty;
            const matchesKeywordTag = !activeKeywordTag || docDos.toLowerCase().includes(activeKeywordTag.toLowerCase());

            if (!matchesQuery || !matchesDos || !matchesLocation || !matchesSpecialty || !matchesKeywordTag) {
                return;
            }

            let scheduleHtml = '';
            const schedRowCurr = globalScheduleMapCurr[docId] || globalScheduleMapCurr[docName.toLowerCase()] || {};
            const schedRowNext = globalScheduleMapNext[docId] || globalScheduleMapNext[docName.toLowerCase()] || {};
            const combinedSchedRow = {
                ...schedRowCurr,
                ...schedRowNext
            };

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
                    if (ignoreCols.has(cleanKey) || cleanVal === "" || !/\d/.test(cleanVal)) {
                        return false;
                    }
                    let dateStr = key.trim();
                    if (!/\d{4}/.test(dateStr))
                        dateStr += currentYear;

                    let headerDate = new Date(dateStr);
                    if (isNaN(headerDate.getTime()))
                        return true;
                    headerDate.setHours(0, 0, 0, 0);
                    return headerDate >= today;
                });

                dateEntries.sort(([aKey], [bKey]) => {
                    const parseDate = (k) => {
                        let str = k.trim();
                        if (!/\d{4}/.test(str))
                            str += currentYear;
                        let d = new Date(str);
                        return isNaN(d.getTime()) ? 0 : d.getTime();
                    };
                    return parseDate(aKey) - parseDate(bKey);
                });

                if (dateEntries.length > 0) {
                    let badges = dateEntries.map(([date]) => `
                        <div class="pdir-date-badge">
                            <span class="pdir-badge-check">✔</span> ${date}
                        </div>
                    `).join('');
                    
                    scheduleHtml = `
                        <div class="pdir-schedule-container">
                            <div class="pdir-schedule-title">📅 Scheduled Presence Days (${dateEntries.length})</div>
                            <div class="pdir-schedule-grid">${badges}</div>
                        </div>
                    `;
                }
            }

            let guidelinesHtml = '';
            if (docDos || docDonts || docEpic) {
                guidelinesHtml = `
                    <div class="pdir-guidelines-box">
                        ${docEpic ? `<div class="pdir-guideline-row"><strong>Epic:</strong> ${docEpic}</div>` : ''}
                        ${docDos ? `<div class="pdir-guideline-row pdir-do-line"><strong>Do's ✔:</strong> ${docDos}</div>` : ''}
                        ${docDonts ? `<div class="pdir-guideline-row pdir-dont-line"><strong>Don'ts ❌:</strong> ${docDonts}</div>` : ''}
                    </div>
                `;
            }

            htmlArr.push(`
                <div class="pdir-card">
                    <div class="pdir-card-top">
                        <div class="pdir-meta-left">
                            <h4 class="pdir-doc-name">${docName}${docDegree ? `, ${docDegree}` : ''}</h4>
                            <div class="pdir-ids">
                                <span>🔑 ID: <strong>${docId || 'N/A'}</strong></span>
                                <span>🌐 NPI: <strong>${docNpi}</strong></span>
                                ${docLocation ? `<span>📍 Location: ${docLocation}</span>` : ''}
                                ${docGender ? `<span>👤 Gender: ${docGender}</span>` : ''}
                                ${docLang ? `<span>🗣 Languages: ${docLang}</span>` : ''}
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
            grid.innerHTML = `<div class="pdir-empty">❌ No providers found matching the selected filters.</div>`;
        } else {
            grid.innerHTML = htmlArr.join('');
        }
    }

    function initMasterProviderDirectory() {
        const searchInput = document.getElementById('masterProviderSearch');
        const dosSearchInput = document.getElementById('masterDosSearch');
        const locationSelect = document.getElementById('pdir-filter-location');
        const specialtySelect = document.getElementById('pdir-filter-specialty');
        const resetBtn = document.getElementById('pdir-reset-btn');

        if (searchInput && !searchInput.__wired) {
            searchInput.addEventListener('input', () => renderDirectory());
            searchInput.__wired = true;
        }
        if (dosSearchInput && !dosSearchInput.__wired) {
            dosSearchInput.addEventListener('input', () => renderDirectory());
            dosSearchInput.__wired = true;
        }
        if (locationSelect && !locationSelect.__wired) {
            locationSelect.addEventListener('change', () => renderDirectory());
            locationSelect.__wired = true;
        }
        if (specialtySelect && !specialtySelect.__wired) {
            specialtySelect.addEventListener('change', () => renderDirectory());
            specialtySelect.__wired = true;
        }
        if (resetBtn && !resetBtn.__wired) {
            resetBtn.addEventListener('click', () => {
                if (searchInput) searchInput.value = '';
                if (dosSearchInput) dosSearchInput.value = '';
                if (locationSelect) locationSelect.value = '';
                if (specialtySelect) specialtySelect.value = '';
                activeKeywordTag = "";
                document.querySelectorAll('.pdir-tag-pill').forEach(btn => btn.classList.remove('is-active'));
                renderDirectory();
                if (searchInput) searchInput.focus();
            });
            resetBtn.__wired = true;
        }
        renderDirectory();
    }

    preloadProviderData();
    window.initMasterProviderDirectory = initMasterProviderDirectory;
    window.addEventListener('PayloadReady', () => {
        preloadProviderData();
    });
})();