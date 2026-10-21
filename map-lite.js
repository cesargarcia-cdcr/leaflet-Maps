/* ==========================================================
   MAP-LITE.JS - Optimized Map, OPFS Check & Sheet Controller
   ========================================================== */

window.LSEngine = window.LSEngine || {};
window.LSEngine.state = window.LSEngine.state || {};

// Control global para cerrar el panel lateral (sheet)
window.closeSheet = function() {
    const sheet = document.getElementById('place-sheet');
    if (sheet) {
        sheet.classList.remove('open');
        sheet.setAttribute('aria-hidden', 'true');
    }
};

window.openSheet = function() {
    const sheet = document.getElementById('place-sheet');
    if (sheet) {
        sheet.classList.add('open');
        sheet.setAttribute('aria-hidden', 'false');
    }
};

// Función auxiliar para extraer y agrupar extensiones por sección (lógica adaptada de map.js)
function getExtensionsForClinic(clinic) {
    const code = String(clinic.code || clinic.Code || clinic.ID || '').trim().toUpperCase();
    const name = String(clinic.name || clinic.Name || clinic.Location || '').trim().toLowerCase();

    let extensions = window.LSEngine.state.globalExtensions || [];
    if (extensions.length === 0) {
        try {
            const cachedExt = localStorage.getItem("csv_extensions");
            if (cachedExt) extensions = JSON.parse(cachedExt);
        } catch (e) {}
    }

    const sectionsMap = {};
    extensions.forEach(item => {
        const itemCode = String(item.Code || item.code || '').trim().toUpperCase();
        const itemClinic = String(item.Clinic || item.clinic || item.Location || item.location || '').trim();
        
        const matchesCode = code && itemCode === code;
        const matchesName = name && itemClinic.toLowerCase().includes(name);

        if (matchesCode || matchesName) {
            const section = item.section || item.Section || "General";
            sectionsMap[section] = item;
        }
    });

    return sectionsMap;
}

// Renderizado de detalles de la clínica con diseño ordenado y estilos oscuros
function renderClinicDetails(clinic) {
    const body = document.getElementById('clinic-info-body');
    if (!body) return;

    console.log("📍 [Map-Lite Clicked Clinic]:", clinic);

    const name = clinic.name || clinic.Name || clinic.Location || clinic['Clinic Name'] || 'Clínica sin nombre';
    const address = clinic.address || clinic.Address || clinic.DIRECCION || [clinic.Address, clinic.City, clinic.ZipCode].filter(Boolean).join(', ') || 'Dirección no disponible';
    
    // Utilidad idéntica a map.js para formatear barras diagonales en extensiones múltiples
    const nb = s => String(s || '').replace(/\s*\/\s*/g, '&nbsp;/&nbsp;').replace(/\s{2,}/g, ' ').trim();
    
    const sectionsMap = getExtensionsForClinic(clinic);
    const sections = Object.keys(sectionsMap);

    let html = `
      <div class="map-lite-details">
       <div class="map-lite-clinic-header">
        <div class="map-lite-clinic-name">🏥 ${name}</div>
        <div class="map-lite-clinic-address">
          <span>📌</span> <span>${address}</span>
        </div>
       </div>`;

    if (sections.length > 0) {
        // Orden preferido de secciones idéntico al de tu aplicación principal
        const order = ['Medical', 'Optical', 'Dental', 'MH'];
        const ordered = [...order.filter(s => sections.includes(s)), ...sections.filter(s => !order.includes(s)).sort()];

        html += `
        <div class="map-lite-extensions">
            <div class="map-lite-extensions-title">📞 EXTENSIONS & LINES</div>
            <div class="map-lite-extension-list">`;

        ordered.forEach((sec) => {
            const v = sectionsMap[sec] || {};
            const rows = [];
            if (v.front) rows.push({ label: 'FRONT', value: nb(v.front) });
            if (v.back) rows.push({ label: 'BACK', value: nb(v.back) });
            if (!v.front && !v.back && v.ext) rows.push({ label: 'EXT', value: nb(v.ext) });

            html += `
                <div class="map-lite-extension-group">
                  <div class="map-lite-extension-heading">
                    <span class="map-lite-section-name">🔹 ${sec}</span>
                  </div>
                  ${v.phone || v.fax ? `
                    <div class="clinic-extension-contact map-lite-contact">
                      ${v.phone ? `<span class="clinic-extension-contact-item"><strong>Phone:</strong> ${v.phone}</span>` : ''}
                      ${v.fax ? `<span class="clinic-extension-contact-item"><strong>Fax:</strong> ${v.fax}</span>` : ''}
                    </div>
                  ` : ''}
                  ${rows.map(r => `
                    <div class="map-lite-extension-row">
                      <span class="map-lite-extension-label">${r.label}</span>
                      <span class="map-lite-extension-value">${r.value}</span>
                    </div>
                  `).join('')}
                </div>`;
        });

        html += `</div></div>`;
    } else {
        const phone = clinic.phone || clinic.Phone || clinic.TELEFONO || 'N/A';
        const fax = clinic.fax || clinic.Fax || clinic.FAX;
        html += `
            <div class="map-lite-primary-phone">
                <p>📞 Teléfono Principal: <span>${phone}</span></p>
                ${fax ? `<p class="map-lite-primary-fax">Fax: <span>${fax}</span></p>` : ''}
            </div>`;
    }

    html += '</div>';
    body.innerHTML = html;
    window.openSheet();
}

