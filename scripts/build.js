'use strict'

const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '..')
const appSource = path.join(root, 'app')
const stageRoot = path.join(root, '.stage')
const releaseRoot = path.join(root, 'release')
const electronVersion = '1.8.6'
const nativeNames = [
  '0f8e273eea4548333d8624cca9dfdc81.node',
  '63f5da0a611e33b4062e0f4d3f55fece.node',
  '977161663b9dbd9aecc1a0b55c331c52.node',
  'd491abcfdbdbdc5687428004350f6b37.node'
]

function argument(name, fallback) {
  const i = process.argv.indexOf('--' + name)
  return i < 0 ? fallback : process.argv[i + 1]
}

const platform = argument('platform', process.platform)
const arch = argument('arch', process.arch)
const target = platform + '-' + arch
const outputName = argument('output-name', 'OpenVK-' + target)
const checkOnly = process.argv.includes('--check')
const stageOnly = process.argv.includes('--stage-only')

if (!['win32', 'linux', 'darwin'].includes(platform) || !['x64', 'ia32'].includes(arch)) {
  throw new Error('Используйте --platform win32|linux|darwin и --arch x64|ia32')
}
if (platform === 'darwin' && arch !== 'x64') {
  throw new Error('Для macOS в Electron 1.8.6 используется архитектура x64')
}

if (!/^OpenVK-[A-Za-z0-9-]+$/.test(outputName)) throw new Error('Invalid output name')

function need(file) {
  if (!fs.existsSync(file)) throw new Error('Отсутствует: ' + path.relative(root, file))
}

function needNative(file) {
  need(file)
  const binary = fs.readFileSync(file)
  const header = binary.subarray(0, 4)
  const format = platform === 'win32' ? 'MZ' : platform === 'linux' ? 'ELF' : 'Mach-O'
  const correct = platform === 'win32'
    ? header.subarray(0, 2).toString() === 'MZ'
    : platform === 'linux'
      ? header.equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))
      : ['feedface', 'feedfacf', 'cefaedfe', 'cffaedfe'].includes(header.toString('hex'))
  if (!correct) throw new Error(`${path.relative(root, file)}: ожидается формат ${format}`)
  if (platform === 'win32') {
    const pe = binary.readUInt32LE(0x3c)
    const machine = binary.readUInt16LE(pe + 4)
    if (machine !== (arch === 'x64' ? 0x8664 : 0x14c)) {
      throw new Error(`${path.relative(root, file)}: неверная архитектура PE`)
    }
  }
  if (platform === 'linux' && binary.readUInt16LE(18) !== (arch === 'x64' ? 62 : 3)) {
    throw new Error(`${path.relative(root, file)}: неверная архитектура ELF`)
  }
}

function copyTree(source, destination) {
  fs.cpSync(source, destination, { recursive: true, force: true })
}

async function setWindowsExecutableIcon(executable, iconPath) {
  const { NtExecutable, NtExecutableResource } = await import('pe-library')
  const { Data, Resource } = await import('resedit')
  const binary = fs.readFileSync(executable)
  const pe = NtExecutable.from(binary, { ignoreCert: true })
  const resources = NtExecutableResource.from(pe)
  const groups = Resource.IconGroupEntry.fromEntries(resources.entries)
  if (groups.length !== 1) throw new Error('Could not find the executable icon resource')
  const icon = Data.IconFile.from(fs.readFileSync(iconPath))
  Resource.IconGroupEntry.replaceIconsForResource(
    resources.entries, groups[0].id, groups[0].lang, icon.icons.map(item => item.data)
  )
  const versionInfos = Resource.VersionInfo.fromEntries(resources.entries)
  for (const versionInfo of versionInfos) {
    for (const language of versionInfo.getAllLanguagesForStringValues()) {
      versionInfo.setStringValues(language, {
        FileDescription: 'OpenVK Messenger',
        ProductName: 'OpenVK Messenger',
        InternalName: 'ovk.exe',
        OriginalFilename: 'ovk.exe'
      })
    }
    versionInfo.outputToResourceEntries(resources.entries)
  }
  resources.outputResource(pe)
  fs.writeFileSync(executable, Buffer.from(pe.generate()))
}

