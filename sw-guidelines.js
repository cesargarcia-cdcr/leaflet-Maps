self.addEventListener('install', (event) => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Solo interceptar peticiones a la carpeta Guidelines_Info
  if (url.pathname.includes('/Guidelines_Info/')) {
    event.respondWith(
      (async () => {
        const rutaVirtual = url.pathname.substring(url.pathname.indexOf('Guidelines_Info/'));
        const contenido = await leerDesdeOPFS(rutaVirtual);

        if (contenido !== null) {
          const contentType = obtenerMimeType(rutaVirtual);
          return new Response(contenido, {
            status: 200,
            headers: { 
              'Content-Type': contentType,
              'Cache-Control': 'no-cache'
            }
          });
        }
        return fetch(event.request);
      })()
    );
  }
});

async function leerDesdeOPFS(ruta) {
  try {
    const root = await navigator.storage.getDirectory();
    const partes = ruta.split('/').filter(Boolean);
    const nombreArchivo = partes.pop();

    let carpeta = root;
    for (const sub of partes) {
      carpeta = await carpeta.getDirectoryHandle(sub);
    }

    const handle = await carpeta.getFileHandle(nombreArchivo);
    const file = await handle.getFile();
    return await file.text();
  } catch (e) {
    return null;
  }
}

function obtenerMimeType(ruta) {
  if (ruta.endsWith('.html')) return 'text/html; charset=utf-8';
  if (ruta.endsWith('.css')) return 'text/css';
  if (ruta.endsWith('.js')) return 'application/javascript';
  if (ruta.endsWith('.json')) return 'application/json';
  return 'text/plain';
}
