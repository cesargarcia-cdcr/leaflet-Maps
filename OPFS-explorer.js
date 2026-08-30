  async function cargarExploradorOPFS() {
    const contenedor = document.getElementById('opfs-explorer-container');
    if (!contenedor) return;

    contenedor.innerHTML = '<div style="padding: 10px; color: #666;">Cargando archivos del navegador...</div>';

    try {
      // Obtenemos la raíz del OPFS
      const root = await navigator.storage.getDirectory();
      
      // Función para recorrer el directorio de forma limpia
      async function listarDirectorio(dirHandle, indent = 0) {
        let html = '<ul style="list-style: none; padding-left: ' + (indent === 0 ? '0' : '20px') + '; margin: 0;">';
        
        const entradas = [];
        for await (const entry of dirHandle.values()) {
          entradas.push(entry);
        }

        if (entradas.length === 0) {
          return '<span style="color: #999; padding-left: 10px;">(Carpeta vacía)</span>';
        }

        for (const handle of entradas) {
          const esCarpeta = handle.kind === 'directory';
          const icono = esCarpeta ? '📁' : '📄';
          
          html += `<li style="padding: 4px 0; font-family: monospace;">
                     <span>${icono}</span> <span>${handle.name}</span>`;
          
          if (esCarpeta) {
            html += await listarDirectorio(handle, indent + 1);
          }
          html += `</li>`;
        }
        html += '</ul>';
        return html;
      }

      const arbolHTML = await listarDirectorio(root);
      contenedor.innerHTML = `<div style="background: #fff; padding: 8px; border-radius: 4px; max-height: 300px; overflow-y: auto;">${arbolHTML}</div>`;

    } catch (err) {
      contenedor.innerHTML = `<div style="color: red; padding: 10px;">Error al leer OPFS: ${err.message}</div>`;
    }
  }

  // Ejecutar al cargar la página y asociarlo a tu botón de actualizar
  document.addEventListener('DOMContentLoaded', () => {
    cargarExploradorOPFS();
    
    // Buscamos tu botón "Actualizar Explorador" por su texto o estructura
    const botones = document.querySelectorAll('button');
    botones.forEach(btn => {
      if (btn.textContent.includes('Actualizar Explorador')) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          cargarExploradorOPFS();
        });
      }
    });
  });
