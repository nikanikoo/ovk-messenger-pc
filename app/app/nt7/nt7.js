const LS = window.localStorage
const { remote, ipcRenderer } = require('electron')
const curWindow = remote.getCurrentWindow()
const mainWindow = remote.require('./main/win').getWindow()

const HIDE_TIMEOUT = 6000

let lastNotificationData, _hideTimeout, replyActive = false, sendByCtrlEnter = false, readyToShow = false
let notificationLogoSvg

/**
 * Utils
 */
function ge(id) {
  return typeof id == 'string' ? document.getElementById(id) : id
}
function safe(str) {
  return str ? str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;') : ''
}
function hide(el) { ge(el).style.display = 'none' }
function show(el) { ge(el).style.display = 'block' }
function setFocusable(focusable) {
  if (focusable || process.platform == 'win32') {
    curWindow.setFocusable(true)
    curWindow.setSkipTaskbar(true)
  } else {
    curWindow.setFocusable(false)
  }
}
function addClass(el, cl) {
  el = ge(el)
  if (!el) {
    return
  }
  if (el.className === undefined) {
    el.className = ''
  }
  let spl = el.className.split(' '), found = false
  for (let p of spl) {
    if (p == '') continue
    if (p == cl) {
      found = true
      break
    }
  }
  if (!found) {
    el.className += ' ' + cl
  }
}
function removeClass(el, cl) {
  el = ge(el)
  if (!el) {
    return
  }
  if (el.className === undefined) {
    el.className = ''
    return
  }
  let re = new RegExp(' ?' + cl, 'g')
  el.className = el.className.replace(re, '')
}

function remoteLog() {
  let args = Array.from(arguments)
  try {
    mainWindow.webContents.send('remote_log', args)
  } catch (e) {
    console.error('[remoteLog]', e)
  }
}

/**
 * Notifications
 */
function getPendingData() {
  try {
    let s = LS.nt7_pending
    if (!s) return false
    delete LS.nt7_pending
    return JSON.parse(s)
  } catch (e) { return false }
}

