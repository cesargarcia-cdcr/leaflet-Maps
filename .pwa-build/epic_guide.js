function parseCSV(text) {
    let rows = [];
    let row = [];
    let inQuotes = false;
    let field = '';
    
    for (let i = 0; i < text.length; i++) {
        let c = text[i];
        let nextC = text[i + 1];
        
        if (c === '"') {
            if (inQuotes && nextC === '"') {
                field += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (c === ',' && !inQuotes) {
            row.push(field);
            field = '';
        } else if ((c === '\r' || c === '\n') && !inQuotes) {
            if (c === '\r' && nextC === '\n') { i++; }
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
        } else {
            field += c;
        }
    }
    if (field !== '' || row.length > 0) {
        row.push(field);
        rows.push(row);
    }
    return rows.filter(r => r.length > 1 || (r.length === 1 && r[0].trim() !== ''));
}

function getDataRowsFromStorage(key) {
    let rawData = localStorage.getItem(key);
    if (!rawData || rawData.trim() === '') return [];

    try {
        let jsonParsed = JSON.parse(rawData);
        if (Array.isArray(jsonParsed) && jsonParsed.length > 0) {
            return jsonParsed;
        }
    } catch (e) {
        let parsedRows = parseCSV(rawData);
        if (parsedRows.length < 2) return [];
        let headers = parsedRows[0].map(h => h.trim());
        let rows = parsedRows.slice(1);
        
        return rows.map(r => {
            let obj = {};
            headers.forEach((h, idx) => {
                obj[h] = r[idx] !== undefined ? r[idx] : '';
            });
            return obj;
        });
    }
    return [];
}

function getField(item, ...names) {
    for (const name of names) {
        const value = item[name];
        if (value !== undefined && value !== null && String(value).trim() !== '') {
            return String(value).trim();
        }
    }
    return '';
}

function normalizeMatchValue(value) {
    return String(value || '').trim().toLowerCase();
}

function loadAndRenderData() {
    const container = document.getElementById('content-area');
    if (!container) return;
    
    const mainKeys = ['csv_Epic_Visit_type_equivilant', 'csvData', 'csv_data'];
    let mainRows = [];

    for (let key of mainKeys) {
        let data = getDataRowsFromStorage(key);
        if (data.length > 0) {
            mainRows = data;
            break;
        }
    }

    if (mainRows.length === 0) {
        container.className = "msg-box error-msg";
        container.innerHTML = '<strong>Notice:</strong> No primary dataset found in <code>localStorage</code>.';
        return;
    }

    const checkinKeys = ['csv_Check-In', 'csv_Check_In', 'csv_check_in'];
    let checkinRows = [];

    for (let key of checkinKeys) {
        let data = getDataRowsFromStorage(key);
        if (data.length > 0) {
            checkinRows = data;
            break;
        }
    }

    const checkinByVisit = new Map();
    const checkinByCode = new Map();
    const ambiguousCodes = new Set();
    checkinRows.forEach(item => {
        const code = getField(item, 'Visit_Code', 'Visit Code', 'VisitCode');
        const visitType = getField(item, 'Visit type', 'Visit_Type', 'Visit_Type_Name');
        if (code && visitType) {
            checkinByVisit.set(`${normalizeMatchValue(code)}|${normalizeMatchValue(visitType)}`, item);
        }
        if (code) {
            const normalizedCode = normalizeMatchValue(code);
            if (checkinByCode.has(normalizedCode)) {
                ambiguousCodes.add(normalizedCode);
            } else {
                checkinByCode.set(normalizedCode, item);
            }
        }
    });

    let sectionsMap = {};
    mainRows.forEach(r => {
        const sectionName = getField(r, 'Section', 'section') || 'General';

        if (!sectionsMap[sectionName]) {
            sectionsMap[sectionName] = [];
        }

        const visitCode = getField(r, 'Visit_Code', 'Visit Code', 'VisitCode');
        const epicType = getField(r, 'Epic_Visit_Type', 'Epic Visit Type', 'EpicType');
        const nextGenType = getField(r, 'NextGen_Visit_Type', 'NextGen Visit Type', 'NextGenType');
        const normalizedCode = normalizeMatchValue(visitCode);
        const checkin = checkinByVisit.get(
            `${normalizedCode}|${normalizeMatchValue(epicType)}`
        ) || checkinByVisit.get(
            `${normalizedCode}|${normalizeMatchValue(nextGenType)}`
        ) || (normalizedCode && !ambiguousCodes.has(normalizedCode)
            ? checkinByCode.get(normalizedCode)
            : null);

        sectionsMap[sectionName].push({
            visitCode,
            epicType,
            nextGen: nextGenType,
            topic: getField(r, 'Topic'),
            guidance: getField(r, 'Guidance', 'Guidelines', 'Descripcion'),
            appointmentDuration: getField(r, 'Appointment_Duration', 'Appointment Duration'),
            regTime: getField(checkin || {}, 'Standard Check-in Time') ||
                getField(r, 'Registration_Time', 'Registration Time', 'RegTime'),
            metaRegTime: getField(checkin || {}, 'META - Oxnard') ||
                getField(r, 'META_Registration_Time', 'META Registration Time', 'MetaRegTime')
        });
    });

    const sectionNames = Object.keys(sectionsMap);
    if (sectionNames.length === 0) {
        container.className = "msg-box error-msg";
        container.innerHTML = 'Could not extract valid sections after processing dataset.';
        return;
    }

    container.className = "";
    container.innerHTML = '';

    Object.keys(sectionsMap).forEach(sectionName => {
        // Use only the CSS class defined in epic_guide.css (including the default 'collapsed' state).
        let sectionDiv = document.createElement('div');
        sectionDiv.className = 'section-container collapsed';

        let headerDiv = document.createElement('div');
        headerDiv.className = 'section-header';
        headerDiv.textContent = sectionName;
        
        // Use CSS classes to collapse or expand the section.
        headerDiv.onclick = () => {
            sectionDiv.classList.toggle('collapsed');
        };
        sectionDiv.appendChild(headerDiv);

        let table = document.createElement('table');
        table.className = 'epic-guide-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th class="text-center">Visit Code</th>
                    <th>Epic Visit Type</th>
                    <th>NextGen Visit Type</th>
                    <th>Topic</th>
                    <th>Guidance</th>
                    <th>Appointment Duration</th>
                    <th>Standard Check-in Time</th>
                    <th>META - Oxnard</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;

        let tbody = table.querySelector('tbody');
        sectionsMap[sectionName].forEach(item => {
            let tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="text-center"><strong>${escapeHtml(item.visitCode)}</strong></td>
                <td>${escapeHtml(item.epicType)}</td>
                <td>${escapeHtml(item.nextGen)}</td>
                <td>${escapeHtml(item.topic)}</td>
                <td>${escapeHtml(item.guidance)}</td>
                <td class="text-center">${escapeHtml(item.appointmentDuration)}</td>
                <td class="text-center">${escapeHtml(item.regTime)}</td>
                <td class="text-center">${escapeHtml(item.metaRegTime)}</td>
            `;
            tbody.appendChild(tr);
        });

        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'epic-guide-table-wrap';
        tableWrapper.appendChild(table);
        sectionDiv.appendChild(tableWrapper);
        container.appendChild(sectionDiv);
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;")
          .replace(/\n/g, "<br>");
}

window.onload = loadAndRenderData;