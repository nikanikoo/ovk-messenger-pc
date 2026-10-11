"""Make an experimental Intel Mac bundle using the matched 2020 VK runtime.

The bundled Electron 3.1 runtime and its native modules come from the same DMG.
OpenVK's own application files replace VK Messenger's application files.
"""

import argparse
import hashlib
import io
import json
import plistlib
import shutil
import subprocess
import tarfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MAC_ROOT = "VK Messenger\\VK Messenger.app"
SOURCE_MODULES = {
    "0f8e273eea4548333d8624cca9dfdc81.node": "586fd81afed43db0fce300ffe514296a.node",  # vkext_flex
    "63f5da0a611e33b4062e0f4d3f55fece.node": "db472fdea7881252eefb4ccdf79505e5.node",  # cld
    "977161663b9dbd9aecc1a0b55c331c52.node": "2926efdbf8e217e8285310f2d2cf8545.node",  # spellchecker
    "d491abcfdbdbdc5687428004350f6b37.node": "3d8ad325c83a4acf2f0e28f58bd8a2e8.node",  # keyboard layout
}


def archive_entries(seven_zip, dmg):
    listing = subprocess.run(
        [str(seven_zip), "l", "-slt", str(dmg)],
        capture_output=True, text=True, encoding="utf-8", errors="replace", check=False,
    )
    if "Type = Dmg" not in listing.stdout:
        raise RuntimeError(f"Cannot read DMG: {dmg}\n{listing.stderr}")
    result = {}
    for block in listing.stdout.split("\n\n"):
        fields = dict(line.split(" = ", 1) for line in block.splitlines() if " = " in line)
        name = fields.get("Path", "")
        if name.startswith(MAC_ROOT + "\\") and "Mode" in fields:
            result[name[len(MAC_ROOT) + 1:].replace("\\", "/")] = (name, fields["Mode"])
    return result


def verify_macho(path):
    header = path.read_bytes()[:8]
    if header[:4] != bytes.fromhex("cffaedfe") or int.from_bytes(header[4:8], "little") != 0x01000007:
        raise RuntimeError(f"Not an Intel 64-bit Mach-O binary: {path}")


def prepare_app(source):
    package = json.loads((source / "Contents/Resources/app/package.json").read_text())
    if package["version"] != "5.0.1":
        raise RuntimeError(f"Expected VK Messenger 5.0.1, found {package['version']}")
    sqlite = source / "Contents/Resources/app/node_modules/sqlite3"
    binding = sqlite / "lib/binding/electron-v3.1-darwin-x64/node_sqlite3.node"
    verify_macho(binding)

    stage = ROOT / ".stage/darwin-x64-v3"
    if not stage.resolve().is_relative_to(ROOT.resolve()):
        raise RuntimeError("Unsafe staging directory")
    if stage.exists():
        shutil.rmtree(stage)
    shutil.copytree(ROOT / "app", stage)
    for target, original in SOURCE_MODULES.items():
        native = source / "Contents/Resources/app/dist" / original
        verify_macho(native)
        shutil.copy2(native, stage / "dist" / target)

    shutil.rmtree(stage / "node_modules/sqlite3")
    shutil.copytree(sqlite, stage / "node_modules/sqlite3")
    for name in ("winutils", "windows-notification-state", "windows-quiet-hours"):
        target = stage / "node_modules" / name
        if target.exists():
            shutil.rmtree(target)
    for name in ("windows-notification-state", "windows-quiet-hours"):
        shutil.copytree(ROOT / "native/linux-x64/node_modules" / name, stage / "node_modules" / name)
    return stage


def archive(seven_zip, dmg, source, stage, entries):
    output = ROOT / "release/OpenVK-darwin-x64-experimental.tar.gz"
    output.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    with tarfile.open(output, "w:gz") as tar:
        for relative, (original, mode) in entries.items():
            if relative.startswith("Contents/Resources/app/") or relative == "Contents/Resources/app":
                continue
            if "_CodeSignature" in relative.split("/") or relative.endswith("/CodeResources"):
                continue
            destination = "OpenVK.app/" + relative
            source_file = source / relative
            if mode.startswith("l"):
                target = subprocess.run(
                    [str(seven_zip), "x", "-so", str(dmg), original],
                    capture_output=True, check=True,
                ).stdout.decode("utf-8").strip("\x00\r\n")
                info = tarfile.TarInfo(destination)
                info.type = tarfile.SYMTYPE
                info.linkname = target
                info.mode = 0o777
                tar.addfile(info)
                count += 1
            elif mode.startswith("d"):
                continue
            elif source_file.is_file():
                data = source_file.read_bytes()
                if relative == "Contents/Info.plist":
                    info_plist = plistlib.loads(data)
                    info_plist["CFBundleName"] = "OpenVK"
                    info_plist["CFBundleDisplayName"] = "OpenVK"
                    info_plist["CFBundleIdentifier"] = "ru.openvk.messenger.experimental"
                    info_plist["CFBundleShortVersionString"] = "26.1"
                    data = plistlib.dumps(info_plist)
                info = tarfile.TarInfo(destination)
                info.size = len(data)
                info.mode = 0o755 if "x" in mode else 0o644
                tar.addfile(info, io.BytesIO(data))
                count += 1
        for file in sorted(stage.rglob("*")):
            if not file.is_file():
                continue
            info = tarfile.TarInfo("OpenVK.app/Contents/Resources/app/" + file.relative_to(stage).as_posix())
            info.size = file.stat().st_size
            info.mode = 0o644
            with file.open("rb") as stream:
                tar.addfile(info, stream)
            count += 1
    print(f"Created {output} with {count} files and links")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dmg", type=Path, required=True)
    parser.add_argument("--7z", dest="seven_zip", type=Path, required=True)
    args = parser.parse_args()
    dmg = args.dmg.resolve()
    seven_zip = args.seven_zip.resolve()
    digest = hashlib.sha256(dmg.read_bytes()).hexdigest()[:12]
    extracted = ROOT / ".tools" / f"mac-{digest}"
    source = extracted / "VK Messenger/VK Messenger.app"
    if not (source / "Contents/Resources/app/package.json").is_file():
        extracted.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            [str(seven_zip), "x", str(dmg), f"-o{extracted}", "-y"],
            capture_output=True, check=False,
        )
    if not (source / "Contents/Resources/app/package.json").is_file():
        raise RuntimeError("Could not extract the Mac app from DMG")
    entries = archive_entries(seven_zip, dmg)
    stage = prepare_app(source)
    archive(seven_zip, dmg, source, stage, entries)


if __name__ == "__main__":
    main()
