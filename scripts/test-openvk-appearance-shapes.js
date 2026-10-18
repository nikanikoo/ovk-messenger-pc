'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

// Exercise the real preference reader and applier without starting Electron.
const source = fs.readFileSync(path.join(__dirname, '../app/app/lib/openvk-appearance.js'), 'utf8')
  .replace('  if (window.OpenVKThemeReady) start()',
    '  window.shapeTest = { prefs: prefs, apply: applyShapes, save: savePrefs };\n  if (window.OpenVKThemeReady) start()')

function load(saved) {
  const storage = new Map([['openvk.appearance.v1', saved]])
  const classes = new Set()
  const controls = {}
  for (const name of ['avatars', 'badges']) controls[name] = {
    classList: { toggle(name, value) { this[name] = value } },
    setAttribute(name, value) { this[name] = value }
  }
  const window = { lang: {}, addEventListener() {} }
  const document = {
    body: { classList: { toggle(name, value) {
      if (value) classes.add(name)
      else classes.delete(name)
    } } },
    querySelectorAll(selector) {
      return selector === '.openvk-square-avatars-control' ? [controls.avatars] :
        selector === '.openvk-square-badges-control' ? [controls.badges] : []
    }
  }
  vm.runInNewContext(source, { window, document, localStorage: {
    getItem: key => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value)
  } })
  window.shapeTest.apply()
  return { window, storage, classes, controls }
}

for (const saved of ['{}', 'invalid json', '{"squareAvatars":"true","squareBadges":1}']) {
  const result = load(saved)
  assert.strictEqual(result.classes.size, 0, 'Round shapes must remain the default')
}

for (const squareAvatars of [false, true]) {
  for (const squareBadges of [false, true]) {
    const result = load(JSON.stringify({ theme: 'night', accent: '#5181B8' }))
    Object.assign(result.window.shapeTest.prefs, { squareAvatars, squareBadges })
    result.window.shapeTest.apply()
    result.window.shapeTest.save()
    const reloaded = load(result.storage.get('openvk.appearance.v1'))
    for (const current of [result, reloaded]) {
      assert.strictEqual(current.classes.has('openvk-square-avatars'), squareAvatars)
      assert.strictEqual(current.classes.has('openvk-square-badges'), squareBadges)
      assert.strictEqual(current.controls.avatars['aria-checked'], String(squareAvatars))
      assert.strictEqual(current.controls.badges['aria-checked'], String(squareBadges))
      assert.strictEqual(current.window.OpenVKAppearance.getNotificationTheme().squareAvatars, squareAvatars)
      assert.strictEqual(current.window.shapeTest.prefs.theme, 'night')
      assert.strictEqual(current.window.shapeTest.prefs.accent, '#5181B8')
    }
    result.window.shapeTest.prefs.squareBadges = !squareBadges
    result.window.shapeTest.apply()
    assert.strictEqual(result.classes.has('openvk-square-avatars'), squareAvatars)
    assert.strictEqual(result.classes.has('openvk-square-badges'), !squareBadges)
  }
}
console.log('Appearance shapes: defaults, independent toggles, persistence and notifications OK')
