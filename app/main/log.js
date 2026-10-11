const util = require('util')

function formatNumber(n) {
  return n < 10 ? '0'+n : n
}

function logString(args) {
  let date = new Date()
  let hours = formatNumber(date.getHours())
  let minutes = formatNumber(date.getMinutes())
  let seconds = formatNumber(date.getSeconds())
  let dateMark = util.format(
   '<%s:%s:%s.%s>',
   hours, minutes, seconds, (date % 1000))
  args.unshift(dateMark)
  return args
}

global.log = function(...args) {
  console.log.apply(console, logString(args))
}

global.loge = function(...args) {
  console.error.apply(console, logString(args))
}

global.logw = function(...args) {
  console.warn.apply(console, logString(args))
}

global.logi = function(...args) {
  console.info.apply(console, logString(args))
}
