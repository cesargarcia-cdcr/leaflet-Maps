/* directory.js - HTML Directory con soporte OPFS y carga en vivo */

'use strict';

window.APP_DATA = window.APP_DATA || {};

(function () {

    let DIRECTORY_INDEX = [];
    let renderedFiles = new Set();

    async function loadClinics() {
        console.log("LOG_DEBUG: Iniciando loadClinics desde OPFS (Directory)...");
        const root = document.getElementById("csvdir-root");
        if (!root) {
            console.error("LOG_DEBUG: No se encontró el elemento #csvdir-root");
            return;
        }

        // Si está vacío o tiene el texto de carga, lo limpiamos para empezar a pintar
        if (!root.hasChildNodes() || root.innerHTML.includes("Cargando") || root.innerHTML.includes("No hay")) {
            root.innerHTML = "";
        }

        try {
            const rootDir = await navigator.storage.getDirectory();
            let dirHandle;

            try {
                // Intentamos abrir la carpeta "Directory" en la raíz del OPFS
                dirHandle = await rootDir.getDirectoryHandle("Directory", { create: false });
            } catch (e) {
                console.warn("⚠️ La carpeta 'Directory' aún no existe en el OPFS.");
                root.innerHTML = "<div style='padding:20px; color:orange;'>Esperando archivos del directorio...</div>";
                return;
            }

            let fileCount = 0;

            // 1. Leer y renderizar lo que ya esté guardado en el OPFS
            for await (const [name, handle] of dirHandle.entries()) {
                if (handle.kind === 'file' && name.toLowerCase().endsWith('.html') && !renderedFiles.has(name)) {
                    await renderClinicItem(handle, name, root);
                    fileCount++;
                }
            }

            if (fileCount === 0 && root.innerHTML.includes("Esperando")) {
                root.innerHTML = "<div style='padding:20px; color:orange;'>No hay archivos en la carpeta Directory.</div>";
                return;
            }

            // 2. Escuchar en vivo los archivos que vayan llegando por la sincronización
            window.removeEventListener("FileSyncedLive", handleLiveClinicArrival);
            window.addEventListener("FileSyncedLive", handleLiveClinicArrival);

        } catch (err) {
            console.error("Error crítico cargando el directorio desde OPFS:", err);
            root.innerHTML = "<div style='padding:20px; color:red;'>Error crítico cargando los directorios clínicos.</div>";
        }
    }

    async function handleLiveClinicArrival(e) {
        if (e.detail.category === "Directory" && !renderedFiles.has(e.detail.name)) {
            const root = document.getElementById("csvdir-root");
            if (root) {
                if (root.innerHTML.includes("Cargando") || root.innerHTML.includes("No hay") || root.innerHTML.includes("Esperando")) {
                    root.innerHTML = "";
                }
                await renderClinicItem(e.detail.handle, e.detail.name, root);
            }
        }
    }

    async function renderClinicItem(fileHandle, fileName, rootElement) {
        try {
            renderedFiles.add(fileName);
            const fileData = await fileHandle.getFile();
            const html = await fileData.text();

            const section = document.createElement("section");
            section.className = "clinic";
            section.innerHTML = html;

            buildClinicMarkup(section);
            rootElement.appendChild(section);

            // Reconstruir índices, selectores y metadatos dinámicamente
            buildIndex();
            buildClinicSelect();
            updateMeta(DIRECTORY_INDEX.length, DIRECTORY_INDEX.length);

            const box = document.getElementById("dirSearchCSV");
            if (box && !box.hasAttribute("data-listener-active")) {
                box.setAttribute("data-listener-active", "true");
                box.addEventListener("input", filterDirectory);
            }
        } catch (err) {
            console.error(`Error procesando la clínica [${fileName}]:`, err);
        }
    }

    function buildClinicMarkup(section) {
        const h1 = section.querySelector("h1");
        if (!h1) return;

        h1.classList.add("clinic-head");

        const body = document.createElement("div");
        body.className = "clinic-body";

        while (h1.nextSibling) {
            body.appendChild(h1.nextSibling);
        }

        section.appendChild(body);
        section.classList.add("collapsed");

        buildSections(section);

        h1.addEventListener("click", () => {
            const collapsed = section.classList.contains("collapsed");
            document.querySelectorAll(".clinic").forEach(c => {
                c.classList.add("collapsed");
            });
            if (collapsed) {
                section.classList.remove("collapsed");
            }
        });
    }

    function buildSections(clinic) {
        const body = clinic.querySelector(".clinic-body");
        if (!body) return;

        const children = [...body.children];
        let currentSection = null;

        children.forEach(node => {
            if (node.tagName && node.tagName.toUpperCase() === "H2") {
                currentSection = document.createElement("div");
                currentSection.className = "directory-section";
                node.parentNode.insertBefore(currentSection, node);
                currentSection.appendChild(node);
                return;
            }
            if (currentSection) {
                currentSection.appendChild(node);
            }
        });
    }

    function buildIndex() {
        DIRECTORY_INDEX = [];
        document.querySelectorAll(".clinic").forEach(clinic => {
            const title = clinic.querySelector("h1")?.textContent.trim() || "";
            DIRECTORY_INDEX.push({
                el: clinic,
                clinicName: title.toLowerCase(),
                sections: [...clinic.querySelectorAll(".directory-section")]
            });
        });
    }

    function buildClinicSelect() {
        const sel = document.getElementById("dirClinicSelect");
        if (!sel) return;

        // Mantener opción por defecto y reconstruir
        const currentValue = sel.value;
        sel.innerHTML = '<option value="">All clinics</option>';

        document.querySelectorAll(".clinic h1").forEach(h1 => {
            const name = h1.textContent.trim();
            const option = document.createElement("option");
            option.value = name;
            option.textContent = name;
            sel.appendChild(option);
        });

        sel.value = currentValue;
        if (!sel.hasAttribute("data-listener-active")) {
            sel.setAttribute("data-listener-active", "true");
            sel.addEventListener("change", filterDirectory);
        }
    }

    function updateMeta(clinicsVisible, sectionsVisible) {
        const meta = document.getElementById("csvdir-meta");
        if (!meta) return;

        if (!clinicsVisible) {
            meta.textContent = "No matches found.";
            return;
        }
        meta.textContent = `Showing ${sectionsVisible} section(s) in ${clinicsVisible} clinic(s)`;
    }

    function filterDirectory() {
        const query = (document.getElementById("dirSearchCSV")?.value || "").toLowerCase().trim();
        const selectedClinic = (document.getElementById("dirClinicSelect")?.value || "").toLowerCase().trim();

        let visibleClinics = 0;
        let visibleSections = 0;

        DIRECTORY_INDEX.forEach(item => {
            let clinicVisible = 0;

            item.sections.forEach(section => {
                let match = true;
                if (query) {
                    match = section.textContent.toLowerCase().includes(query);
                }
                section.style.display = match ? "" : "none";
                if (match) {
                    clinicVisible++;
                    visibleSections++;
                }
            });

            if (selectedClinic && item.clinicName !== selectedClinic) {
                clinicVisible = 0;
            }

            item.el.style.display = clinicVisible ? "" : "none";
            if (clinicVisible) {
                visibleClinics++;
                if (query) {
                    item.el.classList.remove("collapsed");
                }
            }
        });

        const empty = document.getElementById("csvdir-empty");
        if (empty) {
            empty.style.display = visibleClinics ? "none" : "block";
        }

        updateMeta(visibleClinics, visibleSections);
    }

    function resetDirectory() {
        const search = document.getElementById("dirSearchCSV");
        const clinic = document.getElementById("dirClinicSelect");

        if (search) search.value = "";
        if (clinic) clinic.value = "";

        document.querySelectorAll(".directory-section").forEach(sec => {
            sec.style.display = "";
        });

        document.querySelectorAll(".clinic").forEach(c => {
            c.style.display = "";
            c.classList.add("collapsed");
        });

        updateMeta(DIRECTORY_INDEX.length, DIRECTORY_INDEX.length);
    }

    window.CSVDir_reset = resetDirectory;
    window.CSVDir_filter = filterDirectory;

    document.addEventListener("DOMContentLoaded", loadClinics);

})();