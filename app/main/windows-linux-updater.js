const { app, dialog, BrowserWindow } = require('electron')
const temp = require('temp')
const os = require('os')
const fs = require('fs-extra')
const path = require('path')
const EventEmitter = require('events').EventEmitter
const parseUrl = require('url').parse
const child_process = require('child_process')
const extractZip = require('extract-zip')
const util = require('util')

const NOOP = function() {}

let noAsarValue = false

function asarOff() {
  noAsarValue = process.noAsar
  process.noAsar = true
}

function asarBack() {
  process.noAsar = noAsarValue
}

class Updater extends EventEmitter {
  constructor() {
    super()
    this.feedURL = null
    this.downloadPath = null
    this.downloading = false
    this.updateData = null
    this.unpackDir = null
    this.allowHttp = false
    this.bridge = null
  }

  /**
   * @param {String} url
   */
  setFeedURL(url) {
    this.feedURL = url
  }

  setBridge(bridge) {
    this.bridge = bridge
  }

  quitAndInstall() {
    // override this method
  }

  checkForUpdates() {
    if (this.downloading) {
      _log('downloading in process, skip checking')
      return
    }

    if (!this.feedURL) {
      throw new Error('feedURL is not specified')
    }

    this.bridge.call({
      name: 'check',
      url: this.feedURL
    })
    .then(result => {
      if (result.status != 'update-available') {
        return this.emit('update-not-available')
      }

      // TODO
      // if (!this.allowHttp && parseUrl(data.url).protocol != 'https:') {
      //  throw new Error('update url must be https')
      //}

      this.updateData = result.data
      const platform = process.platform == 'win32'
        ? process.arch == 'x64' ? 'win64' : 'win32'
        : process.platform == 'linux'
          ? process.arch == 'x64' ? 'linux64' : 'linux32'
          : process.platform
      const assets = this.updateData.downloads || this.updateData.assets || {}
      const asset = assets[platform] || assets[process.platform]
      const platformURL = typeof asset == 'string' ? asset : asset && asset.url
      if (platformURL) this.updateData.url = platformURL
      if (!this.updateData.url) {
        throw new Error('Update manifest has no download URL for ' + process.platform + '-' + process.arch)
      }
      this.emit('update-available')
    })
    .then(() => {
      // Download
      this.downloadPath = temp.path({ suffix: process.platform == 'linux' ? '.tar.gz' : '.zip' })
      this.downloading = true
      //_log('downloading ' + this.updateData.url + ' to ' + this.downloadPath)
      return this._download(this.updateData.url, this.downloadPath)
    })
    .then(() => {
      return mkTempDir()
      .then(dir => {
        //_log('unpacking to ' + dir)
        this.unpackDir = dir
        return process.platform == 'linux'
          ? pExtractTarGz(this.downloadPath, dir)
          : pExtractZip(this.downloadPath, dir)
      })
    })
    .then(() => {
      if (process.platform == 'linux') {
        const executable = findExecutable(this.unpackDir, 'ovk') || findExecutable(this.unpackDir, 'vk')
        if (!executable) throw new Error('Linux update archive does not contain ovk or vk')
        this.unpackDir = path.dirname(executable)
      }
      return punlink(this.downloadPath, true)
    })
    .then(() => {
      //_log('an update has been successfully downloaded and unpacked')
      this.emit('update-downloaded', this.updateData)
    })
    .catch(e => {
      this.downloadPath = null
      this.updateData = null
      this.unpackDir = null
      this.downloading = false
      loge('[windows-linux-updater.js]', e)
      this.emit('error', e)
    })
  }

  /**
   * @param {String} src
   * @param {String} dst
   * @return {Promise}
   */
  _download(src, dst) {
    return this.bridge.call({
      name: 'download',
      src,
      dst
    })
    .then(result => {
      if (!result) {
        throw new Error('failed to download file ' + src + ' to ' + dst)
      }
    })
  }
}

