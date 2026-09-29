window.NotesDataEngine = window.NotesDataEngine || {};

(function() {
    function initVisitSelectorEngine() {
        console.log("[NotesEngine] Initializing visit selector engine...");

        const epicVisits = getDataset('csv_Epic_Visit_type_equivilant');
        const searchInput = document.getElementById('visit-search-input');
        const container = document.getElementById('visit-sections-container');

        if (!container) {
            console.error("[NotesEngine] Critical Error: #visit-sections-container element not found in DOM.");
            return;
        }

        if (!epicVisits || epicVisits.length === 0) {
            console.warn("[NotesEngine] Warning: Dataset 'csv_Epic_Visit_type_equivilant' is empty or missing from localStorage.");
            container.innerHTML = '<div style="padding: 12px; color: #64748b; text-align: center;">No data available. Please synchronize data.</div>';
            return;
        }

        console.log(`[NotesEngine] Success: Loaded ${epicVisits.length} records from dataset. Building PDF replica layout...`);
        renderPDFReplica(epicVisits);

        if (searchInput) {
            searchInput.oninput = (e) => {
                const term = e.target.value.toLowerCase();
                console.log(`[NotesEngine] Search filter triggered with term: "${term}"`);
                filterPDFReplica(term);
            };
        } else {
            console.warn("[NotesEngine] Warning: #visit-search-input element not found.");
        }
    }

    function renderPDFReplica(items) {
        const container = document.getElementById('visit-sections-container');
        if (!container) return;
        container.innerHTML = '';

        const groups = {};
        items.forEach((item) => {
            const sec = item.Section || 'General Appointments';
            if (!groups[sec]) groups[sec] = [];
            groups[sec].push(item);
        });

        console.log(`[NotesEngine] Grouped records into ${Object.keys(groups).length} distinct sections.`);

        Object.keys(groups).forEach((sectionName, index) => {
            const sectionItems = groups[sectionName];
            
            const accDiv = document.createElement('div');
            accDiv.className = 'accordion-container' + (index === 0 ? ' open' : '');
            accDiv.style.cssText = 'border: 1px solid #cbd5e1; border-radius: 6px; background: #ffffff; margin-bottom: 8px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.04);';

            const header = document.createElement('div');
            header.className = 'accordion-header';
            header.style.cssText = 'background-color: #2563eb; color: white; padding: 8px 12px; font-weight: bold; font-style: italic; font-size: 0.95em; cursor: pointer; display: flex; align-items: center; justify-content: space-between;';
            header.innerHTML = `
                <span>${sectionName} (${sectionItems.length})</span>
                <span style="font-size: 11px;">▼</span>
            `;
            header.onclick = () => {
                accDiv.classList.toggle('open');
                console.log(`[NotesEngine] Toggled accordion section: "${sectionName}"`);
            };

            const body = document.createElement('div');
            body.className = 'accordion-body';
            body.style.cssText = 'display: none; padding: 0; background: #ffffff; overflow-x: auto;';

            let tableHTML = `
                <table style="width:100%; border-collapse: collapse; text-align: left;">
                    <thead>
                        <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
                            <th style="padding: 8px 10px; font-size: 0.8em; font-weight: bold; font-style: italic; color: #1e293b; width: 28%;">Epic Visit Types</th>
                            <th style="padding: 8px 10px; font-size: 0.8em; font-weight: bold; font-style: italic; color: #1e293b; width: 28%;">NextGen Visit Types</th>
                            <th style="padding: 8px 10px; font-size: 0.8em; font-weight: bold; font-style: italic; color: #1e293b; text-align: center; width: 15%;">Reg. Time</th>
                            <th style="padding: 8px 10px; font-size: 0.8em; font-weight: bold; font-style: italic; color: #1e293b; width: 29%;">Scheduling Guidelines</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            sectionItems.forEach((item, itemIndex) => {
                // Encode item safely into base64 or attribute to prevent HTML injection breaks
                const encodedItem = encodeURIComponent(JSON.stringify(item));
                tableHTML += `
                    <tr style="border-bottom: 1px solid #e2e8f0; cursor: pointer;" data-visit-item="${encodedItem}" onclick="handleRowClick(this)">
                        <td style="padding: 8px 10px; font-size: 0.85em; font-weight: bold; color: #1e293b; vertical-align: top;">${item.Epic_Visit_Type || '--'}</td>
                        <td style="padding: 8px 10px; font-size: 0.85em; color: #334155; vertical-align: top;">${item.NextGen_Visit_Type || '--'}</td>
                        <td style="padding: 8px 10px; font-size: 0.85em; color: #475569; text-align: center; vertical-align: top; font-weight: 500;">${item.Registration_Time || '15 min.'}</td>
                        <td style="padding: 8px 10px; font-size: 0.8em; color: #64748b; vertical-align: top;">${item.Guidance || '--'}</td>
                    </tr>
                `;
            });

            tableHTML += `</tbody></table>`;
            body.innerHTML = tableHTML;

            accDiv.appendChild(header);
            accDiv.appendChild(body);
            container.appendChild(accDiv);
        });

        if (!document.getElementById('pdf-replica-styles')) {
            const style = document.createElement('style');
            style.id = 'pdf-replica-styles';
            style.innerHTML = `
                .accordion-container.open .accordion-body { display: block !important; }
                .accordion-container.open .accordion-header span:last-child { transform: rotate(180deg); }
                .accordion-container tbody tr:hover { background-color: #f8fafc !important; }
            `;
            document.head.appendChild(style);
        }
        console.log("[NotesEngine] PDF replica layout successfully rendered.");
    }

    // Helper global function to handle row clicks safely
    window.handleRowClick = function(rowElement) {
        try {
            const encoded = rowElement.getAttribute('data-visit-item');
            const item = JSON.parse(decodeURIComponent(encoded));
            console.log("[NotesEngine] Row clicked, parsed visit item:", item);
            if (window.selectVisitItem) {
                window.selectVisitItem(item);
            }
        } catch (e) {
            console.error("[NotesEngine] Error parsing row dataset item:", e);
        }
    };

    function filterPDFReplica(term) {
        const accordions = document.querySelectorAll('.accordion-container');
        const lowerTerm = term.toLowerCase();
        let visibleCount = 0;

        accordions.forEach(acc => {
            const rows = acc.querySelectorAll('tbody tr');
            let matchesInSec = 0;

            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                if (text.includes(lowerTerm)) {
                    row.style.display = '';
                    matchesInSec++;
                } else {
                    row.style.display = 'none';
                }
            });

            if (matchesInSec > 0 && lowerTerm.length > 0) {
                acc.style.display = '';
                acc.classList.add('open');
                visibleCount += matchesInSec;
            } else if (lowerTerm.length === 0) {
                acc.style.display = '';
                acc.classList.remove('open');
            } else {
                acc.style.display = 'none';
            }
        });
        console.log(`[NotesEngine] Filter applied. Total matching rows visible: ${visibleCount}`);
    }

    function getDataset(key) {
        try {
            console.log(`[NotesEngine] Attempting to retrieve dataset from localStorage: "${key}"`);
            const data = localStorage.getItem(key);
            if (!data) {
                console.warn(`[NotesEngine] localStorage key "${key}" returned null or empty.`);
                return [];
            }
            const parsed = JSON.parse(data);
            console.log(`[NotesEngine] Successfully parsed dataset "${key}" with length: ${parsed.length}`);
            return parsed;
        } catch (e) {
            console.error(`[NotesEngine] Error parsing dataset "${key}" from localStorage:`, e);
            return [];
        }
    }

    window.addEventListener('DOMContentLoaded', initVisitSelectorEngine);
})();