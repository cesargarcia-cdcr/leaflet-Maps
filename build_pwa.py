#!/usr/bin/env python3
"""Build a local-only PWA from the URL in .pwa.var."""

import base64
import json
import shutil
import subprocess
import sys
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlencode, urlsplit

ROOT = Path(__file__).resolve().parent
CONFIG_FILE = ROOT / ".pwa.var"
BUILD_DIR = ROOT / ".pwa-build"
LOCAL_TOOLS = {"build_pwa.py", "serve.py", "serve_pwa.py", ".pwa.var", ".gitignore"}


def extract_data_param(query):
    query_parts = query.split("&")
    data_index = next((i for i, part in enumerate(query_parts) if part.partition("=")[0] == "data"), -1)
    raw_index = next((i for i, part in enumerate(query_parts) if part == "raw=true"), -1)
    if data_index >= 0 and raw_index > data_index:
        first_value = query_parts[data_index].partition("=")[2]
        data_parts = [first_value, *query_parts[data_index + 1:raw_index]]
        return unquote("&".join(data_parts)), True
    return parse_qs(query).get("data", [""])[0], False


def validate_data_param(data_param, is_raw):
    plain_url = data_param.strip()
    if (
        len(plain_url) > 1
        and plain_url[0] in {"'", '"'}
        and plain_url[-1] == plain_url[0]
    ):
        plain_url = plain_url[1:-1].strip()
    if is_raw:
        parsed_data_url = urlsplit(plain_url)
        if parsed_data_url.scheme == "https" and parsed_data_url.netloc:
            return
        raise ValueError("The raw data parameter must be an HTTPS URL.")

    try:
        decoded_url = base64.b64decode(data_param, validate=True).decode("utf-8")
    except (ValueError, UnicodeDecodeError) as error:
        raise ValueError("The data parameter in .pwa.var must be valid Base64 text.") from error

    decoded = urlsplit(decoded_url)
    if decoded.scheme != "https" or not decoded.netloc:
        raise ValueError("The data parameter must decode to an HTTPS URL.")


def read_data_param():
    if not CONFIG_FILE.is_file():
        raise FileNotFoundError(
            "Create .pwa.var in the project root and put the full GitHub Pages "
            "URL containing its ?data= value on the first line."
        )

    config_lines = CONFIG_FILE.read_text(encoding="utf-8").splitlines()
    if not config_lines or not config_lines[0].strip():
        raise ValueError(".pwa.var must contain the full project URL on its first line.")
    project_url = config_lines[0].strip()
    parsed_url = urlsplit(project_url)
    if (
        parsed_url.scheme != "https"
        or parsed_url.netloc != "cesargarcia-cdcr.github.io"
        or parsed_url.path.rstrip("/") != "/leaflet-Maps"
    ):
        raise ValueError("The first line of .pwa.var must be the project GitHub Pages URL.")

    data_param, is_raw = extract_data_param(parsed_url.query)
    if not data_param:
        raise ValueError("The project URL in .pwa.var must include a non-empty data parameter.")

    validate_data_param(data_param, is_raw)
    return data_param, is_raw


def tracked_project_files():
    result = subprocess.run(
        ["git", "-C", str(ROOT), "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        check=True,
        capture_output=True,
    )
    files = []
    for item in result.stdout.split(b"\0"):
        if not item:
            continue
        relative_path = Path(item.decode("utf-8"))
        if (
            relative_path.parts[0] in {".git", ".pwa-build"}
            or relative_path.name in LOCAL_TOOLS
        ):
            continue
        if relative_path.suffix == ".var":
            continue
        source = ROOT / relative_path
        if source.is_file():
            files.append((source, relative_path))
    return files


def build():
    data_param, is_raw = read_data_param()
    files = tracked_project_files()

    if BUILD_DIR.is_symlink():
        raise ValueError("Refusing to replace a symbolic link at .pwa-build.")
    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR)
    BUILD_DIR.mkdir()

    for source, relative_path in files:
        destination = BUILD_DIR / relative_path
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)

    manifest = json.loads((ROOT / "manifest.webmanifest").read_text(encoding="utf-8"))
    start_params = {"data": data_param}
    if is_raw:
        start_params["raw"] = "true"
    manifest["start_url"] = f"./?{urlencode(start_params)}"
    (BUILD_DIR / "manifest.webmanifest").write_text(
        json.dumps(manifest, indent=2) + "\n",
        encoding="utf-8",
    )
    print("Built the local PWA in .pwa-build/; the data URL was not printed.")


if __name__ == "__main__":
    try:
        build()
    except (FileNotFoundError, ValueError, subprocess.CalledProcessError) as error:
        print(f"PWA build failed: {error}", file=sys.stderr)
        raise SystemExit(1) from error
