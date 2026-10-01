'use strict';

/* ======= Hybrid Insurance Dropdown Initialization with LocalStorage Cache & Status Sort ======= */
function initInsuranceDropdown() {
    const insuranceContainer = document.getElementById('insurance-status-select')?.parentElement;
    if (!insuranceContainer) return;

    insuranceContainer.innerHTML = `
        <label style="font-weight: 600; color: #1e293b;">Insurance / Program Type</label>
        <div style="position: relative; display: flex; gap: 6px;">
            <select id="insurance-dropdown" onchange="onInsuranceSelectChange()" style="flex: 2; padding: 7px 10px; border-radius: 6px; border: 1px solid #cbd5e1; background-color: #fff; font-size: 0.75rem;">
                <option value="">-- Select Insurance / Program --</option>
            </select>
            <input id="insurance-custom-input" placeholder="Or type custom..." oninput="updateNote(); checkInsuranceConditions();" style="flex: 1; padding: 7px 10px; border-radius: 6px; border: 1px solid #cbd5e1; background-color: #fff; font-size: 0.75rem; display: none;" />
        </div>
        <div style="font-size: 11px; margin-top: 4px; display: flex; justify-content: space-between;">
            <span id="insurance-mode-toggle" onclick="toggleInsuranceInputMode()" style="color: #2563eb; cursor: pointer; text-decoration: underline;">Switch to manual input</span>
        </div>
    `;

    const selectEl = document.getElementById('insurance-dropdown');
    if (!selectEl) return;

    try {
        const rawData = localStorage.getItem("csv_Insurance");
        if (rawData) {
            let insurances = JSON.parse(rawData);
            window._cachedInsurances = insurances;

            // Sort: Accepted first, then alphabetically by insurance name
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
    const selectEl = document.getElementById('insurance-dropdown');
    const inputEl = document.getElementById('insurance-custom-input');
    const toggleBtn = document.getElementById('insurance-mode-toggle');

    if (!selectEl || !inputEl) return;

    if (selectEl.style.display !== 'none') {
        selectEl.style.display = 'none';
        inputEl.style.display = 'block';
        inputEl.value = selectEl.value; 
        toggleBtn.textContent = "Switch back to dropdown list";
        inputEl.focus();
    } else {
        selectEl.style.display = 'block';
        inputEl.style.display = 'none';
        toggleBtn.textContent = "Switch to manual input";
        selectEl.focus();
    }
    updateNote();
    checkInsuranceConditions();
}

/* ======= Dropdown Selection Handler ======= */
function onInsuranceSelectChange() {
    const selectEl = document.getElementById('insurance-dropdown');
    const customInput = document.getElementById('insurance-custom-input');
    if (selectEl && customInput) {
        customInput.value = selectEl.value;
    }
    updateNote();
    checkInsuranceConditions();
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
            const statusColor = isAccepted ? '#166534' : '#b91c1c';
            
            conditionsDiv.innerHTML = `
                <div style="padding: 6px; background: ${isAccepted ? '#f0fdf4' : '#fef2f2'}; border: 1px solid ${isAccepted ? '#bbf7d0' : '#fecaca'}; border-radius: 4px;">
                    <strong style="color: ${statusColor};">Status: ${match.Status}</strong> | Plan: ${match.Plan_Type || 'Standard'} | Verif: ${match.Verification_Method || 'Standard'}
                    ${match.Special_Conditions && match.Special_Conditions !== "None" ? `<div style="margin-top: 2px; color: #b45309;">⚠️ ${match.Special_Conditions}</div>` : ''}
                </div>
            `;
        } else {
            conditionsDiv.innerHTML = `<div style="padding: 6px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; color: #64748b;">Custom or unlisted insurance/program entry.</div>`;
        }
    } else {
        conditionsDiv.innerHTML = `<div style="padding: 6px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; color: #94a3b8;">Select an insurance or program to view status verification details.</div>`;
    }
}

