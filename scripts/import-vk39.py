"""Import platform files from the matching VK Messenger 3.9.0 releases.

The source archives stay untouched. The extracted runtime and native modules
are copied into this build project; the OpenVK application code stays in app/.
"""

import argparse
import json
import shutil
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
TARGET_NAMES = {
    "vkext": "0f8e273eea4548333d8624cca9dfdc81.node",
    "cld": "63f5da0a611e33b4062e0f4d3f55fece.node",
    "spellchecker": "977161663b9dbd9aecc1a0b55c331c52.node",
    "keyboard": "d491abcfdbdbdc5687428004350f6b37.node",
}
SOURCE_NAMES = {
    "linux-x64": {
        "vkext": "9fe134230e5b3788dbf9919610a65c78.node",
        "cld": "5f97e814e5ac2ec34816383dc9706eaa.node",
        "spellchecker": "65756e37207d3195c6ea99e0f7e1e200.node",
        "keyboard": "47cc87c3720cc710ef89601b8373fd8f.node",
    },
    "win32-ia32": {
        "vkext": "507c3ae127f5af9ce5507f42bfda8bea.node",
        "cld": "dba698047722416189ffb2cd3bf71178.node",
        "spellchecker": "baf9876c9a38e95637560fdcf3edb172.node",
        "keyboard": "8f0b748dd912f8e1218b252a228364dc.node",
    },
}


def copy_native(read, target):
    for module, old_name in SOURCE_NAMES[target].items():
        dest = ROOT / "native" / target / "dist" / TARGET_NAMES[module]
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(read(f"resources/app/dist/{old_name}"))
    sqlite = f"resources/app/node_modules/sqlite3/lib/binding/electron-v1.8-{target}/node_sqlite3.node"
    dest = ROOT / "native" / target / sqlite.removeprefix("resources/app/")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(read(sqlite))


def import_linux(archive_path):
    target = "linux-x64"
    runtime = ROOT / "runtime" / target
    with ZipFile(archive_path) as archive:
        names = set(archive.namelist())
        assert archive.read("version").strip() == b"v1.8.6"
        assert json.loads(archive.read("resources/app/package.json"))["version"] == "3.9.0"
        for info in archive.infolist():
            name = info.filename
            if info.is_dir() or name.startswith("resources/app/"):
                continue
            dest = (runtime / name).resolve()
            if not dest.is_relative_to(runtime.resolve()):
                raise ValueError(f"Unsafe archive entry: {name}")
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(archive.read(info))
        copy_native(archive.read, target)
    print(f"Imported Linux x64 from {archive_path}")


def import_win32(extracted_app):
    target = "win32-ia32"
    source = extracted_app.resolve()
    assert (source / "version").read_text().strip() == "v1.8.6"
    assert json.loads((source / "resources/app/package.json").read_text(encoding="utf-8"))["version"] == "3.9.0"
    runtime = ROOT / "runtime" / target
    for file in source.rglob("*"):
        if not file.is_file():
            continue
        relative = file.relative_to(source)
        if relative.parts[:2] == ("resources", "app"):
            continue
        dest = runtime / relative
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(file, dest)

    def read(name):
        return (source / Path(name)).read_bytes()

    copy_native(read, target)
    for module, binary in [
        ("winutils", "winutils"),
        ("windows-notification-state", "notificationstate"),
        ("windows-quiet-hours", "quiethours"),
    ]:
        relative = Path("node_modules") / module / "build" / "Release" / f"{binary}.node"
        dest = ROOT / "native" / target / relative
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source / "resources/app" / relative, dest)
    print(f"Imported Windows x86 from {extracted_app}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--linux-zip", type=Path)
    parser.add_argument("--win32-app", type=Path, help="app/ extracted from Windows_i386.exe with innoextract")
    args = parser.parse_args()
    if not (args.linux_zip or args.win32_app):
        parser.error("pass --linux-zip or --win32-app")
    if args.linux_zip:
        import_linux(args.linux_zip)
    if args.win32_app:
        import_win32(args.win32_app)