function findExecutable(root, executableName, depth = 4) {
  try {
    const candidate = path.join(root, executableName)
    if (fs.statSync(candidate).isFile()) return candidate
  } catch (e) {}

  if (depth <= 0) return null
  let entries
  try {
    entries = fs.readdirSync(root)
  } catch (e) {
    return null
  }

  for (const entry of entries) {
    const child = path.join(root, entry)
    try {
      if (fs.statSync(child).isDirectory()) {
        const found = findExecutable(child, executableName, depth - 1)
        if (found) return found
      }
    } catch (e) {}
  }
  return null
}

class WindowsUpdater extends Updater {
  constructor() {
    super()
    this.exeName = null
  }

  /**
   * @param {String} name
   */
  setExecutableName(name) {
    this.exeName = name
  }

  quitAndInstall() {
    let installDstDir = path.dirname(process.execPath)
    let needToElevate = false
    let isAdmin = require('winutils').isUserAdmin()
    let args = ['--disable-gpu',
      '--ewu-install', installDstDir, this.exeName,
      isAdmin ? 1 : 0,
      process.argv.includes('--disable-gpu') ? 1 : 0, // needToDisableGpu
    ]

    isWritable(path.join(path.dirname(installDstDir), randstr()))
    .then(writable => {
      fileLog.write('WindowsUpdater::quitAndInstall() directory ' + installDstDir + ' is not writable, need to elevate privileges')
      needToElevate = !writable
      args.push(needToElevate ? 1 : 0)
    })
    .then(() => {
      let cmd = findExecutable(this.unpackDir, this.exeName)
      if (!cmd) {
        const message = 'Could not find ' + this.exeName + ' in extracted update at ' + this.unpackDir
        fileLog.write('WindowsUpdater::quitAndInstall(): ' + message)
        dialog.showErrorBox('Update installation failed', message)
        return
      }
      if (needToElevate) {
        runElevated(cmd, args)
      } else {
        run(cmd, args)
      }
      kill()
    })
  }
}

class SelfUpdater extends WindowsUpdater {
  constructor() {
    super()
    this.updateData = {
      "build": 100,
      "name": "Version 1.0.0-fake (100)",
      "notes": "blah-blah",
      "pub_date": "2016-10-16T15:07:03+02:00",
      "size": 50000000,
      "version": "1.0.0"
    }
  }

  checkForUpdates() {
    let srcPath = path.dirname(process.execPath)

    let tempName = temp.path()
    this.unpackDir = tempName

    pcopy(srcPath, tempName)
    .then(() => {
      this.emit('update-downloaded', this.updateData)
    })
    .catch(err => {
      this.updateData = null
      this.unpackDir = null
      loge('[SelfUpdater]', err)
      this.emit('error', err)
    })
  }
}

class LinuxUpdater extends Updater {
  quitAndInstall() {
    let args = [
      '--ewu-install',
      this.unpackDir, // source dir
      process.argv.includes('--disable-gpu') ? 1 : 0, // needToDisableGpu
    ]

    fileLog.write('LinuxUpdater::quitAndInstall() running ' + process.execPath + ' ' + args.join(' '))

    child_process.spawn(process.execPath, args, {
      detached: true,
      stdio: ['ignore', 'ignore', 'ignore']
    }).unref()

    kill()
  }
}

const INSTALLER_PREFIX = '--ewu-'
class Installer extends EventEmitter {
  constructor() {
    super()
    this.copyFailed = false
  }

  process() {
    // override this method
  }

  /**
   * @return {Object}
   *   String task
   *   Array<String> args
   */
  parseArguments() {
    let task = null, args = []
    for (let i = 1; i < process.argv.length; i++) {
      let a = process.argv[i]
      if (!a.startsWith(INSTALLER_PREFIX)) continue

      task = a.substr(INSTALLER_PREFIX.length)
      if (this.taskArgsCount[task] === undefined) continue

      let argsCount = this.taskArgsCount[task]
      if (argsCount) {
        args = process.argv.slice(i+1, i+1+argsCount)
        if (args.length < argsCount) {
          for (let j = 0; j < argsCount - args.length; j++) {
            args.push(null)
          }
        }
      }
      break
    }

    return { task, args }
  }

