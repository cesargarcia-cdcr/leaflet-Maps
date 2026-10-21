(function() {
    function updateDateFlow() {
        console.log("[DB-LOG] Starting updateDateFlow...");
        
        const dateOptions = { weekday: 'long', day: 'numeric', month: 'long' };
        const now = new Date();
        const table = document.getElementById('tabla-fechas');
        
        if (!table) {
            console.warn("[DB-LOG] The 'tabla-fechas' element was not found yet.");
            return;
        }
        
        table.innerHTML = '';

        const currentTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        // Find the header within this view to avoid global conflicts.
        const startHeader = document.querySelector('#header-inicio') || document.querySelector('th:first-child');
        
        if (startHeader) {
            startHeader.innerHTML = `Call Day (Start)<br><strong>${now.toLocaleDateString('en-US')} - ${currentTime}</strong>`;
            console.log("[DB-LOG] Header updated with time:", currentTime);
        }

        for (let i = 0; i < 6; i++) {
            const sourceDate = new Date();
            sourceDate.setDate(now.getDate() + i);

            if (sourceDate.getDay() === 0) continue;

            const date24 = new Date(sourceDate); date24.setDate(sourceDate.getDate() + 1);
            const date48 = new Date(sourceDate); date48.setDate(sourceDate.getDate() + 2);
            const date72 = new Date(sourceDate); date72.setDate(sourceDate.getDate() + 3);

            const sourceText = (i === 0) ? `TODAY: ${sourceDate.toLocaleDateString('en-US', dateOptions)}` : sourceDate.toLocaleDateString('en-US', dateOptions);
            
            const text72 = (date72.getDay() === 0) ? "Sunday (CLOSED)" :
                        (i === 0) ? `${date72.toLocaleDateString('en-US', dateOptions)} <br><span class="booking-deadline"><strong>Before: ${currentTime}</strong></span>` :
                        date72.toLocaleDateString('en-US', dateOptions);

            const row = `<tr>
                <td>${sourceText}</td>
                <td>${(date24.getDay() === 0) ? "Sunday (CLOSED)" : date24.toLocaleDateString('en-US', dateOptions)}</td>
                <td>${(date48.getDay() === 0) ? "Sunday (CLOSED)" : date48.toLocaleDateString('en-US', dateOptions)}</td>
                <td>${text72}</td>
            </tr>`;
            
            table.innerHTML += row;
        }
        console.log("[DB-LOG] Table generated successfully.");
    }

    // Run immediately when the HTML is injected.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateDateFlow);
    } else {
        updateDateFlow();
    }

    // Refresh every 30 seconds.
    if (!window._dbIntervalStarted) {
        window._dbIntervalStarted = true;
        setInterval(updateDateFlow, 30000);
    }
})();