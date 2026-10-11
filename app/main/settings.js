const electron = require('electron')
const app = electron.app
const fs = require('fs')
const path = require('path')
const { isWindows7or8, guid } = require('./util')

const SETTINGS_FILE = path.join(app.getPath('userData'), '/appSettings.json')

let values = {}

function fileExists(file) {
  try {
    fs.statSync(file)
    return true
  } catch (e) {
    return false
  }
}

function getBool(key) {
  let v = values[key]
  return v === 1
}
function setBool(key, value) {
  values[key] = value ? 1 : 0
}

function getInt(key) {
  let v = values[key]
  if (v === true) return 1
  return parseInt(v, 10) || 0
}
function setInt(key, value) {
  values[key] = value
}

function getString(key) {
  return values[key] || ''
}
function setString(key, value) {
  values[key] = value + ''
}

function load() {
  try {
    if (!fileExists(SETTINGS_FILE)) {
      if (isWindows7or8()) {
        setBool('nativeFrame', true)
      }
      return
    }

    let json = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'))
    if (!json || typeof json != 'object') {
      throw new Error('json should be object type')
    }

    values = json

    if (json.nativeFrame === undefined && isWindows7or8()) {
      setBool('nativeFrame', true)
    }

    if (json.guid === undefined) {
      setString('guid', guid())
    }
  } catch (e) {
    loge('failed to read settings:', e)
  }
}

function save() {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(values), 'utf8')
}

load()

module.exports = {
  getInt,
  setInt,

  getBool,
  setBool,

  getString,
  setString,

  save
}
