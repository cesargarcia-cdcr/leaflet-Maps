/* notes.js — UI base, navegación, Note Builder */
'use strict';

(function () {

    /* ======= Sidebar / burger ======= */
    function enforceCollapsedSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        const burger = document.querySelector('.burger');
        if (sidebar) {
            sidebar.classList.remove('open');
            sidebar.style.transform = 'translateX(-100%)';
        }
        if (overlay)
            overlay.classList.remove('show');
        if (burger) {
            burger.style.display = 'block';
            burger.classList.remove('active');
        }
    }

    function toggleMenu(force) {
        const burger = document.querySelector('.burger');
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        if (!sidebar || !burger || !overlay)
            return;

        const isOpen = sidebar.classList.contains('open');
        const willOpen = (force === true) ? true : (force === false) ? false : !isOpen;

        if (willOpen) {
            burger.classList.add('active');
            sidebar.classList.add('open');
            overlay.classList.add('show');
            sidebar.style.transform = 'translateX(0)';
        } else {
            burger.classList.remove('active');
            sidebar.classList.remove('open');
            overlay.classList.remove('show');
            sidebar.style.transform = 'translateX(-100%)';
        }
    }

    /* ======= Navegación entre secciones ======= */
    function navigateTo(s) {
        const sections = {
            note: document.getElementById('note-section'),
            map: document.getElementById('map-section'),
            directory: document.getElementById('directory-section'),
            'provider-directory': document.getElementById('provider-directory-section'),
            info: document.getElementById('info-section'),
            admin: document.getElementById('admin-section')
        };

        // Hide all sections safely
        Object.values(sections).forEach(el => {
            if (el) el.style.display = 'none';
        });

        // NOTE
        if (s === 'note' && sections.note) {
            sections.note.style.display = 'block';
        }

// MAP
        if (s === 'map' && sections.map) {
            sections.map.style.display = 'block';
            if (window.AppMap && typeof window.AppMap.invalidateSize === 'function') {
                setTimeout(() => {
                    try { 
                        window.AppMap.invalidateSize(); 
                    } catch (e) {
                        console.error("Error invalidating map size:", e);
                    }
                }, 150);
            }
        }

        // DIRECTORY
        if (s === 'directory' && sections.directory) {
            sections.directory.style.display = 'block';
            if (typeof window.CSVDir_syncStickyTop === 'function') window.CSVDir_syncStickyTop();
            if (typeof window.CSVDir_defaultCollapse === 'function') window.CSVDir_defaultCollapse();
            if (typeof window.CSVDir_filter === 'function') window.CSVDir_filter();
        }

        // PROVIDER DIRECTORY
        if (s === 'provider-directory' && sections['provider-directory']) {
            sections['provider-directory'].style.display = 'block';
            if (typeof initMasterProviderDirectory === 'function') {
                initMasterProviderDirectory();
            }
        }

        // GUIDELINES & INFO
        if (s === 'info' && sections.info) {
            sections.info.style.display = 'block';
        }

        // ADMIN
        if (s === 'admin' && sections.admin) {
            sections.admin.style.display = 'block';
            setTimeout(() => {
                if (window.table) {
                    try { window.table.redraw(); } catch (e) {}
                }
            }, 100);
        }

        // ✅ Match sidebar tab item indexes perfectly with the current DOM order
        const items = document.querySelectorAll('.nav-item');
        items.forEach((el, i) => el.classList.toggle('active',
            (s === 'note' && i === 0) ||
            (s === 'map' && i === 1) ||
            (s === 'directory' && i === 2) ||
            (s === 'provider-directory' && i === 3) || 
            (s === 'info' && i === 4) ||               
            (s === 'admin' && i === 5)                 
        ));

        if (typeof toggleMenu === 'function') {
            toggleMenu(false);
        }
    }

    /* ======= Atajos Alt+Shift+1/2/3/4/5/6 ======= */
    document.addEventListener('keydown', e => {
        if (e.altKey && e.shiftKey) {
            if (e.key === '1' || e.code === 'Digit1') { e.preventDefault(); navigateTo('note'); }
            if (e.key === '2' || e.code === 'Digit2') { e.preventDefault(); navigateTo('map'); }
            if (e.key === '3' || e.code === 'Digit3') { e.preventDefault(); navigateTo('directory'); }
            if (e.key === '4' || e.code === 'Digit4') { e.preventDefault(); navigateTo('provider-directory'); }
            if (e.key === '5' || e.code === 'Digit5') { e.preventDefault(); navigateTo('info'); }
            if (e.key === '6' || e.code === 'Digit6') { e.preventDefault(); navigateTo('admin'); }
        }
    });

    /* ======= Note Builder ======= */
    const $ = id => document.getElementById(id);

    function updateNote() {
        const s1 = $('n1').value.trim();
        const er = $('n2').value.trim() ? $('n2').value.trim() : (s1 ? 'no E/R' : '');
        const ins = $('n3').value ?? '';
        const id = $('n4').value.trim();
        const extra = $('n5').value.trim();
        $('result').textContent = [s1, er, ins, id, extra].filter(Boolean).join(' | ');
    }
    function resetForm() {
        $('n1').value = '';
        $('n2').value = '';
        $('n3').value = '';
        $('n4').value = '';
        $('n5').value = '';
        updateNote();
    }
    async function copyResult() {
        const t = $('result').textContent;
        if (t) {
            await navigator.clipboard.writeText(t);
            showToast();
        }
    }
    function showToast() {
        const t = $('toast');
        if (t) {
            t.classList.add('show');
            setTimeout(() => t.classList.remove('show'), 2500);
        }
    }

    /* ======= Bootstrap mínimo (UI base) ======= */
    window.addEventListener('DOMContentLoaded', () => {
        try {
            enforceCollapsedSidebar();

            const overlay = document.querySelector('.sidebar-overlay');
            overlay?.addEventListener('click', () => toggleMenu(false));

            // Choose which section to display on start (Map by default)
            navigateTo('map');
            updateNote();
        } catch (e) {
            console.error('notes.js bootstrap:', e);
        }
    });

    /* insurances we take js code */
    
    function toggleInsuranceDetail(id) {
    const container = document.getElementById('insurance-detail-container');
    const contents = document.querySelectorAll('.ins-content');
    
    // Si ya está visible y damos clic al mismo, lo cerramos
    if (container.style.display === 'block' && document.getElementById(id).style.display === 'block') {
        container.style.display = 'none';
    } else {
        container.style.display = 'block';
        contents.forEach(c => c.style.display = 'none');
        document.getElementById(id).style.display = 'block';
    }
}

// Loading screen 

function updateProgress(percent, message) {
    const bar = document.getElementById('bt-progress-bar');
    const textPercent = document.getElementById('bt-percentage');
    const statusText = document.getElementById('sync-status');
    
    if (bar) bar.style.width = `${percent}%`;
    if (textPercent) textPercent.innerText = `${percent}%`;
    if (statusText && message) statusText.innerText = message;
}

window.addEventListener('AppDataReady', () => {
        const providerSection = document.getElementById('provider-directory-section');
        if (providerSection && providerSection.style.display === 'block') {
            console.log("🔄 [Provider] Datos listos detectados, actualizando vista de proveedores...");
            if (typeof initMasterProviderDirectory === 'function') {
                initMasterProviderDirectory();
            }
        }
    });


window.triggerManualSync = async function() {
    console.log("🔄 [Sync Data] Forzando reseteo y limpieza de caché...");

    try {
        // 1. Borrar elementos clave de localStorage relacionados con caché y sincronización
        localStorage.removeItem("cache_payload");
        localStorage.removeItem("lite_payload_cache");
        localStorage.removeItem("app_last_sync_timestamp");
        localStorage.removeItem("app_last_sync_date");

        // 2. Intentar limpiar el archivo en OPFS si tu entorno lo soporta
        if (navigator.storage && navigator.storage.getDirectory) {
            const rootDir = await navigator.storage.getDirectory();
            try {
                await rootDir.removeEntry('lite_payload.json');
                console.log("🗑️ [OPFS] lite_payload.json eliminado exitosamente.");
            } catch (err) {
                console.log("ℹ️ [OPFS] lite_payload.json no encontrado o ya estaba limpio.");
            }
        }
    } catch (e) {
        console.error("⚠️ Error limpiando almacenamiento local/OPFS:", e);
    }

    // 3. Aplicar tu lógica de Cache Buster para redirigir al root de forma limpia
    const currentSearchParams = window.location.search;
    
    let basePath = window.location.pathname;
    
    if (basePath.endsWith('.html')) {
        basePath = basePath.substring(0, basePath.lastIndexOf('/') + 1);
    } else if (!basePath.endsWith('/')) {
        basePath += '/';
    }

    // Opcional: Agregar un parámetro de control de tiempo único para evitar que el navegador guarde el HTML en caché
    const cacheBusterParam = `_cb=${Date.now()}`;
    let finalSearch = currentSearchParams;
    if (finalSearch) {
        finalSearch += `&${cacheBusterParam}`;
    } else {
        finalSearch = `?${cacheBusterParam}`;
    }

    setTimeout(() => {
        window.location.replace(basePath + finalSearch);
    }, 500);
};

    /* ======= Expose to window ======= */
    window.navigateTo = navigateTo;
    window.resetForm = resetForm;
    window.copyResult = copyResult;
    window.toggleMenu = toggleMenu;
    window.enforceCollapsedSidebar = enforceCollapsedSidebar;
    window.updateNote = updateNote;
})();