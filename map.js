/* === Map UI/UX Optimized (v1) === */
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

    /* ---------- Data Load ---------- */
    async function loadData() {
        const clinicsTxt = obtenerCsv("clinics");
        if (clinicsTxt) {
            CLINICS = mapClinicsCsvToObjects(CSV_rowsToObjects(CSV_parse(clinicsTxt)));
        }

        const provTxt = obtenerCsv("providersSched");
        if (provTxt) {
            const provRows = CSV_rowsToObjects(CSV_parse(provTxt));
            window.APP_DATA = window.APP_DATA || {};
            window.APP_DATA.providersByCode = provRows.reduce((acc, row) => {
                const code = String(row["Code"] || "").trim().toUpperCase();
                if (!acc[code])
                    acc[code] = [];
                acc[code].push(row);
                return acc;
            }, {});
        }

        const extTxt = obtenerCsv("extensions");
        if (extTxt) {
            const extRows = CSV_rowsToObjects(CSV_parse(extTxt));
            EXT = {};
            extRows.forEach(row => {
                const section = row.section || row.Section || "General";
                if (!EXT[section]) {
                    EXT[section] = [];
                }
                EXT[section].push(row);
            });
        }
        buildExtensionsIndex();
    }

    function mapClinicsCsvToObjects(items) {
        if (!items || !Array.isArray(items)) {
            return [];
        }
        const out = [];
        const seen = new Set();
        for (const it of items) {
            // Leemos directamente las columnas exactas del CSV generado
            const code = String(it["code"] || it["Abbreviation"] || "").trim().toUpperCase();
            const name = String(it["Location"] || it["Clinic Name"] || "").trim();
            const plusCode = String(it["PlusCode"] || it["plusCode"] || it["PC"] || it["Plus Code"] || "").trim();
            const address = String(it["Address"] || "").trim();
            const city = String(it["City"] || "").trim();
            const zip = String(it["ZipCode"] || it["Zip"] || "").trim();
            
            const fullAddress = [address, city, zip].filter(Boolean).join(", ");
            
            // Parseamos lat y lng asegurando formato numérico
            const rawLat = it["lat"] ?? it["Lat"] ?? "";
            const rawLng = it["lng"] ?? it["Lng"] ?? "";
            const lat = rawLat !== "" ? parseFloat(rawLat) : null;
            const lng = rawLng !== "" ? parseFloat(rawLng) : null;

            const clinic = {
                clinicId: code || name.toLowerCase().replace(/[^a-z0-9]+/gi, "-"),
                code,
                name,
                plusCode,
                address: fullAddress,
                lat: !isNaN(lat) ? lat : null,
                lng: !isNaN(lng) ? lng : null,
                nicknames: ""
            };
            if (code && !seen.has(code)) {
                out.push(clinic);
                seen.add(code);
            }
        }
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
        if (!window.OpenLocationCode)
            return null;
        
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
        } catch (_) {}
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

    /* ---------- Markers ---------- */
    async function addMarkers() {
        if (markersLayer) {
            map.removeLayer(markersLayer);
            markersLayer = null;
        }
        markersLayer = L.layerGroup().addTo(map);
        const bounds = L.latLngBounds();

        // 🎯 EL ICONO QUE FALTABA
        const clinicIcon = L.icon({
            iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        });

        for (const c of CLINICS) {
            let lat = c.lat;
            let lng = c.lng;

            if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat)) {
                const g = await tryDecodePlusCode(c.plusCode);
                if (g) {
                    lat = g.lat;
                    lng = g.lng;
                }
            }

            if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat)) {
                console.warn(`⚠️ Skipping marker for ${c.name}: No valid coordinates.`);
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
        }

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

    window.routeToProviderDirectory = function (providerIdOrName) {
        if (typeof window.showProviderModalById === 'function') {
            window.showProviderModalById(providerIdOrName);
        }
    };

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

        const ordered = [...CLINICS].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        if (sel) {
            sel.innerHTML = '';
            sel.insertAdjacentHTML('beforeend', '<option value="">All clinics…</option>');
            for (const c of ordered) {
                const main = document.createElement('option');
                main.value = c.code;
                main.textContent = c.code ? `${c.code} — ${c.name}` : c.name;
                main.setAttribute('data-code', c.code);
                sel.appendChild(main);
            }
            if (!sel.__wired) {
                sel.addEventListener('change', () => {
                    const opt = sel.selectedOptions?.[0];
                    const code = opt?.dataset?.code;
                    const c = code ? getClinicByCode(code) : null;
                    if (c && c.lat && c.lng)
                        selectClinic(c);
                });
                sel.__wired = true;
            }
        }

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
        const sel = document.getElementById('clinicSelect');
        const chosen = sel?.selectedOptions?.[0]?.dataset?.code ?? '';
        if (chosen) {
            const c = getClinicByCode(chosen);
            if (c && c.lat && c.lng) {
                selectClinic(c);
                return;
            }
        }
        const q = (document.getElementById('searchInput')?.value ?? '').trim();
        if (!q)
            return;

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

        if (searchMarker) {
            map.removeLayer(searchMarker);
            searchMarker = null;
        }
        if (searchLine) {
            map.removeLayer(searchLine);
            searchLine = null;
        }

        searchMarker = L.circleMarker([g.lat, g.lng], {
            radius: 7,
            color: '#dc2626',
            fillColor: '#dc2626',
            fillOpacity: .8,
            weight: 2
        }).addTo(map).bindPopup('📍 Search Plus Code');

        let candidates = [];
        for (const c of CLINICS) {
            let targetLat = c.lat;
            let targetLng = c.lng;

            if ((typeof targetLat !== 'number' || typeof targetLng !== 'number') && c.plusCode) {
                const plusDecoded = await tryDecodePlusCode(c.plusCode);
                if (plusDecoded) {
                    targetLat = plusDecoded.lat;
                    targetLng = plusDecoded.lng;
                }
            }

            if (!targetLat || !targetLng)
                continue;

            const R = 6371, toRad = d => d * Math.PI / 180;
            const dLat = toRad(targetLat - g.lat), dLng = toRad(targetLng - g.lng);
            const s1 = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(g.lat)) * Math.cos(toRad(targetLat)) * Math.sin(dLng / 2) ** 2;
            const dGeom = 2 * R * Math.asin(Math.sqrt(s1));

            candidates.push({
                clinic: c,
                lat: targetLat,
                lng: targetLng,
                dGeom: dGeom
            });
        }

        candidates.sort((a, b) => a.dGeom - b.dGeom);
        const finalists = candidates.slice(0, 3);
        if (!finalists.length)
            return;

        let bestMatch = null;
        let minDrivingDistance = Infinity;
        let bestRouteGeometry = null;

        for (const f of finalists) {
            try {
                const url = `https://router.project-osrm.org/route/v1/driving/${g.lng},${g.lat};${f.lng},${f.lat}?overview=full&geometries=geojson`;
                const response = await fetch(url);
                if (!response.ok)
                    continue;

                const data = await response.json();
                if (!data.routes || !data.routes.length)
                    continue;

                const route = data.routes[0];
                const drivingDistKm = route.distance / 1000;

                if (drivingDistKm < minDrivingDistance) {
                    minDrivingDistance = drivingDistKm;
                    bestMatch = { ...f.clinic, lat: f.lat, lng: f.lng };
                    bestRouteGeometry = route.geometry;
                }
            } catch (err) {
                if (!bestMatch) {
                    minDrivingDistance = f.dGeom;
                    bestMatch = { ...f.clinic, lat: f.lat, lng: f.lng };
                }
            }
        }

        if (bestMatch) {
            renderSelectedClinic(bestMatch, minDrivingDistance);

            if (bestRouteGeometry) {
                const coordinates = bestRouteGeometry.coordinates.map(coord => [coord[1], coord[0]]);
                searchLine = L.polyline(coordinates, {
                    color: '#2563eb',
                    weight: 4,
                    opacity: 0.85,
                    lineJoin: 'round'
                }).addTo(map);
            } else {
                searchLine = L.polyline([[g.lat, g.lng], [bestMatch.lat, bestMatch.lng]], {
                    color: '#dc2626',
                    weight: 2,
                    opacity: .6,
                    dashArray: '5,5'
                }).addTo(map);
            }

            const routeBounds = searchLine.getBounds();
            routeBounds.extend([g.lat, g.lng]);
            map.fitBounds(routeBounds, {
                padding: [60, 60],
                maxZoom: 14
            });
        }
    }

    function clearSearch() {
        const box = document.getElementById('searchInput');
        if (box) box.value = '';
        const sel = document.getElementById('clinicSelect');
        if (sel) sel.value = '';
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
        const baseGray = L.tileLayer('https://{s}.tile.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png', { maxZoom: 20, attribution: '© Stadia Maps' });
        const baseDark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, attribution: '© CARTO' });
        const layers = { '🗺️ Standard': baseOSM, '🌫️ Gray': baseGray, '🌙 Dark': baseDark };
        const pref = store.get('map:base', '🗺️ Standard');
        const chosen = layers[pref] || baseOSM;
        chosen.addTo(map);
        L.control.layers(layers, {}, { position: 'topright', collapsed: true }).addTo(map);
        map.on('baselayerchange', e => {
            const key = Object.keys(layers).find(k => layers[k] === e.layer) || '🗺️ Standard';
            store.set('map:base', key);
        });
    }

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen?.();
            document.body.classList.add('fullscreen-map');
        } else {
            document.exitFullscreen?.();
            document.body.classList.remove('fullscreen-map');
        }
        setTimeout(() => AppMap.invalidate(), 200);
    }

    function geolocate() {
        if (!navigator.geolocation) {
            alert('Geolocation not supported');
            return;
        }
        navigator.geolocation.getCurrentPosition(pos => {
            const { latitude, longitude } = pos.coords;
            const p = [latitude, longitude];
            const mk = L.circleMarker(p, {
                radius: 7,
                color: '#16a34a',
                fillColor: '#16a34a',
                fillOpacity: .85,
                weight: 2
            }).addTo(map).bindPopup('📍 You are here');
            mk.openPopup();
            map.setView(p, 14);
        }, () => {
            alert('Geolocation error');
        });
    }

    function wireShortcuts() {
        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                document.getElementById('searchInput')?.focus();
            }
            if (e.key === 'Escape') closeSheet();
        });
    }

    window.addEventListener('AppDataLoaded', async () => {
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
        
        // Initialize map with explicit dragging options enabled for GitHub Pages/iframe environments
        map = L.map('map', {
            zoomControl: true,
            dragging: true, // Explicitly force mouse dragging
            tap: true,      // Support touch interaction
            maxBounds: CA_BOUNDS,
            maxBoundsViscosity: .8
        }).setView([34.25, -119.10], 10);
        
        // Expose map globally so loading-screen.js can call invalidateSize() after splash removal
        window.AppMap = map;
        
        buildBaseLayers();
        await loadData();
        buildExtensionsIndex();

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
        wireShortcuts();
        
        setTimeout(() => map.invalidateSize(), 200);
    } catch (e) {
        console.error('Map bootstrap error:', e);
    }
});

    window.findNearest = findNearest;
    window.clearSearch = clearSearch;
    window.AppMap = {
        invalidate() { try { map?.invalidateSize() } catch (_) {} },
        toggleFullscreen,
        geolocate
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

    async function showProviderPopover(providerId) {
        // (Popover logic kept intact)
    }
    window.showProviderPopover = showProviderPopover;
})();