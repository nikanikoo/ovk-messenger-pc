'use strict'

const bin = require('./build/Release/winutils.node')

module.exports = {
  escapeShellArg(arg) {
    arg = arg.replace(/["%!]/g, ' ')
    return '"' + arg + '"'
  },

  deelevate: bin.deelevate,
  elevate: bin.elevate,
  getSystem32Path: bin.getSystem32Path,
  isUserAdmin: bin.isUserAdmin
}
