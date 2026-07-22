/* === Map UI/UX Standalone (v1) === */
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
            const r = await fetch(url, { cache: 'no-cache' });
            if (!r.ok) return null;
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
            } catch (_) { return d; }
        },
        set(k, v) {
            try { localStorage.setItem(k, v); } catch (_) {}
        }
    };

    /* ---------- Data Load ---------- */
    async function loadData() {
    // 0. Cargar desde parámetro Base64 en la URL si existe (?data=...)
    const urlParams = new URLSearchParams(window.location.search);
    const rawDataParam = urlParams.get('data');
    if (rawDataParam) {
        try {
            const jsonStr = new TextDecoder().decode(Uint8Array.from(atob(rawDataParam), c => c.charCodeAt(0)));
            const parsedPayload = JSON.parse(jsonStr);
            
            if (parsedPayload.clinics) {
                CLINICS = mapClinicsCsvToObjects(CSV_rowsToObjects(CSV_parse(parsedPayload.clinics)));
            }
            if (parsedPayload.providers) {
                const provRows = CSV_rowsToObjects(CSV_parse(parsedPayload.providers));
                window.APP_DATA = window.APP_DATA || {};
                window.APP_DATA.providersByCode = provRows.reduce((acc, row) => {
                    const code = String(row['Health Center'] || '').trim().toUpperCase();
                    if (!acc[code]) acc[code] = [];
                    acc[code].push(row);
                    return acc;
                }, {});
            }
            EXT = parsedPayload.extensions || {};
            buildExtensionsIndex();
            return; // Salir para evitar los fetch 404
        } catch (e) {
            console.error("Error al decodificar el payload de la URL:", e);
        }
    }

    // 1. Fallback a archivos locales si no hay parámetro URL
    const clinicsTxt = await CSV_loadText('clinics.csv');
    if (clinicsTxt) {
        CLINICS = mapClinicsCsvToObjects(CSV_rowsToObjects(CSV_parse(clinicsTxt)));
    }

    const provTxt = await CSV_loadText('PROVIDERS-Sched.csv');
    if (provTxt) {
        const provRows = CSV_rowsToObjects(CSV_parse(provTxt));
        window.APP_DATA = window.APP_DATA || {};
        window.APP_DATA.providersByCode = provRows.reduce((acc, row) => {
            const code = String(row['Health Center'] || '').trim().toUpperCase();
            if (!acc[code]) acc[code] = [];
            acc[code].push(row);
            return acc;
        }, {});
    }

    EXT = await safeJson('extensions.json') ?? {};
    buildExtensionsIndex();
}
    function mapClinicsCsvToObjects(items) {
    if (!items || !Array.isArray(items)) return [];
    const out = [], seen = new Set();

    for (const it of items) {
        const code = it['code'];
        const name = it['name'];
        const plusCode = it['plusCode'];
        const nicknames = it['nicknames'];

        const addr = [it['address'], it['city'], it['state'], it['zipCode']]
        .filter(Boolean)
        .join(', ');

        // Forzar conversión numérica limpia y asegurar respaldo por nombre de columna
        const lat = parseFloat(it['lat']);
        const lng = parseFloat(it['lng']);

        const clinic = {
            clinicId: it['clinicId'] || name?.toLowerCase().replace(/[^a-z0-9]+/gi, '-'),
            code: code,
            name: name,
            plusCode: plusCode, 
            address: addr,
            lat: isNaN(lat) ? null : lat,
            lng: isNaN(lng) ? null : lng,
            nicknames: nicknames
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
            if (section === 'Meta' || !Array.isArray(EXT[section])) continue;
            for (const item of EXT[section]) {
                const code = String(item.code || '').toUpperCase();
                if (!code) continue;
                if (!EXT_BY_CODE[code]) EXT_BY_CODE[code] = {};
                EXT_BY_CODE[code][section] = item;
            }
        }
    }

    /* ---------- OLC & Geocode ---------- */
    const CA_BOUNDS = [[32.529523, -124.482003], [42.009518, -114.131211]];
    const CA_VIEWBOX = '-124.482003,42.009518,-114.131211,32.529523';
    const CA_CENTER = { lat: 37.25, lng: -119.7 };
    let __OLC_READY = null;

    function ensureOLC() {
        if (window.OpenLocationCode) return Promise.resolve();
        if (__OLC_READY) return __OLC_READY;
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

    async function tryDecodePlusCode(input, ref) {
        await ensureOLC().catch(() => {});
        if (!window.OpenLocationCode) return null;
        const raw = String(input || '').trim();
        if (!raw.includes('+')) return null;
        let code = raw, loc = null;
        if (raw.includes(',')) {
            const [p, ...r] = raw.split(',');
            code = String(p || '').trim().toUpperCase();
            loc = r.join(',').trim();
        } else code = raw.toUpperCase();
        try {
            if (OpenLocationCode.isFull(code)) {
                const a = OpenLocationCode.decode(code);
                return { lat: a.latitudeCenter, lng: a.longitudeCenter };
            }
            let refPt = ref || (map?.getCenter() && { lat: map.getCenter().lat, lng: map.getCenter().lng }) || CA_CENTER;
            const full = OpenLocationCode.recoverNearest(code, refPt.lat, refPt.lng);
            const a = OpenLocationCode.decode(full);
            return { lat: a.latitudeCenter, lng: a.longitudeCenter };
        } catch (_) {
            return null;
        }
    }

    const NOM_DELAY = 1100;
    let __last = 0;
    async function throttle() {
        const now = Date.now();
        const wait = Math.max(0, NOM_DELAY - (now - __last));
        if (wait) await new Promise(r => setTimeout(r, wait));
        __last = Date.now();
    }

    async function geocode(q) {
        try {
            await throttle();
            q = String(q ?? '').trim();
            if (!/(\bCA\b|\bCalifornia\b|\bUSA\b|\d{5})/i.test(q)) q += ', CA, USA';
            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&countrycodes=us&viewbox=${encodeURIComponent(CA_VIEWBOX)}&bounded=1&limit=5`;
            const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
            if (!r.ok) return null;
            const d = await r.json();
            if (!Array.isArray(d) || !d.length) return null;
            const best = d.find(x => /(^|,\s)California(,|\s|$)/i.test(x?.display_name || '')) || d[0];
            return { lat: +best.lat, lng: +best.lon };
        } catch (_) {
            return null;
        }
    }

    async function resolveLocation(q) {
        const p = await tryDecodePlusCode(q);
        if (p) return p;
        return await geocode(q);
    }

    /* ---------- Markers ---------- */
    async function addMarkers() {
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

       for (const c of CLINICS) {
    let lat = c.lat;
    let lng = c.lng;

    // Solo intentar decodificar si realmente existe un Plus Code escrito
    if (c.plusCode && String(c.plusCode).trim() !== '') {
        const plusDecoded = await tryDecodePlusCode(c.plusCode);
        if (plusDecoded) {
            lat = plusDecoded.lat;
            lng = plusDecoded.lng;
        }
    }

    if (typeof lat !== 'number' || isNaN(lat) || typeof lng !== 'number' || isNaN(lng)) continue;

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
            if (map.getZoom() > 9) map.setZoom(10);
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

    /* ---------- Sheet Render ---------- */
    function renderSelectedClinic(c, distance) {
        const panel = document.getElementById('clinic-info-body');
        if (!panel) return;
        const nb = s => String(s || '').replace(/\s*\/\s*/g, '&nbsp;/&nbsp;').replace(/\s{2,}/g, ' ').trim();

        const now = new Date();
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const todayStr = `${days[now.getDay()]} ${months[now.getMonth()]} ${now.getDate()}`;

        const linkedProviders = (window.APP_DATA?.providersByCode?.[c.code.toUpperCase()] || [])
        .filter(p => String(p.Date || '').trim() === todayStr);

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
              <div class="modern-header">🧑‍⚕️ On Duty Today (${todayStr})</div>
              <div class="modern-body">`;

        if (linkedProviders.length > 0) {
            html += linkedProviders.map(p => `
            <div class="provider-row" style="padding: 6px 0; border-bottom: 1px dashed #e2e8f0; display: flex; align-items: center; justify-content: space-between;">
                <div style="flex: 1; display: flex; align-items: center; gap: 6px;">
                    <span style="color: #475569; font-family: monospace; font-weight: 700; background: #f1f5f9; border: 1px solid #cbd5e1; padding: 1px 5px; border-radius: 3px; font-size: 0.75rem;">
                        🆔 ${p['Provider ID'] || 'N/A'}
                    </span>
                    <a href="#" 
                       onclick="event.preventDefault(); showProviderPopover('${p['Provider ID'] || ''}', '${p['Employee Name'].replace(/'/g, "\\'")}')" 
                       style="color: #4f46e5; text-decoration: none; font-weight: 700; cursor: pointer;">
                       ${p['Employee Name']}
                    </a>
                    <span style="color:#64748b; font-size:0.75rem;">${p.Specialty ? `[${p.Specialty}]` : ''}</span>
                </div>
                <span class="provider-badge">${p['JOB NAME'] ?? 'MD'}</span>
            </div>
        `).join('');
        } else {
            html += `<div style="font-size:0.8rem; color:#64748b; text-align:center; padding: 4px 0;">📅 No providers scheduled for today.</div>`;
        }

        html += `</div></div>`;
        panel.innerHTML = html;
        openSheet();
    }

    function openSheet() {
        const s = document.getElementById('place-sheet');
        if (s) { s.classList.add('open'); s.setAttribute('aria-hidden', 'false'); }
    }
    function closeSheet() {
        const s = document.getElementById('place-sheet');
        if (s) { s.classList.remove('open'); s.setAttribute('aria-hidden', 'true'); }
    }
    window.closePlaceSheet = closeSheet;

    /* ---------- Search & Picker ---------- */
    function getClinicByCode(code) {
        const n = String(code ?? '').toUpperCase().trim();
        return CLINICS.find(c => c.code?.toUpperCase().trim() === n);
    }
    
    function getClinicBySearch(q) {
        let c = getClinicByCode(q);
        if (c) return c;
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
        if (!sel && !dl) return;
        
        const ordered = [...CLINICS].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        
        if (sel) {
            sel.innerHTML = '<option value="">Todas las clínicas…</option>';
            for (const c of ordered) {
                const main = document.createElement('option');
                main.value = c.code;
                main.textContent = c.code ? `${c.code} — ${c.name}` : c.name;
                main.dataset.code = c.code;
                sel.appendChild(main);
            }
            if (!sel.__wired) {
                sel.addEventListener('change', () => {
                    const opt = sel.selectedOptions?.[0];
                    const code = opt?.dataset?.code;
                    const c = code ? getClinicByCode(code) : null;
                    if (c && c.lat && c.lng) selectClinic(c);
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

            const now = new Date();
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const todayStr = `${days[now.getDay()]} ${months[now.getMonth()]} ${now.getDate()}`;
            const seenPairs = new Set();

            if (window.APP_DATA && window.APP_DATA.providersByCode) {
                for (const code in window.APP_DATA.providersByCode) {
                    const list = window.APP_DATA.providersByCode[code] || [];
                    list.forEach(p => {
                        if (String(p.Date || '').trim() === todayStr && p['Employee Name']) {
                            const uniqueKey = `${p['Provider ID']}-${code}`;
                            if (!seenPairs.has(uniqueKey)) {
                                const pId = String(p['Provider ID'] || '').trim();
                                const pName = String(p['Employee Name'] || '').trim();
                                const pSpec = p.Specialty ?? p['JOB NAME'] ?? 'MD';
                                optionsHtml.push(`<option value="${pName}" label="🆔 ${pId} -> Hoy en ${code} (${pSpec})"></option>`);
                                optionsHtml.push(`<option value="${pId}" label="👨‍⚕️ ${pName} -> Hoy en ${code} (${pSpec})"></option>`);
                                seenPairs.add(uniqueKey);
                            }
                        }
                    });
                }
            }
            dl.innerHTML = optionsHtml.join('');
        }
    }

    async function findNearest() {
        const sel = document.getElementById('clinicSelect');
        const chosen = sel?.selectedOptions?.[0]?.dataset?.code ?? '';
        if (chosen) {
            const c = getClinicByCode(chosen);
            if (c && c.lat && c.lng) { selectClinic(c); return; }
        }
        const q = (document.getElementById('searchInput')?.value ?? '').trim();
        if (!q) return;

        const now = new Date();
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const todayStr = `${days[now.getDay()]} ${months[now.getMonth()]} ${now.getDate()}`;
        let providerTargetCode = null;
        let matchedProviderName = null;

        if (window.APP_DATA && window.APP_DATA.providersByCode) {
            for (const code in window.APP_DATA.providersByCode) {
                const list = window.APP_DATA.providersByCode[code] || [];
                const found = list.find(p => 
                    String(p.Date || '').trim() === todayStr && (
                        String(p['Employee Name'] || '').toLowerCase().includes(q.toLowerCase()) ||
                        String(p['Provider ID'] || '').trim() === q
                    )
                );
                if (found) {
                    providerTargetCode = code;
                    matchedProviderName = found['Employee Name'];
                    break;
                }
            }
        }

        if (providerTargetCode) {
            const c = getClinicByCode(providerTargetCode);
            if (c && c.lat && c.lng) {
                selectClinic(c);
                document.getElementById('searchInput').value = matchedProviderName;
                return;
            }
        }

        const bySearch = getClinicBySearch(q);
        if (bySearch && bySearch.lat) { selectClinic(bySearch); return; }
        
        const g = await resolveLocation(q);
        if (!g) { alert('Address/Plus Code/Provider not found.'); return; }
        
        if (searchMarker) { map.removeLayer(searchMarker); searchMarker = null; }
        if (searchLine) { map.removeLayer(searchLine); searchLine = null; }

        searchMarker = L.circleMarker([g.lat, g.lng], {
            radius: 7, color: '#dc2626', fillColor: '#dc2626', fillOpacity: .8, weight: 2
        }).addTo(map).bindPopup('📍 Dirección de Búsqueda');

        let candidates = [];
        for (const c of CLINICS) {
            let targetLat = c.lat, targetLng = c.lng;
            const plusDecoded = await tryDecodePlusCode(c.plusCode);
            if (plusDecoded) { targetLat = plusDecoded.lat; targetLng = plusDecoded.lng; }
            if (!targetLat || !targetLng) continue;

            const R = 6371, toRad = d => d * Math.PI / 180;
            const dLat = toRad(targetLat - g.lat), dLng = toRad(targetLng - g.lng);
            const s1 = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(g.lat)) * Math.cos(toRad(targetLat)) * Math.sin(dLng / 2) ** 2;
            const dGeom = 2 * R * Math.asin(Math.sqrt(s1));
            
            candidates.push({ clinic: c, lat: targetLat, lng: targetLng, dGeom: dGeom });
        }

        candidates.sort((a, b) => a.dGeom - b.dGeom);
        const finalists = candidates.slice(0, 3);
        if (!finalists.length) return;

        let bestMatch = null, minDrivingDistance = Infinity, bestRouteGeometry = null;

        for (const f of finalists) {
            try {
                const url = `https://router.project-osrm.org/route/v1/driving/${g.lng},${g.lat};${f.lng},${f.lat}?overview=full&geometries=geojson`;
                const response = await fetch(url);
                if (!response.ok) continue;
                const data = await response.json();
                if (!data.routes || !data.routes.length) continue;

                const route = data.routes[0];
                const drivingDistKm = route.distance / 1000;

                if (drivingDistKm < minDrivingDistance) {
                    minDrivingDistance = drivingDistKm;
                    bestMatch = { ...f.clinic, lat: f.lat, lng: f.lng };
                    bestRouteGeometry = route.geometry;
                }
            } catch (_) {
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
                searchLine = L.polyline(coordinates, { color: '#2563eb', weight: 4, opacity: 0.85, lineJoin: 'round' }).addTo(map);
            } else {
                searchLine = L.polyline([[g.lat, g.lng], [bestMatch.lat, bestMatch.lng]], { color: '#dc2626', weight: 2, opacity: .6, dashArray: '5,5' }).addTo(map);
            }

            const routeBounds = searchLine.getBounds();
            routeBounds.extend([g.lat, g.lng]);
            map.fitBounds(routeBounds, { padding: [60, 60], maxZoom: 14 });
        }
    }

    function clearSearch() {
        const box = document.getElementById('searchInput');
        if (box) box.value = '';
        const sel = document.getElementById('clinicSelect');
        if (sel) sel.value = '';
        const panel = document.getElementById('clinic-info-body');
        if (panel) panel.innerHTML = `<div class="empty-state">Selecciona una clínica o busca por dirección/código.</div>`;
        closeSheet();
        if (searchMarker) { map.removeLayer(searchMarker); searchMarker = null; }
        if (searchLine) { map.removeLayer(searchLine); searchLine = null; }
    }

    /* ---------- Basemaps ---------- */
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
        if (!navigator.geolocation) { alert('Geolocation not supported'); return; }
        navigator.geolocation.getCurrentPosition(pos => {
            const { latitude, longitude } = pos.coords;
            const p = [latitude, longitude];
            L.circleMarker(p, { radius: 7, color: '#16a34a', fillColor: '#16a34a', fillOpacity: .85, weight: 2 }).addTo(map).bindPopup('📍 You are here').openPopup();
            map.setView(p, 14);
        }, () => alert('Geolocation error'));
    }

    /* ---------- Bootstrap ---------- */
    window.addEventListener('DOMContentLoaded', async() => {
        try {
            map = L.map('map', { zoomControl: true, maxBounds: CA_BOUNDS, maxBoundsViscosity: .8 }).setView([34.25, -119.10], 10);
            buildBaseLayers();
            await loadData();
            buildExtensionsIndex();
            
            for (const c of CLINICS) {
                if (typeof c.lat !== 'number' || typeof c.lng !== 'number') {
                    const g = await tryDecodePlusCode(c.plusCode);
                    if (g) { c.lat = g.lat; c.lng = g.lng; }
                }
            }
            addMarkers();
            populateClinicPickers();
            setTimeout(() => map.invalidateSize(), 200);
        } catch (e) {
            console.error('bootstrap', e);
        }
    });

    /* ---------- Expose ---------- */
    window.findNearest = findNearest;
    window.clearSearch = clearSearch;
    window.AppMap = {
        invalidate() { try { map?.invalidateSize() } catch (_) {} },
        toggleFullscreen,
        geolocate
    };

    /* ---------- CSV Helpers ---------- */
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
    
    async function CSV_loadText(url) {
        const r = await fetch(url, { cache: 'no-cache' });
        if (!r.ok) return null;
        return await r.text();
    }
    
    /* ---------- Popover de Cumplimiento (Do's & Don'ts) ---------- */
    async function showProviderPopover(providerId, providerName) {
        removeProviderPopover();
        let masterList = window.APP_DATA?.Main_Providers_csv || [];
        
        if (masterList.length === 0) {
            try {
                const responseMain = await fetch('Main-Providers.csv');
                if (responseMain.ok) {
                    const textMain = await responseMain.text();
                    masterList = CSV_rowsToObjects(CSV_parse(textMain));
                }
            } catch (err) {
                console.error("❌ Error Main-Providers.csv:", err);
            }
        }

        const doc = masterList.find(m => {
            const mId = String(m['Provider ID'] || '').trim();
            const mName = String(m['Provider'] || '').toLowerCase().trim();
            return (providerId && mId === String(providerId).trim()) || (mName === providerName.toLowerCase().trim());
        });

        if (!doc) {
            alert(`No se encontraron directrices para: ${providerName}`);
            return;
        }

        const docName = String(doc['Provider'] || providerName).trim();
        const docDegree = String(doc['Dr Degree'] || '').trim();
        const docSpec = String(doc['Specialty'] || 'General Medicine').trim();
        const docLang = String(doc['Languages '] || doc['Languages'] || '').trim();
        const docNpi = String(doc['NPI'] || 'N/A').trim();
        const docDos = String(doc["Do's ✔"] || '').trim();
        const docDonts = String(doc["Don'ts ❌"] || '').trim();

        const backdrop = document.createElement('div');
        backdrop.id = 'pdir-popover-backdrop';
        backdrop.style = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15,23,42,0.2); z-index:99999; display:flex; align-items:center; justify-content:center;';
        
        const popover = document.createElement('div');
        popover.id = 'pdir-popover-card';
        popover.style = 'width:440px; max-width:90vw; background:#ffffff; padding:18px; border-radius:8px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.2); border:1px solid #e2e8f0; font-family: system-ui, sans-serif;';

        let guidelinesHtml = '<div style="margin-top:10px; font-size:0.8rem; color:#64748b; text-align:center; font-style:italic;">⚠️ Sin directrices registradas.</div>';
        if (docDos || docDonts) {
            guidelinesHtml = `
                <div style="margin-top:12px; padding:12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; font-size:0.85rem; line-height:1.5;">
                    ${docDos ? `<div style="color:#16a34a; margin-bottom:8px;"><strong>Do's ✔:</strong> ${docDos}</div>` : ''}
                    ${docDonts ? `<div style="color:#dc2626;"><strong>Don'ts ❌:</strong> ${docDonts}</div>` : ''}
                </div>`;
        }

        popover.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:start; gap:10px; border-bottom:1px solid #f1f5f9; padding-bottom:12px;">
                <div>
                    <h4 style="margin:0; font-size:1.15rem; font-weight:800; color:#0f172a;">${docName}${docDegree ? `, ${docDegree}` : ''}</h4>
                    <div style="font-size:0.75rem; color:#64748b; margin-top:4px;">
                        <span>🔑 ID: <strong>${providerId || 'N/A'}</strong> | 🌐 NPI: <strong>${docNpi}</strong></span>
                        ${docLang ? `<br>🗣️ ${docLang}` : ''}
                    </div>
                </div>
                <span style="background:#e0e7ff; color:#4338ca; font-size:0.7rem; font-weight:700; padding:3px 8px; border-radius:4px;">${docSpec}</span>
            </div>
            ${guidelinesHtml}
            <div style="margin-top:14px; text-align:right;">
                <button onclick="removeProviderPopover()" style="background:#f1f5f9; border:1px solid #cbd5e1; color:#475569; padding:6px 14px; border-radius:4px; font-size:0.8rem; font-weight:600; cursor:pointer;">Cerrar</button>
            </div>
        `;

        backdrop.appendChild(popover);
        document.body.appendChild(backdrop);
        backdrop.addEventListener('click', (e) => { if (e.target === backdrop) removeProviderPopover(); });
    }

    function removeProviderPopover() {
        const existing = document.getElementById('pdir-popover-backdrop');
        if (existing) existing.remove();
    }

    window.showProviderPopover = showProviderPopover;
    window.removeProviderPopover = removeProviderPopover;
})();
