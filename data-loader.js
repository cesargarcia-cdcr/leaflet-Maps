/* === Data Loader: JSON -> CSV Cache === */

(function () {
    'use strict';

    const STORAGE_KEY = 'app_raw_payload_cache';

    const urlParams = new URLSearchParams(window.location.search);
    const encodedUrl = urlParams.get('data');

    let targetUrl = null;

    function excelDateToDisplay(excelSerial) {

        if (!excelSerial)
            return "";

        const date = new Date(
                (Number(excelSerial) - 25569) * 86400 * 1000);

        const days = [
            "Sun", "Mon", "Tue",
            "Wed", "Thu", "Fri", "Sat"
        ];

        const months = [
            "Jan", "Feb", "Mar",
            "Apr", "May", "Jun",
            "Jul", "Aug", "Sep",
            "Oct", "Nov", "Dec"
        ];

        return `${days[date.getDay()]} ${months[date.getMonth()]} ${date.getDate()}`;
    }

    // ===============================
    // Base64 Utilities
    // ===============================

    function decodeBase64Safe(str) {
        if (!str)
            return '';

        let clean = str.trim().replace(/\s/g, '');

        const padding = clean.length % 4;
        if (padding) {
            clean += '='.repeat(4 - padding);
        }

        return decodeURIComponent(
            escape(atob(clean)));
    }

    try {
        if (encodedUrl) {
            targetUrl = decodeBase64Safe(encodedUrl);
        }
    } catch (err) {
        console.warn('Unable to decode ?data=', err);
    }

    // ===============================
    // Splash Screen
    // ===============================

    function hideSplashScreen() {
        const splash = document.getElementById('sync-splash');

        if (!splash)
            return;

        splash.style.opacity = '0';

        setTimeout(() => {
            splash.remove();
        }, 400);
    }

    // ===============================
    // CSV Helpers
    // ===============================

    function arrayToCsv(rows) {

        if (!Array.isArray(rows) || !rows.length) {
            return '';
        }

        const headers = [
            ...new Set(
                rows.flatMap(row => Object.keys(row)))
        ];

        const escapeCsv = value => {

            if (value === null || value === undefined) {
                return '';
            }

            return `"${String(value).replace(/"/g, '""')}"`;
        };

        return [
            headers.join(','),
            ...rows.map(row =>
                headers
                .map(header => escapeCsv(row[header]))
                .join(','))
        ].join('\n');
    }

    function saveCsv(name, csvText) {
        localStorage.setItem(
`csv_${name}`,
            csvText);
    }

    function decodeEmbeddedCsv(base64Text) {
        return decodeURIComponent(
            escape(atob(base64Text)));
    }

    // ===============================
    // Business Rules
    // ===============================

    function mergeClinicsPlusCodes(clinics, plusCodes) {

        const lookup = {};

        plusCodes.forEach(row => {

            const key = String(
                row.code || ""
            ).trim();

            if (key) {
                lookup[key] = row;
            }

        });

        return clinics.map(clinic => {

            const abbreviation = String(
                clinic.Abbreviation || ""
            ).trim();

            const match =
                lookup[abbreviation] || {};

            return {

                ...clinic,

                plusCode:
                    match.plusCode || "",

                "Health Center":
                    match["Health Center"] || "",

                "Clinic Name":
                    match["Clinic Name"] || ""

            };

        });

    }

    // ===============================
    // Data Sync
    // ===============================

    async function initializeData() {

        if (!targetUrl) {
            console.warn('No data URL found.');
            hideSplashScreen();
            return;
        }

        try {

            const response = await fetch(targetUrl);

            if (!response.ok) {
                throw new Error(
`HTTP ${response.status}`);
            }

            const payload = await response.json();

            // Optional backup
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(payload));

            // ==========================
            // clinics + plusCodes
            // ==========================

            if (
                payload.clinics &&
                payload.plusCodes) {

                const clinicsMerged =
                    mergeClinicsPlusCodes(
                        payload.clinics,
                        payload.plusCodes);

                saveCsv(
                    'clinics',
                    arrayToCsv(clinicsMerged));
            }

            // ==========================
            // extensions
            // ==========================

            if (payload.extensions) {

                saveCsv(
                    'extensions',
                    arrayToCsv(payload.extensions));
            }

            // ==========================
            // mainProviders
            // ==========================

            if (payload.mainProviders) {

                saveCsv(
                    'mainProviders',
                    arrayToCsv(payload.mainProviders));
            }

            // ==========================
            // providersNpi
            // ==========================

            if (payload.providersNpi) {

                saveCsv(
                    'providersNpi',
                    arrayToCsv(payload.providersNpi));
            }

          // ==========================
          // providersSched
          // ==========================

          if (payload.providersSchedCurr) {

              const currentRows =
    payload.providersSchedCurr || [];

const nextRows =
    payload.providersSchedNext || [];

const mergedSchedule = [
    ...currentRows,
    ...nextRows
];

console.log(
    "Current rows:",
    currentRows.length
);

console.log(
    "Next rows:",
    nextRows.length
);

console.log(
    "Total providersSched rows:",
    mergedSchedule.length
);

console.log(
    "Merged clinic codes:",
    [...new Set(
        mergedSchedule
            .map(r => r.Code)
            .filter(Boolean)
    )].sort()
);

saveCsv(
    "providersSched",
    arrayToCsv(mergedSchedule)
);

              console.log(
                  `✅ Current rows kept: ${filteredCurrent.length}`
              );

              console.log(
                  `✅ Next rows added: ${nextRows.length}`
              );

              console.log(
                  `✅ Total providersSched rows: ${mergedSchedule.length}`
              );

              console.log(
              "✅ Clinic Codes:",
              [...new Set(
                  mergedSchedule
                      .map(r => r.Code)
                      .filter(Boolean)
              )]
          );
          }

            // ==========================
            // clinicsDirectory
            // ==========================

            if (
                payload.clinicsDirectory &&
                payload.clinicsDirectory.$content) {

                saveCsv(
                    'clinicsDirectory',
                    decodeEmbeddedCsv(
                        payload.clinicsDirectory.$content));
            }

            console.log(
                '✅ CSV cache generated successfully.');

        } catch (err) {

            console.error(
                '❌ Error loading payload:',
                err);
        }

        hideSplashScreen();
    }

    // ===============================
    // Public API
    // ===============================

    window.obtenerCsv = function (name) {

        return localStorage.getItem(
`csv_${name}`);
    };

    // Optional legacy support
    window.obtenerArchivo = function (name) {
        return window.obtenerCsv(name);
    };

    window.obtenerSeccion = function (name) {
        return window.obtenerCsv(name);
    };

    // ===============================
    // Boot
    // ===============================

    window.addEventListener(
        'DOMContentLoaded',
        async() => {

        await initializeData();
        console.log(
          '✅ AppDataLoaded dispatched'
        );

        window.dispatchEvent(
            new CustomEvent(
                'AppDataLoaded'));
    });

})();