function checkNative() {
  need(path.join(appSource, 'main.js'))
  need(path.join(appSource, 'package.json'))
  need(path.join(appSource, 'dist', 'main.js'))
  need(path.join(root, 'assets', 'icon48.png'))
  need(path.join(root, 'assets', 'icon256.png'))
  need(path.join(root, 'assets', 'tray.ico'))
  if (target === 'win32-x64') {
    for (const name of nativeNames) needNative(path.join(appSource, 'dist', name))
    needNative(path.join(appSource, 'node_modules', 'sqlite3', 'lib', 'binding', 'electron-v1.8-win32-x64', 'node_sqlite3.node'))
    for (const module of ['winutils', 'windows-notification-state', 'windows-quiet-hours']) {
      need(path.join(appSource, 'node_modules', module))
    }
    return null
  }

  if (target === 'linux-x64') {
    const runtime = path.join(root, 'runtime', target)
    need(path.join(runtime, 'ovk'))
    needNative(path.join(runtime, 'ovk.bin'))
    for (const name of ['libgconf-2.so.4', 'libdbus-glib-1.so.2']) {
      needNative(path.join(runtime, 'lib', name))
    }
    for (const name of ['windows-notification-state', 'windows-quiet-hours']) {
      need(path.join(root, 'native', target, 'node_modules', name, 'index.js'))
    }
  }
  if (target === 'darwin-x64') {
    need(path.join(root, 'assets', 'OpenVK.icns'))
    for (const name of ['windows-notification-state', 'windows-quiet-hours']) {
      need(path.join(root, 'native', target, 'node_modules', name, 'index.js'))
    }
  }

  const overlay = path.join(root, 'native', target)
  for (const name of nativeNames) needNative(path.join(overlay, 'dist', name))
  needNative(path.join(overlay, 'node_modules', 'sqlite3', 'lib', 'binding', `electron-v1.8-${target}`, 'node_sqlite3.node'))
  if (platform === 'win32') {
    for (const [module, name] of [
      ['winutils', 'winutils'],
      ['windows-notification-state', 'notificationstate'],
      ['windows-quiet-hours', 'quiethours']
    ]) {
      needNative(path.join(overlay, 'node_modules', module, 'build', 'Release', name + '.node'))
    }
  }
  return overlay
}

