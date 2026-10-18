'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const bundle = fs.readFileSync(path.join(__dirname, '../app/dist/main.js'), 'utf8')
const listeners = new Set()
const window = {
  OpenVKReplies: { configure() {} },
  addEventListener(name, handler) { listeners.add(handler) },
  removeEventListener(name, handler) { listeners.delete(handler) }
}
const context = { window, module: { exports: {} } }
vm.runInNewContext(bundle.replace('t(t.s = 959)', 't'), context)
const factory = context.module.exports.m.find(factory => factory && factory.toString().includes('key: "maybeAutoPlayGif"'))
assert.ok(factory, 'Native GIF attachment renderer must be present')

function Component(props) {
  this.props = props
  this.refs = { gif_image: { removeAttribute() { delete this.src } } }
}
Component.prototype.setState = function (state, callback) {
  Object.assign(this.state, state)
  if (!this.receivingProps) this.componentDidUpdate()
  if (callback) callback.call(this)
}
const propType = () => propType
const React = { Component, PropTypes: new Proxy({}, { get: () => propType }) }
let disabled = false
const previews = []
const modules = {
  0: React,
  1: { cancelEvent() {} },
  15: {},
  20: { getBool: () => disabled },
  50: { openPhoto: data => previews.push(data) }
}
const controller = context.module.exports.m.find(factory => factory && factory.toString().includes('key: "setGifAutoplay"'))
const setter = controller.toString().match(/key: "setGifAutoplay",\s+value: (function\(e\) \{[\s\S]*?\n        \})/)[1]
let settingsRefreshes = 0
const settingsReceiver = { loadGeneralSettings() { settingsRefreshes++ } }
const setGifAutoplay = vm.runInNewContext('(' + setter + ')', {
  x: { default: { setBool(key, value) {
    assert.strictEqual(key, 'disable_gif_autoplay')
    disabled = value
  } } },
  window: { dispatchEvent(event) { for (const listener of listeners) listener(event) } },
  CustomEvent: function (name, options) { this.type = name; this.detail = options.detail }
})
const moduleObject = { exports: {} }
factory(moduleObject, moduleObject.exports, id => modules[id] || function () {})
const GifAttachment = moduleObject.exports
function doc(id = 1, gif = true) {
  return { url: 'https://example.invalid/' + id + '.gif', getId: () => id, isGif: () => gif,
    isLoaded: () => true, isImageSrcLoaded: () => true,
    toImageObject: () => ({ id }), getAPIObject: () => ({}) }
}
function create(document = doc()) {
  const component = new GifAttachment({ doc: document, docs: [document] })
  component.componentDidMount()
  return component
}
const gif = create()
assert.strictEqual(gif.state.gifState, 'loading', 'GIFs autoplay by default')
assert.strictEqual(gif.refs.gif_image.src, gif.props.doc.url)
gif.onGifLoad()
assert.strictEqual(gif.state.gifState, 'loaded')
gif.onClick({})
assert.strictEqual(gif.state.gifState, 'initial')
assert.strictEqual(gif.refs.gif_image.src, undefined)
gif.componentDidUpdate()
assert.strictEqual(gif.state.gifState, 'initial', 'Rerenders must preserve a manual stop')
gif.receivingProps = true
const replacement = { doc: doc(), docs: [] }
gif.componentWillReceiveProps(replacement)
gif.props = replacement
gif.receivingProps = false
gif.componentDidUpdate()
assert.strictEqual(gif.state.gifState, 'initial', 'Refreshing the same document must preserve a manual stop')
gif.onClick({})
assert.strictEqual(gif.state.gifState, 'loading')
gif.onGifLoad()
setGifAutoplay.call(settingsReceiver, false)
assert.strictEqual(disabled, true)
assert.strictEqual(gif.state.gifState, 'initial', 'Disabling autoplay stops active GIFs')
const stopped = create(doc(2))
assert.strictEqual(stopped.state.gifState, 'initial')
stopped.onClick({})
assert.strictEqual(stopped.state.gifState, 'loading', 'Manual playback works with autoplay disabled')
setGifAutoplay.call(settingsReceiver, true)
assert.strictEqual(disabled, false)
assert.strictEqual(settingsRefreshes, 2)
assert.strictEqual(gif.state.gifState, 'loading')
gif.onGifError()
assert.strictEqual(gif.state.gifState, 'initial')
gif.componentDidUpdate()
assert.strictEqual(gif.state.gifState, 'initial', 'Failed GIFs must not retry forever')
gif.onClick({})
assert.strictEqual(gif.state.gifState, 'loading', 'Clicking allows an explicit retry')
const photo = create(doc(3, false))
assert.strictEqual(photo.state.gifState, 'initial')
photo.onClick({})
assert.strictEqual(previews.length, 1, 'Ordinary images still open in the native viewer')
for (const component of [gif, stopped, photo]) component.componentWillUnmount()
assert.strictEqual(listeners.size, 0)
assert.strictEqual(gif.refs.gif_image.src, undefined)
console.log('Native GIF autoplay: playback, manual stop, settings, refresh, errors and cleanup OK')
