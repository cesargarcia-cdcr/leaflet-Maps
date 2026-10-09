'use strict';

/* ======= Load and populate hospital options from localStorage ======= */
function loadHospitalDropdown() {
    const selectER = document.getElementById('ER');
    if (!selectER) return;

    try {
        const rawData = localStorage.getItem('csv_Hospitals');
        if (!rawData) {
            console.warn('No hospital data found in localStorage under "csv_Hospitals".');
            return;
        }

        const hospitals = JSON.parse(rawData);
        if (!Array.isArray(hospitals)) return;

        selectER.innerHTML = '<option value="">-- Select Hospital / Facility --</option>';

        hospitals.forEach(item => {
            const hospitalName = item["Hospital Name"];
            const longName = item["Long Name"];
            const recordsVal = item["Records"] || '';
            
            if (hospitalName) {
                const option = document.createElement('option');
                option.value = hospitalName;
                
                // Append "Long Name" in parentheses if available and non-empty
                option.textContent = (longName && longName.trim() !== '') 
                    ? `${hospitalName} (${longName.trim()})` 
                    : hospitalName;
                    
                option.setAttribute('data-records', recordsVal);
                selectER.appendChild(option);
            }
        });
    } catch (error) {
        console.error('Error parsing hospital data from localStorage:', error);
    }
}

/* ======= Toggle between dropdown list and manual input for UC/ER ======= */
function toggleHospitalInputMode() {
    const selectER = document.getElementById('ER');
    const selectCustomER = document.getElementById('ER-custom-input');
    const toggleBtn = document.getElementById('er-mode-toggle');

    if (!selectER || !selectCustomER) return;

    if (selectER.style.display !== 'none') {
        selectER.style.display = 'none';
        selectCustomER.style.display = 'block';
        selectCustomER.value = selectER.value; 
        if (toggleBtn) toggleBtn.textContent = "Switch back to dropdown list";
        selectCustomER.focus();
    } else {
        selectER.style.display = 'block';
        selectCustomER.style.display = 'none';
        if (toggleBtn) toggleBtn.textContent = "Switch to manual input";
        selectER.focus();
    }
    if (typeof updateNote === 'function') updateNote();
    checkHospitalConditions();
}

/* ======= Hospital / UC-ER Selection Event Handler ======= */
function onHospitalSelectChange() {
    const selectER = document.getElementById('ER');
    const selectCustomER = document.getElementById('ER-custom-input');
    if (selectER && selectCustomER) {
        selectCustomER.value = selectER.value;
    }
    if (typeof updateNote === 'function') updateNote();
    checkHospitalConditions();
}

/* ======= Check Hospital / UC-ER Conditions & Status ======= */
function checkHospitalConditions() {
    const selectER = document.getElementById('ER');
    const selectCustomER = document.getElementById('ER-custom-input');
    const conditionsDiv = document.getElementById('er-conditions');
    if (!conditionsDiv) return;

    let displayVal = '';
    let recordsVal = '';

    const isManualMode = (selectER && selectER.style.display === 'none');

    if (!isManualMode && selectER) {
        displayVal = selectER.value;
        const selectedOption = selectER.options[selectER.selectedIndex];
        if (selectedOption) {
            recordsVal = selectedOption.getAttribute('data-records') || '';
        }
    } else {
        const rawCustomVal = selectCustomER?.value || '';
        displayVal = rawCustomVal;

        try {
            const rawData = localStorage.getItem('csv_Hospitals');
            if (rawData) {
                const hospitals = JSON.parse(rawData);
                const found = hospitals.find(h => h["Hospital Name"].toLowerCase() === rawCustomVal.toLowerCase());
                if (found) {
                    recordsVal = found["Records"] || '';
                } else {
                    const otherItem = hospitals.find(h => h["Hospital Name"] === "Other");
                    if (otherItem) {
                        recordsVal = otherItem["Records"] || '';
                    }
                }
            }
        } catch (e) {
            // Ignore error on manual fallback
        }
    }

    if (displayVal) {
        let recordDisplay = recordsVal ? ` | Records: <strong>${recordsVal}</strong>` : '';
        conditionsDiv.innerHTML = `<div class="status-box-custom">Selected Facility / UC-ER: <strong>${displayVal}</strong>${recordDisplay}</div>`;
    } else {
        conditionsDiv.innerHTML = `<div class="status-box-placeholder">Select a hospital or facility, or use manual input.</div>`;
    }
}

