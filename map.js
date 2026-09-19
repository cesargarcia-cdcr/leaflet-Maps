/* === Map UI/UX Optimized & Merged (v7.3) === */
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

    /* ---------- Data Load with Enhanced Support ---------- */
    async function loadData() {
        console.log("🔍 [MAP DEBUG] Initializing loadData()...");
        
        // 1. Load and index clinic lookup dataset for Nicknames
        let rawLookup = localStorage.getItem("csv_clinicLookup") || (typeof obtenerCsv === 'function' ? obtenerCsv("clinicLookup") : null);
        const nicknameMap = new Map();
        if (rawLookup) {
            let parsedLookup = rawLookup;
            if (typeof rawLookup === 'string' && (rawLookup.trim().startsWith('[') || rawLookup.trim().startsWith('{'))) {
                try { parsedLookup = JSON.parse(parsedLookup); } catch(e) {}
            }
            const lookupRows = Array.isArray(parsedLookup) ? parsedLookup : CSV_rowsToObjects(CSV_parse(String(parsedLookup)));
            lookupRows.forEach(row => {
                const code = String(row["Code"] || row["code"] || "").trim().toUpperCase();
                const nickname = String(row["Nickname"] || row["nickname"] || "").trim();
                if (code) nicknameMap.set(code, nickname);
            });
        }

        // 2. Load clinics dataset
        let rawClinics = localStorage.getItem("csv_clinics") || (typeof obtenerCsv === 'function' ? obtenerCsv("clinics") : null);
        
        if (typeof rawClinics === 'string' && (rawClinics.trim().startsWith('[') || rawClinics.trim().startsWith('{'))) {
            try {
                rawClinics = JSON.parse(rawClinics);
                console.log("🔄 [MAP DEBUG] 'csv_clinics' parsed as JSON successfully.");
            } catch (e) {
                console.warn("⚠️ [MAP DEBUG] Error parsing 'csv_clinics' as JSON, treating as plain text.", e);
            }
        }

        if (!rawClinics) {
            console.warn("⚠️ [MAP DEBUG] No content found for 'clinics'.");
            CLINICS = [];
        } else if (Array.isArray(rawClinics)) {
            CLINICS = mapClinicsCsvToObjects(rawClinics, nicknameMap);
        } else if (typeof rawClinics === 'object' && rawClinics !== null) {
            const values = Object.values(rawClinics);
            CLINICS = mapClinicsCsvToObjects(Array.isArray(values[0]) ? values : [rawClinics], nicknameMap);
        } else {
            const parsedRows = CSV_parse(rawClinics);
            const objectRows = CSV_rowsToObjects(parsedRows);
            CLINICS = mapClinicsCsvToObjects(objectRows, nicknameMap);
        }

        console.log(`🏥 [MAP DEBUG] Processed CLINICS total valid: (${CLINICS.length}):`, CLINICS);

        // 3. Load provider schedules
        const provTxt = localStorage.getItem("csv_providersSchedCurr") || localStorage.getItem("csv_providersSched") || (typeof obtenerCsv === 'function' ? obtenerCsv("providersSched") : null);
        if (provTxt) {
            let provRows = [];
            let parsedProv = provTxt;
            if (typeof provTxt === 'string' && (provTxt.trim().startsWith('[') || provTxt.trim().startsWith('{'))) {
                try { parsedProv = JSON.parse(parsedProv); } catch(e) {}
            }
            provRows = Array.isArray(parsedProv) ? parsedProv : CSV_rowsToObjects(CSV_parse(String(parsedProv)));
            window.APP_DATA = window.APP_DATA || {};
            window.APP_DATA.providersByCode = provRows.reduce((acc, row) => {
                const code = String(row["Code"] || "").trim().toUpperCase();
                if (!acc[code]) acc[code] = [];
                acc[code].push(row);
                return acc;
            }, {});
        }

        // 4. Load extensions
        let extTxt = localStorage.getItem("csv_extensions") || (typeof obtenerCsv === 'function' ? obtenerCsv("extensions") : null);
        if (extTxt) {
            let extRows = [];
            let parsedExt = extTxt;
            if (typeof parsedExt === 'string' && (parsedExt.trim().startsWith('[') || parsedExt.trim().startsWith('{'))) {
                try { parsedExt = JSON.parse(parsedExt); } catch(e) {}
            }
            extRows = Array.isArray(parsedExt) ? parsedExt : CSV_rowsToObjects(CSV_parse(String(parsedExt)));
            EXT = {};
            extRows.forEach(row => {
                const section = row.section || row.Section || "General";
                if (!EXT[section]) EXT[section] = [];
                EXT[section].push(row);
            });
        }
        buildExtensionsIndex();
    }

    const properCase = (str) => {
        if (!str) return '';
        return String(str).toLowerCase().replace(/(^|\s)\S/g, (l) => l.toUpperCase());
    };

    function mapClinicsCsvToObjects(items, nicknameMap) {
        if (!items || !Array.isArray(items)) return [];

        const out = [];
        const seen = new Set();

        items.forEach((it) => {
            if (!it) return;

            const cleanObj = {};
            for (const key in it) {
                if (Object.prototype.hasOwnProperty.call(it, key)) {
                    cleanObj[key.trim().toLowerCase()] = it[key];
                }
            }

            const rawCode = String(cleanObj["code"] || cleanObj["abbreviation"] || cleanObj["cliniccode"] || "").trim().toUpperCase();
            if (!rawCode) return;

            const rawName = String(cleanObj["location"] || cleanObj["clinic name"] || cleanObj["name"] || rawCode).trim();
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

            // Resolve nickname from lookup map first, then fallback to inline properties
            const nicknames = nicknameMap.get(rawCode) || String(
                cleanObj["nicknames"] || 
                cleanObj["nickname"] || 
                cleanObj["alias"] || ""
            ).trim();

            const clinicId = rawCode;
            const clinic = {
                clinicId,
                code: rawCode,
                name,
                plusCode,
                address: fullAddress,
                lat: !isNaN(lat) ? lat : null,
                lng: !isNaN(lng) ? lng : null,
                nicknames
            };

            if (!seen.has(clinicId)) {
                out.push(clinic);
                seen.add(clinicId);
            }
        });

        return out;
    }

    function buildExtensionsIndex() {
        EXT_BY_CODE = {};
        for (const section in EXT) {
            if (section === 'Meta' || !Array.isArray(EXT[section])) continue;
            for (const item of EXT[section]) {
                const code = String(item.Code || item.code || '').trim().toUpperCase();
                if (!code) continue;
                if (!EXT_BY_CODE[code]) EXT_BY_CODE[code] = {};
                EXT_BY_CODE[code][section] = item;
            }
        }
    }

    /* ---------- OLC & Geocode ---------- */
    const CA_BOUNDS = [[32.529523, -124.482003], [42.009518, -114.131211]];
    const CA_VIEWBOX = '-124.482003,42.009518,-114.131211,32.529523';
    const VENTURA_CENTER = { lat: 34.25, lng: -119.10 };
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
                        el.src = s; el.async = true;
                        el.onload = ok; el.onerror = () => ko();
                        document.head.appendChild(el);
                    });
                    if (window.OpenLocationCode) { res(); return; }
                } catch (e) {}
            }
            res();
        });
        return __OLC_READY;
    }

    async function tryDecodePlusCode(input, ref) {
        await ensureOLC().catch(() => {});
        if (!window.OpenLocationCode) return null;
        const raw = String(input || '').trim().toUpperCase();
        if (!raw) return null;

        try {
            let fullCode = raw;
            if (!OpenLocationCode.isFull(raw)) {
                let refPt = ref || (map?.getCenter() && { lat: map.getCenter().lat, lng: map.getCenter().lng }) || VENTURA_CENTER;
                fullCode = OpenLocationCode.recoverNearest(raw, refPt.lat, refPt.lng);
            }
            if (OpenLocationCode.isFull(fullCode)) {
                const a = OpenLocationCode.decode(fullCode);
                return { lat: a.latitudeCenter, lng: a.longitudeCenter };
            }
        } catch (e) {
            console.error("❌ [MAP DEBUG] Error decoding Plus Code:", raw, e);
        }
        return null;
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
            if (!/(\bCA\b|\bCalifornia\b|\bUSA\b|\d{5})/i.test(q)) q += ', Ventura County, CA, USA';
            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&countrycodes=us&viewbox=${encodeURIComponent(CA_VIEWBOX)}&bounded=1&limit=5`;
            const r = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'ClinicasMapApp/7.3' } });
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

            if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
                if (c.plusCode) {
                    const decodedCoord = await tryDecodePlusCode(c.plusCode);
                    if (decodedCoord) {
                        lat = decodedCoord.lat;
                        lng = decodedCoord.lng;
                    }
                }
            }

            if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
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
            if (map.getZoom() > 11) { map.setZoom(11); }
        }
    }

    /* ---------- Smart Centering ---------- */
    function selectClinic(c) {
        renderSelectedClinic(c);
        if (c.lat && c.lng) {
            map.fitBounds(L.latLngBounds([[c.lat, c.lng]]), {
                paddingTopLeft: [0, 0],
                paddingBottomRight: [380, 0],
                maxZoom: 12,
                animate: true,
                duration: 0.5
            });
        }
    }

    /* ---------- Sheet Render ---------- */
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
            if (matchedKey) { p._matchedDateKey = matchedKey; return true; }
            return false;
        }).map(p => ({
            ...p,
            todayShift: String(p[p._matchedDateKey] || '').trim()
        }));

        const todayDisplayStr = `${dayName} ${monthName} ${dayNum}`;
        let html = '';

        const nicknameDisplay = c.nicknames ? `<div style="font-size:0.75rem; color:#0284c7; font-weight:700; margin-top:2px;">Alias: ${c.nicknames}</div>` : '';

        html += `
      <div style="margin-bottom:20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 14px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
          <div>
            <div style="font-weight:800; font-size:1.3rem; color:#0f172a; line-height:1.2;">🏥 ${c.name}</div>
            ${nicknameDisplay}
          </div>
          ${distance !== undefined ? `<div style="font-size:.75rem; font-weight:700; color:#1d4ed8; background:#dbeafe; padding:4px 10px; border-radius:20px; white-space:nowrap;">📍 ${distance.toFixed(1)} mi</div>` : ''}
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
                <a href="#" onclick="event.preventDefault(); window.showProviderPopover?.('${p['Provider ID'] || ''}')" style="color: #4f46e5; text-decoration: none; font-weight: 700; cursor: pointer;">
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
        setTimeout(() => AppMap?.invalidate?.(), 100);
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

    /* ---------- Clinic Lookup & Selection Helpers (PK based on Code) ---------- */
    function getClinicByCode(code) {
        const normalizedCode = String(code ?? '').toUpperCase().trim();
        return CLINICS.find(c => String(c.code ?? '').toUpperCase().trim() === normalizedCode);
    }

    function populateClinicPickers() {
        const clinicSelect = document.getElementById('clinicSelect');
        if (!clinicSelect) return;

        const orderedClinics = [...CLINICS].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        clinicSelect.innerHTML = '<option value="">-- Select Clinic (Optional) --</option>';
        
        for (const clinic of orderedClinics) {
            const optionElement = document.createElement('option');
            optionElement.value = clinic.code; 
            
            let displayLabel = clinic.code ? `${clinic.code} — ${clinic.name}` : clinic.name;
            if (clinic.nicknames?.trim()) {
                displayLabel += ` (${clinic.nicknames})`;
            }
            
            optionElement.textContent = displayLabel;
            optionElement.dataset.code = clinic.code;
            clinicSelect.appendChild(optionElement);
        }

        if (!clinicSelect.__wired) {
            clinicSelect.addEventListener('change', () => {
                const clinicCode = clinicSelect.selectedOptions?.[0]?.dataset?.code;
                const matchedClinic = clinicCode ? getClinicByCode(clinicCode) : null;
                
                if (matchedClinic?.lat && matchedClinic?.lng) {
                    selectClinic(matchedClinic);
                }
            });
            clinicSelect.__wired = true;
        }
    }

    async function findNearest() {
        const clinicSelect = document.getElementById('clinicSelect');
        const selectedCode = clinicSelect?.selectedOptions?.[0]?.dataset?.code ?? '';
        
        if (selectedCode) {
            const matchedClinic = getClinicByCode(selectedCode);
            if (matchedClinic && matchedClinic.lat && matchedClinic.lng) {
                let drivingDistMiles = undefined;
                const searchInputQuery = (document.getElementById('searchInput')?.value ?? '').trim();
                
                if (searchInputQuery) {
                    const resolvedGeo = await resolveLocation(searchInputQuery);
                    if (resolvedGeo) {
                        try {
                            const url = `https://router.project-osrm.org/route/v1/driving/${resolvedGeo.lng},${resolvedGeo.lat};${matchedClinic.lng},${matchedClinic.lat}?overview=full&geometries=geojson`;
                            const response = await fetch(url);
                            if (response.ok) {
                                const data = await response.json();
                                if (data.routes && data.routes.length) {
                                    drivingDistMiles = (data.routes[0].distance / 1000) * 0.621371;
                                }
                            }
                        } catch (err) {
                            console.error("Error calculating OSRM route:", err);
                        }
                    }
                }

                selectClinic(matchedClinic, drivingDistMiles);
                return;
            }
        }

        const searchInputQuery = (document.getElementById('searchInput')?.value ?? '').trim();
        if (!searchInputQuery) {
            alert('Please enter an address, ZIP code or select a clinic from the dropdown.');
            return;
        }

        const resolvedGeo = await resolveLocation(searchInputQuery);
        if (!resolvedGeo) {
            alert('Could not resolve the specified location.');
            return;
        }

        if (searchMarker) { map.removeLayer(searchMarker); searchMarker = null; }
        if (searchLine) { map.removeLayer(searchLine); searchLine = null; }

        searchMarker = L.circleMarker([resolvedGeo.lat, resolvedGeo.lng], {
            radius: 7,
            color: '#dc2626',
            fillColor: '#dc2626',
            fillOpacity: .8,
            weight: 2
        }).addTo(map).bindPopup('📍 Search Location');

        let candidates = [];
        for (const c of CLINICS) {
            let targetLat = c.lat;
            let targetLng = c.lng;

            const plusDecoded = await tryDecodePlusCode(c.plusCode);
            if (plusDecoded) {
                targetLat = plusDecoded.lat;
                targetLng = plusDecoded.lng;
            }

            if (!targetLat || !targetLng) continue;

            const R = 6371, toRad = d => d * Math.PI / 180;
            const dLat = toRad(targetLat - resolvedGeo.lat), dLng = toRad(targetLng - resolvedGeo.lng);
            const s1 = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(resolvedGeo.lat)) * Math.cos(toRad(targetLat)) * Math.sin(dLng / 2) ** 2;
            const dGeom = 2 * R * Math.asin(Math.sqrt(s1));

            candidates.push({ clinic: c, lat: targetLat, lng: targetLng, dGeom: dGeom });
        }

        candidates.sort((a, b) => a.dGeom - b.dGeom);
        const finalists = candidates.slice(0, 3);
        if (!finalists.length) return;

        let bestMatch = null;
        let minDrivingDistance = Infinity;
        let bestRouteGeometry = null;

        for (const f of finalists) {
            try {
                const url = `https://router.project-osrm.org/route/v1/driving/${resolvedGeo.lng},${resolvedGeo.lat};${f.lng},${f.lat}?overview=full&geometries=geojson`;
                const response = await fetch(url);
                if (!response.ok) continue;

                const data = await response.json();
                if (!data.routes || !data.routes.length) continue;

                const route = data.routes[0];
                const drivingDistKm = route.distance / 1000;
                const drivingDistMiles = drivingDistKm * 0.621371;

                if (drivingDistMiles < minDrivingDistance) {
                    minDrivingDistance = drivingDistMiles;
                    bestMatch = { ...f.clinic, lat: f.lat, lng: f.lng };
                    bestRouteGeometry = route.geometry;
                }
            } catch (err) {
                if (!bestMatch) {
                    minDrivingDistance = f.dGeom * 0.621371;
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
                searchLine = L.polyline([[resolvedGeo.lat, resolvedGeo.lng], [bestMatch.lat, bestMatch.lng]], {
                    color: '#dc2626',
                    weight: 2,
                    opacity: .6,
                    dashArray: '5,5'
                }).addTo(map);
            }

            const routeBounds = searchLine.getBounds();
            routeBounds.extend([resolvedGeo.lat, resolvedGeo.lng]);
            map.fitBounds(routeBounds, { padding: [60, 60], maxZoom: 14 });
        }
    }

    function clearSearch() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = '';
        const clinicSelect = document.getElementById('clinicSelect');
        if (clinicSelect) clinicSelect.value = '';
        const panel = document.getElementById('clinic-info-body');
        if (panel) {
            panel.innerHTML = `<div class="empty-state">Select a clinic or search by address/ZIP.</div>`;
        }
        closeSheet();
        if (searchMarker) { map.removeLayer(searchMarker); searchMarker = null; }
        if (searchLine) { map.removeLayer(searchLine); searchLine = null; }
    }

    /* ---------- Basemaps & Switching ---------- */
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

    /* ---------- Extras: Fullscreen & Geolocate ---------- */
    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen?.();
            document.body.classList.add('fullscreen-map');
        } else {
            document.exitFullscreen?.();
            document.body.classList.remove('fullscreen-map');
        }
        setTimeout(() => AppMap?.invalidate?.(), 200);
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
            if (e.key === 'Escape') { closeSheet(); }
            if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'f') { toggleFullscreen(); }
            if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'g') { geolocate(); }
        });
    }

    /* ---------- Bootstrap ---------- */
    window.addEventListener('AppDataLoaded', async() => {
        try {
            if (map) {
                map.remove();
                map = null;
            }

            map = L.map('map', {
                zoomControl: true,
                maxBounds: CA_BOUNDS,
                maxBoundsViscosity: .8
            }).setView([34.25, -119.10], 10);
            
            map.on('click', () => { closeSheet(); });

            buildBaseLayers();
            await loadData();
            buildExtensionsIndex();

            for (const c of CLINICS) {
                if (typeof c.lat !== 'number' || typeof c.lng !== 'number') {
                    const g = await tryDecodePlusCode(c.plusCode);
                    if (g) { c.lat = g.lat; c.lng = g.lng; }
                }
            }
            await addMarkers();
            populateClinicPickers();
            wireShortcuts();
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

    /* ---------- Provider Popover ---------- */
    async function showProviderPopover(providerId) {
        removeProviderPopover();

        const rawId = String(providerId || '').trim();
        const cleanTargetId = rawId.match(/715\d{3}/)?.[0] || rawId;

        if (!cleanTargetId || cleanTargetId === 'N/A' || cleanTargetId === 'undefined' || cleanTargetId.length !== 6) {
            alert("⚠️ This provider does not have a valid 6-digit Provider ID assigned.");
            return;
        }

        let masterList = 
            window.APP_DATA?.csv_mainProviders || 
            window.APP_DATA?.Main_Providers_csv || 
            window.mainProvidersList || 
            [];

        if (masterList.length === 0 && window.APP_DATA) {
            const foundKey = Object.keys(window.APP_DATA).find(k => Array.isArray(window.APP_DATA[k]) && window.APP_DATA[k].length > 0);
            if (foundKey) { masterList = window.APP_DATA[foundKey]; }
        }

        const doc = masterList.find(m => {
            if (!m) return false;
            const mId = String(m['Provider ID'] || m['provider id'] || m['ID'] || '').trim();
            return mId === cleanTargetId;
        });

        if (!doc) {
            alert(`No registered guidelines found for Provider ID: ${cleanTargetId}`);
            return;
        }

        const docName = String(doc['Provider'] || 'Unknown').trim();
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
        popover.style = 'width:440px; max-width:90vw; background:#ffffff; padding:18px; border-radius:8px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.2); border:1px solid #e2e8f0; font-family: system-ui, -apple-system, sans-serif;';

        let guidelinesHtml = '<div style="margin-top:10px; font-size:0.8rem; color:#64748b; text-align:center; font-style:italic;">⚠️ No scheduling guidelines registered.</div>';
        if (docDos || docDonts) {
            guidelinesHtml = `
                <div style="margin-top:12px; padding:12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; font-size:0.85rem; line-height:1.5;">
                    ${docDos ? `<div style="color:#16a34a; margin-bottom:8px;"><strong>Do's ✔:</strong> ${docDos}</div>` : ''}
                    ${docDonts ? `<div style="color:#dc2626;"><strong>Don'ts ❌:</strong> ${docDonts}</div>` : ''}
                </div>
            `;
        }

        popover.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:start; gap:10px; border-bottom:1px solid #f1f5f9; padding-bottom:12px;">
                <div style="flex:1;">
                    <h4 style="margin:0; font-size:1.15rem; font-weight:800; color:#0f172a;">${docName}${docDegree ? `, ${docDegree}` : ''}</h4>
                    <div style="font-size:0.75rem; color:#64748b; margin-top:4px; display:flex; flex-direction:column; gap:2px;">
                        <span>🔑 Provider ID: <strong>${cleanTargetId}</strong> | 🌐 NPI: <strong>${docNpi}</strong></span>
                        ${docLang ? `<span>🗣️ ${docLang}</span>` : ''}
                    </div>
                </div>
                <span style="background:#e0e7ff; color:#4338ca; font-size:0.7rem; font-weight:700; padding:3px 8px; border-radius:4px; white-space:nowrap;">${docSpec}</span>
            </div>
            ${guidelinesHtml}
            <div style="margin-top:14px; text-align:right;">
                <button onclick="removeProviderPopover()" style="background:#f1f5f9; border:1px solid #cbd5e1; color:#475569; padding:6px 14px; border-radius:4px; font-size:0.8rem; font-weight:600; cursor:pointer;">Close</button>
            </div>
        `;

        backdrop.appendChild(popover);
        document.body.appendChild(backdrop);

        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) removeProviderPopover();
        });
    }

    function removeProviderPopover() {
        const existing = document.getElementById('pdir-popover-backdrop');
        if (existing) existing.remove();
    }

    window.showProviderPopover = showProviderPopover;
    window.removeProviderPopover = removeProviderPopover;

    document.addEventListener('click', (e) => {
        const sheet = document.getElementById('place-sheet');
        if (!sheet) return;

        const isOpen = sheet.classList.contains('open') || sheet.getAttribute('aria-hidden') === 'false';
        if (!isOpen) return;

        const clickedInsideSheet = sheet.contains(e.target);
        const clickedMarker = e.target.closest('.leaflet-marker-icon');
        const clickedTooltip = e.target.closest('.leaflet-tooltip');

        if (!clickedInsideSheet && !clickedMarker && !clickedTooltip) {
            if (typeof window.closePlaceSheet === 'function') {
                window.closePlaceSheet();
            } else {
                closeSheet();
            }
        }
    });
})();