function applyAppearance(appearance) {
  if (!appearance) return
  const colors = {
    '--nt-bg': appearance.background,
    '--nt-header-bg': appearance.header,
    '--nt-border': appearance.border,
    '--nt-fg': appearance.foreground,
    '--nt-muted': appearance.muted,
    '--nt-accent': appearance.accent,
    '--nt-input-bg': appearance.input,
    '--nt-reply-bg': appearance.reply
  }
  Object.keys(colors).forEach(function(name) {
    if (colors[name]) document.documentElement.style.setProperty(name, colors[name])
  })
  if (/^#[0-9a-f]{6}$/i.test(appearance.accent || '')) {
    try {
      if (!notificationLogoSvg) {
        const logoPath = require('path').join(remote.app.getAppPath(), 'app', 'nt7', 'logo.svg')
        notificationLogoSvg = require('fs').readFileSync(logoPath, 'utf8')
      }
      const coloredLogo = notificationLogoSvg.replace(/#7e7e7e/ig, appearance.accent)
      document.querySelector('.title').style.backgroundImage = 'url("data:image/svg+xml,' + encodeURIComponent(coloredLogo) + '")'
    } catch (e) {
      remoteLog('NT7 logo recoloring failed:', String(e))
    }
  }
}

function updateNotification(data) {
  applyAppearance(data.appearance)
  ge('nt-name').innerHTML = safe(data.title)
  ge('nt-text').innerHTML = safe(data.text)
  ge('nt-avatar').src = data.image

  lastNotificationData = data.data

  if (!replyActive) {
    updateHideTimeout()
  }
}

function updateHideTimeout() {
  if (replyActive) return
  clearTimeout(_hideTimeout)
  _hideTimeout = setTimeout(onTimeout, HIDE_TIMEOUT)
}

function getMode() {
  return /-reply-content/.test(ge('nt-content').className) ? 'reply' : 'notification'
}

function setMode(mode) {
  if (getMode() == mode) return
  if (mode == 'reply') {
    let ta = ge('nt-reply-ta')
    ta.value = ''
    ta._sendButtonActive = false
    removeClass('nt-reply-send-button', '-active')

    hide('nt-notification-content')
    show('nt-reply-content')

    removeClass('nt-content', '-notification-content')
    addClass('nt-content', '-reply-content')

    setFocusable(true)
    curWindow.focus()
    ta.focus()

    clearTimeout(_hideTimeout)
    _hideTimeout = undefined
    replyActive = true
  }

  else {
    hide('nt-reply-content')
    show('nt-notification-content')

    removeClass('nt-content', '-reply-content')
    addClass('nt-content', '-notification-content')

    setFocusable(false)
    curWindow.blur()
    updateHideTimeout()
    replyActive = false
  }
}

function send(text) {
  setFocusable(false)
  curWindow.hide()
  setFocusable(false)
  setMode('notification')
  mainWindow.webContents.send('nt7', {
    what: 'reply',
    data: lastNotificationData,
    text
  })
}

function onIPCMessage(event, message) {
  if (!message) return
  switch (message.what) {
    case 'notification':
      updateNotification(message.data)
      if (readyToShow) {
        curWindow.setFocusable(false)
        curWindow.showInactive()
        //curWindow.show()
      }
      if (message.position) {
        let { x, y } = message.position
        curWindow.setPosition(x, y)
      }
      break

    case 'settings':
      let data = message.data
      if (data.i18n) {
        ge('nt-reply-ta').setAttribute('placeholder', data.i18n.reply_placeholder)
      }
      if (data.ctrlEnter !== undefined) {
        sendByCtrlEnter = !!data.ctrlEnter
      }
      break

    case 'ready-to-show':
      readyToShow = true
      break

    case 'hide':
      hideWindow()
      break
  }
}

function onTimeout() {
  curWindow.hide()
  setMode('notification')
  _hideTimeout = undefined
  mainWindow.webContents.send('nt7', { what: 'hidden' })
}

function hideWindow() {
  curWindow.hide()
  setMode('notification')
  mainWindow.webContents.send('nt7', { what: 'hidden' })
}

/**
 * init
 */
function init() {
  ipcRenderer.on('nt7', onIPCMessage)

  window.addEventListener('beforeunload', function(e) {
    if (!curWindow.isClosable()) {
      remoteLog('NT7 remote: prevent unloading by e.returnValue')
      e.returnValue = false
      return
    }

    remoteLog('NT7 remote: onbeforeunload, removing ipc listener')
    ipcRenderer.removeListener('nt7', onIPCMessage)
  })

  document.addEventListener('mousemove', function() {
    updateHideTimeout()
  })

  // right click
  document.addEventListener('contextmenu', function() {
    hideWindow()
  })

  ge('nt-notification-content').addEventListener('click', function(e) {
    curWindow.hide()
    mainWindow.webContents.send('nt7', {
      what: 'click',
      data: lastNotificationData
    })
  })
  ge('nt-reply-content').addEventListener('click', function() {
    ge('nt-reply-ta').focus()
  })
  ge('nt-close-button').addEventListener('click', function(e) {
    curWindow.hide()
    setMode('notification')
    mainWindow.webContents.send('nt7', { what: 'hidden' })
  })
  ge('nt-reply-button').addEventListener('click', function(e) {
    setMode('reply')
    e.stopPropagation()
  })
  ge('nt-avatar').ondragstart = function() { return false }
  ge('nt-reply-ta').addEventListener('keydown', function(e) {
    if (e.keyCode == 27) {
      setMode('notification')
      return
    }

    let enterKey = e.keyCode == 13
    let sendPressed = sendByCtrlEnter ? (enterKey && e.ctrlKey) : (enterKey && !e.ctrlKey && !e.shiftKey && !e.altKey)

    if (sendPressed) {
      e.preventDefault()
      send(this.value)
    }
  })
  ge('nt-reply-ta').addEventListener('input', function(e) {
    let empty = this.value.trim() == ''
    if (empty === !this._sendButtonActive) return
    this._sendButtonActive = !empty
    window[empty ? 'removeClass' : 'addClass']('nt-reply-send-button', '-active')
  })
  ge('nt-reply-send-button').addEventListener('click', function(e) {
    send(ge('nt-reply-ta').value)
  })

  let data = getPendingData()
  if (data) {
    updateNotification(data)
  }

  mainWindow.webContents.send('nt7', { what: 'ready' })
}

function onload() {
  readyToShow = true
}
