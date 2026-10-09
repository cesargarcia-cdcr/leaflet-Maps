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

function loadAndRenderData() {
    const container = document.getElementById('content-area');
    
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

    const checkinKeys = ['csv_Check_In', 'csv_Check-In', 'csv_check_in'];
    let checkinRows = [];

    for (let key of checkinKeys) {
        let data = getDataRowsFromStorage(key);
        if (data.length > 0) {
            checkinRows = data;
            break;
        }
    }

    let checkinMap = new Map();
    checkinRows.forEach(item => {
        let recId = String(item.Record_ID || item.record_id || '').trim();
        let section = String(item.Section || item.section || '').trim().toLowerCase();
        let epicType = String(item.Epic_Visit_Type || item.epic_visit_type || '').trim().toLowerCase();

        if (recId) checkinMap.set(`id:${recId}`, item);
        if (section && epicType) checkinMap.set(`sec:${section}|epic:${epicType}`, item);
    });

    let mergedRows = mainRows.map(mainItem => {
        let recId = String(mainItem.Record_ID || mainItem.record_id || '').trim();
        let section = String(mainItem.Section || mainItem.section || '').trim().toLowerCase();
        let epicType = String(mainItem.Epic_Visit_Type || mainItem.epic_visit_type || '').trim().toLowerCase();

        let match = null;
        if (recId && checkinMap.has(`id:${recId}`)) {
            match = checkinMap.get(`id:${recId}`);
        } else if (section && epicType && checkinMap.has(`sec:${section}|epic:${epicType}`)) {
            match = checkinMap.get(`sec:${section}|epic:${epicType}`);
        }

        if (match) {
            return {
                ...mainItem,
                Registration_Time: (match.Registration_Time !== undefined && match.Registration_Time !== '') ? match.Registration_Time : mainItem.Registration_Time,
                META_Registration_Time: (match.META_Registration_Time !== undefined && match.META_Registration_Time !== '') ? match.META_Registration_Time : mainItem.META_Registration_Time
            };
        }
        return mainItem;
    });

    let sectionsMap = {};
    mergedRows.forEach(r => {
        let sectionName = String(r.Section || r.section || 'General').trim();
        if (!sectionName) sectionName = 'General';

        if (!sectionsMap[sectionName]) {
            sectionsMap[sectionName] = [];
        }

        sectionsMap[sectionName].push({
            visitCode: r.Visit_Code || r['Visit Code'] || r.VisitCode || '',
            epicType: r.Epic_Visit_Type || r['Epic Visit Type'] || r.EpicType || '',
            nextGen: r.NextGen_Visit_Type || r['NextGen Visit Type'] || r.NextGenType || '',
            guidance: r.Guidance || r.Guidelines || r.Descripcion || '',
            regTime: r.Registration_Time || r['Registration Time'] || r.RegTime || '',
            metaRegTime: r.META_Registration_Time || r['META Registration Time'] || r.MetaRegTime || ''
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
        // Se utiliza puramente la clase de CSS definida en epic_guide.css (incluyendo 'collapsed' por defecto)
        let sectionDiv = document.createElement('div');
        sectionDiv.className = 'section-container collapsed';

        let headerDiv = document.createElement('div');
        headerDiv.className = 'section-header';
        headerDiv.textContent = sectionName;
        
        // Evento para colapsar / expandir mediante clases CSS
        headerDiv.onclick = () => {
            sectionDiv.classList.toggle('collapsed');
        };
        sectionDiv.appendChild(headerDiv);

        let table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th style="width: 8%;" class="text-center">Visit Code</th>
                    <th style="width: 22%;">Epic Visit Types</th>
                    <th style="width: 22%;">NextGen Visit Types</th>
                    <th style="width: 30%;">Scheduling Guidelines</th>
                    <th style="width: 9%;" class="text-center">Reg. Time</th>
                    <th style="width: 9%;" class="text-center">Meta Reg. Time</th>
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
                <td>${escapeHtml(item.guidance)}</td>
                <td class="text-center">${escapeHtml(item.regTime)}</td>
                <td class="text-center">${escapeHtml(item.metaRegTime)}</td>
            `;
            tbody.appendChild(tr);
        });

        sectionDiv.appendChild(table);
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