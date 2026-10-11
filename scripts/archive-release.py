"""Create portable release archives from the unpacked build folders."""

import argparse
import tarfile
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
RELEASE = ROOT / "release"


def archive(target):
    source = RELEASE / f"OpenVK-{target}"
    if not source.is_dir():
        raise SystemExit(f"Build first: {source}")
    files = sorted(path for path in source.rglob("*") if path.is_file())
    if target.startswith("win32-"):
        output = source.with_suffix(".zip")
        with ZipFile(output, "w", compression=ZIP_DEFLATED, compresslevel=6, allowZip64=True) as zip_file:
            for file in files:
                zip_file.write(file, file.relative_to(RELEASE).as_posix())
    elif target == "linux-x64":
        output = RELEASE / "OpenVK-linux-x64.tar.gz"
        with tarfile.open(output, "w:gz") as tar_file:
            for file in files:
                name = file.relative_to(RELEASE).as_posix()
                info = tar_file.gettarinfo(str(file), arcname=name)
                info.mode = 0o755 if file in (source / "vk", source / "vk.bin") else 0o644
                with file.open("rb") as stream:
                    tar_file.addfile(info, stream)
    else:
        raise SystemExit(f"Unsupported archive target: {target}")
    print(f"{output.name}: {len(files)} files, {output.stat().st_size} bytes")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("target", choices=["win32-x64", "win32-ia32", "linux-x64"])
    archive(parser.parse_args().target)
