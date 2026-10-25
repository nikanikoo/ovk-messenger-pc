<div align="center">
  <img src="assets/logo256.png" width="128" height="128" alt="OpenVK Messenger">
  <h1>OpenVK Messenger</h1>
  <p><b>Клиент для обмена сообщениями OpenVK.</b></p>
  <div>
    <a href="https://www.microsoft.com/windows"><img src="https://img.shields.io/badge/Windows-x64%20%7C%20x86-0078D4.svg?style=flat-square&logo=windows" alt="Windows x64 и x86"></a>
    <a href="https://www.linux.org/"><img src="https://img.shields.io/badge/Linux-x64-FCC624.svg?style=flat-square&logo=linux&logoColor=black" alt="Linux x64"></a>
    <a href="https://www.apple.com/macos/"><img src="https://img.shields.io/badge/macOS-Intel%20x64-000000.svg?style=flat-square&logo=apple" alt="macOS Intel x64"></a>
    <a href="https://github.com/nikanikoo/ovk-messenger-pc/releases"><img src="https://img.shields.io/github/v/release/nikanikoo/ovk-messenger-pc?style=flat-square&color=blue" alt="Последний релиз"></a>
    <a href="https://github.com/nikanikoo/ovk-messenger-pc/issues"><img src="https://img.shields.io/github/issues/nikanikoo/ovk-messenger-pc?style=flat-square&color=orange" alt="Проблемы"></a>
  </div>
</div>

---

[English](README.md)

**OpenVK Messenger** — неофициальный клиент OpenVK на базе VK Messenger 3.9.0.

> [!WARNING]
> Это независимый фанатский проект. Он не связан с VK или ООО «ВКонтакте», не одобрен ими и не является их официальным продуктом.

## 📥 Скачать

| Источник | Статус | Ссылка |
| :--- | :---: | :--- |
| **GitHub Releases** | 🟢 Доступно | [Скачать последнюю версию](https://github.com/nikanikoo/ovk-messenger-pc/releases/latest) |
| **Telegram** | 🟢 Доступно | [Скачать из Telegram-канала](https://t.me/openvk_flux) |

## 📦 Установка клиента

1. Откройте доступный источник и скачайте архив для своей системы.
2. Распакуйте архив.
3. Запустите клиент:
   - **Windows:** откройте `ovk.exe` в распакованной папке.
   - **Linux:** откройте терминал в распакованной папке и выполните `./ovk`.
   - **macOS:** перенесите `OpenVK Messenger.app` в папку «Программы» и откройте приложение.

## 💻 Платформы

| Платформа | Цель сборки | Примечания |
| :--- | :--- | :--- |
| Windows x64 | `win32-x64` | Electron включён в проект |
| Windows x86 | `win32-ia32` | Electron и нативные модули включены в проект |
| Linux x64 | `linux-x64` | Переносимый архив; системные библиотеки зависят от дистрибутива |
| macOS Intel x64 | `darwin-x64` | Приложение `OpenVK Messenger.app` в ZIP-архиве |

## 🖥 Системные требования

- **Процессор:** x86 или x64.
- **Память:** рекомендуется 4 ГБ ОЗУ.
- **Место на диске:** не менее 300 МБ.
- **Windows:** Windows 7+ (64/32 битная)
- **Linux:** 64-битный дистрибутив.
- **macOS:** macOS 10.9+ (Intel x64).

## 🛠 Сборка

### Windows и Linux

Установите Node.js, откройте терминал в каталоге проекта и выполните команды для нужной платформы:

Для сборки нужна **Node.js 22.12.0 или новее**.

```sh
npm run check:win       # Проверить Windows x64
npm run build:win       # Собрать Windows x64

npm run check:win32     # Проверить Windows x86
npm run build:win32     # Собрать Windows x86

npm run check:arch      # Проверить Linux x64
npm run build:linux     # Собрать Linux x64
```

Среды Electron и нативные модули для Windows и Linux уже находятся в проекте, поэтому для этих целей Electron не скачивается. Результаты сборки помещаются в `release/`.

### macOS Intel x64

Для сборки нужны Node.js 22.12.0 или новее, Python 3 и доступ к интернету для загрузки сборщика и Electron. Нативные модули для macOS x64 уже включены в проект.

```sh
npm install
npm run check:mac       # Проверить macOS x64
npm run build:mac       # Собрать приложение
```

Для пересборки нативных модулей на Intel Mac установите Xcode Command Line Tools и выполните:

```sh
bash scripts/build-mac-native.sh
```

Этот скрипт загрузит исходники зависимостей, пересоберёт нативные модули для Electron 1.8.6 и соберёт приложение с архивом.

## 🐛 Сообщить о проблеме

О багах и проблемах со сборкой можно сообщить в [GitHub Issues](https://github.com/nikanikoo/ovk-messenger-pc/issues).
