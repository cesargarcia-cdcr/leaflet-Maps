/* === Data Loader: Decodificador Automático de Power Automate a localStorage === */
(function () {
  'use strict';

  const CACHE_KEY = 'app_pa_csv_data_v1';
  const urlParams = new URLSearchParams(window.location.search);
  const encodedUrl = urlParams.get('data');

  let targetUrl = null;
  if (encodedUrl && !encodedUrl.includes('…')) {
    try {
      let cleanBase64 = encodedUrl.trim();
      const padding = cleanBase64.length % 4;
      if (padding) {
        cleanBase64 += '='.repeat(4 - padding);
      }
      targetUrl = atob(decodeURIComponent(cleanBase64));
    } catch (e) {
      console.warn("⚠️ No se pudo decodificar el parámetro ?data=. Usando caché local.", e);
    }
  }

  // --- LÓGICA DEL MINIJUEGO INTERACTIVO ---
  let callsCount = 0;
  const avatars = ['🧑‍💼', '📞', '📋', '🎧', '💊', '👨‍⚕️'];

  function registrarAccionJugador() {
    callsCount++;
    const counterEl = document.getElementById('callCounter');
    const avatarEl = document.getElementById('agentAvatar');

    if (counterEl) counterEl.textContent = callsCount;

    if (avatarEl) {
      avatarEl.classList.add('bounce');
      if (callsCount % 3 === 0) {
        avatarEl.textContent = avatars[Math.floor(Math.random() * avatars.length)];
      }
      setTimeout(() => avatarEl.classList.remove('bounce'), 80);
    }
  }

  window.addEventListener('keydown', registrarAccionJugador);
  window.addEventListener('click', registrarAccionJugador);

  // --- PROCESAMIENTO Y CACHÉ DE DATOS ---
  async function CargarDatosGlobales() {
    if (targetUrl) {
      try {
        console.log("🌐 Conectando con Power Automate para descargar datos...");
        const response = await fetch(targetUrl);
        if (response.ok) {
          const freshData = await response.json();
          
          // Desglosar y decodificar cada archivo del diccionario de Power Automate
          for (const [fileKey, contentInfo] of Object.entries(freshData)) {
            if (contentInfo && typeof contentInfo === 'object') {
              let base64Str = contentInfo.$content || '';
              if (base64Str) {
                const missingPadding = base64Str.length % 4;
                if (missingPadding) {
                  base64Str += '='.repeat(4 - missingPadding);
                }

                try {
                  const binaryString = atob(base64Str);
                  const bytes = Uint8Array.from(binaryString, (m) => m.codePointAt(0));
                  const decodedText = new TextDecoder('utf-8').decode(bytes);

                  // Guardar individualmente limpio para consumo directo
                  localStorage.setItem(fileKey, decodedText);
                } catch (err) {
                  console.warn(`⚠️ No se pudo decodificar el archivo interno: ${fileKey}`, err);
                }
              }
            }
          }

          localStorage.setItem(CACHE_KEY, JSON.stringify(freshData));
          console.log("✅ Datos sincronizados, decodificados y guardados en localStorage con éxito.");
          return freshData;
        }
      } catch (e) {
        console.warn("⚠️ Falló la red. Cargando respaldo desde localStorage...", e);
      }
    }

    const localCache = localStorage.getItem(CACHE_KEY);
    if (localCache) {
      console.log("📂 Usando datos desde el caché local.");
      try {
        return JSON.parse(localCache);
      } catch (err) {
        console.error("❌ Error al parsear el caché local:", err);
      }
    }

    console.warn("⚠️ No se obtuvieron datos de red ni del caché.");
    return null;
  }

  // --- FUNCIÓN GLOBAL REQUERIDA POR MAP.JS Y DIRECTORY.JS ---
  window.obtenerArchivo = function(nombreArchivo) {
    // 1. Buscar si ya está decodificado individualmente
    let contenido = localStorage.getItem(nombreArchivo);
    if (contenido) return contenido;

    // 2. Respaldo extrayendo directo del JSON general de Power Automate
    try {
      const cacheGeneral = localStorage.getItem(CACHE_KEY);
      if (!cacheGeneral) return null;

      const data = JSON.parse(cacheGeneral);
      const archivoObj = data[nombreArchivo];

      if (archivoObj && archivoObj.$content) {
        let b64 = archivoObj.$content;
        const pad = b64.length % 4;
        if (pad) b64 += '='.repeat(4 - pad);

        const binaryString = atob(b64);
        const bytes = Uint8Array.from(binaryString, (m) => m.codePointAt(0));
        const decodedText = new TextDecoder('utf-8').decode(bytes);
        
        // Guardarlo para futuras consultas
        localStorage.setItem(nombreArchivo, decodedText);
        return decodedText;
      }
    } catch (e) {
      console.error(`❌ Error al extraer '${nombreArchivo}' del caché:`, e);
    }

    return null;
  };

  window.APP_RAW_DATA = null;
  CargarDatosGlobales().then(data => {
    window.APP_RAW_DATA = data;
    window.dispatchEvent(new CustomEvent('AppDataLoaded', { detail: data }));
  });

})();