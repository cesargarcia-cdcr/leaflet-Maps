function filterEpicGuide(query) {
            const filterText = query.toLowerCase().trim();
            const sections = document.querySelectorAll('.section-container');
            
            sections.forEach(section => {
                const rows = section.querySelectorAll('tbody tr');
                let hasVisibleRows = false;

                rows.forEach(row => {
                    const rowText = row.textContent.toLowerCase();
                    if (rowText.includes(filterText)) {
                        row.style.display = '';
                        hasVisibleRows = true;
                    } else {
                        row.style.display = 'none';
                    }
                });

                // Si ninguna fila coincide en esta sección, ocultamos toda la sección para limpiar la vista
                if (hasVisibleRows || filterText === '') {
                    section.style.display = '';
                } else {
                    section.style.display = 'none';
                }
            });
        }