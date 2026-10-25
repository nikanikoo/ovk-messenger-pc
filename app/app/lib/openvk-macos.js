(function () {
  'use strict'
  if (process.platform !== 'darwin') return
  if (new URLSearchParams(location.search).get('mac_frameless') !== '1') return
  document.body.classList.add('openvk-mac-titlebar')
  var bar = document.createElement('div')
  bar.className = 'openvk-mac-titlebar-drag'
  document.body.appendChild(bar)
  var win = require('electron').remote.getCurrentWindow()
  function updateFullscreen() {
    document.body.classList.toggle('openvk-mac-fullscreen', win.isFullScreen())
  }
  win.on('enter-full-screen', updateFullscreen)
  win.on('leave-full-screen', updateFullscreen)
  updateFullscreen()
  window.addEventListener('unload', function () {
    win.removeListener('enter-full-screen', updateFullscreen)
    win.removeListener('leave-full-screen', updateFullscreen)
  })
})()
