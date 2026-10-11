'use strict'

Array.prototype.flatMap = function(lambda) {
  return Array.prototype.concat.apply([], this.map(lambda))
}
Array.prototype.pushOnce = function(value) {
  if (!this.includes(value)) {
    this.push(value)
  }
}
Array.prototype.removeOnce = function(value) {
  let index = this.indexOf(value)
  if (index != -1) {
    this.splice(index, 1)
  }
}
RegExp.escape = function(s) {
  return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
}

function padSeconds(n) {
  return n < 10 ? '0'+n : n
}

function parse(args) {
  let date = new Date()
  let msgs = ['<'+date.getHours()+':'+date.getMinutes()+':'+padSeconds(date.getSeconds())+'.'+(date % 1000)+'>'], i, tmp
  for (i = 0; i < args.length; i++) {
    if (args[i] instanceof Error) tmp = [args[i], args[i].stack]
    else tmp = args[i]
    msgs.push(tmp)
  }
  return msgs
}

function log() {
  if (global.verboseLogsDisabled) return
  console.log.apply(console, parse(arguments))
}
function loge() {
  console.error.apply(console, parse(arguments))
}
function logw() {
  console.warn.apply(console, parse(arguments))
}
function logi() {
  console.info.apply(console, parse(arguments))
}
function logdeprecated() {
  let args = Array.from(arguments)
  let st = stackTrace(true, 1)
  args.unshift('DEPRECATED')
  args.push(st)
  console.warn.apply(console, parse(args))
}
function logd(...args) {
  // @ifdef DEBUG
  log(...args)
  // @endif
}

const logFunctions = {
  'log': log,
  'loge': loge,
  'logw': logw,
  'logi': logi,
  'logd': logd,
  'logdeprecated': logdeprecated,
}
for (let name in logFunctions) {
  let f = logFunctions[name]
  if (process.type == 'renderer') {
    window[name] = f
  } else {
    global[name] = f
  }
}

module.exports = {}
