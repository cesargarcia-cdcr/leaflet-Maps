/* directory.js - HTML Directory */

'use strict';

window.APP_DATA = window.APP_DATA || {};

(function () {

    let DIRECTORY_INDEX = [];

    async function loadText(url) {

        const r = await fetch(url, {
            cache: "no-cache"
        });

        if (!r.ok) {
            throw new Error(`${url} (${r.status})`);
        }

        return await r.text();
    }

async function loadDirectoryFiles() {
        // En lugar de hacer un fetch a /data-files, leemos la sección desde el caché del flujo
        try {
            if (typeof window.obtenerArchivo === 'function') {
                const dirContent = window.obtenerArchivo('clinicsDirectory');
                if (dirContent) {
                    // Si el flujo regresa el contenido como texto HTML o JSON, lo adaptamos
                    return dirContent; 
                }
            }
        } catch (err) {
            console.warn("Error obteniendo directorio desde el caché:", err);
        }
        return null;
    }

    async function loadClinics() {
        console.log("LOG_DEBUG: Iniciando loadClinics...");
        const root = document.getElementById("csvdir-root");
        if (!root) {
            console.error("LOG_DEBUG: No se encontró el elemento #csvdir-root");
            return;
        }

        root.innerHTML = "<div style='padding:20px'>Cargando directorios clínicos...</div>";

        try {
            // Obtenemos el contenido directamente del almacenamiento sincronizado
            const dirData = await loadDirectoryFiles();
            
            if (!dirData) {
                console.warn("LOG_DEBUG: La lista de directorios está vacía o no disponible.");
                root.innerHTML = "<div style='padding:20px; color:orange;'>No hay datos de directorios sincronizados.</div>";
                return;
            }

            root.innerHTML = "";

            // Dependiendo de cómo Power Automate te entregue 'clinicsDirectory' (HTML directo o lista):
            // Si es un string con el HTML completo o bloques:
            const section = document.createElement("section");
            section.className = "clinic";
            
            // Si dirData es texto HTML crudo:
            section.innerHTML = typeof dirData === 'string' ? dirData : (dirData.Content || JSON.stringify(dirData));

            buildClinicMarkup(section);
            root.appendChild(section);

            // Inicializamos las funciones de búsqueda y filtrado
            buildIndex();
            buildClinicSelect();
            updateMeta(DIRECTORY_INDEX.length, DIRECTORY_INDEX.length);

            const box = document.getElementById("dirSearchCSV");
            if (box) {
                box.addEventListener("input", filterDirectory);
            }

        } catch (err) {
            console.error("Error crítico cargando los datos:", err);
            root.innerHTML = "<div style='padding:20px; color:red;'>Error crítico cargando los datos.</div>";
        }
    }

    async function loadClinics() {
        // logs
        console.log("LOG_DEBUG: Iniciando loadClinics..."); // <--- AÑADE ESTO
        const root = document.getElementById("csvdir-root");
        if (!root) {
            console.error("LOG_DEBUG: No se encontró el elemento #csvdir-root"); // <--- AÑADE ESTO
            return;
        }

        if (!root)
            return;

        root.innerHTML = "<div style='padding:20px'>Cargando directorios clínicos...</div>";

        try {
        const files = await loadDirectoryFiles();
        console.log("LOG_DEBUG: Archivos recibidos:", files); // <--- AÑADE ESTO
        
        if (files.length === 0) {
            console.warn("LOG_DEBUG: La lista de archivos está vacía.");
        }
            root.innerHTML = "";

            for (const file of files) {
                try {
                    // Fetch directo al archivo HTML en la carpeta Directory/
                    const response = await fetch(`Directory/${file}`);
                    const html = await response.text();

                    const section = document.createElement("section");
                    section.className = "clinic";
                    section.innerHTML = html;

                    // Reutilizamos tu función existente para convertir el HTML en la UI
                    buildClinicMarkup(section);

                    root.appendChild(section);
                } catch (err) {
                    console.error("Error al cargar:", file, err);
                }
            }

            // Inicializamos las funciones de búsqueda y filtrado que ya tenías
            buildIndex();
            buildClinicSelect();
            updateMeta(DIRECTORY_INDEX.length, DIRECTORY_INDEX.length);
        } catch (err) {
            root.innerHTML = "Error crítico cargando los datos.";
        }
    }
    
  /* async function loadClinics() {

    const root =
    document.getElementById(
    "csvdir-root"
    );

    if (!root) return;

    root.innerHTML =
    "<div style='padding:20px'>Loading directory...</div>";

    try {

    const files =
    await loadDirectoryFiles();

    root.innerHTML = "";

    for (const file of files) {

    try {

    const html =
    await loadText(
    `Directory/${file}`
    );

    const section =
    document.createElement(
    "section"
    );

    section.className =
    "clinic";

    section.innerHTML =
    html;

    buildClinicMarkup(
    section
    );

    root.appendChild(
    section
    );

    }
    catch (err) {

    console.error(
    "Failed:",
    file,
    err
    );

    }
    }

    buildIndex();
    buildClinicSelect();

    updateMeta(
    DIRECTORY_INDEX.length,
    DIRECTORY_INDEX.length
    );

    const box =
    document.getElementById(
    "dirSearchCSV"
    );

    if (box) {

    box.addEventListener(
    "input",
    filterDirectory
    );

    }

    }
    catch (err) {

    console.error(err);

    root.innerHTML =
    `<div style="padding:20px;color:red">
    Unable to load directory.
    </div>`;
    }
    } */

    function buildClinicMarkup(section) {

        const h1 =
            section.querySelector("h1");

        if (!h1)
            return;

        h1.classList.add(
            "clinic-head");

        const body =
            document.createElement("div");

        body.className =
            "clinic-body";

        while (h1.nextSibling) {

            body.appendChild(
                h1.nextSibling);

        }

        section.appendChild(body);

        section.classList.add(
            "collapsed");

        buildSections(section);

        h1.addEventListener(
            "click",
            () => {

            const collapsed =
                section.classList.contains(
                    "collapsed");

            document
            .querySelectorAll(
                ".clinic")
            .forEach(c => {

                c.classList.add(
                    "collapsed");

            });

            if (collapsed) {

                section.classList.remove(
                    "collapsed");

            }

        });
    }

    function buildSections(clinic) {

        const body =
            clinic.querySelector(
                ".clinic-body");

        if (!body)
            return;

        const children =
            [...body.children];

        let currentSection = null;

        children.forEach(node => {

            if (
                node.tagName &&
                node.tagName.toUpperCase() === "H2") {

                currentSection =
                    document.createElement(
                        "div");

                currentSection.className =
                    "directory-section";

                node.parentNode.insertBefore(
                    currentSection,
                    node);

                currentSection.appendChild(
                    node);

                return;
            }

            if (currentSection) {

                currentSection.appendChild(
                    node);

            }

        });

    }

    function buildIndex() {

        DIRECTORY_INDEX = [];

        document
        .querySelectorAll(".clinic")
        .forEach(clinic => {

            const title =
                clinic
                .querySelector("h1")
                ?.textContent
                .trim() || "";

            DIRECTORY_INDEX.push({

                el: clinic,

                clinicName:
                title.toLowerCase(),

                sections:
                [
                    ...clinic.querySelectorAll(
                        ".directory-section")
                ]

            });

        });

    }

    function buildClinicSelect() {

        const sel =
            document.getElementById(
                "dirClinicSelect");

        if (!sel)
            return;

        sel.innerHTML =
            '<option value="">All clinics</option>';

        document
        .querySelectorAll(
            ".clinic h1")
        .forEach(h1 => {

            const name =
                h1.textContent.trim();

            const option =
                document.createElement(
                    "option");

            option.value =
                name;

            option.textContent =
                name;

            sel.appendChild(
                option);

        });

        sel.addEventListener(
            "change",
            filterDirectory);
    }

    function updateMeta(
        clinicsVisible,
        sectionsVisible) {

        const meta =
            document.getElementById(
                "csvdir-meta");

        if (!meta)
            return;

        if (!clinicsVisible) {

            meta.textContent =
                "No matches found.";

            return;
        }

        meta.textContent =
`Showing ${sectionsVisible} section(s) in ${clinicsVisible} clinic(s)`;
    }

    function filterDirectory() {

        const query =
            (
            document
            .getElementById(
                "dirSearchCSV")
            ?.value || "")
        .toLowerCase()
        .trim();

        const selectedClinic =
            (
            document
            .getElementById(
                "dirClinicSelect")
            ?.value || "")
        .toLowerCase()
        .trim();

        let visibleClinics = 0;
        let visibleSections = 0;

        DIRECTORY_INDEX.forEach(item => {

            let clinicVisible = 0;

            item.sections.forEach(section => {

                let match = true;

                if (query) {

                    match =
                        section
                        .textContent
                        .toLowerCase()
                        .includes(query);

                }

                section.style.display =
                    match
                     ? ""
                     : "none";

                if (match) {

                    clinicVisible++;
                    visibleSections++;

                }

            });

            if (
                selectedClinic &&
                item.clinicName !== selectedClinic) {

                clinicVisible = 0;

            }

            item.el.style.display =
                clinicVisible
                 ? ""
                 : "none";

            if (clinicVisible) {

                visibleClinics++;

                if (query) {

                    item.el.classList.remove(
                        "collapsed");

                }

            }

        });

        const empty =
            document.getElementById(
                "csvdir-empty");

        if (empty) {

            empty.style.display =
                visibleClinics
                 ? "none"
                 : "block";

        }

        updateMeta(
            visibleClinics,
            visibleSections);
    }

    function resetDirectory() {

        const search =
            document.getElementById(
                "dirSearchCSV");

        const clinic =
            document.getElementById(
                "dirClinicSelect");

        if (search)
            search.value = "";

        if (clinic)
            clinic.value = "";

        document
        .querySelectorAll(
            ".directory-section")
        .forEach(sec => {

            sec.style.display = "";

        });

        document
        .querySelectorAll(
            ".clinic")
        .forEach(c => {

            c.style.display = "";
            c.classList.add(
                "collapsed");

        });

        updateMeta(
            DIRECTORY_INDEX.length,
            DIRECTORY_INDEX.length);
    }

  
    window.CSVDir_reset =
        resetDirectory;

    window.CSVDir_filter =
        filterDirectory;

    document.addEventListener(
        "DOMContentLoaded",
        loadClinics);

})();