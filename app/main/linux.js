const path = require('path')
const os = require('os')
const { app } = require('electron')
var fs
if (process.platform == 'linux') {
  fs = require('fs-extra')
}

const package_json = require('../package.json')

function shellEscape(s) {
  return '\'' + s.replace(/\'/g, "'\\''") + '\''
}

function getXdgPath(name) {
  let dir = path.join(os.homedir(), '.local', 'share', name)
  if (!fs.existsSync(dir)) {
    fs.mkdirsSync(dir)
  }
  return dir
}

function copyResources() {
  try {
    const appDir = getXdgPath('applications')
    const iconsDir = getXdgPath('icons')

    // vk.png
    if (!fs.existsSync(path.join(iconsDir, 'vk.png'))) {
      fs.copySync(
        path.join(path.dirname(process.execPath), 'icon256.png'),
        path.join(iconsDir, 'vk.png')
      )
    }

    // vk.desktop
    let desktopFilePath = path.join(appDir, package_json.desktopName)

    if (fs.existsSync(desktopFilePath)) {
      let pathMatch = false
      let s = fs.readFileSync(desktopFilePath, { encoding: 'utf-8' })
      for (let line of s.split("\n")) {
        if (line.startsWith('Exec=')) {
          let m = line.match(/^Exec='(.*?)' --/)
          if (m) {
            pathMatch = process.execPath == m[1].replace("\\'", "'")
          }
          break
        }
      }

      if (pathMatch) {
        return true
      }

      fs.unlinkSync(desktopFilePath)
    }

    let lines = [
      '[Desktop Entry]',
      'Encoding=UTF-8',
      'Version=1.0',
      'Type=Application',
      'Categories=Network;',
      'Name=OpenVK Messenger',
      'Icon=vk',
      'Exec=' + shellEscape(process.execPath) + ' --disable-gpu',
      'StartupNotify=false',
      'StartupWMClass=VK',
      'Terminal=false',
      'MimeType=x-scheme-handler/vk;'
    ]

    fs.writeFileSync(desktopFilePath, lines.join("\n"), {
      mode: 0o644
    })
  } catch (e) {
    loge(e)
    return false
  }

  return true
}

function installerAfterCopyCallback(src) {
  return new Promise(function(resolve, reject) {
    try {
      // Copy app icon on update
      let iconSrc = path.join(src, 'icon256.png')
      let iconDst = path.join(getXdgPath('icons'), 'vk.png')
      if (!fs.existsSync(iconSrc)) {
        return resolve()
      }
      if (fs.existsSync(iconDst)) {
        fs.unlinkSync(iconDst)
      }
      fs.copySync(iconSrc, iconDst)
      resolve()
    } catch (e) {
      reject(e)
    }
  })
}

function isUnity() {
  return app.isUnityRunning() && !isKDE() && !((process.env.XDG_CURRENT_DESKTOP || '').match(/gnome/i))
}

function isKDE() {
  return (typeof process.env.DESKTOP_SESSION == 'string' && process.env.DESKTOP_SESSION.indexOf('plasma') != -1)
    || process.env.KDE_FULL_SESSION !== undefined
    || process.env.KDE_SESSION_VERSION !== undefined
}


module.exports = {
  copyResources,
  installerAfterCopyCallback,
  isUnity,
  isKDE
}