  launchApp() {
    this.emit('done')
    // override this method
  }
}

class WindowsInstaller extends Installer {
  constructor() {
    super()
    this.sysRoot = require('winutils').getSystem32Path()
    this.taskArgsCount = {
      'install': 5,
      'post-install': 2
    }

    process.on('uncaughtException', (err) => {
      fileLog.write(err)
      kill()
    })
  }

  process() {
    super.process()

    let { task, args } = this.parseArguments()
    if (!task) {
      return false
    }

    fileLog.write('WindowsInstaller::process() argv:', process.argv.join(' '))

    switch (task) {
      case 'install': {
        let [ dst, exeName, wasAdmin, needToBeAdmin, needToDisableGpu ] = args

        // transition from 1.3.0 to 1.4.0
        if (wasAdmin === null) wasAdmin = 0
        if (needToBeAdmin === null) needToBeAdmin = 1
        if (needToDisableGpu === null) needToDisableGpu = 1

        wasAdmin = !!parseInt(wasAdmin, 10)
        needToBeAdmin = !!parseInt(needToBeAdmin, 10)
        needToDisableGpu = !!parseInt(needToDisableGpu, 10)

        let isAdmin = require('winutils').isUserAdmin()
        let src = path.dirname(process.execPath)

        if (!isAdmin && needToBeAdmin) {
          // user refused to elevate privielges
          fileLog.write('WindowsInstaller::install(): user must be an admin and it isn\'t; relaunching the app without continuing')

          alert("Error", "Admin rights are needed to install the update. Restarting.")
          .then(() => this.launchApp(path.join(dst, exeName), src, !wasAdmin && isAdmin, needToDisableGpu))
          return true
        }

        fileLog.write('WindowsInstaller::install() isAdmin:', isAdmin)

        this.copy(src, dst, exeName)
        .then(() => this.clearIconCache())
        .catch(e => {
          fileLog.write(e)
        })
        .then(() => this.launchApp(path.join(dst, exeName), src, !wasAdmin && isAdmin, needToDisableGpu))
        return true
      }

      case 'post-install': {
        let [ dir, copyResult ] = args
        this.copyFailed = parseInt(copyResult, 10) == 0

        asarOff()
        try {
          fs.removeSync(dir)
          fileLog.write('WindowsInstaller::postInstall() done')
        } catch (err) {
          fileLog.write('WindowsInstaller::postInstall() error while deleting ' + dir + ':', err)
        }
        asarBack()
        break
      }
    }
  }

  copy(src, dst, exeName) {
    const maxTries = 45
    function tryToCopy(iter = 0) {
      return pcopy(src, dst)
      .then(() => {
        fileLog.write('WindowsInstaller::copy(): succeeded on iteration ' + iter)
      })
      .catch(err => {
        fileLog.write('WindowsInstaller::copy(): failed on iteration ' + iter, err)
        if (iter < maxTries) {
          return psleep(1000).then(() => tryToCopy(iter+1))
        } else {
          throw err
        }
      })
    }

    return tryToCopy()
    .catch(err => {
      fileLog.write('WindowsInstaller::copy("' + src + '", "' + dst + '") failed:', err)
      this.copyFailed = true
      return alert("Error", "Can't install the update:" + err)
    })
  }

  launchApp(exe, tempDir, needToDeelevate, needToDisableGpu) {
    super.launchApp()
    fileLog.write('WindowsInstaller::launchApp() path:', exe, 'needToDeelevate:', needToDeelevate)

    let success = !this.copyFailed
    let args = ['--ewu-post-install', path.resolve(tempDir), (success ? '1' : '0')]
    if (needToDisableGpu) {
      args.unshift('--disable-gpu')
    }

    if (needToDeelevate) {
      runDeelevated(exe, args)
    } else {
      run(exe, args)
    }

    kill()
  }

