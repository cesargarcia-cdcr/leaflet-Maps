#!/usr/bin/env python3
"""Serve the generated local PWA for installation and use in Chrome."""

import json
import signal
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urljoin, urlsplit
import webbrowser

HOST = "127.0.0.1"
PORT = 6000
BUILD_DIR = Path(__file__).resolve().parent / ".pwa-build"


class LocalRequestHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        # The request query contains the private data URL.
        super().log_message("%s %s", self.command, urlsplit(self.path).path)


def stop_server(signum, frame):
    raise KeyboardInterrupt


def main():
    manifest_file = BUILD_DIR / "manifest.webmanifest"
    if not manifest_file.is_file():
        raise FileNotFoundError("Run `python build_pwa.py` before starting the local app.")
    manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
    start_url = manifest["start_url"]
    if not start_url.startswith("./"):
        raise ValueError("The generated PWA start URL must be relative to its app scope.")

    handler = partial(
        LocalRequestHandler,
        directory=str(BUILD_DIR)
    )
    signal.signal(signal.SIGTERM, stop_server)
    if hasattr(signal, "SIGHUP"):
        signal.signal(signal.SIGHUP, stop_server)

    try:
        with ThreadingHTTPServer((HOST, PORT), handler) as server:
            url = urljoin(f"http://localhost:{PORT}/", start_url)
            print(f"Serving locally at http://localhost:{PORT}/ (Ctrl+C to stop)", flush=True)
            print("Opening the app in your browser.", flush=True)
            webbrowser.open(url)
            server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped; port 6000 is closed.", flush=True)


if __name__ == "__main__":
    main()
