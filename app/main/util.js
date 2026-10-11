'use strict'

const { app } = require('electron')
const child_process = require("child_process")
const dirname = require('path').dirname
const os = require('os')
const package_json = require('../package.json')
const supportedLocales = ['en', 'ru', 'uk']

const argv = require('minimist')(process.argv.slice(process.argv[0] == 'node' ? 2 : 1))

function getLang() {
  const settings = require('./settings')

  let setting = settings.getString('lang')
  if (setting && supportedLocales.includes(setting)) {
    return setting
  }

  let locale = app.getLocale().substring(0, 2)
  if (locale == 'be') {
    return 'ru'
  }
  if (!supportedLocales.includes(locale)) {
    return supportedLocales[0]
  }
  return locale
}

function isDebug() {
  const settings = require('./settings')
  return ['dev', 'test'].includes(package_json.config.branch)
    || settings.getBool('devtoolsEnabled')
    || argv.debug
}

function isDev() {
  return package_json.config.branch == 'dev'
}

function restart() {
  let child
  if (process.platform == "darwin")  {
    let args = ["-n", "-a",
      process.execPath.match(/^([^\0]+?\.app)\//)[1],
      "--args",
      __dirname]
    log(args.join(' '))
    child = child_process.spawn("open", args, { detached: true })
  } else {
    child = child_process.spawn(process.execPath, [], { detached: true })
  }
  child.unref()
  app.quit()
}

function createCallablePromise(abortCallback) {
  let promise, resolve, reject
  promise = new Promise(function(_resolve, _reject) {
    resolve = _resolve
    reject = _reject
  })
  promise.resolve = function(result) {
    resolve(result)
  }
  promise.reject = function(result) {
    reject(result)
  }
  if (abortCallback) {
    promise.abort = abortCallback
  }
  return promise
}

function macosAppPath() {
  let path = app.getPath('exe')
  path = dirname(dirname(dirname(path)))
  return path
}

function isVKProtocolURI(s) {
  return s.match(/^vk:\/\//)
}

function getLangpack() {
  return require('../app/i18n/' + getLang())
}

function isWindows7or8() {
  return process.platform == 'win32' && os.release().match(/^6\.[123]/)
}

function isWindows7() {
  return process.platform == 'win32' && os.release().startsWith('6.1')
}

/**
 * Returns whether current user is root on Linux
 */
function isRoot() {
  return process.getuid && process.getuid() === 0
}

function S4() {
  return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
}

function guid() {
  return (S4() + S4() + "-" + S4() + "-4" + S4().substr(0,3) + "-" + S4() + "-" + S4() + S4() + S4()).toLowerCase();
}

function userAgent() {
  let platform = os.platform() + '; ' + os.release() + '; ' + os.arch()
  return 'VKDesktopMessenger/' + package_json.version + ' (' + platform + ')'
}

function getParsedArguments() {
  return argv
}

module.exports = {
  isDebug,
  isDev,
  restart,
  createCallablePromise,
  macosAppPath,
  isVKProtocolURI,
  getLangpack,
  getLang,
  isWindows7or8,
  isWindows7,
  isRoot,
  guid,
  userAgent,
  getParsedArguments,
}