  clearIconCache() {
    return pexecute(path.join(this.sysRoot, 'ie4uinit.exe'), ['-ClearIconCache'])
      .then(() => pexecute(path.join(this.sysRoot, 'ie4uinit.exe'), ['-show']))
  }
}

class LinuxInstaller extends Installer {
  constructor() {
    super()
    this.taskArgsCount = {
      'install': 2,
      'post-install': 1
    }
  }

  process(opts = {}) {
    super.process()

    const defaultOpts = {
      afterCopy: NOOP
    }
    opts = Object.assign(defaultOpts, opts)

    let { task, args } = this.parseArguments()
    if (!task) {
      return false
    }

    fileLog.write('LinuxInstaller::process() argv:', process.argv.join(' '))

    switch (task) {
      case 'install': {
        let [ src, needToDisableGpu ] = args
        let dst = path.dirname(process.execPath)

        this.copy(src, dst)
        .then(() => {
          let res
          try {
            res = opts.afterCopy(src)
          } catch (e) {
            fileLog.write(e)
          }

          if (res instanceof Promise) {
            return res.catch(err => {
              fileLog.write(err)
            })
          }
        })
        .then(() => premove(src))
        .then(() => {
          return this.launchApp(needToDisableGpu)
        })
        .catch(e => {
          fileLog.write(e)
          kill()
        })
        return true
      }

      case 'post-install': {
        let copyResult = args[0]
        this.copyFailed = parseInt(copyResult, 10) == 0
        break
      }
    }
  }

  copy(src, dst) {
    return pcopy(src, dst)
    .catch(err => {
      fileLog.write('LinuxInstaller::copy("' + src + '", "' + dst + '") failed:', err)
      this.copyFailed = true
    })
  }

  launchApp(needToDisableGpu) {
    super.launchApp()
    fileLog.write('LinuxInstaller::launchApp()')

    let args = ['--ewu-post-install', (this.copyFailed ? '0' : '1')]
    if (needToDisableGpu) {
      args.unshift('--disable-gpu')
    }

    child_process.spawn(process.execPath, args, {
      detached: true,
      stdio: ['ignore', 'ignore', 'ignore']
    }).unref()

    kill()
  }
}



/**
 * Utils
 */

function pExtractZip(src, dst) {
  return new Promise(function(resolve, reject) {
    asarOff()
    extractZip(src, { dir: dst }, function (err) {
      asarBack()
      !err ? resolve() : reject(err)
    })
  })
}

function pExtractTarGz(src, dst) {
  return new Promise(function(resolve, reject) {
    child_process.execFile('tar', ['-xzf', src, '-C', dst], function(err, stdout, stderr) {
      err ? reject(new Error('Failed to extract update tar.gz: ' + (stderr.trim() || err.message))) : resolve()
    })
  })
}

function pexecute(cmd, args, opts) {
  return new Promise(function(resolve, reject) {
    let child = child_process.spawn(cmd, args, opts)
    let stderr = [], stdout = []
    child.stderr.on('data', function(data) {
      stderr.push(data)
    })
    child.stdout.on('data', function(data) {
      stdout.push(data)
    })
    child.on('exit', function(code) {
      if (code != 0) {
        reject('"' + cmd + '" returned ' + code +
               "\nstdout: " + Buffer.concat(stdout).toString('utf-8') +
               "\nstderr: " + Buffer.concat(stderr).toString('utf-8')
              )
      } else {
        resolve()
      }
    })
  })
}

function mkTempDir() {
  return new Promise(function(resolve, reject) {
    temp.mkdir(null, function(e, path) {
      e ? reject(e) : resolve(path)
    })
  })
}