// Inicialización optimizada del mapa interactivo
window.LSEngine.initializeMap = function() {
    console.log("📍 [Map-Lite]: Inicializando instancia del mapa interactivo...");

    if (typeof L === 'undefined') {
        console.error("❌ [Map-Lite]: La librería Leaflet (L) no está cargada.");
        return;
    }

    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
        console.error("❌ [Map-Lite]: No se encontró el contenedor DOM con id 'map'.");
        return;
    }

    if (window.LSEngine.state.mapInstance) {
        console.log("🔄 [Map-Lite]: Actualizando dimensiones del mapa existente...");
        window.LSEngine.state.mapInstance.invalidateSize();
        return;
    }

    try {
        const defaultLat = 34.2381; 
        const defaultLng = -119.1771;
        
        const map = L.map(mapContainer, {
            zoomControl: true,
            attributionControl: true
        }).setView([defaultLat, defaultLng], 10);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            updateWhenZooming: false,
            keepBuffer: 2,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>'
        }).addTo(map);

        window.LSEngine.state.mapInstance = map;

        let clinics = window.LSEngine.state.globalClinics;
        if (!clinics || clinics.length === 0) {
            try {
                const cachedClinics = localStorage.getItem("csv_clinics") || localStorage.getItem("cache_payload");
                if (cachedClinics) {
                    const parsed = JSON.parse(cachedClinics);
                    clinics = Array.isArray(parsed) ? parsed : (parsed.clinics || []);
                }
            } catch (e) {
                console.warn("⚠️ [Map-Lite]: Error leyendo clínicas de localStorage:", e);
            }
        }

        clinics = clinics || [];
        console.log(`📊 [Map-Lite]: Renderizando ${clinics.length} marcadores...`);

        const markersGroup = L.featureGroup().addTo(map);

        clinics.forEach((clinic, index) => {
            const lat = parseFloat(clinic.Latitude || clinic.lat || clinic.LAT);
            const lng = parseFloat(clinic.Longitude || clinic.lng || clinic.LNG);

            if (!isNaN(lat) && !isNaN(lng)) {
                const marker = L.marker([lat, lng]);
                
                marker.on('click', () => {
                    renderClinicDetails(clinic);
                    map.setView([lat, lng], 14, { animate: true });
                });

                markersGroup.addLayer(marker);
            } else {
                console.warn(`⚠️ [Map-Lite]: Coordenadas inválidas en índice ${index}:`, clinic);
            }
        });

        if (clinics.length > 0) {
            const groupBounds = markersGroup.getBounds();
            if (groupBounds.isValid()) {
                map.fitBounds(groupBounds, { padding: [30, 30], maxZoom: 14 });
            }
        }

        setTimeout(() => map.invalidateSize(), 250);
        console.log("✅ [Map-Lite]: Mapa inicializado con éxito.");
        return true;

    } catch (err) {
        console.error("❌ [Map-Lite]: Error al configurar el mapa:", err);
        return false;
    }
};