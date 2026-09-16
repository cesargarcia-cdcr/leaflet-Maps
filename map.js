/* === Map UI/UX Optimized with Debug Logs (v2) - Manual Init === */
'use strict';
(function () {
    let CLINICS = [],
    EXT = {},
    EXT_BY_CODE = {};
    let map,
    searchMarker = null,
    searchLine = null,
    markersLayer = null;

    /* ---------- Utilities ---------- */
    async function safeJson(url) {
        try {
            const r = await fetch(url, {
                cache: 'no-cache'
            });
            if (!r.ok)
                return null;
            return await r.json();
        } catch (_) {
            return null;
        }
    }
    const store = {
        get(k, d) {
            try {
                const v = localStorage.getItem(k);
                return v ?? d;
            } catch (_) {
                return d
            }
        },
        set(k, v) {
            try {
                localStorage.setItem(k, v)
            } catch (_) {}
        }
    };

    /* ---------- Data Load with Logs ---------- */
    async function loadData() {
    console.log("🔍 [MAP DEBUG] Iniciando loadData()...");
    
    let rawClinics = localStorage.getItem("csv_clinics") || (typeof obtenerCsv === 'function' ? obtenerCsv("clinics") : null);
    
    // 💡 NUEVO: Si está almacenado como string JSON, lo convertimos a objeto/arreglo primero
    if (typeof rawClinics === 'string' && (rawClinics.trim().startsWith('[') || rawClinics.trim().startsWith('{'))) {
        try {
            rawClinics = JSON.parse(rawClinics);
            console.log("🔄 [MAP DEBUG] 'csv_clinics' detectado como JSON y parseado correctamente.");
        } catch (e) {
            console.warn("⚠️ [MAP DEBUG] Error al parsear 'csv_clinics' como JSON, se tratará como texto plano.", e);
        }
    }

    if (!rawClinics) {
        console.warn("⚠️ [MAP DEBUG] No se encontró contenido para el CSV 'clinics'.");
        CLINICS = [];
    } else if (Array.isArray(rawClinics)) {
        console.log("✅ [MAP DEBUG] 'clinics' ya es un arreglo de objetos.");
        CLINICS = mapClinicsCsvToObjects(rawClinics);
    } else if (typeof rawClinics === 'object' && rawClinics !== null) {
        console.log("✅ [MAP DEBUG] 'clinics' es un objeto.");
        const values = Object.values(rawClinics);
        CLINICS = mapClinicsCsvToObjects(Array.isArray(values[0]) ? values : [rawClinics]);
    } else {
        console.log("✅ [MAP DEBUG] 'clinics' es texto plano CSV, parseando...");
        const parsedRows = CSV_parse(rawClinics);
        const objectRows = CSV_rowsToObjects(parsedRows);
        CLINICS = mapClinicsCsvToObjects(objectRows);
    }

    console.log(`🏥 [MAP DEBUG] CLINICS procesadas (${CLINICS.length}):`, CLINICS);

    // Mapeo adaptado para providersSched
    const provTxt = localStorage.getItem("csv_providersSchedCurr") || localStorage.getItem("csv_providersSched") || (typeof obtenerCsv === 'function' ? obtenerCsv("providersSched") : null);
    if (provTxt) {
        let provRows = [];
        let parsedProv = provTxt;
        if (typeof provTxt === 'string' && (provTxt.trim().startsWith('[') || provTxt.trim().startsWith('{'))) {
            try { parsedProv = JSON.parse(provTxt); } catch(e) {}
        }
        if (Array.isArray(parsedProv)) {
            provRows = parsedProv;
        } else {
            provRows = CSV_rowsToObjects(CSV_parse(typeof parsedProv === 'string' ? parsedProv : JSON.stringify(parsedProv)));
        }
        window.APP_DATA = window.APP_DATA || {};
        window.APP_DATA.providersByCode = provRows.reduce((acc, row) => {
            const code = String(row["Code"] || "").trim().toUpperCase();
            if (!acc[code]) acc[code] = [];
            acc[code].push(row);
            return acc;
        }, {});
    }

    // Mapeo adaptado para extensions
    let extTxt = localStorage.getItem("csv_extensions") || (typeof obtenerCsv === 'function' ? obtenerCsv("extensions") : null);
    if (extTxt) {
        let extRows = [];
        let parsedExt = extTxt;
        if (typeof extTxt === 'string' && (extTxt.trim().startsWith('[') || extTxt.trim().startsWith('{'))) {
            try { parsedExt = JSON.parse(extTxt); } catch(e) {}
        }
        if (Array.isArray(parsedExt)) {
            extRows = parsedExt;
        } else {
            extRows = CSV_rowsToObjects(CSV_parse(typeof parsedExt === 'string' ? parsedExt : JSON.stringify(parsedExt)));
        }
        EXT = {};
        extRows.forEach(row => {
            const section = row.section || row.Section || "General";
            if (!EXT[section]) EXT[section] = [];
            EXT[section].push(row);
        });
    }
    buildExtensionsIndex();
}

    // Función universal tipo PROPER() de Excel
    const properCase = (str) => {
        if (!str) return '';
        return String(str).toLowerCase().replace(/(^|\s)\S/g, (l) => l.toUpperCase());
    };

    function mapClinicsCsvToObjects(items) {
        console.log("🔍 [TS DEBUG] --------------------------------------------------");
        console.log("🔍 [TS DEBUG] Iniciando mapClinicsCsvToObjects. Tipo de input:", typeof items, "Es Array?:", Array.isArray(items));
        console.log("🔍 [TS DEBUG] Cantidad de elementos crudos recibidos:", items ? items.length : 0);
        if (items && items.length > 0) {
            console.log("🔍 [TS DEBUG] Ejemplo del primer elemento crudo:", items[0]);
        }

        if (!items || !Array.isArray(items)) {
            console.warn("⚠️ [TS DEBUG] mapClinicsCsvToObjects recibió un input inválido o vacío.");
            return [];
        }

        const properCase = (str) => {
            if (!str) return '';
            return String(str).toLowerCase().replace(/(^|\s)\S/g, (l) => l.toUpperCase());
        };

        // Cargar lookup
        let lookupMap = {};
        try {
            const rawLookup = localStorage.getItem("csv_clinicLookup") || window.LSEngine?.state?.globalClinicLookup;
            const lookupArray = typeof rawLookup === 'string' ? JSON.parse(rawLookup) : rawLookup;
            
            if (Array.isArray(lookupArray)) {
                lookupArray.forEach(item => {
                    const codeKey = String(item.Code || "").trim().toUpperCase();
                    if (codeKey) {
                        lookupMap[codeKey] = {
                            healthCenter: properCase(item["Health Center"] || ""),
                            clinicName: properCase(item["Clinic Name"] || "")
                        };
                    }
                });
            }
            console.log("🔍 [TS DEBUG] Lookup cargado exitosamente. Claves en lookup:", Object.keys(lookupMap));
        } catch (e) {
            console.warn("⚠️ [TS DEBUG] Error cargando csv_clinicLookup:", e);
        }

        const out = [];
        const seen = new Set();

        items.forEach((it, index) => {
            // Normalizar llaves
            const cleanObj = {};
            for (const key in it) {
                if (Object.prototype.hasOwnProperty.call(it, key)) {
                    cleanObj[key.trim().toLowerCase()] = it[key];
                }
            }

            const rawCode = String(cleanObj["code"] || cleanObj["abbreviation"] || cleanObj["cliniccode"] || "").trim().toUpperCase();
            const lookupMatch = lookupMap[rawCode] || {};

            const rawName = String(cleanObj["location"] || lookupMatch.clinicName || lookupMatch.healthCenter || cleanObj["clinic name"] || cleanObj["name"] || rawCode).trim();
            const name = properCase(rawName);

            const plusCode = String(cleanObj["pluscode"] || cleanObj["pc"] || cleanObj["plus code"] || "").trim();
            const address = properCase(String(cleanObj["address"] || "").trim());
            const city = properCase(String(cleanObj["city"] || "").trim());
            const zip = String(cleanObj["zipcode"] || cleanObj["zip"] || "").trim();
            
            const fullAddress = [address, city, zip].filter(Boolean).join(", ");
            
            const rawLat = cleanObj["lat"] ?? cleanObj["latitude"] ?? "";
            const rawLng = cleanObj["lng"] ?? cleanObj["longitude"] ?? "";
            const lat = rawLat !== "" ? parseFloat(rawLat) : null;
            const lng = rawLng !== "" ? parseFloat(rawLng) : null;

            const clinicId = rawCode || name.toLowerCase().replace(/[^a-z0-9]+/gi, "-");

            console.log(`🔍 [TS DEBUG] [Fila ${index}] Code detectado: '${rawCode}' | Nombre detectado: '${name}' | Lat: ${lat}, Lng: ${lng}`);

            const clinic = {
                clinicId,
                code: rawCode,
                name,
                plusCode,
                address: fullAddress,
                lat: !isNaN(lat) ? lat : null,
                lng: !isNaN(lng) ? lng : null,
                nicknames: ""
            };

            // Evaluar condición de aceptación
            const isValid = (rawCode || name) && !seen.has(clinicId);
            if (isValid) {
                out.push(clinic);
                seen.add(clinicId);
                console.log(`✅ [TS DEBUG] [Fila ${index}] Aceptada y agregada correctamente.`);
            } else {
                console.warn(`❌ [TS DEBUG] [Fila ${index}] DESCARTADA. Motivo -> code/name presente?: ${Boolean(rawCode || name)}, Ya estaba en 'seen'?: ${seen.has(clinicId)}`);
            }
        });

        console.log(`🗺️ [TS DEBUG] Finalizado. Devolviendo ${out.length} clínicas válidas de ${items.length} totales.`);
        console.log("🔍 [TS DEBUG] --------------------------------------------------");
        return out;
    }

    function buildExtensionsIndex() {
        EXT_BY_CODE = {};
        for (const section in EXT) {
            if (section === 'Meta' || !Array.isArray(EXT[section]))
                continue;
            for (const item of EXT[section]) {
                const code = String(item.Code || item.code || '').trim().toUpperCase();
                if (!code)
                    continue;
                if (!EXT_BY_CODE[code])
                    EXT_BY_CODE[code] = {};
                EXT_BY_CODE[code][section] = item;
            }
        }
    }

    /* ---------- OLC / Exclusive Plus Codes (Ventura County) ---------- */
    const VENTURA_CENTER = {
        lat: 34.25,
        lng: -119.10
    };
    let __OLC_READY = null;

    function ensureOLC() {
        if (window.OpenLocationCode)
            return Promise.resolve();
        if (__OLC_READY)
            return __OLC_READY;
        const srcs = ['https://cdnjs.cloudflare.com/ajax/libs/openlocationcode/1.0.5/openlocationcode.min.js', 'https://cdn.jsdelivr.net/openlocationcode/latest/openlocationcode.min.js'];
        __OLC_READY = new Promise(async res => {
            for (const s of srcs) {
                try {
                    await new Promise((ok, ko) => {
                        const el = document.createElement('script');
                        el.src = s;
                        el.async = true;
                        el.onload = ok;
                        el.onerror = () => ko();
                        document.head.appendChild(el);
                    });
                    if (window.OpenLocationCode) {
                        res();
                        return;
                    }
                } catch (e) {}
            }
            res();
        });
        return __OLC_READY;
    }

    async function tryDecodePlusCode(input) {
        await ensureOLC().catch(() => {});
        if (!window.OpenLocationCode) {
            console.warn("⚠️ [MAP DEBUG] OpenLocationCode no está cargado en el navegador.");
            return null;
        }
        
        const raw = String(input || '').trim().toUpperCase();
        if (!raw)
            return null;

        try {
            let fullCode = raw;
            if (!OpenLocationCode.isFull(raw)) {
                fullCode = OpenLocationCode.recoverNearest(raw, VENTURA_CENTER.lat, VENTURA_CENTER.lng);
            }
            
            if (OpenLocationCode.isFull(fullCode)) {
                const a = OpenLocationCode.decode(fullCode);
                return {
                    lat: a.latitudeCenter,
                    lng: a.longitudeCenter
                };
            }
        } catch (e) {
            console.error("❌ [MAP DEBUG] Error decodificando Plus Code:", raw, e);
        }
        return null;
    }

    async function resolveLocation(q) {
        const query = String(q || '').trim();
        if (!query)
            return null;

        const clinicMatch = CLINICS.find(c => c.code.toUpperCase() === query.toUpperCase());
        if (clinicMatch && clinicMatch.plusCode) {
            return await tryDecodePlusCode(clinicMatch.plusCode);
        }

        return await tryDecodePlusCode(query);
    }

    /* ---------- Markers with Logs ---------- */
    async function addMarkers() {
        console.log("📍 [MAP DEBUG] Ejecutando addMarkers(). Total clínicas en memoria:", CLINICS.length);
        
        if (markersLayer) {
            map.removeLayer(markersLayer);
            markersLayer = null;
        }
        markersLayer = L.layerGroup().addTo(map);
        const bounds = L.latLngBounds();

        const clinicIcon = L.icon({
            iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        });

        let renderedCount = 0;

        for (const c of CLINICS) {
            let lat = c.lat;
            let lng = c.lng;

            if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat)) {
                if (c.plusCode) {
                    const g = await tryDecodePlusCode(c.plusCode);
                    if (g) {
                        lat = g.lat;
                        lng = g.lng;
                    }
                }
            }

            if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat)) {
                continue;
            }

            const m = L.marker([lat, lng], { icon: clinicIcon }).addTo(markersLayer);
            
            m.bindTooltip(c.code, {
                permanent: true,
                direction: 'polygon',
                offset: [0, -42],
                className: 'clinic-label'
            });

            m.on('click', () => selectClinic({ ...c, lat, lng })); 
            bounds.extend([lat, lng]);
            renderedCount++;
        }

        console.log(`✨ [MAP DEBUG] Total de marcadores agregados al mapa: ${renderedCount}`);

        if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [40, 40] });
            if (map.getZoom() > 9) {
                map.setZoom(10);
            }
        }
    }

    function selectClinic(c) {
        renderSelectedClinic(c);
        map.fitBounds(L.latLngBounds([[c.lat, c.lng]]), {
            paddingTopLeft: [0, 0],
            paddingBottomRight: [380, 0],
            maxZoom: 11,
            animate: true,
            duration: 0.5
        });
    }

    function renderSelectedClinic(c, distance) {
        const panel = document.getElementById('clinic-info-body');
        if (!panel) return;
        const nb = s => String(s || '').replace(/\s*\/\s*/g, '&nbsp;/&nbsp;').replace(/\s{2,}/g, ' ').trim();

        const now = new Date();
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        const dayName = days[now.getDay()];
        const monthName = months[now.getMonth()];
        const dayNum = now.getDate();
        const dayNumPadded = String(dayNum).padStart(2, '0');

        const possibleDateKeys = [
            `${dayName} ${monthName} ${dayNum}`,
            `${dayName} ${monthName} ${dayNumPadded}`,
            `${monthName} ${dayNum}`,
            `${now.getMonth() + 1}/${dayNum}/${now.getFullYear()}`
        ];

        const clinicCode = String(c?.code || '').trim().toUpperCase();
        const rawProviders = window.APP_DATA?.providersByCode?.[clinicCode] || [];

        const linkedProviders = rawProviders.filter(p => {
            const matchedKey = possibleDateKeys.find(k => p[k] !== undefined && String(p[k]).trim() !== '');
            if (matchedKey) {
                p._matchedDateKey = matchedKey;
                return true;
            }
            return false;
        }).map(p => ({
            ...p,
            todayShift: String(p[p._matchedDateKey] || '').trim()
        }));

        const todayDisplayStr = `${dayName} ${monthName} ${dayNum}`;
        let html = '';

        html += `
      <div style="margin-bottom:20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 14px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
          <div style="font-weight:800; font-size:1.3rem; color:#0f172a; line-height:1.2;">🏥 ${c.name}</div>
          ${distance !== undefined ? `<div style="font-size:.75rem; font-weight:700; color:#1d4ed8; background:#dbeafe; padding:4px 10px; border-radius:20px; white-space:nowrap;">📍 ${distance.toFixed(1)} km</div>` : ''}
        </div>
        <div style="margin-top:8px; font-size:0.85rem; color:#475569; display:flex; align-items:center; gap:6px;">
          <span>📌</span> <span>${c.address ?? ''}</span>
        </div>
      </div>`;

        const sections = EXT_BY_CODE[c.code] ? Object.keys(EXT_BY_CODE[c.code]) : [];

        if (!sections.length && linkedProviders.length === 0) {
            panel.innerHTML = html + `<div class='empty-state'>ℹ️ No extensions or schedule available</div>`;
            openSheet();
            return;
        }

        if (sections.length > 0) {
            const order = ['Medical', 'Optical', 'Dental', 'MH'];
            const ordered = [...order.filter(s => sections.includes(s)), ...sections.filter(s => !order.includes(s)).sort()];

            html += `<div class="modern-stack extensions-panel">
                  <div class="modern-header">📞 Extensions & Lines</div>
                  <div class="modern-body">`;

            ordered.forEach((sec) => {
                const v = EXT_BY_CODE[c.code][sec] || {};
                const rows = [];
                if (v.front) rows.push({ label: 'Front', value: nb(v.front) });
                if (v.back) rows.push({ label: 'Back', value: nb(v.back) });
                if (!v.front && !v.back && v.ext) rows.push({ label: 'EXT', value: nb(v.ext) });

                html += `
            <div class="modern-ext-group">
              <div class="modern-ext-title">
                <span>🔹 ${sec}</span>
                ${v.phone ? `<span style="color:#2563eb; font-weight:600;">${v.phone}</span>` : ''}
              </div>
              ${rows.map(r => `
                <div class="modern-grid-row">
                  <div class="modern-lbl">${r.label}</div>
                  <div class="modern-val">${r.value}</div>
                </div>
              `).join('')}
            </div>`;
            });

            html += `</div></div>`;
        }

        html += `<div class="modern-stack providers-panel">
              <div class="modern-header">🧑‍⚕️ On Duty Today (${todayDisplayStr})</div>
              <div class="modern-body">`;

        if (linkedProviders.length > 0) {
            html += linkedProviders.map(p => `
        <div class="provider-row" style="padding: 6px 0; border-bottom: 1px dashed #e2e8f0; display: flex; align-items: center; justify-content: space-between;">
            <div style="flex: 1; display: flex; align-items: center; gap: 6px;">
                <span style="color: #475569; font-family: monospace; font-weight: 700; background: #f1f5f9; border: 1px solid #cbd5e1; padding: 1px 5px; border-radius: 3px; font-size: 0.75rem;">
                    🆔 ${p['Provider ID'] || 'N/A'}
                </span>
                <a href="#" 
                   onclick="event.preventDefault(); window.showProviderPopover('${p['Provider ID'] || ''}')" 
                   style="color: #4f46e5; text-decoration: none; font-weight: 700; cursor: pointer;">
                   ${p['Employee Name']}
                </a>
                <span style="color:#64748b; font-size:0.75rem;">${p.Specialty ? `[${p.Specialty}]` : ''}</span>
            </div>
            <span class="provider-badge">${p['JOB NAME'] ?? 'MD'}</span>
        </div>
    `).join('');
        } else {
            html += `<div style="font-size:0.8rem; color:#64748b; text-align:center; padding: 4px 0;">
                📅 No providers scheduled for today.
             </div>`;
        }

        html += `</div></div>`;

        panel.innerHTML = html;
        openSheet();
        setTimeout(() => AppMap.invalidate(), 100);
    }

    function openSheet() {
        const s = document.getElementById('place-sheet');
        if (s) {
            s.classList.add('open');
            s.setAttribute('aria-hidden', 'false');
        }
    }
    function closeSheet() {
        const s = document.getElementById('place-sheet');
        if (s) {
            s.classList.remove('open');
            s.setAttribute('aria-hidden', 'true');
        }
    }
    window.closePlaceSheet = closeSheet;

    function getClinicByCode(code) {
        const n = String(code ?? '').toUpperCase().trim();
        return CLINICS.find(c => c.code?.toUpperCase().trim() === n);
    }

    function getClinicBySearch(q) {
        let c = getClinicByCode(q);
        if (c)
            return c;
        const n = String(q ?? '').toLowerCase().trim();
        return CLINICS.find(c => {
            const nameMatch = c.name?.toLowerCase().trim() === n || c.name?.toLowerCase().includes(n);
            const nicknameMatch = String(c.nicknames || '').toLowerCase().includes(n);
            return nameMatch || nicknameMatch;
        });
    }

    function populateClinicPickers() {
        const sel = document.getElementById('clinicSelect');
        const dl = document.getElementById('clinicNameList');
        if (!sel && !dl)
            return;

        if (dl) {
            let optionsHtml = [];
            CLINICS.forEach(c => {
                const nicknamesArray = String(c.nicknames || '').split(',').map(n => n.trim()).filter(Boolean);
                const nicknamesStr = nicknamesArray.length > 0 ? ` (${nicknamesArray.join(', ')})` : '';
                optionsHtml.push(`<option value="${c.name}${nicknamesStr}" data-type="clinic" data-code="${c.code}"></option>`);
            });
            dl.innerHTML = optionsHtml.join('');
        }
    }

    async function findNearest() {
        const q = (document.getElementById('searchInput')?.value ?? '').trim();
        if (!q) return;

        const bySearch = getClinicBySearch(q);
        if (bySearch && bySearch.lat) {
            selectClinic(bySearch);
            return;
        }

        const g = await resolveLocation(q);
        if (!g) {
            alert('Invalid or not found Plus Code.');
            return;
        }
    }

    function clearSearch() {
        const box = document.getElementById('searchInput');
        if (box) box.value = '';
        const panel = document.getElementById('clinic-info-body');
        if (panel) {
            panel.innerHTML = `<div class="empty-state">Select a clinic or search by Plus Code.</div>`;
        }
        closeSheet();
        if (searchMarker) { map.removeLayer(searchMarker); searchMarker = null; }
        if (searchLine) { map.removeLayer(searchLine); searchLine = null; }
    }

    function buildBaseLayers() {
        const baseOSM = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });
        baseOSM.addTo(map);
    }

    /* 🚀 FUNCIÓN DE INVOCACIÓN MANUAL (Reemplaza el addEventListener automático) */
    async function initManualMap() {
        console.log("🚀 [MAP DEBUG] initManualMap() llamado manualmente.");
        try {
            if (map && typeof map.remove === 'function') {
                map.remove();
                map = null;
            }

            const mapContainer = document.getElementById('map');
            if (mapContainer && mapContainer._leaflet_id) {
                mapContainer._leaflet_id = null; 
            }

            const CA_BOUNDS = [[32.529523, -124.482003], [42.009518, -114.131211]];
            
            map = L.map('map', {
                zoomControl: true,
                dragging: true,
                tap: true,
                maxBounds: CA_BOUNDS,
                maxBoundsViscosity: .8
            }).setView([34.25, -119.10], 10);
            
            window.AppMap = map;
            
            buildBaseLayers();
            await loadData();

            for (const c of CLINICS) {
                if (typeof c.lat !== 'number' || typeof c.lng !== 'number') {
                    const g = await tryDecodePlusCode(c.plusCode);
                    if (g) {
                        c.lat = g.lat;
                        c.lng = g.lng;
                    }
                }
            }
            
            await addMarkers();
            populateClinicPickers();
            
            setTimeout(() => map.invalidateSize(), 200);
            console.log("🎉 [MAP DEBUG] Inicialización manual del mapa completada con éxito.");
        } catch (e) {
            console.error('❌ [MAP DEBUG] Error crítico en bootstrap manual del mapa:', e);
        }
    }

    // Exponemos las funciones necesarias de forma global sin listeners automáticos
    window.initManualMap = initManualMap;
    window.findNearest = findNearest;
    window.clearSearch = clearSearch;
    window.AppMap = {
        invalidate() { try { map?.invalidateSize() } catch (_) {} }
    };

    function CSV_parse(text) {
        const rows = [];
        let f = "", row = [], q = false;
        text = String(text ?? '').replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        for (let i = 0; i < text.length; i++) {
            const c = text[i];
            if (q) {
                if (c == '"') {
                    if (text[i + 1] == '"') { f += '"'; i++; continue; }
                    q = false; continue;
                }
                f += c; continue;
            }
            if (c == '"') { q = true; continue; }
            if (c == ',') { row.push(f); f = ""; continue; }
            if (c == '\n') { row.push(f); rows.push(row); row = []; f = ""; continue; }
            f += c;
        }
        row.push(f); rows.push(row);
        return rows;
    }

    function CSV_rowsToObjects(rows) {
        if (!rows || rows.length === 0) return [];
        const headers = (rows.shift() ?? []).map(h => String(h ?? '').trim());
        const out = [];
        for (const r of rows) {
            if (!r || !r.some(v => String(v ?? '').trim().length)) continue;
            const o = {};
            for (let i = 0; i < headers.length; i++) {
                o[headers[i] ?? `Col${i}`] = String(r[i] ?? '').trim();
            }
            out.push(o);
        }
        return out;
    }
})();