/* ======= Initialize hospital dropdown on DOM load ======= */
document.addEventListener('DOMContentLoaded', () => {
    loadHospitalDropdown();
});

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
            <input id="insurance-custom-input" placeholder="Or type custom..." oninput="updateNote(); checkInsuranceConditions();" class="insurance-custom-input" style="display: none;" />
        </div>
        <div class="insurance-footer">
            <span id="insurance-mode-toggle" onclick="toggleInsuranceInputMode()" class="insurance-mode-toggle">Switch to manual input</span>
        </div>
    `;

    const selectIN = document.getElementById('insurance-dropdown');
    if (!selectIN) return;

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

            selectIN.innerHTML = '<option value="">-- Select Insurance / Program --</option>';

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
                
                selectIN.appendChild(option);
            });
            console.log("🏥 Insurances successfully loaded and sorted from localStorage:", insurances.length);
        } else {
            console.warn("⚠️ 'csv_Insurance' not found in localStorage.");
        }
    } catch (e) {
        console.error("Error parsing 'csv_Insurance' from localStorage:", e);
    }
}

/* ======= Toggle between Dropdown and Manual Text Input Mode ======= */
function toggleInsuranceInputMode() {
    const selectIN = document.getElementById('insurance-dropdown');
    const selectCustomIN = document.getElementById('insurance-custom-input');
    const toggleBtn = document.getElementById('insurance-mode-toggle');

    if (!selectIN || !selectCustomIN) return;

    if (selectIN.style.display !== 'none') {
        selectIN.style.display = 'none';
        selectCustomIN.style.display = 'block';
        selectCustomIN.value = selectIN.value; 
        toggleBtn.textContent = "Switch back to dropdown list";
        selectCustomIN.focus();
    } else {
        selectIN.style.display = 'block';
        selectCustomIN.style.display = 'none';
        toggleBtn.textContent = "Switch to manual input";
        selectIN.focus();
    }
    updateNote();
    checkInsuranceConditions();
}

/* ======= Dropdown Selection Handler ======= */
function onInsuranceSelectChange() {
    const selectIN = document.getElementById('insurance-dropdown');
    const selectCustomIN = document.getElementById('insurance-custom-input');
    if (selectIN && selectCustomIN) {
        selectCustomIN.value = selectIN.value;
    }
    updateNote();
    checkInsuranceConditions();
}

/* ======= Permanent Insurance Conditions & Status Verification ======= */
function checkInsuranceConditions() {
    const selectIN = document.getElementById('insurance-dropdown');
    const selectCustomIN = document.getElementById('insurance-custom-input');
    const insuranceVal = (selectIN && selectIN.style.display !== 'none') ? selectIN.value : (selectCustomIN?.value || '');
    const conditionsDiv = document.getElementById('insurance-conditions');
    if (!conditionsDiv) return;

    if (!window._cachedInsurances) {
        try {
            const rawData = localStorage.getItem("csv_Insurance");
            if (rawData) window._cachedInsurances = JSON.parse(rawData);
        } catch (e) {}
    }

    if (window._cachedInsurances && insuranceVal) {
        const match = window._cachedInsurances.find(item => item.Insurance_Name && item.Insurance_Name.toLowerCase() === insuranceVal.toLowerCase());
        if (match) {
            const isAccepted = (match.Status || '').toLowerCase() === 'accepted';
            const statusClass = isAccepted ? 'status-box-accepted' : 'status-box-rejected';
            const textClass = isAccepted ? 'status-text-accepted' : 'status-text-rejected';
            
            conditionsDiv.innerHTML = `
                <div class="${statusClass}">
                    <strong class="${textClass}">Status: ${match.Status}</strong> | Plan: ${match.Plan_Type || 'Standard'} | Verif: ${match.Verification_Method || 'Standard'}
                    ${match.Special_Conditions && match.Special_Conditions !== "None" ? `<div class="special-condition-warn">⚠️ ${match.Special_Conditions}</div>` : ''}
                </div>
            `;
        } else {
            conditionsDiv.innerHTML = `<div class="status-box-custom">Custom or unlisted insurance/program entry.</div>`;
        }
    } else {
        conditionsDiv.innerHTML = `<div class="status-box-placeholder">Select an insurance or program to view status verification details.</div>`;
    }
}

/* ======= Real-Time Note Generation & Concatenation ======= */
function updateNote() {
    const symptomsInput = document.getElementById('Symptoms');
    const selectER = document.getElementById('ER');
    const selectCustomER = document.getElementById('ER-custom-input');
    const selectIN = document.getElementById('insurance-dropdown');
    const selectCustomIN = document.getElementById('insurance-custom-input');
    const resultDiv = document.getElementById('result');
    const memberId = document.getElementById('InsuranceID')?.value.trim() || '';
    const additionalNotes = document.getElementById('n5')?.value.trim() || '';
    
    const customERVal = selectCustomER ? selectCustomER.value.trim() : '';
    const erVal = selectER ? selectER.value.trim() : '';

    if (!resultDiv) return;

    const symptomsVal = symptomsInput ? symptomsInput.value.trim() : '';
    const insuranceVal = (selectIN && selectIN.style.display !== 'none') ? selectIN.value : (selectCustomIN?.value || '');
    
    // Definir las banderas antes de usarlas
    const isErEmpty = !customERVal && !erVal;
    const hasAnyFieldFilled = symptomsVal !== '' || insuranceVal !== '' || memberId !== '' || additionalNotes !== '';
    
    const isManualMode = (selectER && selectER.style.display === 'none');
    let facilityVal = '';

    if (!isManualMode && selectER) {
        facilityVal = selectER.value;
    } else if (selectCustomER) {
        facilityVal = selectCustomER.value.trim();
    }

    let noteParts = [];
    if (symptomsVal) noteParts.push(symptomsVal);
    if (facilityVal) noteParts.push(facilityVal);
    if (memberId) noteParts.push(memberId);
    if (insuranceVal) noteParts.push(insuranceVal);
    if (additionalNotes) noteParts.push(additionalNotes);
    
    // Se agrega "No E/R" si hay campos llenos pero los selectores de E/R están vacíos
    if (hasAnyFieldFilled && isErEmpty) {
        noteParts.push("No E/R");
    }

    resultDiv.textContent = noteParts.join(' | ');
}

/* ======= Reset Form Fields ======= */
function resetForm() {
    ['Symptoms', 'ER', 'insurance-dropdown', 'insurance-custom-input', 'InsuranceID', 'n5', 'live-search-input'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const resultDiv = document.getElementById('result');
    if (resultDiv) resultDiv.innerText = '';
    
    updateNote();
    checkInsuranceConditions();
    filterEpicGuide('');
}

/* ======= Simple Filter for Epic Guide with Header Protection & Auto-Expand ======= */
function filterEpicGuide(query) {
    const filterText = query.toLowerCase().trim();
    const sections = document.querySelectorAll('.section-container');

    sections.forEach(section => {
        const rows = section.querySelectorAll('tbody tr');
        let hasMatchingRows = false;

        rows.forEach(tr => {
            const textContent = tr.textContent.toLowerCase();
            if (filterText === '' || textContent.includes(filterText)) {
                tr.style.display = '';
                hasMatchingRows = true;
            } else {
                tr.style.display = 'none';
            }
        });

        const headerText = section.querySelector('.section-header')?.textContent.toLowerCase() || '';
        const headerMatches = headerText.includes(filterText);

        if (filterText === '') {
            section.classList.add('collapsed');
            section.style.display = '';
        } else if (hasMatchingRows || headerMatches) {
            section.classList.remove('collapsed');
            section.style.display = '';
        } else {
            section.style.display = 'none';
        }
    });
}

/* ======= Clipboard Copy Function with Permissions & Fallback ======= */
async function copyResult() {
    try {
        updateNote();
        const resultText = document.getElementById('result')?.innerText || '';

        if (!resultText.trim() || resultText.includes('Your generated note will appear here')) {
            alert("⚠️ Insufficient information to copy. Please complete at least one field.");
            return;
        }

        if (navigator.permissions && navigator.permissions.query) {
            try {
                const permissionStatus = await navigator.permissions.query({ name: 'clipboard-write' });
                if (permissionStatus.state === 'denied') {
                    alert("⚠️ Clipboard access was denied. Please enable permissions in your browser settings.");
                    return;
                }
            } catch (err) {
                console.log("Permissions query notice:", err);
            }
        }

        await navigator.clipboard.writeText(resultText);
        showToast("✓ Successfully copied to clipboard!");

    } catch (error) {
        console.error("Clipboard copy error:", error);
        try {
            const fallbackTextArea = document.createElement('textarea');
            fallbackTextArea.value = document.getElementById('result')?.innerText || '';
            document.body.appendChild(fallbackTextArea);
            fallbackTextArea.select();
            document.execCommand('copy');
            document.body.removeChild(fallbackTextArea);
            showToast("✓ Copied (fallback method)!");
        } catch (fallbackErr) {
            alert("❌ Automatic clipboard permission could not be granted. Please check browser settings.");
        }
    }
}

/* ======= Toast Notification Helper ======= */
function showToast(message) {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.innerText = message;
        toast.className = "toast show";
        setTimeout(() => {
            toast.className = toast.className.replace("show", "");
        }, 3000);
    }
}

/* ======= Best-Effort Insurance Auto-Detection by Member ID & Automation ======= */
function autoSelectInsuranceByMemberId(memberId) {
    const selectIN = document.getElementById('insurance-dropdown');
    const selectCustomIN = document.getElementById('insurance-custom-input');
    
    if (!memberId || memberId.trim() === '') {
        if (selectIN) selectIN.value = "";
        if (selectCustomIN) selectCustomIN.value = "";
        updateNote();
        checkInsuranceConditions();
        return;
    }
    
    const cleanId = memberId.trim().toUpperCase();

    if (!selectIN) return;

    let detectedCarrierKeyword = null;

    if (/^[1-9][A-Z0-9][0-9][A-Z][A-Z0-9][0-9][A-Z]{2}[0-9]{2}$/.test(cleanId)) {
        detectedCarrierKeyword = "Medicare";
    } else if (/^R[0-9]{8}$/.test(cleanId)) {
        detectedCarrierKeyword = "Anthem";
    } else if (/^\d{8}[A-Z]$/.test(cleanId)) {
        detectedCarrierKeyword = "GCHP";
    } else if (/^([0-9]{9}|[0-9]{11})$/.test(cleanId)) {
        detectedCarrierKeyword = "TRICARE";
    } else if (/^((?![01])[A-Z0-9]){3}[A-Z0-9]{6,14}$/.test(cleanId)) {
        detectedCarrierKeyword = "Blue";
    } else if (/^([RC][0-9]{8})$/.test(cleanId)) {
        detectedCarrierKeyword = "Health Net";
    } else if (/^[0-9]{7,10}$/.test(cleanId)) {
        detectedCarrierKeyword = "Ventura County";
    } else if (/^[0-9]{9}$/.test(cleanId)) {
        detectedCarrierKeyword = "Western Growers";
    }

    if (detectedCarrierKeyword) {
        for (let option of selectIN.options) {
            if (option.value.toLowerCase().includes(detectedCarrierKeyword.toLowerCase())) {
                selectIN.value = option.value;
                if (selectCustomIN) selectCustomIN.value = option.value;
                if (typeof onInsuranceSelectChange === 'function') {
                    onInsuranceSelectChange();
                }
                break;
            }
        }
    }
}

/* ======= Toggle Floating Expansion for Right Column ======= */
function toggleFloatingDirectory() {
    const columnRight = document.querySelector('.directory-column-right');
    const expandBtn = document.getElementById('expandBtn');
    
    if (!columnRight) return;

    const isExpanded = columnRight.classList.toggle('floating-expanded');

    if (isExpanded) {
        if (expandBtn) expandBtn.textContent = '✕ Minimizar';
        // Opcional: Agregar un fondo oscuro detrás (overlay) si se desea
        document.body.style.overflow = 'hidden'; // Evita el scroll del fondo
    } else {
        if (expandBtn) expandBtn.textContent = '⤢ Expandir';
        document.body.style.overflow = ''; // Restaura el scroll
    }
}

/* ======= Page Initialization Handler & Event Listeners ======= */
window.addEventListener('DOMContentLoaded', () => {
    initInsuranceDropdown();
    updateNote();
    checkInsuranceConditions();

    const memberIdInput = document.getElementById('InsuranceID');
    if (memberIdInput) {
        memberIdInput.addEventListener('input', (e) => {
            autoSelectInsuranceByMemberId(e.target.value);
        });
    }
});