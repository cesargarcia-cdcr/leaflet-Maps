/* ====================================
   DATA LOADER
   ETL de datasets
==================================== */

(function () {

    "use strict";

    //--------------------------------------------------
    // CSV Helpers
    //--------------------------------------------------

    function arrayToCsv(rows) {

        if (
            !Array.isArray(rows) ||
            rows.length === 0
        ) {
            return "";
        }

        const headers = [

            ...new Set(
                rows.flatMap(
                    row => Object.keys(row)
                )
            )

        ];

        const csvRows = [];

        csvRows.push(
            headers.join(",")
        );

        rows.forEach(row => {

            const line =
                headers
                .map(header => {

                    const value =
                        row[header];

                    if (
                        value === null ||
                        value === undefined
                    ) {
                        return "";
                    }

                    return `"${String(value)
                        .replace(/"/g, '""')}"`;

                })
                .join(",");

            csvRows.push(line);

        });

        return csvRows.join("\n");

    }

    function saveCsv(
        name,
        csvText
    ) {

        localStorage.setItem(
            `csv_${name}`,
            csvText
        );

    }

    function saveDataset(
        name,
        rows
    ) {

        saveCsv(
            name,
            arrayToCsv(rows)
        );

    }

    //--------------------------------------------------
    // Payload
    //--------------------------------------------------

    function getPayload() {

        const raw =
            localStorage.getItem(
                "cache_payload"
            );

        if (!raw) {
            return null;
        }

        return JSON.parse(raw);

    }


    //--------------------------------------------------
    // clinicLookup
    //--------------------------------------------------

    function generateClinicLookup(payload) {

        saveDataset(
            "clinicLookup",
            payload.clinicLookup || []
        );

    }

    //--------------------------------------------------
    // Clinics
    //--------------------------------------------------

    function generateClinics(
        payload
    ) {

        const clinics =
            payload.clinics || [];

        const plusCodes =
            payload.plusCodes || [];

        const lookup = {};

        plusCodes.forEach(row => {

            const key =
                String(
                    row.code || ""
                ).trim();

            if (key) {

                lookup[key] = row;

            }

        });

        const merged =
            clinics.map(clinic => {

                const code =
                    String(
                        clinic.Abbreviation || ""
                    ).trim();

                const extra =
                    lookup[code] || {};

                return {

                    ...clinic,

                    plusCode:
                        extra.plusCode || "",

                    "Health Center":
                        extra["Health Center"] || "",

                    "Clinic Name":
                        extra["Clinic Name"] || ""

                };

            });

        saveDataset(
            "clinics",
            merged
        );

        console.log(
            `✅ clinics: ${merged.length}`
        );

    }

    //--------------------------------------------------
    // Providers Schedule
    //--------------------------------------------------

    function generateProvidersSched(payload) {
        const rows = [...(payload.providersSchedCurr || []), ...(payload.providersSchedNext || [])];
        const merged = {};
        rows.forEach(row => {
            const providerId = String(row["Provider ID"] || "").trim();
            const healthCenter = String(row["Health Center"] || row["Health Center "] || "").trim().toUpperCase();
            if (!providerId || !healthCenter) {
                return;
            }
            const key = `${providerId}|${healthCenter}`;
            if (!merged[key]) {
                merged[key] = {};
            }
            Object.entries(row).forEach(([field, value]) => {
                if (value !== "" && value !== null && value !== undefined) {
                    merged[key][field] = value;
                }
            });
        });
        saveDataset("providersSched", Object.values(merged));
        console.log(`✅ providersSched: ${Object.keys(merged).length}`);
    }

    function generateProviderScheduleDaily(payload) {
        const rows = [...(payload.providersSchedCurr || []), ...(payload.providersSchedNext || [])];
        const dailyRows = [];
        rows.forEach(provider => {
            Object.keys(provider).forEach(field => {
                const value = String(provider[field] || "").trim();
                if (!value) {
                    return;
                }
                if (/^[A-Z][a-z]{2}\s[A-Z][a-z]{2}\s\d{1,2}$/.test(field)) {
                    dailyRows.push({
                        Code: provider["Code"],
                        "Health Center": provider["Health Center"],
                        "Provider ID": provider["Provider ID"],
                        NPI: provider["NPI"],
                        "Employee Name": provider["Employee Name"],
                        "JOB NAME": provider["JOB NAME"],
                        Specialty: provider["Specialty"],
                        Date: field,
                        Schedule: value
                    });
                }
            });
        });
        saveDataset("providerScheduleDaily", dailyRows);
        console.log(`✅ providerScheduleDaily: ${dailyRows.length}`);
    }

    //--------------------------------------------------
    // Straight datasets
    //--------------------------------------------------

    function generateExtensions(
        payload
    ) {

        saveDataset(
            "extensions",
            payload.extensions || []
        );

    }

    function generateMainProviders(
        payload
    ) {

        saveDataset(
            "mainProviders",
            payload.mainProviders || []
        );

    }

    function generateProvidersNpi(
        payload
    ) {

        saveDataset(
            "providersNpi",
            payload.providersNpi || []
        );

    }

    //--------------------------------------------------
    // Clinics Directory
    //--------------------------------------------------

    function generateClinicsDirectory(
        payload
    ) {

        const dir =
            payload.clinicsDirectory;

        if (
            !dir ||
            !dir.$content
        ) {
            return;
        }

        const decoded =
            decodeURIComponent(
                escape(
                    atob(
                        dir.$content
                    )
                )
            );

        saveCsv(
            "clinicsDirectory",
            decoded
        );

    }

    //--------------------------------------------------
    // Main
    //--------------------------------------------------

    async function initializeData() {

        try {

            const payload =
                getPayload();

            if (!payload) {

                console.warn(
                    "cache_payload not found"
                );

                return;

            }

            generateClinicLookup(
                payload
            );

            generateClinics(
                payload
            );

            generateProvidersSched(
                payload
            );

            // 🎯 Added back so future schedule days parse correctly
            generateProviderScheduleDaily(
                payload
            );

            generateExtensions(
                payload
            );

            generateMainProviders(
                payload
            );

            generateProvidersNpi(
                payload
            );

            generateClinicsDirectory(
                payload
            );

            console.log(
                "✅ ETL Complete"
            );

            window.dispatchEvent(
                new CustomEvent(
                    "AppDataLoaded"
                )
            );

        } catch (err) {

            console.error(
                "Data Loader Error",
                err
            );

        }

    }

    //--------------------------------------------------
    // Public
    //--------------------------------------------------

    window.obtenerCsv =
        function (name) {

            return localStorage.getItem(
                `csv_${name}`
            );

        };

    window.obtenerArchivo =
        window.obtenerCsv;

    window.obtenerSeccion =
        window.obtenerCsv;

    //--------------------------------------------------
    // Boot
    //--------------------------------------------------

    window.addEventListener(
        "PayloadReady",
        initializeData
    );

    console.log("✅ Data loading complete. The force is with us.");
    window.dispatchEvent(new Event('AppDataReady'));

})();