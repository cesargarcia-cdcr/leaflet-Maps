/* === Map UI/UX Optimized (v3.1 - Standalone Flow URL & iframe Support) === */
'use strict';
(function () {
    let CLINICS = [],
    EXT = {};
    let map,
    searchMarker = null,
    searchLine = null,
    markersLayer = null;

    /* ---------- Utilities ---------- */
    const store = {
        get(k, d) {
            try {
                const v = localStorage.getItem(k);
                return v ?? d;
            } catch (_) {
                return d;
            }
        },
        set(k, v) {
            try {
                localStorage.setItem(k, v);
            } catch (_) {}
        }
    };

    function showErrorNotification(message) {
        let banner = document.getElementById('map-error-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'map-error-banner';
            banner.style.cssText = 'position:fixed; top:12px; left:50%; transform:translateX(-50%); background:#fee2e2; color:#991b1b; padding:10px 18px; border-radius:8px; font-size:0.875rem; font-weight:600; box-shadow:0 4px 12px rgba(0,0,0,0.15); z-index:99999; max-width:90%; text-align:center; border:1px solid #fecaca;';
            document.body.appendChild(banner);
        }
        banner.textContent = message;
    }

    /* ---------- Data Load (Base64 URL Parameter & iframe Support) ---------- */
    function getFlowUrlFromParam() {
        try {
            const params = new URLSearchParams(window.location.search);
            let rawData = params.get('data');
            
            // Check parent window search if loaded inside an iframe
            if (!rawData && window.self !== window.top) {
                try {
                    const parentParams = new URLSearchParams(window.parent.location.search);
                    rawData = parentParams.get('data');
                } catch (e) {
                    // Cross-origin restriction fallback
                }
            }

            if (!rawData) return null;

            // Normalize Base64 padding/characters if passed via URL query string
            let base64 = rawData.replace(/-/g, '+').replace(/_/g, '/');
            while (base64.length % 4) {
                base64 += '=';
            }

            // Decode Base64 supporting UTF-8 strings safely
            const binString = atob(base64);
            const bytes = Uint8Array.from(binString, (m) => m.codePointAt(0));
            const decodedUrl = new TextDecoder().decode(bytes);
            
            return decodedUrl;
        } catch (e) {
            console.error('Failed to parse data parameter as Base64:', e);
            return null;
        }
    }

    async function loadData() {
        const flowUrl = getFlowUrlFromParam();
        
        if (!flowUrl) {
            showErrorNotification('⚠️ Error: Missing "data" parameter with the Base64 Flow URL.');
            console.error('No Base64 Flow URL provided in search parameters.');
            return;
        }

        try {
            const r = await fetch(flowUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({})
            });

            if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`);
            
            // 🔍 Debug: Grab the raw text first to inspect what Power Automate is sending back
            const rawText = await r.text();
            console.log("Raw Flow Response:", rawText);

            if (!rawText) {
                throw new Error("Flow returned an empty response body.");
            }

            EXT = JSON.parse(rawText);
            buildClinicsFromJSON();
        } catch (err) {
            console.error('Flow URL fetch failed:', err);
            showErrorNotification('⚠️ Error: Could not load data from the Flow URL (check console).');
        }
    }
    function buildClinicsFromJSON() {
        CLINICS = [];
        for (const code in EXT) {
            const item = EXT[code];
            if (!item || code === 'Meta') continue;

            const lat = parseFloat(item.lat);
            const lng = parseFloat(item.lng);

            CLINICS.push({
                clinicId: code.toLowerCase(),
                code: item.code || code,
                name: item.name,
                address: [item.address, item.city, item.state, item.zip].filter(Boolean).join(', '),
                lat: !isNaN(lat) ? lat : null,
                lng: !isNaN(lng) ? lng : null,
                plusCode: item.plusCode,
                nicknames: item.nicknames || ''
            });
        }
        addMarkers();
        populateClinicPickers();
    }

    /* ---------- OLC & Geocode ---------- */
    const CA_BOUNDS = [[32.529523, -124.482003], [42.009518, -114.131211]];
    const CA_VIEWBOX = '-124.482003,42.009518,-114.131211,32.529523';
    const CA_CENTER = { lat: 37.25, lng: -119.7 };
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

    async function tryDecodePlusCode(input, ref) {
        await ensureOLC().catch(() => {});
        if (!window.OpenLocationCode)
            return null;
        const raw = String(input || '').trim();
        if (!raw.includes('+'))
            return null;
        let code = raw;
        if (raw.includes(',')) {
            const [p] = raw.split(',');
            code = String(p || '').trim().toUpperCase();
        } else {
            code = raw.toUpperCase();
        }
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
            if (!/(\bCA\b|\bCalifornia\b|\bUSA\b|\d{5})/i.test(q))
                q += ', CA, USA';
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

            if ((!lat || !lng) && c.plusCode) {
                const plusDecoded = await tryDecodePlusCode(c.plusCode);
                if (plusDecoded) {
                    lat = plusDecoded.lat;
                    lng = plusDecoded.lng;
                }
            }

            if (typeof lat !== 'number' || typeof lng !== 'number') continue;

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

    /* ---------- Selection & Sheet Integration ---------- */
    function selectClinic(c) {
        renderSelectedClinic(c);
        if (c.lat && c.lng) {
            map.fitBounds(L.latLngBounds([[c.lat, c.lng]]), {
                paddingTopLeft: [0, 0],
                paddingBottomRight: [380, 0],
                maxZoom: 11,
                animate: true,
                duration: 0.5
            });
        }
    }

    function renderSelectedClinic(c, distance) {
        const panel = document.getElementById('clinic-info-body');
        if (!panel) return;
        const nb = s => String(s || '').replace(/\s*\/\s*/g, '&nbsp;/&nbsp;').replace(/\s{2,}/g, ' ').trim();

        const clinicData = EXT[c.code?.toUpperCase()] || {};
        let html = '';

        html += `
      <div style="margin-bottom:20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 14px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
          <div style="font-weight:800; font-size:1.3rem; color:#0f172a; line-height:1.2;">🏥 ${clinicData.name || c.name}</div>
          ${distance !== undefined ? `<div style="font-size:.75rem; font-weight:700; color:#1d4ed8; background:#dbeafe; padding:4px 10px; border-radius:20px; white-space:nowrap;">📍 ${distance.toFixed(1)} km</div>` : ''}
        </div>
        <div style="margin-top:8px; font-size:0.85rem; color:#475569; display:flex; align-items:center; gap:6px;">
          <span>📌</span> <span>${clinicData.address ? [clinicData.address, clinicData.city, clinicData.state, clinicData.zip].filter(Boolean).join(', ') : c.address}</span>
        </div>
      </div>`;

        const departments = ['medical', 'mh', 'dental', 'optical'];
        const deptLabels = { medical: 'Medical', mh: 'Mental Health', dental: 'Dental', optical: 'Optical' };
        
        let hasDepts = false;
        let deptsHtml = '';

        departments.forEach(deptKey => {
            const dept = clinicData[deptKey];
            if (!dept) return;
            const hasValues = dept.front || dept.back || dept.ext || dept.phone || dept.fax;
            if (!hasValues) return;

            hasDepts = true;
            const rows = [];
            if (dept.front) rows.push({ label: 'Front', value: nb(dept.front) });
            if (dept.back) rows.push({ label: 'Back', value: nb(dept.back) });
            if (dept.ext) rows.push({ label: 'EXT', value: nb(dept.ext) });
            if (dept.fax) rows.push({ label: 'Fax', value: nb(dept.fax) });

            deptsHtml += `
            <div class="modern-ext-group">
              <div class="modern-ext-title">
                <span>🔹 ${deptLabels[deptKey]}</span>
                ${dept.phone ? `<span style="color:#2563eb; font-weight:600;">${dept.phone}</span>` : ''}
              </div>
              ${rows.map(r => `
                <div class="modern-grid-row">
                  <div class="modern-lbl">${r.label}</div>
                  <div class="modern-val">${r.value}</div>
                </div>
              `).join('')}
            </div>`;
        });

        if (hasDepts) {
            html += `<div class="modern-stack extensions-panel">
                  <div class="modern-header">📞 Extensions & Lines</div>
                  <div class="modern-body">${deptsHtml}</div></div>`;
        }

        panel.innerHTML = html;
        openSheet();
        setTimeout(() => AppMap?.invalidate(), 100);
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
        if (!sel) return;
        
        const ordered = [...CLINICS].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        sel.innerHTML = '<option value="">Todas las clínicas…</option>';
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
                if (c && c.lat && c.lng) selectClinic(c);
            });
            sel.__wired = true;
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
        if (!q) return;

        const bySearch = getClinicBySearch(q);
        if (bySearch && bySearch.lat) {
            selectClinic(bySearch);
            return;
        }
        
        const g = await resolveLocation(q);
        if (!g) {
            alert('Address/Plus Code not found.');
            return;
        }
        
        if (searchMarker) { map.removeLayer(searchMarker); searchMarker = null; }
        if (searchLine) { map.removeLayer(searchLine); searchLine = null; }

        searchMarker = L.circleMarker([g.lat, g.lng], {
            radius: 7, color: '#dc2626', fillColor: '#dc2626', fillOpacity: .8, weight: 2
        }).addTo(map);

        let candidates = [];
        for (const c of CLINICS) {
            let targetLat = c.lat;
            let targetLng = c.lng;

            if ((!targetLat || !targetLng) && c.plusCode) {
                const plusDecoded = await tryDecodePlusCode(c.plusCode);
                if (plusDecoded) {
                    targetLat = plusDecoded.lat;
                    targetLng = plusDecoded.lng;
                }
            }

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

        let bestMatch = null;
        let minDrivingDistance = Infinity;

        for (const f of finalists) {
            try {
                const url = `https://router.project-osrm.org/route/v1/driving/${g.lng},${g.lat};${f.lng},${f.lat}?overview=full&geometries=geojson`;
                const response = await fetch(url);
                if (!response.ok) continue;
                const data = await response.json();
                if (!data.routes || !data.routes.length) continue;

                const drivingDistKm = data.routes[0].distance / 1000;
                if (drivingDistKm < minDrivingDistance) {
                    minDrivingDistance = drivingDistKm;
                    bestMatch = { ...f.clinic, lat: f.lat, lng: f.lng };
                }
            } catch (err) {
                if (!bestMatch) {
                    minDrivingDistance = f.dGeom;
                    bestMatch = { ...f.clinic, lat: f.lat, lng: f.lng };
                }
            }
        }

        if (bestMatch) selectClinic(bestMatch);
    }

    function clearSearch() {
        const box = document.getElementById('searchInput');
        if (box) box.value = '';
        const sel = document.getElementById('clinicSelect');
        if (sel) sel.value = '';
        const panel = document.getElementById('clinic-info-body');
        if (panel) {
            panel.innerHTML = `<div class="empty-state">Selecciona una clínica o busca por dirección/código.</div>`;
        }
        closeSheet();
        if (searchMarker) { map.removeLayer(searchMarker); searchMarker = null; }
        if (searchLine) { map.removeLayer(searchLine); searchLine = null; }
    }

    /* ---------- Basemaps ---------- */
    function buildBaseLayers() {
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
        }).addTo(map);
    }

    /* ---------- Bootstrap ---------- */
    window.addEventListener('DOMContentLoaded', async() => {
        try {
            map = L.map('map', {
                zoomControl: true,
                maxBounds: CA_BOUNDS,
                maxBoundsViscosity: .8
            }).setView([34.25, -119.10], 10);
            
            buildBaseLayers();
            await loadData();
            
            for (const c of CLINICS) {
                if ((typeof c.lat !== 'number' || typeof c.lng !== 'number') && c.plusCode) {
                    const g = await tryDecodePlusCode(c.plusCode);
                    if (g) {
                        c.lat = g.lat;
                        c.lng = g.lng;
                    }
                }
            }
            
            setTimeout(() => map.invalidateSize(), 200);
        } catch (e) {
            console.error('bootstrap', e);
        }
    });

    window.findNearest = findNearest;
    window.clearSearch = clearSearch;
    window.AppMap = {
        invalidate() { try { map?.invalidateSize() } catch (_) {} }
    };
})();
