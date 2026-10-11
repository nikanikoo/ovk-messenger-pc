const {app, BrowserWindow, Menu, nativeImage, globalShortcut} = require('electron')
const path = require('path')
const settings = require('./settings')
const {isDebug, macosAppPath, isWindows7or8, getLangpack, isVKProtocolURI, getParsedArguments} = require('./util')
const {isUnity} = require('./linux')
const package_json = require('../package.json')

const DEFAULT_WIN_W = 970
const DEFAULT_WIN_H = 597
const MIN_WIN_W = 380
const MIN_WIN_H = 480

let mainWindow = null

function registerMainWindowShortcut(shortcut, callback) {
  function reg() {
    var ret = globalShortcut.register(shortcut, callback)
    if (!ret) {
      log('[registerMainWindowShortcut] failed to register ' + shortcut)
    }
  }

  mainWindow.on('blur', function() {
    globalShortcut.unregister(shortcut)
  })

  mainWindow.on('hide', function() {
    globalShortcut.unregister(shortcut)
  })

  mainWindow.on('minimize', function() {
    globalShortcut.unregister(shortcut)
  })

  mainWindow.on('focus', function() {
    reg()
  })

  if (mainWindow.isFocused()) {
    reg()
  }
}

function killAllWindows() {
  for (let win of BrowserWindow.getAllWindows()) {
    if (win && win != mainWindow) {
      try {
        win.removeAllListeners()
        win.webContents.removeAllListeners()
        win.webContents.session.webRequest.onHeadersReceived(null)
      } catch (e) {
        console.error(e)
      }
      win.destroy()
    }
  }
}

function send(...args) {
  if (!mainWindow) {
    return loge('[send] mainWindow is not defined')
  }
  mainWindow.webContents.send.apply(mainWindow.webContents, args)
}

/**
 * @param {Object} bounds
 * @return {Object}
 */
function checkAndFixWindowBounds(bounds) {
  let screen
  try {
    screen = require('electron').screen
  } catch (e) {
    console.error('checkAndFixWindowBounds(): caught', e)
    console.log('checkAndFixWindowBounds(): returning default bounds')
    bounds = {
      width: DEFAULT_WIN_W,
      height: DEFAULT_WIN_H,
      center: true
    }
    return bounds
  }

  let dsp = screen.getPrimaryDisplay()
  let dspBounds = dsp.bounds
  let invalid = false

  if (!bounds.width) {
    bounds.width = DEFAULT_WIN_W
  }
  if (!bounds.height) {
    bounds.height = DEFAULT_WIN_H
  }

  if (!bounds.x) {
    bounds.x = dspBounds.x + Math.round(dspBounds.width/2) - Math.round(bounds.width/2)
  }
  if (!bounds.y) {
    bounds.y = dspBounds.y + Math.round(dspBounds.height/2) - Math.round(bounds.height/2)
  }

  let dspMaxX = dspBounds.x + dspBounds.width
  let dspMaxY = dspBounds.y + dspBounds.height

  let boundsMaxX = bounds.x + bounds.width
  let boundsMaxY = bounds.y + bounds.height

  if (bounds.width > dspBounds.width
      || bounds.height > dspBounds.height
      || bounds.x < dspBounds.x
      || bounds.y < dspBounds.y
      || boundsMaxX > dspMaxX
      || boundsMaxY > dspMaxY
      || bounds.width < MIN_WIN_W
      || bounds.height < MIN_WIN_H) {
    invalid = true
  }

  if (!invalid) {
    return bounds
  }

  if (bounds.width > dspBounds.width) {
    bounds.width = dspBounds.width
  } else if (bounds.width < MIN_WIN_W) {
    bounds.width = MIN_WIN_W
  }

  if (bounds.height > dspBounds.height) {
    bounds.height = dspBounds.height
  } else if (bounds.height < MIN_WIN_H) {
    bounds.height = MIN_WIN_H
  }

  if (bounds.x < dspBounds.x) {
    bounds.x = dspBounds.x
  } else if (boundsMaxX > dspMaxX) {
    bounds.x = dspMaxX - bounds.width
  }
  if (bounds.y < dspBounds.y) {
    bounds.y = dspBounds.y
  } else if (boundsMaxY > dspMaxY) {
    bounds.y = dspMaxY - bounds.height
  }

  return bounds
}

/**
 * @return {Object}
 */
function getWindowParams() {
  let frame = true
  if (process.platform == 'win32') {
    frame = settings.getBool('nativeFrame')
  }

  let argv = getParsedArguments()
  let params = {
    minWidth: MIN_WIN_W,
    minHeight: MIN_WIN_H,
    show: argv.show === true,
    frame,
    title: 'OpenVK Messenger',
    transparent: false,
    fullscreenable: true,
    resizable: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      java: false,
      webgl: false,
      plugins: false,
      textAreasAreResizable: false,
      devTools: isDebug()
    }
  }

  if (process.platform == 'win32') {
    let exeDir = path.dirname(app.getPath('exe'))
    params.icon = path.join(exeDir, 'icon48.png')
  }
  if (process.platform == 'linux') {
    let exeDir = path.dirname(app.getPath('exe'))
    params.icon = path.join(exeDir, 'icon256.png')
  }
  if (process.platform == 'darwin' && !settings.getBool('macFrame')) {
    params.titleBarStyle = 'hidden'
  }

  return params
}

/**
 * @param {Object} opts
 * @return {String}
 */
