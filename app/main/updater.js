'use strict'

const FORCE_TEST = false || process.env.UPDATE_FORCE_TEST !== undefined
const TEST_FROM_LOCALHOST = false
const useVKUpdater = process.platform == 'win32' || process.platform == 'linux'

let autoUpdater = null
let vkUpdater = null
let bridge = null
let downloadInProgress = false

if (useVKUpdater) {
  vkUpdater = require('./windows-linux-updater')
  if (FORCE_TEST && false) {
    autoUpdater = new vkUpdater.SelfUpdater()
    autoUpdater.allowHttp = true // TODO updater_worker
  } else {
    autoUpdater = vkUpdater.updater
  }
} else {
  autoUpdater = require('electron').autoUpdater
}

const https = require('https')
const http = require('http')
const URL = require('url')
const settings = require('./settings')
const win = require('./win')
const package_json = require('../package.json')
const tray = require('./tray')
const IPCMainBridge = require('./ipc_main_bridge')

const UPDATE_MANIFEST_URL = 'https://files.nikanikoo.com/openvk-messenger/latest.json'

/**
 * @return {String}
 */
function getPlatform() {
  if (package_json.config.platform) {
    return package_json.config.platform
  }
  if (process.platform == 'darwin') {
    return 'mac'
  }
  if (process.platform == 'win32') {
    return process.arch == 'x64' ? 'win64' : 'win32'
  }
  if (process.platform == 'linux') {
    return process.arch == 'x64' ? 'linux64' : 'linux32'
  }
  return process.platform
}

/**
 * @return {Number}
 */
function getCurrentBuild() {
  if (process.env.UPDATE_CURRENT_BUILD) {
    return parseInt(process.env.UPDATE_CURRENT_BUILD, 10)
  }
  //if (FORCE_TEST) {
  //  return 1
  //}
  return package_json.build
}

/**
 * @return {String}
 */
function getCheckURL() {
  return TEST_FROM_LOCALHOST ? 'http://localhost/latest.json' : UPDATE_MANIFEST_URL
}

function requestJSON(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const parsed = URL.parse(url)
    const transport = parsed.protocol == 'http:' ? http : https
    const request = transport.get(url, { headers: { 'User-Agent': 'OpenVK-Updater' } }, response => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        response.resume()
        if (!response.headers.location || redirects >= 5) {
          return reject(new Error('Invalid or excessive update manifest redirects'))
        }
        const nextURL = URL.resolve(url, response.headers.location)
        return resolve(requestJSON(nextURL, redirects + 1))
      }

      if (response.statusCode != 200) {
        response.resume()
        return reject(new Error('Update manifest returned HTTP ' + response.statusCode))
      }

      let body = ''
      response.setEncoding('utf8')
      response.on('data', chunk => { body += chunk })
      response.on('end', () => {
        try {
          resolve(JSON.parse(body))
        } catch (error) {
          reject(new Error('Invalid update manifest JSON: ' + error.message))
        }
      })
    })
    request.on('error', reject)
  })
}

function getUpdateAsset(manifest) {
  const platform = getPlatform()
  const assets = manifest.downloads || manifest.assets || {}
  const platformAsset = assets[platform] || assets[process.platform]
  if (typeof platformAsset == 'string') return platformAsset
  if (platformAsset && platformAsset.url) return platformAsset.url
  if (manifest.url) return manifest.url

  const version = manifest.version || manifest.tag_name
  if (!version) return null
  const tag = manifest.tag_name || ('v' + String(version).replace(/^v/, ''))
  let filename
  if (process.platform == 'win32') {
    filename = 'OpenVK-win32-' + (process.arch == 'x64' ? 'x64' : 'ia32') + '.zip'
  } else if (process.platform == 'linux') {
    filename = 'OpenVK-linux-' + (process.arch == 'x64' ? 'x64' : 'ia32') + '.zip'
  } else {
    return null
  }
  return 'https://github.com/nikanikoo/ovk-messenger-pc/releases/download/' +
    encodeURIComponent(tag) + '/' + encodeURIComponent(filename)
}

/**
 * @return {Promise} resolves null or update object
 */
