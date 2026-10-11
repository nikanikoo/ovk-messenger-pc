process.on('uncaughtException', function(error) {
  console.error('[main.js] uncaughtException:', error)
})

require('./main/log')

const electron = require('electron')
const {app, shell, clipboard, nativeImage, ipcMain} = electron
const win = require('./main/win')
const {isVKProtocolURI, isRoot, userAgent, getParsedArguments} = require('./main/util')
const menu = require('./main/menu')
const linux = require('./main/linux')
const tray = require('./main/tray')
const settings = require('./main/settings')
const package_json = require('./package.json')
const URL = require('url')

app.setName('OpenVK Messenger')

const AUTO_PROXY_FP = 'sha256/t7pBJxBcILwIJ8jY82pRQT4lh3AzRNP1CerGfnSyo4o='

let TouchBar
if (process.platform == 'darwin') {
  TouchBar = require('electron').TouchBar
}

var macNotifications
if (process.platform == 'darwin') {
  macNotifications = require('./main/mac-notifications')
}

let isCustomDataDir = false
let appReady = false
let urlToOpen = null

function relaunch() {
  app.relaunch()
  let w = win.getWindow()
  if (w) {
    w.forceClose = true
    w.close()
  }
}

function openURLCallback(url) {
  if (!appReady) {
    urlToOpen = url
  } else {
    win.send('open-url', url)
  }
}

function onWindowCrashed() {
  let mainWindow = win.getWindow()
  mainWindow.webContents.removeListener('crashed', onWindowCrashed)
  mainWindow.webContents.removeAllListeners()
  if (process.platform != 'linux') {
    //win.killAllWindows()
    relaunch()
  } else {
    mainWindow.forceClose = true
    mainWindow.close()
  }
}

let trayUpdateTimeout = null

function onWindowHide() {
  tray.updateMenuAsync()
}

function onWindowShow() {
  tray.updateMenuAsync()
}

function onWindowBlur() {
  tray.updateMenuAsync()
}

function onWindowFocus() {
  tray.updateMenuAsync()
}

function setTouchBar(window) {
  const labels = ['1', '2']
  const touchBar = new TouchBar([
    new TouchBar.TouchBarLabel({ label: labels[Math.floor(Math.random()*labels.length)] })
  ])
  window.setTouchBar(touchBar)
}

function relaunchWithDisableGPU() {
  let args = process.argv.slice(1)
  args.push('--disable-gpu')

  app.relaunch({ args })
  app.exit()
}

const argv = getParsedArguments()
if (argv.h || argv.help) {
  console.log('OpenVK Messenger '+package_json.version+' (build '+package_json.build+', branch '+package_json.config.branch+')')
  console.log(`Options:
  -h, --help:          print this help
  -v, --version:       print version
  --disable-gpu:       disable GPU
  --user-data-dir=DIR: application data directory
  --no-focus:          do not focus the window
  --font-family=NAME:  override default font-family
  --show:              show the window immediately after creation
  --debug:             enable dev tools (ctrl+shift+i or cmd+opt+i)`)
  app.exit()
}

if (process.platform == 'linux') {
  if (!argv['disable-gpu']) {
    console.log('Note: if you see a black window, launch the app with --disable-gpu flag')
  }
}

if (argv.v || argv.version) {
  console.log('OpenVK Messenger '+package_json.version+' (build '+package_json.build+', branch '+package_json.config.branch+')')
  app.exit()
}

if (process.platform == 'linux' || process.platform == 'win32') {
  app.commandLine.appendSwitch('disable-smooth-scrolling')
}

if (argv['user-data-dir']) {
  try {
    app.setPath('userData', argv['user-data-dir'])
  } catch (e) {
    loge('ERROR: ' + e.message)
    app.exit()
  }
  isCustomDataDir = true
}

// doesn't work in MAS signed builds
let shouldQuit = !process.mas && !isCustomDataDir && app.makeSingleInstance(function(argv) {
  if (argv.length >= 2 && isVKProtocolURI(argv[1])) {
    openURLCallback(argv[1])
  } else {
    let mainWindow = win.getWindow()
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }
      mainWindow.show()
      mainWindow.focus()
    }
  }
})

if (settings.getBool('hardwareAccelerationDisabled')) {
  app.disableHardwareAcceleration()
}

app.on('window-all-closed', function() {
  app.quit()
})

app.on('activate', function(hasVisibleWindows) {
  let w = win.getWindow()
  if (w) w.show()
})

app.on('before-quit', function() {
  let w = win.getWindow()
  if (!w) {
    return // TODO debug, remove
  }

  w.forceClose = true
  if (process.platform == 'darwin') {
    app.dock.setBadge('')
  }

  try {
    w.webContents.session.flushStorageData()
  } catch (e) {
    loge(e)
  }

  tray.destroy()
})

app.on('accessibility-support-changed', (e, accessibilitySupportEnabled) => {
  log('accessibility-support-changed', accessibilitySupportEnabled)
})

