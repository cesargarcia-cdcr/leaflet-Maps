# Local Chrome app

The PWA build is local-only. It reads the app's `?data=` URL from `.pwa.var`
and writes a generated app to `.pwa-build/`. Both paths are ignored by Git;
the tracked manifest used by GitHub Pages contains no data URL.

1. Create `.pwa.var` in the repository root. Put the full GitHub Pages URL,
   including `?data=...`, on its first line. Keep the file private.
2. Build the local app with `python build_pwa.py`.
3. Start it with `python serve_pwa.py`. This opens the app at `localhost:6000`.
4. In Chrome, use **Install page as app** (or the install icon in the address
   bar) to install it in the current Chrome profile.

Keep the server running while using the installed app. The generated manifest
contains the data URL, so do not publish or share `.pwa-build/`; each coworker
should create their own `.pwa.var`, build, and install locally.
