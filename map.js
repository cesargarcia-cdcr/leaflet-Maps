/* === Map UI/UX Standalone (v1 - Clean Map Only) === */
'use strict';
(function () {
    let CLINICS = [];
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

async function loadData() {
    try {
        let flowUrl = "";
        const urlParams = new URLSearchParams(window.location.search);
        
        // 1. Check for the Base64 'data' parameter first
        const encodedData = urlParams.get('data');
        if (encodedData) {
            try {
                // If the user pastes a raw URL directly for testing instead of Base64, handle it gracefully
                if (encodedData.startsWith('http://') || encodedData.startsWith('https://')) {
                    flowUrl = encodedData;
                } else {
                    flowUrl = atob(encodedData);
                }
            } catch (e) {
                console.error("Failed to decode base64 data parameter, treating as raw string:", e);
                flowUrl = encodedData;
            }
        }

        // 2. Fallback to standard flowUrl query parameter if needed
        if (!flowUrl) {
            flowUrl = urlParams.get('flowUrl');
        }

        // 3. Fallback check for iframe data- attribute or direct local testing injection
        if (!flowUrl) {
            const iframeElement = window.parentElement?.querySelector('iframe') || document.querySelector('[data-flow-url]');
            if (iframeElement) {
                flowUrl = iframeElement.getAttribute('data-flow-url');
            }
        }

        if (!flowUrl) {
            throw new Error("No se encontró la flowUrl en los parámetros de la URL ni en el contexto del iframe.");
        }

        const response = await fetch(flowUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({}) // Required by Power Automate direct triggers
        });

        if (!response.ok) {
            throw new Error(`Flow request failed with status: ${response.status}`);
        }

        const result = await response.json();
        const records = result.clinics || [];

        const out = [], seen = new Set();

        for (const item of records) {
            // Code and plusCode are stored strictly for marker placement and internal logic
            const code = item.code || "";
            const plusCode = item.plusCode || "";
            const name = item.name || "";

            const addr = [
                item.address,
                item.city,
                item.state,
                item.zip
            ].filter(Boolean).join(', ');

            const lat = parseFloat(item.latitude);
            const lng = parseFloat(item.longitude);

            const clinic = {
                clinicId: name?.toLowerCase().replace(/[^a-z0-9]+/gi, '-'),
                code: code,          // Internal tracking/marker reference
                plusCode: plusCode,  // Internal mapping reference
                name: name,
                address: addr,
                lat: isNaN(lat) ? null : lat,
                lng: isNaN(lng) ? null : lng,
                
                // Nested department schema mapping
                medical: {
                    front: item.medical?.front || "",
                    back: item.medical?.back || "",
                    phone: item.medical?.phone || "",
                    fax: item.medical?.fax || ""
                },
                optical: {
                    ext: item.optical?.ext || "",
                    phone: item.optical?.phone || ""
                },
                dental: {
                    ext: item.dental?.ext || "",
                    phone: item.dental?.phone || ""
                },
                mh: {
                    ext: item.mh?.ext || "",
                    phone: item.mh?.phone || ""
                }
            };

            if (name && !seen.has(name)) {
                out.push(clinic);
                seen.add(name);
            }
        }

        CLINICS = out;
        window.CLINICS = out; // Ensure global availability for console/UI inspection
        
        console.log(`Successfully loaded ${CLINICS.length} clinics!`);
        initMap();

    } catch (error) {
        console.error("Error fetching clinic data:", error);
    }
}

function initMap() {
    if (!map) {
        map = L.map('map').setView([34.22, -119.15], 11);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
        }).addTo(map);
        markersLayer = L.layerGroup().addTo(map);
    }

    markersLayer.clearLayers();

    CLINICS.forEach(clinic => {
        if (clinic.lat && clinic.lng) {
            const marker = L.marker([clinic.lat, clinic.lng]);
            marker.on('click', () => {
                if (typeof window.selectClinicPanel === 'function') {
                    window.selectClinicPanel(clinic);
                }
            });
            marker.addTo(markersLayer);
        }
    });
}