if (shouldQuit) {
  app.exit()
} else {
  app.once('ready', function() {
    // setup update installer for Windows and Linux
    if (process.platform == 'win32' || process.platform == 'linux') {
      const updater = require('./main/windows-linux-updater')
      updater.setLogFileName('vk-update-log.txt')

      let installerOpts = {}
      if (process.platform == 'linux') {
        installerOpts.afterCopy = linux.installerAfterCopyCallback
      }
      if (updater.installer.process(installerOpts)) {
        return
      }
    }

    if (process.platform == 'linux' && package_json.config.custom_install === 1
        && !isRoot()) {
      if (!linux.copyResources()) {
        loge("Failed to copy Linux resources")
      }
    }

    if (process.platform == 'win32') {
      if (!process.windowsStore) {
        app.setAppUserModelId('com.vk.Messenger')
      } else {
        app.setAppUserModelId('com.vk.Messenger')
      }

      if (process.argv.length >= 2 && isVKProtocolURI(process.argv[1])) {
        urlToOpen = process.argv[1]
      }
    }

    // on linux this is declared in .desktop file
    if (process.platform != 'linux') {
      app.setAsDefaultProtocolClient('vk')
    }

    app.on('open-url', function(e, url) {
      if (isVKProtocolURI(url)) {
        openURLCallback(url)
        e.preventDefault()
      }
    })

    // Create main window
    let mainWindow = win.create()
    mainWindow.webContents.on('crashed', onWindowCrashed)

    mainWindow.webContents.on('will-navigate', (e, url) => {
      let curUrl = mainWindow.webContents.getURL()

      log('will-navigate:')
      log('  cur = ' + curUrl)
      log('  new = ' + url + '\n')

      if (url != curUrl) {
        e.preventDefault()
      }
    })

    mainWindow.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
      details.requestHeaders['User-Agent'] = userAgent()
      callback({ cancel: false, requestHeaders: details.requestHeaders })
    })

    mainWindow.on('show', onWindowShow)
    mainWindow.on('hide', onWindowHide)
    mainWindow.on('blur', onWindowBlur)
    mainWindow.on('focus', onWindowFocus)

    // Setup menu
    if (menu.need()) {
      menu.setup(true)
    } else {
      mainWindow.setMenu(null)
    }

    electron.powerMonitor.on('suspend', function() {
      win.send('suspend')
    })

    electron.powerMonitor.on('resume', function() {
      win.send('resume')
    })

    // Touch Bar
//    if (process.platform == 'darwin' && package_json.config.branch == 'dev') {
//      setTouchBar(mainWindow)
//    }

    ipcMain.on('image-to-clipboard', (event, dataURI) => {
      //log('image-to-clipboard')
      let ni = nativeImage.createFromDataURL(dataURI)
      clipboard.writeImage(ni)
      //log('image copied')
    })
  })

  app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    let purl = URL.parse(url)
    if (purl.hostname.match(/vk\.com|userapi\.com|vk\.me|vk-cdn\.net|vkuservideo\.net|vkuservideo\.com|vkuserlive\.com|vkuserlive\.net|vkuseraudio\.com|vkuseraudio\.net/) && certificate.fingerprint == AUTO_PROXY_FP) {
      event.preventDefault()
      callback(true)
    } else {
      callback(false)
    }
  })
}

module.exports = {
  /**
   * @return {Object}
   */
  getPackageJSON() { return package_json },

  /**
   * @param {String} text
   */
  setBadge(text) {
    if (process.platform == 'win32') return
    if (process.platform == 'darwin') {
      if (typeof text != 'string') text += ''
      app.dock.setBadge(text)
    }
    if (process.platform == 'linux') {
      app.setBadgeCount(text)
    }
  },

  /**
   * Inform this process that app is ready
   */
  setReady() {
    appReady = true
    if (urlToOpen) {
      win.send('open-url', urlToOpen)
      urlToOpen = null
    }
  },

  /**
   * @return {Boolean}
   */
  isReady() { return appReady },

  /**
   * @param {Function} activeCallback
   * @param {Function} replyCallback
   */
  macInitNotifications(activeCallback, replyCallback) {
    if (process.platform != 'darwin') return

    macNotifications.initializeCallback(function(notification, type, replyText) {
      if (type == 'reply' && replyCallback) {
        replyCallback(notification, replyText)
      }
      if (type == 'active' && activeCallback) {
        activeCallback(notification)
      }
    })
  },

  /**
   * @param {Object} notification
   */
  macShowNotification(notification) {
    if (process.platform != 'darwin') return
    macNotifications.show(notification)
  },

  macHideNotification() {
    if (process.platform != 'darwin') return
    macNotifications.hide()
  },

  relaunch,

  getProcessExecPath() {
    return process.execPath
  },

  getProcessArgv() {
    return process.argv.slice(1)
  }
}
