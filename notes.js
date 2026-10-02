/* ======= Hybrid Insurance Dropdown Initialization with LocalStorage Cache & Status Sort ======= */
function initInsuranceDropdown() {
    const insuranceContainer = document.getElementById('insurance-status-select')?.parentElement;
    if (!insuranceContainer) return;

    insuranceContainer.innerHTML = `
        <label class="insurance-label">Insurance / Program Type</label>
        <div class="insurance-input-group">
            <select id="insurance-dropdown" onchange="onInsuranceSelectChange()" class="insurance-select">
                <option value="">-- Select Insurance / Program --</option>
            </select>
            <input id="insurance-custom-input" placeholder="Or type custom..." oninput="updateNote(); checkInsuranceConditions();" class="insurance-custom-input" />
        </div>
        <div class="insurance-footer">
            <span id="insurance-mode-toggle" onclick="toggleInsuranceInputMode()" class="insurance-mode-toggle">Switch to manual input</span>
        </div>
    `;

    const selectEl = document.getElementById('insurance-dropdown');
    if (!selectEl) return;

    try {
        const rawData = localStorage.getItem("csv_Insurance");
        if (rawData) {
            let insurances = JSON.parse(rawData);
            window._cachedInsurances = insurances;

            insurances.sort((a, b) => {
                const statusA = (a.Status || '').toLowerCase();
                const statusB = (b.Status || '').toLowerCase();
                if (statusA === 'accepted' && statusB !== 'accepted') return -1;
                if (statusA !== 'accepted' && statusB === 'accepted') return 1;
                return (a.Insurance_Name || '').localeCompare(b.Insurance_Name || '');
            });

            selectEl.innerHTML = '<option value="">-- Select Insurance / Program --</option>';

            insurances.forEach(item => {
                const name = item.Insurance_Name || 'Unknown';
                const status = item.Status || 'N/A';
                const planType = item.Plan_Type ? ` (${item.Plan_Type})` : '';
                
                const option = document.createElement('option');
                option.value = name;
                option.textContent = `${name}${planType} — [${status}]`;
                option.dataset.status = status;
                option.dataset.special = item.Special_Conditions || 'None';
                option.dataset.plan = item.Plan_Type || '';
                
                selectEl.appendChild(option);
            });
        }
    } catch (e) {
        console.error("Error parsing 'csv_Insurance' from localStorage:", e);
    }
}

/* ======= Permanent Insurance Conditions & Status Verification ======= */
function checkInsuranceConditions() {
    const selectEl = document.getElementById('insurance-dropdown');
    const customInput = document.getElementById('insurance-custom-input');
    const activeVal = (selectEl && selectEl.style.display !== 'none') ? selectEl.value : (customInput?.value || '');
    const conditionsDiv = document.getElementById('insurance-conditions');
    if (!conditionsDiv) return;

    if (!window._cachedInsurances) {
        try {
            const rawData = localStorage.getItem("csv_Insurance");
            if (rawData) window._cachedInsurances = JSON.parse(rawData);
        } catch (e) {}
    }

    if (window._cachedInsurances && activeVal) {
        const match = window._cachedInsurances.find(item => item.Insurance_Name && item.Insurance_Name.toLowerCase() === activeVal.toLowerCase());
        if (match) {
            const isAccepted = (match.Status || '').toLowerCase() === 'accepted';
            
            conditionsDiv.innerHTML = `
                <div class="status-box ${isAccepted ? 'status-accepted' : 'status-rejected'}">
                    <strong>Status: ${match.Status}</strong> | Plan: ${match.Plan_Type || 'Standard'} | Verif: ${match.Verification_Method || 'Standard'}
                    ${match.Special_Conditions && match.Special_Conditions !== "None" ? `<div class="special-condition-warn">⚠️️ ${match.Special_Conditions}</div>` : ''}
                </div>
            `;
        } else {
            conditionsDiv.innerHTML = `<div class="status-box status-custom">Custom or unlisted insurance/program entry.</div>`;
        }
    } else {
        conditionsDiv.innerHTML = `<div class="status-box status-placeholder">Select an insurance or program to view status verification details.</div>`;
    }
}

/* ======= Always-Visible Hospital Message Area ======= */
function checkHospitalConditions() {
    const selectEl = document.getElementById('ER');
    const customInput = document.getElementById('ER-custom-input');
    const conditionsDiv = document.getElementById('er-conditions');
    if (!conditionsDiv || !selectEl) return;

    const isCustomActive = selectEl.style.display === 'none';
    const selectedVal = isCustomActive ? (customInput?.value || '') : selectEl.value;

    if (selectedVal === "Other" || isCustomActive) {
        const selectedOption = selectEl.options[selectEl.selectedIndex];
        const messageData = selectedOption?.dataset?.message || 'Needs Medical Release Form';
        conditionsDiv.innerHTML = `
            <div class="hospital-box hospital-custom">
                ⚠️ <strong>Details:</strong> ${messageData} (Custom Facility Entry)
            </div>
        `;
        return;
    }

    const selectedOption = selectEl.options[selectEl.selectedIndex];
    const messageData = selectedOption?.dataset?.message;

    if (messageData && messageData.trim() !== '') {
        conditionsDiv.innerHTML = `
            <div class="hospital-box hospital-accepted">
                📌 <strong>Details:</strong> ${messageData}
            </div>
        `;
    } else if (selectedVal) {
        conditionsDiv.innerHTML = `
            <div class="hospital-box hospital-neutral">
                ℹ️ No extra details recorded for this facility.
            </div>
        `;
    } else {
        conditionsDiv.innerHTML = `
            <div class="hospital-box hospital-placeholder">
                Select a hospital or facility to view records verification details.
            </div>
        `;
    }
}