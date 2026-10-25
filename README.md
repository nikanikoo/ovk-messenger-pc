<div align="center">
  <img src="assets/logo256.png" width="128" height="128" alt="OpenVK logo">
  <h1>OpenVK Messenger</h1>
  <p><b>OpenVK messaging client.</b></p>
  <div>
    <a href="https://www.microsoft.com/windows"><img src="https://img.shields.io/badge/Windows-x64%20%7C%20x86-0078D4.svg?style=flat-square&logo=windows" alt="Windows x64 and x86"></a>
    <a href="https://www.linux.org/"><img src="https://img.shields.io/badge/Linux-x64-FCC624.svg?style=flat-square&logo=linux&logoColor=black" alt="Linux x64"></a>
    <a href="https://www.apple.com/macos/"><img src="https://img.shields.io/badge/macOS-Intel%20x64-000000.svg?style=flat-square&logo=apple" alt="macOS Intel x64"></a>
    <a href="https://github.com/nikanikoo/ovk-messenger-pc/releases"><img src="https://img.shields.io/github/v/release/nikanikoo/ovk-messenger-pc?style=flat-square&color=blue" alt="Latest release"></a>
    <a href="https://github.com/nikanikoo/ovk-messenger-pc/issues"><img src="https://img.shields.io/github/issues/nikanikoo/ovk-messenger-pc?style=flat-square&color=orange" alt="Issues"></a>
  </div>
</div>

---

[Русский](README_RU.md)

**OpenVK Messenger** is an unofficial desktop client for OpenVK in based VK Messenger 3.9.0.

> [!WARNING]
> This is an independent fan project. It is not affiliated with, endorsed by, or an official product of VK or VK LLC.

## 📥 Download

| Source | Status | Link |
| :--- | :---: | :--- |
| **GitHub Releases** | 🟢 Available | [Download the latest release](https://github.com/nikanikoo/ovk-messenger-pc/releases/latest) |
| **Telegram** | 🟢 Available | [Telegram channel](https://t.me/openvk_flux) |

## 📦 Install the client

1. Open available source and download the archive.
2. Extract the entire archive to a folder.
3. Start the client:
   - **Windows:** run `ovk.exe` from the extracted folder.
   - **Linux:** open a terminal in the extracted folder and run `./ovk`.
   - **macOS:** move `OpenVK Messenger.app` to Applications and open it.

## 💻 Platforms

| Platform | Build target | Notes |
| :--- | :--- | :--- |
| Windows x64 | `win32-x64` | Bundled Electron runtime |
| Windows x86 | `win32-ia32` | Bundled Electron runtime and native modules |
| Linux x64 | `linux-x64` | Portable archive; system libraries depend on the distribution |
| macOS Intel x64 | `darwin-x64` | `OpenVK Messenger.app` in a ZIP archive |

## 🖥 System requirements

- **CPU:** x86/x64.
- **RAM:** recommended 4 GB.
- **Disk:** >=300 MB.
- **Windows:** Windows 7+ (x64/x86).
- **Linux:** 64-bit.
- **macOS:** macOS 10.9+ (Intel x64).

## 🛠 Build

### Windows and Linux

Install Node.js, open a terminal in the project directory, then run the command for your target:

Use **Node.js 22.12.0 or newer** to build the project.

```sh
npm run check:win       # Windows x64 prerequisites
npm run build:win       # Windows x64

npm run check:win32     # Windows x86 prerequisites
npm run build:win32     # Windows x86

npm run check:arch      # Linux x64 prerequisites
npm run build:linux     # Linux x64
```

The Windows and Linux Electron runtimes and native modules are included in the repository, so these targets do not download Electron. Build output is written to `release/`.

### macOS Intel x64

Requires Node.js 22.12.0 or newer, Python 3 and internet access to download the packager and Electron. Native modules for macOS x64 are included in the repository.

```sh
npm install
npm run check:mac       # macOS x64 prerequisites
npm run build:mac       # Build the application
```
Build output is written to `release/`.

To rebuild native modules on an Intel Mac, install Xcode Command Line Tools and run:

```sh
bash scripts/build-mac-native.sh
```

This script downloads dependency sources, rebuilds native addons for Electron 1.8.6 and packages the application and archive.

## 🐛 Issues

Please report bugs and build problems in [GitHub Issues](https://github.com/nikanikoo/ovk-messenger-pc/issues).