async function main() {
  const overlay = checkNative()
  console.log(`Нативные файлы для ${target}: найдены`)
  if (checkOnly) return

  const stage = path.join(stageRoot, target)
  fs.mkdirSync(stageRoot, { recursive: true })
  fs.rmSync(stage, { recursive: true, force: true })
  copyTree(appSource, stage)

  if (overlay) {
    for (const name of nativeNames) fs.rmSync(path.join(stage, 'dist', name))
    fs.rmSync(path.join(stage, 'node_modules', 'sqlite3', 'lib', 'binding'), { recursive: true, force: true })
    if (platform !== 'win32') {
      for (const module of ['winutils', 'windows-notification-state', 'windows-quiet-hours']) {
        fs.rmSync(path.join(stage, 'node_modules', module), { recursive: true, force: true })
      }
    }
    copyTree(overlay, stage)
    const sqliteJs = path.join(stage, 'node_modules', 'sqlite3', 'lib', 'sqlite3.js')
    const original = fs.readFileSync(sqliteJs, 'utf8')
    const patched = original.replace('electron-v1.8-win32-x64', `electron-v1.8-${target}`)
    if (patched === original) throw new Error('Не удалось исправить путь к sqlite3 для ' + target)
    fs.writeFileSync(sqliteJs, patched)
  }

  const assets = path.join(root, 'assets')
  const extras = platform === 'win32'
    ? ['icon48.png', 'icon256.png', 'tray.ico']
    : platform === 'linux'
      ? ['icon24.png', 'icon256.png']
      : ['trayTemplate.png', 'icon256.png']
  for (const file of extras) need(path.join(assets, file))
  console.log('Подготовлено: ' + path.relative(root, stage))
  if (stageOnly) return

  const localRuntime = path.join(root, 'runtime', target)
  const localExecutable = platform === 'win32' ? 'vk.exe' : platform === 'linux' ? 'ovk' : 'vk'
  if (fs.existsSync(path.join(localRuntime, localExecutable))) {
    const output = path.join(releaseRoot, outputName)
    fs.mkdirSync(releaseRoot, { recursive: true })
    try {
      fs.rmSync(output, { recursive: true, force: true })
    } catch (error) {
      if (!fs.existsSync(output) || !fs.statSync(output).isDirectory() || fs.readdirSync(output).length !== 0) {
        throw error
      }
    }
    copyTree(localRuntime, output)
    if (platform === 'linux') {
      for (const executable of ['vk', 'vk.bin']) {
        const file = path.join(output, executable)
        fs.chmodSync(file, fs.statSync(file).mode | 0o111)
      }
    }
    if (platform === 'win32') {
      const windowsExecutable = path.join(output, localExecutable)
      await setWindowsExecutableIcon(windowsExecutable, path.join(assets, 'tray.ico'))
      fs.renameSync(windowsExecutable, path.join(output, 'ovk.exe'))
    }
    copyTree(stage, path.join(output, 'resources', 'app'))
    if (platform === 'linux') {
      fs.chmodSync(path.join(output, 'ovk'), 0o755)
      fs.chmodSync(path.join(output, 'ovk.bin'), 0o755)
    }
    for (const file of extras) {
      const outputFile = path.join(output, file)
      if (platform === 'linux' || !fs.existsSync(outputFile)) {
        fs.copyFileSync(path.join(assets, file), outputFile)
      }
    }
    console.log('Сборка готова: ' + output)
    return
  }

  let packager
  try { packager = require('@electron/packager').packager } catch (_) {
    throw new Error('Установите сборщик: npm install (в каталоге electron-app)')
  }
  const outputs = await packager({
    dir: stage,
    name: platform === 'darwin' ? 'OpenVK Messenger' : 'OpenVK',
    appBundleId: platform === 'darwin' ? 'com.nikanikoo.openvk' : undefined,
    platform,
    arch,
    electronVersion,
    out: releaseRoot,
    overwrite: true,
    prune: false,
    asar: false,
    executableName: platform === 'win32' || platform === 'linux' ? 'ovk'
      : platform === 'darwin' ? 'OpenVK Messenger' : 'OpenVK',
    icon: platform === 'win32' ? path.join(assets, 'tray.ico')
      : platform === 'darwin' ? path.join(assets, 'OpenVK.icns') : undefined,
    extendInfo: platform === 'darwin' ? {
      CFBundleIconFile: 'OpenVK.icns',
      NSUserNotificationAlertStyle: 'banner'
    } : undefined,
    extraResource: platform === 'darwin' ? extras.map(file => path.join(assets, file)) : [],
    appVersion: require(path.join(stage, 'package.json')).version
  })
  if (platform === 'darwin') {
    const output = path.join(releaseRoot, outputName)
    for (let i = 0; i < outputs.length; i++) {
      if (path.resolve(outputs[i]) !== output) {
        fs.rmSync(output, { recursive: true, force: true })
        fs.renameSync(outputs[i], output)
        outputs[i] = output
      }
    }
  } else {
    for (const output of outputs) {
      for (const file of extras) {
        fs.copyFileSync(path.join(assets, file), path.join(output, file))
      }
    }
  }
  console.log('Сборка готова: ' + outputs.join(', '))
}

main().catch(error => {
  console.error(error.message)
  if (error.cause) {
    console.error('Причина: ' + (error.cause.code ? error.cause.code + ': ' : '') + error.cause.message)
  }
  process.exitCode = 1
})