// Auto-load on startup
window.addEventListener('DOMContentLoaded', () => {
    loadData();
});
   
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

    /* ---------- OLC & Geocode ---------- */
    const CA_BOUNDS = [[32.529523, -124.482003], [42.009518, -114.131211]];
    const CA_VIEWBOX = '-124.482003,42.009518,-114.131211,32.529523';
    const VENTURA_VIEWBOX = '-120.8,34.5,-118.8,32.8';
    const CA_CENTER = { lat: 37.25, lng: -119.7 };
    const VENTURA_CENTER = { lat: 34.15, lng: -119.8 };
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
        let code = raw;
        if (raw.includes(',')) {
            const [p] = raw.split(',');
            code = String(p || '').trim().toUpperCase();
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

    /* Helper: Normalize address before geocoding */
    function normalizeAddress(q) {
        let normalized = String(q ?? '').trim();
        
        normalized = normalized.replace(/\b(St|St\.|Street)\b/gi, 'Street')
                               .replace(/\b(Rd|Rd\.|Road)\b/gi, 'Road')
                               .replace(/\b(Ave|Ave\.|Avenue)\b/gi, 'Avenue')
                               .replace(/\b(Blvd|Blvd\.|Boulevard)\b/gi, 'Boulevard')
                               .replace(/\b(Dr|Dr\.|Drive)\b/gi, 'Drive')
                               .replace(/\b(Ln|Ln\.|Lane)\b/gi, 'Lane')
                               .replace(/\b(Ct|Ct\.|Court)\b/gi, 'Court')
                               .replace(/\b(Pkwy|Parkway)\b/gi, 'Parkway')
                               .replace(/\b(Hwy|Highway)\b/gi, 'Highway')
                               .replace(/\b(N\.|North)\b/gi, 'North')
                               .replace(/\b(S\.|South)\b/gi, 'South')
                               .replace(/\b(E\.|East)\b/gi, 'East')
                               .replace(/\b(W\.|West)\b/gi, 'West');
        
        normalized = normalized.replace(/\s+/g, ' ').trim();
        return normalized;
    }

    /* Helper: Check if location is within Ventura County bounds */
    function isInVenturaCounty(lat, lng) {
        const minLat = 32.8, maxLat = 34.5, minLng = -120.8, maxLng = -118.8;
        return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
    }

    async function geocode(q) {
        try {
            await throttle();
            q = normalizeAddress(q);
            
            if (!/(\bCA\b|\bCalifornia\b|\bUSA\b|\d{5})/i.test(q)) {
                q += ', Ventura County, CA, USA';
            }
            
            let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&countrycodes=us&viewbox=${encodeURIComponent(VENTURA_VIEWBOX)}&bounded=1&limit=10`;
            let r = await fetch(url, { headers: { 'Accept': 'application/json' } });
            if (!r.ok) throw new Error('Primary request failed');
            let d = await r.json();
            
            if (!Array.isArray(d) || !d.length) {
                url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&countrycodes=us&viewbox=${encodeURIComponent(CA_VIEWBOX)}&bounded=1&limit=10`;
                r = await fetch(url, { headers: { 'Accept': 'application/json' } });
                if (!r.ok) throw new Error('Fallback 1 failed');
                d = await r.json();
            }
            
            if (!Array.isArray(d) || !d.length) {
                url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&countrycodes=us&limit=10`;
                r = await fetch(url, { headers: { 'Accept': 'application/json' } });
                if (!r.ok) throw new Error('Fallback 2 failed');
                d = await r.json();
            }
            
            if (!Array.isArray(d) || !d.length) return null;
            
            let best = d.find(x => /(^|,\s)California(,|\s|$)/i.test(x?.display_name || ''));
            if (!best) best = d.find(x => isInVenturaCounty(+x.lat, +x.lon));
            if (!best) {
                best = d.sort((a, b) => {
                    const distA = Math.hypot(Math.abs(+a.lat - VENTURA_CENTER.lat), Math.abs(+a.lon - VENTURA_CENTER.lng));
                    const distB = Math.hypot(Math.abs(+b.lat - VENTURA_CENTER.lat), Math.abs(+b.lon - VENTURA_CENTER.lng));
                    return distA - distB;
                })[0];
            }
            if (!best) best = d[0];
            
            return { lat: +best.lat, lng: +best.lon };
        } catch (e) {
            console.error('Geocode error:', e);
            return null;
        }
    }

    async function resolveLocation(q) {
        const p = await tryDecodePlusCode(q);
        if (p) return p;
        return await geocode(q);
    }

    /* ---------- Markers & Selection ---------- */
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
        if (!c) {
            if (typeof window.selectClinicPanel === 'function') {
                window.selectClinicPanel(null);
            }
            return;
        }

        if (typeof window.selectClinicPanel === 'function') {
            window.selectClinicPanel(c);
        }

        const selectionMessage = {
            type: 'CLINIC_SELECTED',
            clinic: c,
            timestamp: new Date().toISOString(),
            action: 'marker_click'
        };
        console.log('Sending CLINIC_SELECTED message to parent:', selectionMessage);
        window.parent.postMessage(selectionMessage, '*');

        map.setView([c.lat, c.lng], 13, {
            animate: true,
            duration: 0.5
        });
    }

    /* ---------- Search & Routing ---------- */
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

    async function findNearest() {
        const q = (document.getElementById('searchInput')?.value ?? '').trim();
        if (!q) return;

        const bySearch = getClinicBySearch(q);
        if (bySearch && bySearch.lat) { 
            selectClinic(bySearch); 
            return; 
        }
        
        const g = await resolveLocation(q);
        if (!g) { alert('Dirección / Plus Code no encontrado.'); return; }
        
        if (searchMarker) { map.removeLayer(searchMarker); searchMarker = null; }
        if (searchLine) { map.removeLayer(searchLine); searchLine = null; }

        searchMarker = L.circleMarker([g.lat, g.lng], {
            radius: 7, color: '#dc2626', fillColor: '#dc2626', fillOpacity: .8, weight: 2
        }).addTo(map).bindPopup('📍 Ubicación Buscada');

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
            selectClinic(bestMatch);
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
        selectClinic(null);
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
        if (!navigator.geolocation) { alert('Geolocalización no soportada'); return; }
        navigator.geolocation.getCurrentPosition(pos => {
            const { latitude, longitude } = pos.coords;
            const p = [latitude, longitude];
            L.circleMarker(p, { radius: 7, color: '#16a34a', fillColor: '#16a34a', fillOpacity: .85, weight: 2 }).addTo(map).bindPopup('📍 Estás aquí').openPopup();
            map.setView(p, 14);
        }, () => alert('Error de geolocalización'));
    }

    /* ---------- Bootstrap ---------- */
    window.addEventListener('DOMContentLoaded', async() => {
        try {
            map = L.map('map', { zoomControl: true, maxBounds: CA_BOUNDS, maxBoundsViscosity: .8 }).setView([34.25, -119.10], 10);
            buildBaseLayers();
            await loadData();
            
            for (const c of CLINICS) {
                if (typeof c.lat !== 'number' || typeof c.lng !== 'number') {
                    const g = await tryDecodePlusCode(c.plusCode);
                    if (g) { c.lat = g.lat; c.lng = g.lng; }
                }
            }
            addMarkers();
            
            map.on('click', (e) => {
                let clickedMarker = false;
                markersLayer.eachLayer((layer) => {
                    if (layer instanceof L.Marker) {
                        const markerLatLng = layer.getLatLng();
                        const clickLatLng = e.latlng;
                        const distance = map.latLngToContainerPoint(markerLatLng)
                            .distanceTo(map.latLngToContainerPoint(clickLatLng));
                        if (distance < 40) {
                            clickedMarker = true;
                        }
                    }
                });
                
                if (!clickedMarker) {
                    selectClinic(null);
                }
            });

            setTimeout(() => { map.invalidateSize(); }, 150);
            setTimeout(() => { map.invalidateSize(); }, 500);
            setTimeout(() => { map.invalidateSize(); }, 1000);
        } catch (e) {
            console.error('bootstrap', e);
        }
    });

    /* ---------- Responsive Size Listener ---------- */
    const mapContainer = document.getElementById('map');
    
    if (window.ResizeObserver && mapContainer) {
        const resizeObserver = new ResizeObserver(() => {
            if (typeof map !== 'undefined' && map) {
                requestAnimationFrame(() => {
                    map.invalidateSize();
                });
            }
        });
        resizeObserver.observe(mapContainer);
    }

    window.addEventListener('message', (event) => {
        if (event.data && (event.data.width || event.data.height || typeof event.data === 'string')) {
            if (typeof map !== 'undefined' && map) {
                setTimeout(() => {
                    map.invalidateSize();
                }, 100);
            }
        }
    });

    window.addEventListener('resize', () => {
        if (typeof map !== 'undefined' && map) {
            map.invalidateSize();
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
    
    async function CSV_loadTest(url) {
        const r = await fetch(url, { cache: 'no-cache' });
        if (!r.ok) return null;
        return await r.text();
    }
    async function CSV_loadText(url) {
        const r = await fetch(url, { cache: 'no-cache' });
        if (!r.ok) return null;
        return await r.text();
    }
})();
