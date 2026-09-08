/* ====================================
DATA LOADER
ETL datasets pipeline (Curr and Next separated into JSON)
==================================== */

(function () {
    "use strict";

    //--------------------------------------------------
    // Storage Helpers (JSON & CSV)
    //--------------------------------------------------
    function saveJson(name, data) {
        localStorage.setItem(`json_${name}`, JSON.stringify(data));
        localStorage.setItem(name, JSON.stringify(data)); // Fallback compatibility
    }

    function arrayToCsv(rows) {
        if (!Array.isArray(rows) || rows.length === 0) return "";
        const headers = [...new Set(rows.flatMap(row => Object.keys(row)))];
        const csvRows = [headers.join(",")];
        rows.forEach(row => {
            const line = headers.map(header => {
                const value = row[header];
                if (value === null || value === undefined) return "";
                return `"${String(value).replace(/"/g, '""')}"`;
            }).join(",");
            csvRows.push(line);
        });
        return csvRows.join("\n");
    }

    function saveCsv(name, csvText) {
        localStorage.setItem(`csv_${name}`, csvText);
    }

    function saveDataset(name, rows) {
        saveCsv(name, arrayToCsv(rows));
    }

    function getPayload() {
        const raw = localStorage.getItem("cache_payload");
        if (!raw) return null;
        return JSON.parse(raw);
    }

    //--------------------------------------------------
    // Clinic Lookup & Clinics
    //--------------------------------------------------
    function generateClinicLookup(payload) {
        saveDataset("clinicLookup", payload.clinicLookup || []);
    }

    function generateClinics(payload) {
        const clinics = payload.clinics || [];
        const plusCodes = payload.plusCodes || [];

        const lookup = {};
        plusCodes.forEach(row => {
            const key = String(row.code || row.Abbreviation || "").trim().toUpperCase();
            if (key) lookup[key] = row.plusCode || row.plus_code || "";
        });

        const rows = clinics.map(clinic => {
            const code = String(clinic.code || clinic.Abbreviation || clinic.Code || "").trim().toUpperCase();
            const plusCode = lookup[code] || clinic.PlusCode || clinic.plusCode || "";
            const rawLat = clinic.lat ?? clinic.Lat ?? clinic.LAT ?? "";
            const rawLng = clinic.lng ?? clinic.Lng ?? clinic.LNG ?? "";
            
            return {
                code: code,
                Location: clinic.Location || "",
                City: clinic.City || "",
                Address: clinic.Address || "",
                ZipCode: clinic.ZipCode || "",
                PlusCode: plusCode,
                lat: rawLat !== "" ? parseFloat(rawLat) : "",
                lng: rawLng !== "" ? parseFloat(rawLng) : ""
            };
        });

        saveDataset("clinics", rows);
        console.log(`✅ clinics: ${rows.length} processed.`);
    }

    //--------------------------------------------------
    // Schedule Normalizer Helper (JSON)
    //--------------------------------------------------
    function normalizeRows(rows) {
        const merged = {};
        const metaKeys = [
            "ItemInternalId", "Provider ID", "NPI", "Code", 
            "Health Center", "Health Center ", "Report Employee Name", 
            "Employee Name", "JOB NAME", "Specialty"
        ];

        const allDateKeysSet = new Set();
        rows.forEach(row => {
            Object.keys(row).forEach(k => {
                if (!metaKeys.includes(k)) allDateKeysSet.add(k);
            });
        });

        const sortedDateKeys = Array.from(allDateKeysSet).sort((a, b) => {
            return new Date(`${a} 2026`) - new Date(`${b} 2026`);
        });

        rows.forEach(row => {
            const providerId = String(row["Provider ID"] || "").trim();
            const healthCenter = String(row["Health Center"] || row["Health Center "] || "").trim().toUpperCase();
            if (!providerId || !healthCenter) return;

            const key = `${providerId}|${healthCenter}`;
            if (!merged[key]) {
                merged[key] = {};
                metaKeys.forEach(k => { if (row[k] !== undefined) merged[key][k] = row[k]; });
                sortedDateKeys.forEach(dateKey => { merged[key][dateKey] = ""; });
            }

            Object.entries(row).forEach(([field, value]) => {
                if (value !== "" && value !== null && value !== undefined) {
                    merged[key][field] = value;
                }
            });
        });

        return Object.values(merged).map(provider => {
            const orderedProvider = {};
            metaKeys.forEach(k => {
                if (provider[k] !== undefined) orderedProvider[k] = provider[k];
            });
            sortedDateKeys.forEach(dateKey => {
                orderedProvider[dateKey] = provider[dateKey] !== undefined ? provider[dateKey] : "";
            });
            return orderedProvider;
        });
    }

    //--------------------------------------------------
    // Providers Schedule (Curr & Next Separated)
    //--------------------------------------------------
    function generateProvidersSchedCurr(payload) {
        const processedRows = normalizeRows(payload.providersSchedCurr || []);
        saveJson("providersSchedCurr", processedRows);
        console.log(`✅ providersSchedCurr JSON: ${processedRows.length} records.`);
    }

    function generateProvidersSchedNext(payload) {
        const processedRows = normalizeRows(payload.providersSchedNext || []);
        saveJson("providersSchedNext", processedRows);
        console.log(`✅ providersSchedNext JSON: ${processedRows.length} records.`);
    }

    function generateProviderScheduleDailyCurr(payload) {
        const rows = payload.providersSchedCurr || [];
        const dailyRecords = [];
        const metaKeys = ["ItemInternalId", "Provider ID", "NPI", "Code", "Health Center", "Health Center ", "Report Employee Name", "Employee Name", "JOB NAME", "Specialty"];

        rows.forEach(row => {
            const providerId = String(row["Provider ID"] || "").trim();
            const healthCenter = String(row["Health Center"] || row["Health Center "] || "").trim().toUpperCase();
            if (!providerId || !healthCenter) return;

            const baseData = {};
            metaKeys.forEach(k => { if (row[k] !== undefined) baseData[k] = row[k]; });

            Object.entries(row).forEach(([field, value]) => {
                if (!metaKeys.includes(field) && value !== "" && value !== null && value !== undefined) {
                    dailyRecords.push({ ...baseData, Date: field, Shift: value });
                }
            });
        });

        saveJson("providersSchedDailyCurr", dailyRecords);
        console.log(`✅ providersSchedDailyCurr JSON: ${dailyRecords.length} shifts.`);
    }

    function generateProviderScheduleDailyNext(payload) {
        const rows = payload.providersSchedNext || [];
        const dailyRecords = [];
        const metaKeys = ["ItemInternalId", "Provider ID", "NPI", "Code", "Health Center", "Health Center ", "Report Employee Name", "Employee Name", "JOB NAME", "Specialty"];

        rows.forEach(row => {
            const providerId = String(row["Provider ID"] || "").trim();
            const healthCenter = String(row["Health Center"] || row["Health Center "] || "").trim().toUpperCase();
            if (!providerId || !healthCenter) return;

            const baseData = {};
            metaKeys.forEach(k => { if (row[k] !== undefined) baseData[k] = row[k]; });

            Object.entries(row).forEach(([field, value]) => {
                if (!metaKeys.includes(field) && value !== "" && value !== null && value !== undefined) {
                    dailyRecords.push({ ...baseData, Date: field, Shift: value });
                }
            });
        });

        saveJson("providersSchedDailyNext", dailyRecords);
        console.log(`✅ providersSchedDailyNext JSON: ${dailyRecords.length} shifts.`);
    }

    //--------------------------------------------------
    // Straight Datasets
    //--------------------------------------------------
    function generateExtensions(payload) { saveDataset("extensions", payload.extensions || []); }
    function generateMainProviders(payload) { saveDataset("mainProviders", payload.mainProviders || []); }
    function generateProvidersNpi(payload) { saveDataset("providersNpi", payload.providersNpi || []); }

    function generateClinicsDirectory(payload) {
        const dir = payload.clinicsDirectory;
        if (!dir || !dir.$content) return;
        const decoded = decodeURIComponent(escape(atob(dir.$content)));
        saveCsv("clinicsDirectory", decoded);
    }

    //--------------------------------------------------
    // Main ETL Flow
    //--------------------------------------------------
    function initializeData() {
        try {
            const payload = getPayload();
            if (!payload) {
                console.warn("cache_payload not found");
                return;
            }
            generateClinicLookup(payload);
            generateClinics(payload);
            
            // Independent processing for current and next schedule blocks
            generateProvidersSchedCurr(payload);
            generateProvidersSchedNext(payload);
            generateProviderScheduleDailyCurr(payload);
            generateProviderScheduleDailyNext(payload);

            generateExtensions(payload);
            generateMainProviders(payload);
            generateProvidersNpi(payload);
            generateClinicsDirectory(payload);
            
            console.log("✅ ETL Complete");
            window.dispatchEvent(new CustomEvent("AppDataLoaded"));
        } catch (err) {
            console.error("Data Loader Error", err);
        }
    }

    window.obtenerCsv = function (name) { return localStorage.getItem(`csv_${name}`); };
    window.obtenerArchivo = window.obtenerCsv;
    window.obtenerSeccion = window.obtenerCsv;

    window.addEventListener("PayloadReady", initializeData);
    console.log("✅ Data loading complete. The force is with us.");
    window.dispatchEvent(new Event('AppDataReady'));
})();