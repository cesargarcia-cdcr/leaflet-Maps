(function () {
    const THEME_KEY = 'app_theme';
    const validThemes = new Set(['clear', 'dark']);

    function applyTheme(theme) {
        const selectedTheme = validThemes.has(theme) ? theme : 'clear';
        document.documentElement.dataset.theme = selectedTheme;

        document.querySelectorAll('[data-theme-option]').forEach(option => {
            const isSelected = option.dataset.themeOption === selectedTheme;
            option.setAttribute('aria-pressed', String(isSelected));
            option.classList.toggle('is-active', isSelected);
        });
    }

    let initialTheme = 'clear';
    try {
        const savedTheme = localStorage.getItem(THEME_KEY);
        if (validThemes.has(savedTheme)) initialTheme = savedTheme;
    } catch (error) {
        console.error('[Theme]: Could not read the saved theme preference.', error);
    }
    applyTheme(initialTheme);

    function initializeThemeMenu() {
        if (!document.body || document.querySelector('[data-settings-menu]')) return;

        const menu = document.createElement('div');
        menu.className = 'settings-menu';
        menu.dataset.settingsMenu = '';

        const existingHelpButton = document.querySelector('.floating-help-btn');
        const trigger = existingHelpButton || document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'settings-trigger';
        trigger.removeAttribute('onclick');
        trigger.setAttribute('aria-label', 'Open appearance and help menu');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.setAttribute('aria-haspopup', 'true');
        trigger.innerHTML = '<span aria-hidden="true">⚙</span>';
        menu.appendChild(trigger);

        const panel = document.createElement('div');
        panel.className = 'settings-panel';
        panel.hidden = true;
        panel.setAttribute('aria-label', 'Appearance and help');

        const heading = document.createElement('span');
        heading.className = 'settings-heading';
        heading.textContent = 'Appearance';
        panel.appendChild(heading);

        for (const [theme, label] of [['clear', '☀️ Clear'], ['dark', '🌙 Dark']]) {
            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'settings-option';
            option.dataset.themeOption = theme;
            option.setAttribute('aria-pressed', 'false');
            option.textContent = label;
            option.addEventListener('click', () => {
                applyTheme(theme);
                try {
                    localStorage.setItem(THEME_KEY, theme);
                } catch (error) {
                    console.error('[Theme]: Could not save the theme preference.', error);
                }
                closeMenu();
            });
            panel.appendChild(option);
        }

        if (document.getElementById('help-modal-container') && typeof window.toggleHelpModal === 'function') {
            const help = document.createElement('button');
            help.type = 'button';
            help.className = 'settings-option settings-help-option';
            help.textContent = '❔ Help & shortcuts';
            help.addEventListener('click', () => {
                closeMenu();
                window.toggleHelpModal();
            });
            panel.appendChild(help);
        }

        menu.appendChild(panel);
        document.body.appendChild(menu);
        applyTheme(document.documentElement.dataset.theme);

        function closeMenu() {
            panel.hidden = true;
            trigger.setAttribute('aria-expanded', 'false');
        }

        trigger.addEventListener('click', () => {
            const isOpen = !panel.hidden;
            panel.hidden = isOpen;
            trigger.setAttribute('aria-expanded', String(!isOpen));
        });

        document.addEventListener('click', event => {
            if (!menu.contains(event.target)) closeMenu();
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && !panel.hidden) {
                closeMenu();
                trigger.focus();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeThemeMenu, { once: true });
    } else {
        initializeThemeMenu();
    }

    window.addEventListener('storage', event => {
        if (event.key === THEME_KEY) applyTheme(event.newValue);
    });
})();
