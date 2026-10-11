# Нативные модули

Для Windows x64 модули находятся в `app/`. Для Windows x86 и Linux x64 совместимые с Electron 1.8.6 бинарники уже импортированы из VK Messenger 3.9.0 в `native/win32-ia32/` и `native/linux-x64/`. Исходники модулей не входят в эти поставки.

Сборщик ожидает четыре файла в `native/<platform>-<arch>/dist/` под именами из собранного кода OpenVK:

| Файл | Модуль | Исходный пакет |
| --- | --- | --- |
| `0f8e273eea4548333d8624cca9dfdc81.node` | `vkext_flex` | [`vk-flex`](https://www.npmjs.com/package/vk-flex) |
| `63f5da0a611e33b4062e0f4d3f55fece.node` | `cld` | [`cld`](https://www.npmjs.com/package/cld) |
| `977161663b9dbd9aecc1a0b55c331c52.node` | `spellchecker` | [`spellchecker`](https://www.npmjs.com/package/spellchecker) |
| `d491abcfdbdbdc5687428004350f6b37.node` | `keyboard_layout_manager` | [`keyboard-layout`](https://www.npmjs.com/package/keyboard-layout) |

Пятый файл — [`sqlite3`](https://www.npmjs.com/package/sqlite3): `native/<platform>-<arch>/node_modules/sqlite3/lib/binding/electron-v1.8-<platform>-<arch>/node_sqlite3.node`. Для Windows x86 дополнительно нужны `winutils`, `windows-notification-state` и `windows-quiet-hours`; они уже лежат в `native/win32-ia32/node_modules/`.

Для macOS Intel заполните те же пять путей с `<platform>-<arch>` = `darwin-x64`. Нативные файлы должны быть собраны для **Electron 1.8.6 x64**, а не для текущей версии Node.js. Для этого подготовлены `macos-build/package.json`, файл фиксации зависимостей и `scripts/build-mac-native.sh`, который устанавливает исходники, компилирует модули и вызывает основной сборщик. Компиляцию и запуск ещё нужно проверить на Mac. Модуль `mac-notifications` больше не нужен: вызовы заменены встроенным API Electron в `app/main/mac-notifications.js`.

В `native/linux-x64/node_modules/` также находятся совместимые реализации `windows-notification-state` и `windows-quiet-hours`. Собранный интерфейс загружает оба пакета и на Linux; они возвращают состояние «уведомления разрешены» и «тихие часы выключены» без Windows API.

После подготовки Mac модулей проверьте `npm run check:mac` и выполните `npm run build:mac`. Для этой платформы, если нет локальной среды в `runtime/darwin-x64/`, сборщик использует `@electron/packager`; установите его командой `npm install` из корня проекта.
