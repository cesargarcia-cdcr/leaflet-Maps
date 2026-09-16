/* ==========================================================
   LOADING SCREEN & OPFS SYNC ENGINE (Strictly Orchestrated)
   ========================================================== */

window.LSEngine = window.LSEngine || {};

window.LSEngine.state = {
    globalClinics: [],
    globalExtensions: [],
    globalClinicLookup: [],
    mapInstance: null
};

window.LSEngine.setProgress = function(percent, text, state) {
    const bar = document.getElementById('bt-progress-bar');
    const percentage = document.getElementById('bt-percentage');
    const status = document.getElementById('sync-status');
    const stateText = document.getElementById('bt-state-text');

    if (bar) bar.style.width = percent + '%';
    if (percentage) percentage.textContent = percent + '%';
    if (status) status.textContent = text;
    if (stateText) stateText.textContent = state;
};

window.LSEngine.closeSheet = function() {
    const sheet = document.getElementById('place-sheet');
    if (sheet) sheet.classList.remove('open');
    setTimeout(() => {
        if (window.LSEngine.state.mapInstance) {
            window.LSEngine.state.mapInstance.invalidateSize();
        }
    }, 300);
};

window.LSEngine.renderClinicInfo = function(clinic) {
    const sheet = document.getElementById('place-sheet');
    if (!sheet) return;
    sheet.classList.add('open');
    
    setTimeout(() => {
        if (window.LSEngine.state.mapInstance) {
            window.LSEngine.state.mapInstance.invalidateSize();
        }
    }, 300);

    const clinicCode = String(clinic.code || "").trim().toUpperCase();
    const clinicName = String(clinic.Location || clinic.name || "").trim().toUpperCase();

    const matchingLookup = window.LSEngine.state.globalClinicLookup.find(item => {
        const itemCode = String(item.Code || item.code || "").trim().toUpperCase();
        const itemHealthCenter = String(item['Health Center'] || item['Clinic Name'] || "").trim().toUpperCase();
        return (clinicCode && itemCode === clinicCode) || 
               (clinicName && (itemHealthCenter === clinicName || clinicName.includes(itemHealthCenter) || itemHealthCenter.includes(clinicName)));
    });

    const validTokens = new Set([clinicCode, clinicName]);
    if (matchingLookup) {
        Object.values(matchingLookup).forEach(val => {
            if (val) validTokens.add(String(val).trim().toUpperCase());
        });
    }

    const clinicExtensions = window.LSEngine.state.globalExtensions.filter(ext => {
        const extCode = String(ext.code || ext.Code || ext.ClinicCode || ext.Abbreviation || "").trim().toUpperCase();
        const extLocation = String(ext.Location || ext.Clinic || "").trim().toUpperCase();
        const extName = String(ext.name || "").trim().toUpperCase();

        for (let token of validTokens) {
            if (!token) continue;
            if (extCode && (extCode === token || token.includes(extCode) || extCode.includes(token))) return true;
            if (extLocation && (extLocation === token || extLocation.includes(token) || token.includes(extLocation))) return true;
            if (extName && (extName === token || extName.includes(token))) return true;
        }
        return false;
    });

    let extensionsHtml = '<p style="color: #94a3b8; font-size: 12px; padding: 10px 0;">No extensions registered for this clinic.</p>';
    
    if (clinicExtensions.length > 0) {
        extensionsHtml = clinicExtensions.map(ext => {
            const keys = Object.keys(ext);
            const findVal = (keywords) => {
                for (let k of keys) {
                    const lowerK = k.toLowerCase();
                    if (keywords.some(kw => lowerK.includes(kw))) {
                        if (ext[k] !== undefined && ext[k] !== null && String(ext[k]).trim() !== "") {
                            return ext[k];
                        }
                    }
                }
                return null;
            };

            const phoneVal = findVal(['phone', 'tel', 'fax1']) || 'N/A';
            const extVal = findVal(['front', 'ext', 'back', 'number', 'num']) || 'N/A';
            const sectionVal = findVal(['section', 'department', 'service', 'line', 'name']) || 'General';

            return `
                <div style="background: #1e293b; padding: 10px 12px; border-radius: 6px; margin-bottom: 8px; border: 1px solid #334155;">
                    <div style="font-weight: bold; color: #38bdf8; font-size: 13px; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                        <span>🔹</span> ${sectionVal}
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 12px; color: #cbd5e1;">
                        <div><b>Phone:</b> <span style="color: #f8fafc;">${phoneVal}</span></div>
                        <div><b>Ext:</b> <span style="color: #34d399; font-weight: bold;">${extVal}</span></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    const infoBody = document.getElementById('clinic-info-body');
    if (infoBody) {
        infoBody.innerHTML = `
            <h3 style="margin: 0 0 6px 0; color: #f8fafc; font-size: 16px;">${clinic.Location || clinic.name}</h3>
            <p style="color: #94a3b8; font-size: 12px; margin: 0 0 14px 0;">📍 ${clinic.Address || ''}, ${clinic.City || ''} ${clinic.ZipCode || ''}</p>
            <div style="font-size: 11px; font-weight: bold; color: #38bdf8; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px; border-bottom: 1px solid #334155; padding-bottom: 4px;">
                Extensions & Lines
            </div>
            ${extensionsHtml}
        `;
    }
};

window.LSEngine.initializeMap = function() {
    window.LSEngine.setProgress(90, "Rendering interactive map...", "RENDERING");

    const map = L.map('map', {
        zoomControl: true,
        dragging: true,
        scrollWheelZoom: true
    }).setView([34.25, -119.10], 10);
    
    window.LSEngine.state.mapInstance = map;
    window.mapInstance = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    window.LSEngine.state.globalClinics.forEach(clinic => {
        if (clinic.lat && clinic.lng) {
            const marker = L.marker([parseFloat(clinic.lat), parseFloat(clinic.lng)]).addTo(map);
            marker.on('click', () => window.LSEngine.renderClinicInfo(clinic));
        }
    });

    const ClinicDropdownControl = L.Control.extend({
        options: { position: 'topright' },
        onAdd: function (map) {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            container.style.backgroundColor = '#1e293b';
            container.style.border = '1px solid #334155';
            container.style.borderRadius = '6px';
            container.style.padding = '4px';
            container.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';

            const select = document.createElement('select');
            select.style.background = '#0f172a';
            select.style.color = '#f8fafc';
            select.style.border = '1px solid #334155';
            select.style.borderRadius = '4px';
            select.style.padding = '6px 10px';
            select.style.fontSize = '12px';
            select.style.cursor = 'pointer';
            select.style.outline = 'none';

            const defaultOpt = document.createElement('option');
            defaultOpt.value = "";
            defaultOpt.textContent = "🔍 Select clinic...";
            select.appendChild(defaultOpt);

            window.LSEngine.state.globalClinics.forEach(clinic => {
                if (clinic.lat && clinic.lng) {
                    const opt = document.createElement('option');
                    opt.value = clinic.code || clinic.Location;
                    opt.textContent = clinic.Location;
                    select.appendChild(opt);
                }
            });

            select.onchange = (e) => {
                const val = e.target.value;
                if (!val) return;
                const targetClinic = window.LSEngine.state.globalClinics.find(c => (c.code === val || c.Location === val));
                if (targetClinic) {
                    map.setView([parseFloat(targetClinic.lat), parseFloat(targetClinic.lng)], 14);
                    window.LSEngine.renderClinicInfo(targetClinic);
                }
            };

            L.DomEvent.disableClickPropagation(container);
            container.appendChild(select);
            return container;
        }
    });

    map.addControl(new ClinicDropdownControl());
    setTimeout(() => map.invalidateSize(), 150);
};

// --- PASOS INDIVIDUALES PARA ORQUESTACIÓN DESDE EL HTML ---

window.LSEngine.getEndpointUrl = function() {
    const urlParams = new URLSearchParams(window.location.search);
    const encodedData = urlParams.get('data');
    if (!encodedData) throw new Error("Parameter 'data' was not found in the URL.");
    return atob(encodedData);
};

window.LSEngine.stepConnect = async function(endpointUrl) {
    window.LSEngine.setProgress(15, "Initializing connection...", "CONNECTING");
    const response = await fetch(endpointUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "" })
    });
    if (!response.ok) throw new Error(`HTTP Error during connect: ${response.status}`);
};

window.LSEngine.stepRead = async function(endpointUrl) {
    window.LSEngine.setProgress(40, "Reading server status...", "READ");
    const response = await fetch(endpointUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "READ" })
    });
    if (!response.ok) throw new Error(`HTTP Error during read: ${response.status}`);
};

window.LSEngine.stepDownload = async function(endpointUrl) {
    window.LSEngine.setProgress(70, "Downloading datasets...", "DOWNLOAD");
    const response = await fetch(endpointUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DOWNLOAD" })
    });
    if (!response.ok) throw new Error(`HTTP Error during download: ${response.status}`);
    
    const payloadData = await response.json();
    localStorage.setItem("cache_payload", JSON.stringify(payloadData));
    
    window.LSEngine.state.globalClinics = payloadData.clinics || [];
    window.LSEngine.state.globalExtensions = payloadData.extensions || [];
    window.LSEngine.state.globalClinicLookup = payloadData.clinicLookup || [];
    
    return payloadData;
};