function punlink(path, ignoreErrors = false) {
  return new Promise(function(resolve, reject) {
    asarOff()
    fs.unlink(path, function(e) {
      asarBack()
      e && !ignoreErrors ? reject(e) : resolve()
    })
  })
}

function pcopy(src, dst, opts = {}) {
  asarOff()
  try {
    fs.copySync(src, dst)
  } catch (e) {
    asarBack()
    return Promise.reject(e)
  }
  asarBack()
  return Promise.resolve()

//  return new Promise(function(resolve, reject) {
//    fs.copy(src, dst, opts, function(err) {
//      asarBack()
//      !err ? resolve() : reject(err)
//    })
//  })
}

function premove(dir) {
  return new Promise(function(resolve, reject) {
    asarOff()
    fs.remove(dir, function(err) {
      asarBack()
      !err ? resolve() : reject(err)
    })
  })
}

function psleep(timeout) {
  return new Promise(function(resolve, reject) {
    setTimeout(function() {
      resolve()
    }, timeout)
  })
}

function isWritable(path) {
  return new Promise(function(resolve, reject) {
    asarOff()
    fs.access(path, fs.W_OK, function(err) {
      asarBack()
      return !err ? resolve(true) : resolve(false)
    })
  })
}

function run(path, args) {
  child_process.spawn(path, args, {
    detached: true,
    stdio: ['ignore', 'ignore', 'ignore']
  }).unref()
}

function runElevated(path, args) {
  if (!require('winutils').elevate(path, args.map(s => require('winutils').escapeShellArg(s+'')).join(' '))) {
    run(path, args)
  }
}

function runDeelevated(path, args) {
  try {
    require('winutils').deelevate(path, args.map(s => require('winutils').escapeShellArg(s+'')).join(' '))
    fileLog.write('[runDeelevated] seems ok')
  } catch (e) {
    fileLog.write('[runDeelevated] fallback to run()', e)
    run(path, args)
  }
}

function _log(...args) {
  args.unshift('<windows-linux-updater.js>')
  console.log.apply(console, args)
}

function randstr() {
  let text = ''
  let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

  for (let i = 0; i < 10; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }

  return text
}

function alert(title, text) {
  return new Promise(function(resolve, reject) {
    try {
      dialog.showMessageBox(null, {
        type: 'error',
        message: title,
        detail: text,
        buttons: ['OK'],
        defaultId: 0,
        noLink: true
      }, function(id) {
        resolve(id)
      })
    } catch (e) {
      reject(e)
    }
  })
}

function kill() {
  fileLog.close(function() {
    app.exit()
  })
}


class FileLog {
  constructor(fileName) {
    this.stream = null
    this.fileName = 'electron-updater-log.txt'
  }

  write(...args) {
    try {
      if (!this.stream) {
        let logpath = path.join(app.getPath('temp'), this.fileName)
        try {
          let stat = fs.statSync(logpath)
          if (stat && stat.size > 1024000) {
            fs.unlinkSync(logpath)
          }
        } catch (e) {}
        this.stream = fs.createWriteStream(logpath, { flags: 'a' })
      }

      let date = new Date()
      args.unshift('<'+date.getHours()+':'+date.getMinutes()+':'+date.getSeconds()+'>')

      this.stream.write(util.format.apply(null, args) + "\n")
    } catch (e) {
      _log(e)
    }
  }

  setFileName(n) {
    this.fileName = n
  }

  close(callback) {
    if (this.stream) {
      this.stream.end(callback)
    } else {
      callback()
    }
  }
}

let updater, installer, fileLog = new FileLog()
switch (process.platform) {
  case 'linux':
    updater = new LinuxUpdater()
    installer = new LinuxInstaller()
    break

  case 'win32':
    updater = new WindowsUpdater()
    installer = new WindowsInstaller()
    break
}

module.exports = {
  updater,
  installer,

  SelfUpdater,

  /**
   * @param {String} s
   */
  setLogFileName(s) {
    fileLog.setFileName(s)
  }
}
