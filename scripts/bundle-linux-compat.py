"""Bundle legacy GConf libraries needed by Electron 1.8.6 on modern Linux."""

import hashlib
import io
import tarfile
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / "runtime" / "linux-x64"
PACKAGES = (
    (
        "https://deb.debian.org/debian/pool/main/g/gconf/libgconf-2-4_3.2.6-8_amd64.deb",
        "0fad57869b4074899625e2747afefbf32318224ede8e17c59d0ed2a703d0f095",
        "libgconf-2.so.4.1.5",
        "libgconf-2.so.4",
        "libgconf-2-4",
    ),
    (
        "https://deb.debian.org/debian/pool/main/d/dbus-glib/libdbus-glib-1-2_0.112-3_amd64.deb",
        "1cddce2ec5231fcfc12eb9daaa5a99bcdbe69373bff5362d9e38e54153d552fd",
        "libdbus-glib-1.so.2.3.5",
        "libdbus-glib-1.so.2",
        "libdbus-glib-1-2",
    ),
)


def deb_data(archive):
    if not archive.startswith(b"!<arch>\n"):
        raise ValueError("Invalid Debian package")
    offset = 8
    while offset < len(archive):
        header = archive[offset:offset + 60]
        name = header[:16].decode("ascii").strip().rstrip("/")
        size = int(header[48:58].decode("ascii"))
        data = archive[offset + 60:offset + 60 + size]
        offset += 60 + size + (size % 2)
        if name.startswith("data.tar"):
            return tarfile.open(fileobj=io.BytesIO(data), mode="r:*")
    raise ValueError("Debian package has no data.tar member")


def extract_package(url, expected_hash, binary_name, soname, package_name):
    cache = ROOT / ".tools" / Path(url).name
    cache.parent.mkdir(parents=True, exist_ok=True)
    if not cache.exists():
        urllib.request.urlretrieve(url, cache)
    archive = cache.read_bytes()
    if hashlib.sha256(archive).hexdigest() != expected_hash:
        raise ValueError(f"SHA256 mismatch: {cache}")
    with deb_data(archive) as data:
        binary = next((m for m in data if m.name.endswith("/" + binary_name) and m.isfile()), None)
        if binary is None:
            raise ValueError(f"Missing {binary_name} in {cache}")
        content = data.extractfile(binary).read()
        library = RUNTIME / "lib" / soname
        library.parent.mkdir(parents=True, exist_ok=True)
        library.write_bytes(content)

    with deb_data(archive) as data:
        copyright_file = next(
            (m for m in data if m.name.endswith(f"/doc/{package_name}/copyright") and m.isfile()),
            None,
        )
        if copyright_file is None:
            raise ValueError(f"Missing copyright file in {cache}")
        license_path = RUNTIME / "licenses" / f"{package_name}.copyright"
        license_path.parent.mkdir(parents=True, exist_ok=True)
        license_path.write_bytes(data.extractfile(copyright_file).read())
    print(f"Bundled {soname} from {cache.name}")


def main():
    executable = RUNTIME / "ovk"
    legacy_executable = RUNTIME / "vk"
    original = RUNTIME / "ovk.bin"
    legacy_original = RUNTIME / "vk.bin"
    if legacy_original.exists():
        if original.exists():
            original.unlink()
        legacy_original.rename(original)
    if legacy_executable.exists() and legacy_executable.read_bytes()[:4] == b"\x7fELF":
        if original.exists():
            original.unlink()
        legacy_executable.rename(original)
    elif legacy_executable.exists():
        legacy_executable.unlink()
    if not original.exists():
        raise ValueError("Import the Linux VK Messenger 3.9.0 runtime first")
    for package in PACKAGES:
        extract_package(*package)
    executable.write_text(
        '#!/bin/sh\n'
        'APP_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)\n'
        'export LD_LIBRARY_PATH="$APP_DIR/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"\n'
        'exec "$APP_DIR/ovk.bin" "$@"\n',
        encoding="utf-8",
        newline="\n",
    )
    executable.chmod(0o755)
    original.chmod(0o755)
    print("Created portable Linux launcher: runtime/linux-x64/ovk")


if __name__ == "__main__":
    main()
