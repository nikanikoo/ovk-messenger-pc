'use strict'

// Replacement for the unavailable mac-notifications package. Electron 1.8.6
// already supports click and inline reply notifications on macOS.
const { Notification, nativeImage } = require('electron')
const path = require('path')

let current = null
let callback = null

function iconFrom(image) {
  if (!image || typeof image !== 'string') return undefined
  if (image.startsWith('data:')) return nativeImage.createFromDataURL(image)
  return image
}

module.exports = {
  initializeCallback(fn) {
    callback = fn
  },

  show(data) {
    this.hide()
    const notification = new Notification({
      title: String(data.title || ''),
      body: String(data.text || ''),
      subtitle: String(data.subtitle || ''),
      icon: iconFrom(data.image) || nativeImage.createFromPath(path.join(__dirname, '../../icon256.png')),
      hasReply: Boolean(data.hasReplyButton),
      silent: Boolean(data.silent)
    })
    notification.on('click', () => {
      if (callback) callback(data, 'active')
    })
    notification.on('reply', (event, text) => {
      if (callback) callback(data, 'reply', text)
    })
    notification.on('failed', (event, error) => {
      console.error('[mac-notifications] Failed to show notification:', error)
    })
    notification.on('close', () => {
      if (current === notification) current = null
    })
    current = notification
    notification.show()
  },

  hide() {
    if (current) {
      current.close()
      current = null
    }
  }
}