/* ======= Real-Time Note Generation & Concatenation ======= */
function updateNote() {
    const symptom = document.getElementById('Symptoms')?.value.trim() || '';
    let visitTypeCat = document.getElementById('ER')?.value.trim() || '';
    
    const selectEl = document.getElementById('insurance-dropdown');
    const customInput = document.getElementById('insurance-custom-input');
    const insuranceVal = (selectEl && selectEl.style.display !== 'none') ? selectEl.value : (customInput?.value || '');

    const memberId = document.getElementById('InsuranceID')?.value.trim() || '';
    const additionalNotes = document.getElementById('n5')?.value.trim() || '';

    const hasAnyContent = symptom || insuranceVal || memberId || additionalNotes || visitTypeCat;
    if (!visitTypeCat && hasAnyContent) {
        visitTypeCat = "No E/R";
    }

    const concatenatedText = [
        symptom || null,
        visitTypeCat || null,
        insuranceVal || null,
        memberId ? `${memberId}` : null,
        additionalNotes || null
    ].filter(Boolean).join(' | ');

    const resultDiv = document.getElementById('result');
    if (resultDiv) {
        resultDiv.innerText = concatenatedText;
    }
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
        // Target strictly the body rows, leaving the <thead> headers completely untouched
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

/* ======= Best-Effort Insurance Auto-Detection by Member ID ======= */
function autoSelectInsuranceByMemberId(memberId) {
    console.group("🔍 [T.S. Auto-Detection] Evaluating Member ID");
    try {
        if (!memberId || memberId.trim() === '') {
            console.log("⚠️ Empty or null input. Skipping evaluation.");
            console.groupEnd();
            return;
        }
        
        const cleanId = memberId.trim().toUpperCase();
        console.log("Clean ID to evaluate:", cleanId);

        const dropdown = document.getElementById('insurance-dropdown');
        if (!dropdown) {
            console.warn("⚠️ Element 'insurance-dropdown' not found in DOM.");
            console.groupEnd();
            return;
        }

        let detectedCarrierKeyword = null;

        // Carrier matching logic based on specific ID patterns
        if (/^[1-9][A-Z0-9][0-9][A-Z][A-Z0-9][0-9][A-Z]{2}[0-9]{2}$/.test(cleanId)) {
            detectedCarrierKeyword = "Medicare";
            console.log("✅ Match found: Medicare (MBI)");
        } else if (/^R[0-9]{8}$/.test(cleanId)) {
            detectedCarrierKeyword = "Anthem"; // Anthem FEP
            console.log("✅ Match found: Anthem FEP (R + 8 digits)");
        } else if (/^\d{8}[A-Z]$/.test(cleanId)) {
            detectedCarrierKeyword = "GCHP"; // Gold Coast Health Plan (8 digits + 1 letter)
            console.log("✅ Match found: Gold Coast Health Plan (GCHP)");
        } else if (/^([0-9]{9}|[0-9]{11})$/.test(cleanId)) {
            detectedCarrierKeyword = "TRICARE";
            console.log("✅ Match found: TRICARE");
        } else if (/^((?![01])[A-Z0-9]){3}[A-Z0-9]{6,14}$/.test(cleanId)) {
            detectedCarrierKeyword = "Blue"; // Anthem / Blue Shield Standard
            console.log("✅ Match found: Anthem / Blue Cross Standard");
        } else if (/^([RC][0-9]{8})$/.test(cleanId)) {
            detectedCarrierKeyword = "Health Net";
            console.log("✅ Match found: Health Net");
        } else if (/^[0-9]{7,10}$/.test(cleanId)) {
            detectedCarrierKeyword = "Ventura County";
            console.log("✅ Match found: Ventura County");
        } else if (/^[0-9]{9}$/.test(cleanId)) {
            detectedCarrierKeyword = "Western Growers";
            console.log("✅ Match found: Western Growers");
        } else {
            console.log("ℹ️️ No regex matched the current format (Best-effort skipped).");
        }

        // If a match is found, safely attempt to select it in the dropdown
        if (detectedCarrierKeyword) {
            let matched = false;
            for (let option of dropdown.options) {
                if (option.value.toLowerCase().includes(detectedCarrierKeyword.toLowerCase())) {
                    dropdown.value = option.value;
                    matched = true;
                    console.log(`🎯 Dropdown successfully updated to option: "${option.value}"`);
                    
                    if (typeof onInsuranceSelectChange === 'function') {
                        onInsuranceSelectChange();
                    }
                    break;
                }
            }
            if (!matched) {
                console.warn(`⚠️ Keyword "${detectedCarrierKeyword}" detected, but no matching option found in <select>.`);
            }
        }
    } catch (error) {
        console.error("❌ Critical error in autoSelectInsuranceByMemberId (Best-effort caught):", error);
    }
    console.groupEnd();
}

/* ======= Page Initialization Handler ======= */
window.addEventListener('DOMContentLoaded', () => {
    initInsuranceDropdown();
    updateNote();
    checkInsuranceConditions();
});