function checkForUpdates() {
  // GitHub ZIP installation is implemented by this project only on Windows and Linux.
  if (!useVKUpdater) {
    return Promise.resolve(false)
  }

  const directRequest = () => requestJSON(getCheckURL())
  let manifestPromise
  if (bridge) {
    const workerRequest = bridge.call({ name: 'check', url: getCheckURL() })
      .then(result => {
        if (result && result.status == 'update-available') return result.data
        if (result && result.status == 'update-not-available') return null
        return directRequest()
      })
      .catch(error => {
        return directRequest()
      })
    manifestPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        directRequest().then(resolve, reject)
      }, 10000)
      workerRequest.then(result => {
        clearTimeout(timeout)
        resolve(result)
      }, error => {
        clearTimeout(timeout)
        reject(error)
      })
    })
  } else {
    manifestPromise = directRequest()
  }

  return manifestPromise.then(manifest => {
    if (!manifest) {
      return false
    }

    const build = Number(manifest.build)
    if (!Number.isFinite(build) || build <= getCurrentBuild()) {
      return false
    }

    const url = getUpdateAsset(manifest)
    if (!url) {
      throw new Error('Update manifest has no download URL for ' + getPlatform())
    }

    return Object.assign({}, manifest, {
      build,
      version: manifest.version || manifest.tag_name,
      name: manifest.name || ('Version ' + (manifest.version || manifest.tag_name) + ' (' + build + ')'),
      notes: manifest.notes || manifest.body || '',
      pub_date: manifest.pub_date || manifest.published_at || new Date().toISOString(),
      size: Number(manifest.size) || 0,
      url
    })
  })
}


module.exports = {
  init() {
    if (!package_json.config.updates) {
      return
    }

    if (useVKUpdater && (!process.env.HOT || FORCE_TEST)) {
      autoUpdater.setFeedURL(getCheckURL())
    }

    bridge = new IPCMainBridge('updater_worker')
    bridge.setWindow(win.getWindow())

    bridge.listen((payload, reply) => {
      switch (payload.name) {
      case 'download_progress':
        //log('[bridge] download_progress:', payload.progress)
        autoUpdater.emit('download-progress', payload.progress)
        break
      }
    })

    if (useVKUpdater) {
      autoUpdater.setBridge(bridge)
    }

    autoUpdater.removeAllListeners('checking-for-update')
    autoUpdater.on('checking-for-update', function() {
      //log('main_update.js: checking-for-update')
    })

    autoUpdater.removeAllListeners('update-available')
    autoUpdater.on('update-available', function() {
      log('update: update-available (downloading..)')
    })

    autoUpdater.removeAllListeners('update-not-available')
    autoUpdater.on('update-not-available', function() {
      log('update: update-not-available')
      win.send('update', { status: 'not-available' })
    })

    autoUpdater.removeAllListeners('update-downloaded')
    autoUpdater.on('update-downloaded', function(data) {
      log('update: update-downloaded', data)
      downloadInProgress = false
      win.send('update', { status: 'downloaded' })
    })

    autoUpdater.removeAllListeners('error')
    autoUpdater.on('error', function(error) {
      log('update: update failed', error)
      if (downloadInProgress) {
        downloadInProgress = false
        win.send('update', { status: 'download-error', message: error && error.message })
      } else {
        win.send('update', { status: 'not-available' })
      }
    })

    if (useVKUpdater) {
      if (process.platform == 'win32') {
    autoUpdater.setExecutableName('ovk.exe')
      }

      autoUpdater.removeAllListeners('download-progress')
      autoUpdater.on('download-progress', function(progress) {
        win.send('update', { downloadProgress: progress })
      })
    }
  },

  /**
   * @param {Boolean} byUser
   */
  check(byUser = false) {
    if (!package_json.config.updates) {
      return
    }

    win.send('update', { status: 'checking' })

    checkForUpdates()
    .then(function(update) {
      log('update:', update)
      if (update) {
        win.send('update', { status: 'available', update, byUser })
      } else {
        win.send('update', { status: 'not-available', byUser })
      }
    })
    .catch(function(error) {
      loge('update check failed:', error)
      win.send('update', { status: 'not-available', byUser })
    })
  },

  download() {
    log('downloading update')
    downloadInProgress = true
    autoUpdater.checkForUpdates()
  },

  quitAndInstall() {
    win.getWindow().forceClose = true
    settings.save()
    if (process.platform == 'linux') {
      tray.destroy()
    }
    autoUpdater.quitAndInstall()
  },

  getCheckURL
}
