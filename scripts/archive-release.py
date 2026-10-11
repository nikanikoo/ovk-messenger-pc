"""Create portable release archives from the unpacked build folders."""

import argparse
import tarfile
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
RELEASE = ROOT / "release"


def archive(target, build_name=None, archive_name=None):
    source = RELEASE / (build_name or f"OpenVK-{target}")
    if not source.is_dir():
        raise SystemExit(f"Build first: {source}")
    files = sorted(path for path in source.rglob("*") if path.is_file())
    archive_root = source.name
    if archive_name:
        archive_root = Path(archive_name).name
        archive_root = archive_root[:-7] if archive_root.endswith(".tar.gz") else archive_root[:-4] if archive_root.endswith(".zip") else archive_root
    if target.startswith("win32-"):
        output = RELEASE / (archive_name or f"{source.name}.zip")
        with ZipFile(output, "w", compression=ZIP_DEFLATED, compresslevel=6, allowZip64=True) as zip_file:
            for file in files:
                zip_file.write(file, (Path(archive_root) / file.relative_to(source)).as_posix())
    elif target == "linux-x64":
        output = RELEASE / (archive_name or f"{source.name}.tar.gz")
        with tarfile.open(output, "w:gz") as tar_file:
            for file in files:
                name = (Path(archive_root) / file.relative_to(source)).as_posix()
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
    parser.add_argument("--build-name", help="Name of the built directory in release/")
    parser.add_argument("--archive-name", help="Output archive name and top-level archive directory")
    args = parser.parse_args()
    archive(args.target, args.build_name, args.archive_name)
