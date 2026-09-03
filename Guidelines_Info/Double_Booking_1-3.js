function actualizarFlujoFechas() {
    console.log("[DB-LOG] Iniciando ejecución de actualizarFlujoFechas...");
    
    const opciones = { weekday: 'long', day: 'numeric', month: 'long' };
    const ahora = new Date();
    const tabla = document.getElementById('tabla-fechas');
    
    if (!tabla) {
        console.error("[DB-LOG] Error: No se encontró el elemento 'tabla-fechas'");
        return;
    }
    
    tabla.innerHTML = ''; 

    const horaActualStr = ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const thInicio = document.querySelector('th:first-child');
    
    if (thInicio) {
        thInicio.innerHTML = `Día de la Llamada (Inicio)<br><strong>${ahora.toLocaleDateString('es-ES')} - ${horaActualStr}</strong>`;
        console.log("[DB-LOG] Encabezado actualizado con hora:", horaActualStr);
    } else {
        console.error("[DB-LOG] Error: No se encontró el encabezado de la tabla");
    }

    for (let i = 0; i < 6; i++) {
        let fechaOrigen = new Date();
        fechaOrigen.setDate(ahora.getDate() + i);

        if (fechaOrigen.getDay() === 0) continue;

        let f24 = new Date(fechaOrigen); f24.setDate(fechaOrigen.getDate() + 1);
        let f48 = new Date(fechaOrigen); f48.setDate(fechaOrigen.getDate() + 2);
        let f72 = new Date(fechaOrigen); f72.setDate(fechaOrigen.getDate() + 3);

        let txtOrigen = (i === 0) ? `HOY: ${fechaOrigen.toLocaleDateString('es-ES', opciones)}` : fechaOrigen.toLocaleDateString('es-ES', opciones);
        
        let txt72 = (f72.getDay() === 0) ? "Domingo (CERRADO)" : 
                    (i === 0) ? `${f72.toLocaleDateString('es-ES', opciones)} <br><span style="color:#c62828;"><strong>Antes de las: ${horaActualStr}</strong></span>` : 
                    f72.toLocaleDateString('es-ES', opciones);

        let fila = `<tr>
            <td>${txtOrigen}</td>
            <td>${(f24.getDay() === 0) ? "Domingo (CERRADO)" : f24.toLocaleDateString('es-ES', opciones)}</td>
            <td>${(f48.getDay() === 0) ? "Domingo (CERRADO)" : f48.toLocaleDateString('es-ES', opciones)}</td>
            <td>${txt72}</td>
        </tr>`;
        
        tabla.innerHTML += fila;
    }
    console.log("[DB-LOG] Tabla generada exitosamente.");
}

// Ejecutar al cargar
window.onload = actualizarFlujoFechas;

// Inicializar y configurar temporizador de actualización periódica (cada 30 segundos)
document.addEventListener('DOMContentLoaded', () => {
    actualizarFlujoFechas();
    setInterval(actualizarFlujoFechas, 30000);
});