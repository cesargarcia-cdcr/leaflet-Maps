/* === Map UI/UX Optimized & Merged (v7.3) === */
'use strict';
(function () {
    let CLINICS = [],
    EXT = {},
    EXT_BY_CODE = {};
    let map,
    searchMarker = null,
    searchLine = null,
    markersLayer = null,
    baseLayers = {},
    selectedClinicCode = '',
    carouselWheelDelta = 0,
    clinicBounds = null;
    const clinicMarkers = {}; // Store each marker by clinic code.

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
        
        let rawLookup = localStorage.getItem("csv_clinicLookup") || (typeof window.getCachedData === 'function' ? window.getCachedData("clinicLookup") : null);
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

        let rawClinics = localStorage.getItem("csv_clinics") || (typeof window.getCachedData === 'function' ? window.getCachedData("clinics") : null);
        
        if (typeof rawClinics === 'string' && (rawClinics.trim().startsWith('[') || rawClinics.trim().startsWith('{'))) {
            try {
                rawClinics = JSON.parse(rawClinics);
            } catch (e) {}
        }

        if (!rawClinics) {
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

        const provTxt = localStorage.getItem("csv_providersSchedCurr") || localStorage.getItem("csv_providersSched") || (typeof window.getCachedData === 'function' ? window.getCachedData("providersSched") : null);
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

        let extTxt = localStorage.getItem("csv_extensions") || (typeof window.getCachedData === 'function' ? window.getCachedData("extensions") : null);
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
        Object.keys(clinicMarkers).forEach(k => delete clinicMarkers[k]); // Clear the previous marker dictionary.
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
            clinicMarkers[c.code] = m; // Store the marker reference.

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
            clinicBounds = bounds;
            map.fitBounds(bounds, { padding: [40, 40] });
            if (map.getZoom() > 11) { map.setZoom(11); }
        } else {
            clinicBounds = null;
        }
    }

    /* ---------- Smart centering (supports an optional distance) ---------- */
    function selectClinic(c, distance) {
        if (searchMarker) { map.removeLayer(searchMarker); searchMarker = null; }
        if (searchLine) { map.removeLayer(searchLine); searchLine = null; }
        const clinicSelect = document.getElementById('clinicSelect');
        if (clinicSelect && c.code) clinicSelect.value = c.code;
        selectedClinicCode = String(c.code || '');
        renderSelectedClinic(c, distance);
        if (Number.isFinite(c.lat) && Number.isFinite(c.lng)) {
            map.setView([c.lat, c.lng], Math.min(12, Math.max(map.getZoom(), 10)), {
                animate: true,
                duration: 0.5
            });
            centerClinicInVisibleMap();
        }
    }

    function centerClinicInVisibleMap() {
        if (!map) return;

        let centered = false;
        const centerAfterMove = () => {
            if (centered || !map) return;
            centered = true;
            map.off('moveend', centerAfterMove);

            const mapRect = map.getContainer().getBoundingClientRect();
            const size = map.getSize();
            let left = 0;
            let right = size.x;
            let top = 0;
            let bottom = size.y;

            const controls = document.querySelector('#map-section .map-controls');
            if (controls) {
                const rect = controls.getBoundingClientRect();
                if (rect.bottom > mapRect.top && rect.top < mapRect.bottom) {
                    top = Math.max(top, Math.min(size.y, rect.bottom - mapRect.top));
                }
            }

            const sheet = document.getElementById('place-sheet');
            if (sheet?.classList.contains('open')) {
                const rect = sheet.getBoundingClientRect();
                const narrowLayout = window.matchMedia('(max-width: 768px)').matches;
                if (narrowLayout) {
                    if (rect.bottom > mapRect.top && rect.top < mapRect.bottom) {
                        top = Math.max(top, Math.min(size.y, rect.bottom - mapRect.top));
                    }
                } else if (rect.left > mapRect.left && rect.left < mapRect.right) {
                    right = Math.min(right, rect.left - mapRect.left);
                }
            }

            const carousel = document.getElementById('clinic-carousel');
            if (carousel) {
                const rect = carousel.getBoundingClientRect();
                if (rect.top > mapRect.top && rect.top < mapRect.bottom) {
                    bottom = Math.min(bottom, rect.top - mapRect.top);
                }
            }

            const targetX = Math.max(24, Math.min(size.x - 24, (left + right) / 2));
            const targetY = Math.max(24, Math.min(size.y - 24, (top + bottom) / 2));
            const offset = L.point(size.x / 2 - targetX, size.y / 2 - targetY);
            if (Math.abs(offset.x) > 1 || Math.abs(offset.y) > 1) {
                map.panBy(offset, { animate: true, duration: 0.35 });
            }
        };

        map.once('moveend', centerAfterMove);
        window.setTimeout(centerAfterMove, 650);
    }

    /* ---------- Sheet Render ---------- */
    function renderSelectedClinic(c, distance) {
        updateClinicCarouselSelection(c, distance);
        const panel = document.getElementById('clinic-info-body');
        if (!panel) return;
        const nb = s => String(s || '').replace(/\s*\/\s*/g, '&nbsp;/&nbsp;').replace(/\s{2,}/g, ' ').trim();
        let html = '';

        const nicknameDisplay = c.nicknames ? `<div class="clinic-detail-nickname">Alias: ${c.nicknames}</div>` : '';

        html += `
      <div class="clinic-detail-header">
        <div class="clinic-detail-heading-row">
          <div>
            <div class="clinic-detail-name">🏥 ${c.name}</div>
            ${nicknameDisplay}
          </div>
          ${distance !== undefined ? `<div class="clinic-detail-distance">📍 ${distance.toFixed(1)} mi</div>` : ''}
        </div>
        <div class="clinic-detail-address">
          <span>📌</span> <span>${c.address ?? ''}</span>
        </div>
      </div>`;

        const sections = EXT_BY_CODE[c.code] ? Object.keys(EXT_BY_CODE[c.code]) : [];

      if (!sections.length) {
          panel.innerHTML = html + `<div class='empty-state'>ℹ️ No extension information available</div>`;
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
              </div>
              ${v.phone || v.fax ? `
                <div class="clinic-extension-contact">
                  ${v.phone ? `<span class="clinic-extension-contact-item"><strong>Phone:</strong> ${v.phone}</span>` : ''}
                  ${v.fax ? `<span class="clinic-extension-contact-item"><strong>Fax:</strong> ${v.fax}</span>` : ''}
                </div>
              ` : ''}
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
                const searchInput = document.getElementById('searchInput');
                if (!clinicSelect.value && !searchInput?.value.trim()) {
                    clearSearch();
                    return;
                }
                findNearest();
            });
            clinicSelect.__wired = true;
        }
    }

    async function loadClinicImagesFromOPFS() {
        const imageUrls = new Map();
        const normalizeImageName = name => name.replace(/[^a-z0-9]/gi, '').toUpperCase();

        try {
            const rootDir = await navigator.storage.getDirectory();
            const cdcrDir = await rootDir.getDirectoryHandle('CDCR', { create: false });
            const entries = [];
            for await (const [fileName, fileHandle] of cdcrDir.entries()) {
                if (fileHandle.kind === 'file' && /\.(jpe?g|png)$/i.test(fileName)) {
                    entries.push([fileName, fileHandle]);
                }
            }

            entries.sort(([nameA], [nameB]) => {
                const extensionRank = name => /\.jpe?g$/i.test(name) ? 0 : 1;
                return extensionRank(nameA) - extensionRank(nameB) || nameA.localeCompare(nameB);
            });

            for (const [fileName, fileHandle] of entries) {
                const baseName = fileName.replace(/\.(jpe?g|png)$/i, '');
                const key = normalizeImageName(baseName);
                if (!key || imageUrls.has(key)) continue;
                imageUrls.set(key, URL.createObjectURL(await fileHandle.getFile()));
            }
        } catch (error) {
            if (error.name !== 'NotFoundError') {
                console.warn('Could not load clinic carousel images from OPFS CDCR folder:', error);
            }
        }

        return imageUrls;
    }

    function populateClinicCarousel(clinicImages = new Map()) {
        const track = document.getElementById('clinic-carousel-track');
        if (!track) return;

        const normalizeImageName = name => String(name || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
        const orderedClinics = [...CLINICS].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        track.replaceChildren();

        orderedClinics.forEach(clinic => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'clinic-carousel-card';
            card.dataset.code = clinic.code;
            card.setAttribute('aria-pressed', 'false');

            const imageUrl = clinicImages.get(normalizeImageName(clinic.code)) ||
                clinicImages.get(normalizeImageName(clinic.name));
            if (imageUrl) {
                const image = document.createElement('img');
                image.className = 'clinic-carousel-card-image';
                image.src = imageUrl;
                image.alt = `${clinic.name || clinic.code} clinic`;
                image.loading = 'lazy';
                image.addEventListener('error', () => {
                    console.warn(`Could not display carousel image for clinic ${clinic.code}.`);
                    image.remove();
                }, { once: true });
                card.appendChild(image);
            }

            const code = document.createElement('span');
            code.className = 'clinic-carousel-card-code';
            code.textContent = clinic.code || 'CLINIC';

            const name = document.createElement('span');
            name.className = 'clinic-carousel-card-name';
            name.textContent = clinic.name || clinic.code;

            const distance = document.createElement('span');
            distance.className = 'clinic-carousel-card-distance';
            distance.hidden = true;

            card.append(code, name, distance);
            card.addEventListener('click', () => selectClinic(clinic));
            track.appendChild(card);
        });

        const count = document.getElementById('clinic-carousel-count');
        if (count) count.textContent = orderedClinics.length
            ? `${orderedClinics.length} ${orderedClinics.length === 1 ? 'location' : 'locations'}`
            : 'No clinics available';

        if (!track.__wired) {
            track.addEventListener('wheel', event => {
                if (!track.children.length) return;
                event.preventDefault();
                carouselWheelDelta += Math.abs(event.deltaY) >= Math.abs(event.deltaX)
                    ? event.deltaY
                    : event.deltaX;
                if (Math.abs(carouselWheelDelta) < 45) return;

                const direction = carouselWheelDelta > 0 ? 1 : -1;
                carouselWheelDelta = 0;
                stepClinicCarousel(direction);
            }, { passive: false });
            track.addEventListener('keydown', event => {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                event.preventDefault();
                stepClinicCarousel(event.key === 'ArrowRight' ? 1 : -1);
            });
            track.__wired = true;
        }
        updateClinicCarouselSelection();
    }

    function stepClinicCarousel(direction) {
        const track = document.getElementById('clinic-carousel-track');
        const codes = [...(track?.children ?? [])].map(card => card.dataset.code);
        if (!codes.length) return;
        const currentIndex = codes.indexOf(selectedClinicCode);
        const nextIndex = currentIndex < 0
            ? (direction > 0 ? 0 : codes.length - 1)
            : (currentIndex + direction + codes.length) % codes.length;
        const clinic = getClinicByCode(codes[nextIndex]);
        if (clinic) selectClinic(clinic);
    }

    function updateClinicCarouselSelection(clinic, distance) {
        const track = document.getElementById('clinic-carousel-track');
        if (!track) return;

        const code = clinic?.code ?? selectedClinicCode;
        const cards = track.querySelectorAll('.clinic-carousel-card');
        const cardList = [...cards];
        const selectedIndex = cardList.findIndex(card => card.dataset.code === String(code));
        const centerIndex = selectedIndex >= 0 ? selectedIndex : 0;

        cardList.forEach((card, index) => {
            let offset = index - centerIndex;
            if (cardList.length > 1) {
                const half = Math.floor(cardList.length / 2);
                if (offset > half) offset -= cardList.length;
                if (offset < -half) offset += cardList.length;
            }

            const distanceFromCenter = Math.abs(offset);
            const isSelected = selectedIndex >= 0 && index === selectedIndex;
            card.classList.toggle('is-selected', isSelected);
            card.classList.toggle('is-center', index === centerIndex);
            card.classList.toggle('is-prev', offset < 0);
            card.classList.toggle('is-next', offset > 0);
            card.classList.toggle('is-hidden-stack-card', distanceFromCenter > 5);
            card.style.setProperty('--card-offset-x', `${offset === 0 ? 0 : Math.sign(offset) * (104 + (distanceFromCenter - 1) * 25)}px`);
            card.style.setProperty('--card-offset-y', `${Math.min(distanceFromCenter * 3, 15)}px`);
            card.style.setProperty('--card-scale', `${Math.max(0.78, 1 - distanceFromCenter * 0.045)}`);
            card.style.setProperty('--card-depth', String(20 - distanceFromCenter));
            card.setAttribute('aria-pressed', String(isSelected));
            const distanceLabel = card.querySelector('.clinic-carousel-card-distance');
            if (distanceLabel) {
                distanceLabel.hidden = !isSelected || !Number.isFinite(distance);
                distanceLabel.textContent = isSelected && Number.isFinite(distance)
                    ? `${distance.toFixed(1)} mi away`
                    : '';
            }
        });
    }

    async function findNearest() {
        const clinicSelect = document.getElementById('clinicSelect');
        const selectedCode = clinicSelect?.value ?? '';
        const searchInputQuery = (document.getElementById('searchInput')?.value ?? '').trim();

        if (searchMarker) { map.removeLayer(searchMarker); searchMarker = null; }
        if (searchLine) { map.removeLayer(searchLine); searchLine = null; }

        // ==========================================
        // Case A: A clinic is selected in the dropdown.
        // ==========================================
        if (selectedCode) {
            const matchedClinic = getClinicByCode(selectedCode);
            if (!matchedClinic) return;
            selectClinic(matchedClinic);
            if (!Number.isFinite(matchedClinic.lat) || !Number.isFinite(matchedClinic.lng)) {
                return;
            }

            let drivingDistMiles = undefined;
            let routeGeometry = null;
            let resolvedGeo = null;

            if (searchInputQuery) {
                resolvedGeo = await resolveLocation(searchInputQuery);
                if (resolvedGeo) {
                    searchMarker = L.circleMarker([resolvedGeo.lat, resolvedGeo.lng], {
                        radius: 7,
                        color: '#dc2626',
                        fillColor: '#dc2626',
                        fillOpacity: .8,
                        weight: 2
                    }).addTo(map).bindPopup('📍 Search Location');

                    try {
                        const url = `https://router.project-osrm.org/route/v1/driving/${resolvedGeo.lng},${resolvedGeo.lat};${matchedClinic.lng},${matchedClinic.lat}?overview=full&geometries=geojson`;
                        const response = await fetch(url);
                        if (response.ok) {
                            const data = await response.json();
                            if (data.routes && data.routes.length) {
                                drivingDistMiles = (data.routes[0].distance / 1000) * 0.621371;
                                routeGeometry = data.routes[0].geometry;
                            }
                        }
                    } catch (err) {
                        console.error("Error calculating OSRM route:", err);
                    }
                }
            }

            if (drivingDistMiles !== undefined) {
                renderSelectedClinic(matchedClinic, drivingDistMiles);
            }

            if (resolvedGeo && routeGeometry) {
                const coordinates = routeGeometry.coordinates.map(coord => [coord[1], coord[0]]);
                searchLine = L.polyline(coordinates, {
                    color: '#2563eb',
                    weight: 4,
                    opacity: 0.85,
                    lineJoin: 'round'
                }).addTo(map);

                const routeBounds = searchLine.getBounds();
                routeBounds.extend([resolvedGeo.lat, resolvedGeo.lng]);
                map.fitBounds(routeBounds, { padding: [60, 60], maxZoom: 14 });
            } else if (resolvedGeo) {
                searchLine = L.polyline([[resolvedGeo.lat, resolvedGeo.lng], [matchedClinic.lat, matchedClinic.lng]], {
                    color: '#dc2626',
                    weight: 2,
                    opacity: .6,
                    dashArray: '5,5'
                }).addTo(map);

                const routeBounds = searchLine.getBounds();
                routeBounds.extend([resolvedGeo.lat, resolvedGeo.lng]);
                map.fitBounds(routeBounds, { padding: [60, 60], maxZoom: 14 });
            }
            return;
        }

        // ==========================================
        // Case B: No clinic is selected; find the nearest clinic.
        // ==========================================
        if (!searchInputQuery) {
            alert('Please enter an address, ZIP code or select a clinic from the dropdown.');
            return;
        }

        const resolvedGeo = await resolveLocation(searchInputQuery);
        if (!resolvedGeo) {
            alert('Could not resolve the specified location.');
            return;
        }

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
            selectClinic(bestMatch, minDrivingDistance);

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
        selectedClinicCode = '';
        updateClinicCarouselSelection();
        closeSheet();
        if (searchMarker) { map.removeLayer(searchMarker); searchMarker = null; }
        if (searchLine) { map.removeLayer(searchLine); searchLine = null; }
        recenter();
    }

    function recenter() {
        if (!map) return;
        map.invalidateSize();
        if (clinicBounds?.isValid()) {
            map.fitBounds(clinicBounds, { padding: [40, 40], maxZoom: 11 });
        } else {
            map.setView([34.25, -119.10], 10);
        }
    }

    function buildBaseLayers() {
        const topoAttribution = 'Sources: Esri, HERE, Garmin, Intermap, increment P Corp., GEBCO, USGS, FAO, NPS, NRCAN, GeoBase, IGN, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), &copy; OpenStreetMap contributors, and the GIS User Community';
        const imageryAttribution = 'Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community';
        const tileOptions = { maxZoom: 19, updateWhenZooming: false, keepBuffer: 2 };
        const osmAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>';
        const baseStreet = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { ...tileOptions, attribution: osmAttribution });
        const baseTopo = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', { ...tileOptions, attribution: topoAttribution });
        const baseImagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { ...tileOptions, attribution: imageryAttribution });
        const layers = { '🗺️ Standard': baseStreet, '⛰️ Topographic': baseTopo, '🛰️ Satellite': baseImagery };
        const pref = store.get('map:base', '🗺️ Standard');
        const chosenName = layers[pref] ? pref : '🗺️ Standard';
        baseLayers = layers;
        const chosen = layers[chosenName];
        chosen.addTo(map);
        store.set('map:base', chosenName);
        window.dispatchEvent(new CustomEvent('appmapbaselayerchange', { detail: { layer: chosenName } }));
    }

    function setBaseLayer(name) {
        const nextLayer = baseLayers[name];
        if (!map || !nextLayer) return false;

        Object.values(baseLayers).forEach(layer => {
            if (map.hasLayer(layer)) map.removeLayer(layer);
        });
        nextLayer.addTo(map);
        store.set('map:base', name);
        window.dispatchEvent(new CustomEvent('appmapbaselayerchange', { detail: { layer: name } }));
        return true;
    }

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
            populateClinicCarousel(await loadClinicImagesFromOPFS());
            setTimeout(() => map.invalidateSize(), 200);
        } catch (e) {
            console.error('bootstrap', e);
        }
    });

    window.findNearest = findNearest;
    window.clearSearch = clearSearch;
    window.AppMap = {
        invalidate() { map?.invalidateSize(); },
        invalidateSize() { map?.invalidateSize(); },
        recenter,
        setBaseLayer,
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
        backdrop.className = 'pdir-popover-backdrop';

        const popover = document.createElement('div');
        popover.id = 'pdir-popover-card';
        popover.className = 'pdir-popover-card';

        let guidelinesHtml = '<div class="pdir-guidelines-empty">⚠️ No scheduling guidelines registered.</div>';
        if (docDos || docDonts) {
            guidelinesHtml = `
                <div class="pdir-guidelines">
                    ${docDos ? `<div class="pdir-guidelines-dos"><strong>Do's ✔:</strong> ${docDos}</div>` : ''}
                    ${docDonts ? `<div class="pdir-guidelines-donts"><strong>Don'ts ❌:</strong> ${docDonts}</div>` : ''}
                </div>
            `;
        }

        popover.innerHTML = `
            <div class="pdir-popover-header">
                <div class="pdir-popover-provider">
                    <h4 class="pdir-popover-name">${docName}${docDegree ? `, ${docDegree}` : ''}</h4>
                    <div class="pdir-popover-meta">
                        <span>🔑 Provider ID: <strong>${cleanTargetId}</strong> | 🌐 NPI: <strong>${docNpi}</strong></span>
                        ${docLang ? `<span>🗣️ ${docLang}</span>` : ''}
                    </div>
                </div>
                <span class="pdir-popover-specialty">${docSpec}</span>
            </div>
            ${guidelinesHtml}
            <div class="pdir-popover-actions">
                <button class="pdir-popover-close" onclick="removeProviderPopover()">Close</button>
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