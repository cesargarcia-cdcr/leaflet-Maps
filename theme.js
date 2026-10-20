(function () {
    const THEME_KEY = 'app_theme';
    const validThemes = new Set(['clear', 'dark']);

    function applyTheme(theme) {
        const selectedTheme = validThemes.has(theme) ? theme : 'clear';
        document.documentElement.dataset.theme = selectedTheme;

        const toggle = document.querySelector('[data-theme-toggle]');
        if (toggle) {
            const isDark = selectedTheme === 'dark';
            toggle.setAttribute('aria-pressed', String(isDark));
            toggle.setAttribute('aria-label', `Switch to ${isDark ? 'clear' : 'dark'} theme`);
            toggle.textContent = isDark ? '☀️ Clear' : '🌙 Dark';
        }
    }

    let initialTheme = 'clear';
    try {
        const savedTheme = localStorage.getItem(THEME_KEY);
        if (validThemes.has(savedTheme)) initialTheme = savedTheme;
    } catch (error) {
        console.error('[Theme]: Could not read the saved theme preference.', error);
    }
    applyTheme(initialTheme);

    function initializeThemeToggle() {
        if (!document.body || document.querySelector('[data-theme-toggle]')) return;

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'theme-toggle';
        toggle.dataset.themeToggle = '';
        toggle.addEventListener('click', () => {
            const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'clear' : 'dark';
            applyTheme(nextTheme);
            try {
                localStorage.setItem(THEME_KEY, nextTheme);
            } catch (error) {
                console.error('[Theme]: Could not save the theme preference.', error);
            }
        });
        document.body.appendChild(toggle);
        applyTheme(document.documentElement.dataset.theme);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeThemeToggle, { once: true });
    } else {
        initializeThemeToggle();
    }

    window.addEventListener('storage', event => {
        if (event.key === THEME_KEY) applyTheme(event.newValue);
    });
})();
