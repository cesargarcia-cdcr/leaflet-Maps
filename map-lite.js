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
      <div style="margin-bottom:14px; border-bottom: 1px solid #334155; padding-bottom: 10px;">
        <div style="font-weight:700; font-size:1.1rem; color:#38bdf8; line-height:1.3;">🏥 ${name}</div>
        <div style="margin-top:5px; font-size:0.75rem; color:#94a3b8; display:flex; align-items:center; gap:5px;">
          <span>📌</span> <span>${address}</span>
        </div>
      </div>`;

    if (sections.length > 0) {
        // Orden preferido de secciones idéntico al de tu aplicación principal
        const order = ['Medical', 'Optical', 'Dental', 'MH'];
        const ordered = [...order.filter(s => sections.includes(s)), ...sections.filter(s => !order.includes(s)).sort()];

        html += `
        <div style="background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 10px; margin-bottom: 10px;">
            <div style="font-weight: 600; font-size: 0.8rem; color: #38bdf8; margin-bottom: 8px; border-bottom: 1px solid #334155; padding-bottom: 4px; letter-spacing: 0.5px;">📞 EXTENSIONS & LINES</div>
            <div style="display: flex; flex-direction: column; gap: 8px; max-height: 280px; overflow-y: auto; padding-right: 2px;">`;

        ordered.forEach((sec) => {
            const v = sectionsMap[sec] || {};
            const rows = [];
            if (v.front) rows.push({ label: 'FRONT', value: nb(v.front) });
            if (v.back) rows.push({ label: 'BACK', value: nb(v.back) });
            if (!v.front && !v.back && v.ext) rows.push({ label: 'EXT', value: nb(v.ext) });

            html += `
                <div style="background: #1e293b; padding: 6px 8px; border-radius: 6px; border: 1px solid #334155; font-size: 0.75rem;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
                    <span style="font-weight: 600; color: #f8fafc;">🔹 ${sec}</span>
                    ${v.phone ? `<span style="color:#38bdf8; font-weight:600;">${v.phone}</span>` : ''}
                  </div>
                  ${rows.map(r => `
                    <div style="display: flex; justify-content: space-between; margin-top: 2px; border-top: 1px dashed #334155; padding-top: 2px;">
                      <span style="color: #94a3b8; font-weight: 500;">${r.label}</span>
                      <span style="color: #cbd5e1; text-align: right; max-width: 70%; word-break: break-word;">${r.value}</span>
                    </div>
                  `).join('')}
                </div>`;
        });

        html += `</div></div>`;
    } else {
        const phone = clinic.phone || clinic.Phone || clinic.TELEFONO || 'N/A';
        html += `
            <div style="background: #0f172a; padding: 10px; border-radius: 6px; border: 1px solid #334155;">
                <p style="font-size: 0.8rem; color: #94a3b8; margin: 0;">📞 Teléfono Principal: <span style="color: #f8fafc; font-weight: 600;">${phone}</span></p>
            </div>`;
    }

    body.innerHTML = html;
    window.openSheet();
}

// Verificación rápida en OPFS del archivo lite_payload.json antes de decidir si descargar
window.LSEngine.checkAndLoadOPFSLite = async function(filename = "lite_payload.json") {
    try {
        console.log(`🔍 [OPFS Check]: Verificando existencia de '${filename}' en almacenamiento local...`);
        const rootDir = await navigator.storage.getDirectory();
        const dataDir = await rootDir.getDirectoryHandle("App_Data", { create: true });
        
        const fileHandle = await dataDir.getFileHandle(filename);
        const file = await fileHandle.getFile();
        const content = await file.text();

        if (!content) {
            console.warn(`⚠️ [OPFS Check]: El archivo '${filename}' está vacío.`);
            return false;
        }

        const parsedData = JSON.parse(content);
        
        window.LSEngine.state.globalClinics = parsedData.clinics || [];
        window.LSEngine.state.globalExtensions = parsedData.extensions || [];
        window.LSEngine.state.globalClinicLookup = parsedData.clinicLookup || [];

        if (parsedData.clinics) localStorage.setItem("csv_clinics", JSON.stringify(parsedData.clinics));
        if (parsedData.extensions) localStorage.setItem("csv_extensions", JSON.stringify(parsedData.extensions));
        if (parsedData.clinicLookup) localStorage.setItem("csv_clinicLookup", JSON.stringify(parsedData.clinicLookup));
        
        localStorage.setItem("lite_payload_cache", content);
        console.log(`✅ [OPFS Check]: '${filename}' encontrado y mapeado con éxito.`);
        return true;

    } catch (err) {
        console.log(`ℹ️ [OPFS Check]: '${filename}' no encontrado o inaccesible. Se procederá con descarga remota.`);
        return false;
    }
};

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
            attributionControl: false
        }).setView([defaultLat, defaultLng], 10);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
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