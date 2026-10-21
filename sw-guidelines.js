self.addEventListener('install', (event) => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Intercept requests to the Guidelines_Info folder only.
  if (url.pathname.includes('/Guidelines_Info/')) {
    event.respondWith(
      (async () => {
        const rutaVirtual = url.pathname.substring(url.pathname.indexOf('Guidelines_Info/'));
        const content = await readFromOPFS(virtualPath);

        if (content !== null) {
          const contentType = getMimeType(virtualPath);
          return new Response(content, {
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

async function readFromOPFS(path) {
  try {
    const root = await navigator.storage.getDirectory();
    const parts = path.split('/').filter(Boolean);
    const fileName = parts.pop();

    let directory = root;
    for (const subdirectory of parts) {
      directory = await directory.getDirectoryHandle(subdirectory);
    }

    const handle = await directory.getFileHandle(fileName);
    const file = await handle.getFile();
    return await file.text();
  } catch (e) {
    return null;
  }
}

function getMimeType(path) {
  if (path.endsWith('.html')) return 'text/html; charset=utf-8';
  if (path.endsWith('.css')) return 'text/css';
  if (path.endsWith('.js')) return 'application/javascript';
  if (path.endsWith('.json')) return 'application/json';
  return 'text/plain';
}
