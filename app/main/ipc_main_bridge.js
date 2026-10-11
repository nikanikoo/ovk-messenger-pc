'use strict'

const { createCallablePromise } = require('./util')
const ipc = require('electron').ipcMain

const CALL = 0
const REPLY = 1

class IPCMainBridge {
  constructor(key) {
    this._userListener = null
    this._counter = 0
    this._promises = {}
    this._win = null

    this._key = 'ipc_main_bridge'
    if (key) {
      this._key += '_' + key
    }

    this._listener = this._listener.bind(this)

    ipc.on(this._key, this._listener)
  }

  destroy() {
    ipc.removeListener(this._key, this._listener)
    this._win = null
    this._counter = 0
    this._promises = {}
  }

  setWindow(win) {
    this._win = win
  }

  unsetWindow() {
    this._win = null
  }

  call(payload) {
    let num = this._nextNumber()
    this._promises[num] = createCallablePromise(() => {
      this._abortCall(num)
    })
    this._dispatch(num, payload)
    return this._promises[num]
  }

  dispatch(payload) {
    this._dispatch(this._nextNumber(), payload)
  }

  listen(listener) {
    this._userListener = listener
  }

  _listener(event, message) {
    if (message[0] == CALL) {
      this._userListener && this._userListener(message[2], (payload) => {
        this._reply(message[1], payload, event.sender)
      })
    }
    else if (message[0] == REPLY) {
      let num = message[1]
      if (this._promises[num]) {
        this._promises[num].resolve(message[2])
        delete this._promises[num]
      }
    }
  }

  _dispatch(num, payload) {
    let packet = [CALL, num, payload]
    try {
      this._win.webContents.send(this._key, packet)
    } catch (e) {
      loge('[IPCMainBridge _dispatch]', e)
    }
  }

  _reply(num, payload, sender) {
    let packet = [REPLY, num, payload]
    try {
      sender.send(this._key, packet)
    } catch (e) {
      loge('[IPCMainBridge _reply]', e)
    }
  }

  _nextNumber() {
    ++this._counter
    if (this._counter > 65536) {
      this._counter = 0
    }
    return this._counter
  }

  _abortCall(num) {
    if (this._promises[num]) {
      delete this._promises[num]
    }
  }
}

module.exports = IPCMainBridge