function getWindowURL(opts) {
  const argv = getParsedArguments()

  opts = Object.assign({ frame: false }, opts)
  let url = 'file://' + path.dirname(__dirname)
  if (process.env.HOT) {
    url += '/app/hot-dev-window.html'
  } else {
    url += '/app/window.html'
  }
  url += '?native_frame=' + (opts.frame ? 1 : 0)
  if (isDebug()) {
    url += '&debug=1'
  }

  if (process.platform == 'darwin' && !opts.macFrame) {
    url += '&mac_frameless=1'
  }
  if (process.platform == 'linux' && isUnity()) {
    url += '&ubuntu=1'
  }
  if (argv['no-focus']) {
    url += '&no_focus=1'
  }
  if (settings.getBool('hardwareAccelerationDisabled')) {
    url += '&accel_disabled=1'
  }
  if (argv['font-family']) {
    url += '&font_family='+encodeURIComponent(argv['font-family'])
  }
  return url
}

function create() {
  // Create window
  let params = getWindowParams()
  let bounds = {
    width: settings.getInt('windowWidth'),
    height: settings.getInt('windowHeight'),
    x: settings.getInt('windowX'),
    y: settings.getInt('windowY')
  }
  params = Object.assign(params, bounds)

  mainWindow = new BrowserWindow(params)

  if (isDebug()) {
    mainWindow.webContents.on('console-message', function(event, level, message, line, sourceId) {
      console.log('[renderer ' + level + '] ' + message + ' (' + sourceId + ':' + line + ')')
    })
  }

  if (settings.getBool('maximized')) {
    mainWindow.maximize()
  }
  if (settings.getBool('fullscreen')) {
    mainWindow.setFullScreen(true)
  }

  let urlParams = {
    frame: params.frame
  }

  if (process.platform == 'darwin') {
    mainWindow.setRepresentedFilename(macosAppPath())
    urlParams.macFrame = params.titleBarStyle != 'hidden'
  }

  mainWindow.loadURL(getWindowURL(urlParams))

  // Load app
  if (isDebug()) {
    mainWindow.openDevTools()
  }

  // Attach event listeners
  mainWindow.on('close', onClose)
  mainWindow.on('closed', function() {
    // Dereference object
    mainWindow = null
  })
  mainWindow.on('devtools-opened', function() {
    send('devtools', true)
  })
  mainWindow.on('devtools-closed', function() {
    send('devtools', false)
  })
  mainWindow.webContents.once('did-finish-load', () => {
    if (!mainWindow.isMaximized() && !mainWindow.isFullScreen()) {
      bounds = checkAndFixWindowBounds(bounds)
      try {
        mainWindow.setBounds(bounds)
      } catch (e) {
        mainWindow.setSize(DEFAULT_WIN_W, DEFAULT_WIN_H)
        mainWindow.center()
      }
    }
  })

  // Devtools shortcut for windows and linux
  if (isDebug() && (process.platform == 'win32' || process.platform == 'linux')) {
    registerMainWindowShortcut('Ctrl+Shift+i', function(e) {
      mainWindow.toggleDevTools()
    })
  }

  if (process.platform == 'linux' || process.platform == 'win32') {
    registerMainWindowShortcut('Ctrl+Q', function(e) {
      mainWindow.forceClose = true
      mainWindow.close()
      app.exit()
    })

    registerMainWindowShortcut('Ctrl+W', function(e) {
      mainWindow.close()
    })

    mainWindow.on('show', function() {
      mainWindow.setMinimumSize(MIN_WIN_W-1, MIN_WIN_H-1)
      mainWindow.setMinimumSize(MIN_WIN_W, MIN_WIN_H)
    })
  }

  return mainWindow
}

function saveBounds() {
  let sizes = mainWindow.getSize()
  let pos = mainWindow.getPosition()
  if (!mainWindow.isFullScreen()) {
    settings.setInt('windowWidth', sizes[0])
    settings.setInt('windowHeight', sizes[1])
    settings.setInt('windowX', pos[0])
    settings.setInt('windowY', pos[1])
  }
  settings.setBool('maximized', mainWindow.isMaximized())
  settings.setBool('fullscreen', mainWindow.isFullScreen())
  settings.save()
}

function onClose(e) {
  if (!mainWindow) {
    return
  }

  let needShowBalloon = process.platform == 'win32'
    && !settings.getBool('trayBalloonDisplayed')

  let reallyClose = mainWindow.forceClose || (!require('./tray').isEnabled() && process.platform != 'darwin')

  if (reallyClose) {
    saveBounds()
    return
  }

  e.preventDefault()

  if (process.platform == 'darwin' && mainWindow.isFullScreen()) {
    let onLeave = function() {
      saveBounds()
      mainWindow.hide()
      mainWindow.removeListener('leave-full-screen', onLeave)
    }
    mainWindow.setFullScreen(false)
    mainWindow.on('leave-full-screen', onLeave)
  } else {
    saveBounds()
    mainWindow.hide()
    if (needShowBalloon) {
      require('./tray').showBalloon()
      settings.setBool('trayBalloonDisplayed', true)
      settings.save()
    }
  }
}

module.exports = {
  create,

  /**
   * Set badge on window icon
   * @param {String} badgeDataURL
   * @param {Number} count
   */
  setOverlayBadge(badgeDataURL, count) {
    count += ''
    let img = badgeDataURL !== null
      ? nativeImage.createFromDataURL(badgeDataURL)
      : null
    mainWindow.setOverlayIcon(img, count)
  },

  killAllWindows,
  getWindow() { return mainWindow },
  send
}
