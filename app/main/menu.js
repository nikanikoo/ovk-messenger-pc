const { app, Menu, BrowserWindow } = require('electron')
const { isDebug, isDev, getLangpack } = require('./util')
const package_json = require('../package.json')
const win = require('./win')
const { isUnity } = require('./linux')

let menu = null // menu template
let appMenu = null // actual Menu object
let lastWindowsDesignChecked = false

let lang = null

const SEPARATOR = { type: 'separator' }
const APP_NAME = 'OpenVK Messenger'

function getPreferencesItemTemplate(inAuth) {
  let item = {
    label: lang.menu_preferences,
    click() {
      win.send('preferences')
    }
  }
  if (process.platform == 'darwin') {
    item.accelerator = 'Command+,'
  }
  return item
}

function getAboutItemTemplate(inAuth) {
  let aboutItem = {
    label: lang.menu_about + ' ' + APP_NAME
  }
  if (inAuth && process.platform == 'darwin') {
    aboutItem.role = 'about'
  } else {
    aboutItem.click = function() {
      win.send('about')
    }
  }
  return aboutItem
}

function need() {
  return process.platform == 'darwin' || (process.platform == 'linux' && isUnity() && !process.env.VK_NO_MENU)
}

function setup(inAuth = true) {
  menu = []

  let mainWindow = win.getWindow()
  let mEdit = {}, mView = {}, mWindow = {}, mHelp = {}, mDebug = {}, mFile = {}

  lang = getLangpack()

  if (process.platform == 'linux') {
    mFile = {
      label: lang.menu_file,
      submenu: [
        {
          enabled: !inAuth,
          label: lang.menu_logout,
          click() {
            win.send('logout')
          }
        },
        {
          label: lang.menu_quit,
          click() {
            mainWindow.forceClose = true
            mainWindow.close()
          }
        }
      ]
    }
    menu.push(mFile)
  }

  mEdit = {
    label: lang.menu_edit,
    submenu: [{
        label: lang.menu_undo,
        accelerator: 'CmdOrCtrl+Z',
        role: 'undo'
      }, {
        label: lang.menu_redo,
        accelerator: 'Shift+CmdOrCtrl+Z',
        role: 'redo'
      },
      SEPARATOR,
      {
        label: lang.menu_cut,
        accelerator: 'CmdOrCtrl+X',
        role: 'cut'
      }, {
        label: lang.menu_copy,
        accelerator: 'CmdOrCtrl+C',
        role: 'copy'
      }, {
        label: lang.menu_paste,
        accelerator: 'CmdOrCtrl+V',
        role: 'paste'
      }, {
        label: lang.menu_select_all,
        accelerator: 'CmdOrCtrl+A',
        role: 'selectall'
      }]
  }
  if (process.platform == 'linux') {
    mEdit.submenu.push(
      SEPARATOR,
      getPreferencesItemTemplate(inAuth)
    )
  }
  menu.push(mEdit)

  if (process.platform == 'darwin' || isDev()) {
    mView = {
      label: lang.menu_view,
      submenu: []
    }

    if (process.platform == 'darwin' && process.env.HOT) {
      mView.submenu.push({
        label: 'Windows Design',
        type: 'checkbox',
        checked: lastWindowsDesignChecked,
        click(item, focusedWindow) {
          win.send('windows_design', item.checked)
        }
      }, SEPARATOR)
    }

    mView.submenu.push({
      label: lang.menu_toggle_fs,
      accelerator: process.platform == 'darwin' ? 'Ctrl+Command+F' : 'F11',
      click(item, focusedWindow) {
        if (focusedWindow)
          focusedWindow.setFullScreen(!focusedWindow.isFullScreen())
      }
    })

    if (isDebug()) {
      mView.submenu.push({
        label: 'Toggle Developer Tools',
        accelerator: process.platform == 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
        click(item, focusedWindow) {
          if (focusedWindow)
            focusedWindow.toggleDevTools()
        }
      })
    }
    if (isDev()) {
      mView.submenu.push({
        label: 'Reload',
        accelerator: 'CmdOrCtrl+R',
        click(item, focusedWindow) {
          if (focusedWindow)
            focusedWindow.reload()
        }
      })
    }

    menu.push(mView)
  }

  if (isDev()) {
    mDebug = {
      label: 'Debug',
      submenu: [{
          label: 'Test Captcha',
          click() {
            win.send('debug', 'test_captcha')
          }
        }, {
          label: 'Test API Flood',
          click() {
            win.send('debug', 'test_api_flood')
          }
        }, {
          label: 'Test Validation',
          click() {
            win.send('debug', 'test_validation')
          }
        }, {
          label: 'Test Command 1',
          click() {
            win.send('debug', 'test1')
          }
        }, {
          label: 'Test Command 2',
          click() {
            win.send('debug', 'test2')
          }
        }]
    }
    menu.push(mDebug)
  }

  // Window
  if (process.platform == 'darwin') {
    mWindow = {
      label: lang.menu_window,
      role: 'window',
      submenu: [
        {
          label: lang.menu_minimize,
          accelerator: 'CmdOrCtrl+M',
          role: 'minimize'
        },
        {
          label: lang.menu_close,
          role: 'close',
          //accelerator: 'CmdOrCtrl+W',
          click() {
            let focusedWin = BrowserWindow.getFocusedWindow()
            if (!focusedWin) {
              return
            }
            if (focusedWin !== mainWindow) {
              return focusedWin.close()
            }

            let closeFunc = function() {
              mainWindow.close()
              mainWindow.removeListener('leave-full-screen', closeFunc)
            }

            if (mainWindow.isFullScreen()) {
              mainWindow.setFullScreen(false)
              mainWindow.on('leave-full-screen', closeFunc)
            } else {
              closeFunc()
            }
          }
        },
        //{
        //  role: 'zoom'
        //},
        SEPARATOR,
        {
          label: lang.menu_bring_all_to_front,
          //role: 'front',
          click() {
            if (mainWindow) {
              mainWindow.show()
              mainWindow.focus()
            }
          }
        }
      ]
    }
    menu.push(mWindow)
  }

  // Help
  mHelp = {
    label: lang.menu_help,
    role: 'help',
    submenu: [
      {
        label: lang.menu_learn_more,
        click() { require('electron').shell.openExternal(package_json.homepage) }
      }
    ]
  }
  if (process.platform == 'linux') {
    mHelp.submenu.unshift(getAboutItemTemplate(inAuth))
  }
  menu.push(mHelp)

  if (process.platform == 'darwin') {
    let appMenuItems = []
    appMenuItems.push(getAboutItemTemplate(inAuth))
    appMenuItems.push(SEPARATOR)
    appMenuItems.push(getPreferencesItemTemplate(inAuth))

    if (!process.mas) {
      appMenuItems.push(
        {
          label: lang.menu_check_for_updates,
          enabled: !inAuth,
          click() {
            win.send('update', {status: 'check_clicked'})
          }
        })
    }

    appMenuItems.push(SEPARATOR)

    appMenuItems.push(
      {
        label: lang.menu_services,
        role: 'services',
        submenu: []
      })
    appMenuItems.push(SEPARATOR)

    appMenuItems.push(
      {
        label: lang.menu_hide + ' ' + APP_NAME,
        accelerator: 'Command+H',
        role: 'hide'
      })
    appMenuItems.push(
      {
        label: lang.menu_hide_others,
        accelerator: 'Command+Shift+H',
        role: 'hideothers'
      })
    appMenuItems.push(
      {
        label: lang.menu_show_all,
        role: 'unhide'
      })
    appMenuItems.push(SEPARATOR)

    appMenuItems.push(
      {
        label: lang.menu_quit,
        accelerator: 'Command+Q',
        click() { app.quit() }
      })

    menu.unshift({
      label: APP_NAME,
      submenu: appMenuItems
    })
  }

  appMenu = Menu.buildFromTemplate(menu)
  Menu.setApplicationMenu(appMenu)
}

function setWindowsDesignItemChecked(checked) {
  if (!process.env.HOT) return
  appMenu.items[2].submenu.items[2].checked = checked
  lastWindowsDesignChecked = checked
}


module.exports = {
  need,
  setup,

  /**
   * Rebuild and reset app menu
   * @param {Boolean} inAuth
   */
  reset(inAuth = false) {
    if (!need()) return
    setup(inAuth)
  },

  get() { return appMenu }
}
if (process.env.HOT) {
  module.exports.setWindowsDesignItemChecked = setWindowsDesignItemChecked
}
