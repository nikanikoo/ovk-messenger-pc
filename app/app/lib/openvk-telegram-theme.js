(function () {
  'use strict'

  function parse(text) {
    var raw = {}
    var pattern = /^\s*([A-Za-z][A-Za-z0-9]*):\s*(#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?|[A-Za-z][A-Za-z0-9]*)\s*;/gm
    var match
    while ((match = pattern.exec(text))) raw[match[1]] = match[2]
    var resolved = {}
    function resolve(name, seen) {
      if (resolved[name]) return resolved[name]
      if (!raw[name] || seen[name]) return null
      seen[name] = true
      var value = raw[name]
      if (value.charAt(0) !== '#') value = resolve(value, seen)
      if (!value) return null
      if (value.length === 9) {
        var alpha = parseInt(value.slice(7), 16) / 255
        value = alpha === 1 ? value.slice(0, 7) : 'rgba(' + [1, 3, 5].map(function (at) { return parseInt(value.slice(at, at + 2), 16) }).join(', ') + ', ' + Number(alpha.toFixed(3)) + ')'
      }
      return (resolved[name] = value)
    }
    Object.keys(raw).forEach(function (name) { resolve(name, {}) })
    return resolved
  }

  function color(colors, names, fallback) {
    for (var i = 0; i < names.length; i++) if (colors[names[i]]) return colors[names[i]]
    return fallback
  }

  function preserveTransparency(original, chosen) {
    if (original === 'transparent') return original
    var source = /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)$/i.exec(original)
    if (!source || Number(source[1]) >= 1 || !/^#[0-9a-f]{6}$/i.test(chosen)) return chosen
    return 'rgba(' + [1, 3, 5].map(function (at) { return parseInt(chosen.slice(at, at + 2), 16) }).join(', ') + ', ' + source[1] + ')'
  }

  function replaceDefaultAccent(value, accent) {
    if (/^#(?:70a7f0|5181b8|42648b|507299)$/i.test(value)) return accent
    var match = /^rgba\(\s*(112|81)\s*,\s*(167|129)\s*,\s*(240|184)\s*,\s*([\d.]+)\s*\)$/i.exec(value)
    if (!match || !((match[1] === '112' && match[2] === '167' && match[3] === '240') || (match[1] === '81' && match[2] === '129' && match[3] === '184'))) return value
    var parts = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(accent)
    if (parts) return 'rgba(' + [1, 2, 3].map(function (at) { return parseInt(parts[at], 16) }).join(', ') + ', ' + match[4] + ')'
    var transparentAccent = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,/.exec(accent)
    return transparentAccent ? 'rgba(' + transparentAccent.slice(1).join(', ') + ', ' + match[4] + ')' : value
  }

  function rgb(value) {
    var hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value || '')
    if (hex) return [1, 2, 3].map(function (at) { return parseInt(hex[at], 16) })
    var rgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(value || '')
    return rgba ? rgba.slice(1).map(Number) : null
  }

  function contrastRatio(first, second) {
    function luminance(parts) {
      var channels = parts.map(function (part) {
        var value = part / 255
        return value <= .04045 ? value / 12.92 : Math.pow((value + .055) / 1.055, 2.4)
      })
      return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722
    }
    var a = luminance(first), b = luminance(second)
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
  }

  function contrastingColor(background, colors) {
    var bg = rgb(background)
    if (!bg) return '#FFFFFF'
    var candidates = [colors.activeButtonFg, colors.dialogsUnreadFg, colors.windowBg, colors.windowFg, '#FFFFFF', '#20232B']
    var best = '#FFFFFF', bestRatio = 0
    candidates.forEach(function (candidate) {
      var parts = rgb(candidate)
      if (!parts) return
      var ratio = contrastRatio(bg, parts)
      if (ratio > bestRatio) { best = candidate; bestRatio = ratio }
    })
    return best
  }

  function makePalette(base, colors) {
    var palette = {}
    var groups = {
      window: ['windowBg', 'boxBg', 'mainMenuBg'],
      foreground: ['windowFg', 'windowBoldFg'],
      muted: ['windowSubTextFg', 'placeholderFg', 'dialogsTextFg'],
      accent: ['activeButtonBg', 'windowActiveTextFg', 'activeLineFg'],
      border: ['filterInputBorderFg', 'scrollBarBg', 'windowBgOver'],
      hover: ['windowBgOver', 'menuBgOver', 'dialogsBgOver'],
      icon: ['menuIconFg', 'dialogsMenuIconFg', 'windowFg'],
      dialog: ['dialogsBg', 'windowBg'],
      message: ['historyComposeAreaBg', 'windowBg'],
      selected: ['dialogsBgActive', 'activeButtonBg'],
      incoming: ['msgInBg', 'windowBg'],
      outgoing: ['msgOutBg', 'windowBg'],
      messageText: ['historyTextInFg', 'windowFg'],
      outgoingText: ['historyTextOutFg', 'windowFg'],
      link: ['historyLinkInFg', 'windowActiveTextFg'],
      buttonText: ['activeButtonFg', 'windowBg', 'windowFg']
    }
    var picked = {}
    Object.keys(groups).forEach(function (name) { picked[name] = color(colors, groups[name], base['base-fg']) })
    Object.keys(base).forEach(function (name) {
      var value = base[name]
      var key = name.toLowerCase()
      var isBg = /(?:-bg|-background)$/.test(key)
      var isFg = /(?:-fg|-icon|-text)$/.test(key)
      var isBorder = /border/.test(key)
      var isHover = /hover|over/.test(key)
      var isSelected = /selected|active/.test(key)
      if (/dialogitem/.test(key)) {
        value = /badge/.test(key) ? isFg ? color(colors, ['dialogsUnreadFg'], picked.buttonText) : color(colors, ['dialogsUnreadBg'], picked.accent) : /name|title/.test(key) ? color(colors, [isSelected ? 'dialogsNameFgOver' : 'dialogsNameFg', 'windowBoldFg'], picked.foreground) : /date|sub|message/.test(key) ? color(colors, [isSelected ? 'dialogsTextFgService' : 'dialogsTextFg', 'dialogsDateFg'], picked.muted) : /icon/.test(key) ? color(colors, ['dialogsSentIconFg', 'dialogsChatIconFg'], picked.icon) : isSelected ? picked.selected : isHover ? picked.hover : isBg ? picked.dialog : picked.icon
      } else if (/dialog-input|compose/.test(key)) {
        value = isBg ? picked.message : /placeholder|empty/.test(key) ? color(colors, ['placeholderFg'], picked.muted) : isBorder ? picked.border : color(colors, ['historyComposeIconFg', 'windowFg'], picked.foreground)
      } else if (/dialog-message|dialog-messages|history/.test(key)) {
        value = /date-bg/.test(key) ? color(colors, ['msgServiceBg'], picked.message) : /date-fg/.test(key) ? color(colors, ['msgServiceFg'], picked.muted) : isBg ? picked.incoming : /link/.test(key) ? picked.link : isFg ? picked.messageText : value
      } else if (/^header|^layer/.test(key)) {
        value = isBorder ? picked.border : isBg ? color(colors, ['topBarBg', 'titleBg'], picked.window) : isFg ? picked.foreground : value
      } else if (/^input|^settings|^context-menu|^popover|^dropdown/.test(key)) {
        value = isBorder ? picked.border : isBg ? isHover ? picked.hover : picked.window : isFg ? /placeholder|section|sub|block/.test(key) ? picked.muted : picked.foreground : value
      } else if (/button|toggle|checkbox|radio/.test(key)) {
        value = isBorder ? picked.border : isBg ? isHover ? color(colors, ['activeButtonBgOver', 'lightButtonBgOver'], picked.accent) : picked.accent : isFg ? picked.buttonText : value
      } else if (isBorder) value = picked.border
      else if (isBg) value = isHover ? picked.hover : picked.window
      else if (isFg) value = /gray|sub|muted|placeholder|date/.test(key) ? picked.muted : /link/.test(key) ? picked.link : picked.foreground
      palette[name] = preserveTransparency(base[name], value)
    })
    var explicit = {
      'base-bg': 'windowBg', 'base-fg': 'windowFg', 'base-icon': 'menuIconFg',
      'layer-box-bg': 'boxBg', 'layer-box-header-bg': 'titleBg',
      'dialogitem-bg': 'dialogsBg', 'dialogitem-hover-bg': 'dialogsBgOver',
      'dialogitem-selected-bg': 'dialogsBgActive', 'dialogitem-name-fg': 'dialogsNameFg',
      'dialogitem-message-fg': 'dialogsTextFg', 'dialogitem-date-fg': 'dialogsDateFg',
      'dialogitem-badge-bg': 'dialogsUnreadBg', 'dialogitem-badge-fg': 'dialogsUnreadFg',
      'dialogitem-muted-badge-bg': 'dialogsUnreadBgMuted',
      'dialog-input-bg': 'historyComposeAreaBg', 'dialog-input-ta-bg': 'historyComposeAreaBg',
      'dialog-input-ta-empty-fg': 'placeholderFg',
      'dialog-messages-date-bg': 'msgServiceBg', 'dialog-messages-date-fg': 'msgServiceFg',
      'dialog-message-unread-bg': 'historyUnreadBarBg',
      'dialog-message-selected-bg': 'msgInBgSelected',
      'dialog-message-icon': 'historySendingInIconFg',
      'button-bg': 'activeButtonBg', 'button-hover-bg': 'activeButtonBgOver',
      'button-fg': 'activeButtonFg', 'buttonlight-bg': 'lightButtonBg',
      'buttonlight-hover-bg': 'lightButtonBgOver', 'buttonwide-bg': 'activeButtonBg',
      'buttonwide-fg': 'activeButtonFg', 'input-placeholder-fg': 'placeholderFg',
      'input-search-bg': 'filterInputInactiveBg', 'context-menu-bg': 'mainMenuBg',
      'context-menu-item-hover-bg': 'menuBgOver', 'link-fg': 'historyLinkInFg',
      'gray-fg': 'windowSubTextFg', 'user-name-fg': 'windowBoldFg',
      'header-title': 'windowBoldFg', 'header-border': 'filterInputBorderFg',
      'settings-tab-active-fg': 'windowActiveTextFg', 'settings-tab-underline-bg': 'activeLineFg',
      'settings-separator-bg': 'filterInputBorderFg', 'settings-line-left-fg': 'windowSubTextFg'
    }
    Object.keys(explicit).forEach(function (name) { if (colors[explicit[name]]) palette[name] = preserveTransparency(base[name], colors[explicit[name]]) })
    var switchForeground = contrastingColor(picked.accent, colors)
    palette['toggle-enabled-bg'] = picked.accent
    palette['toggle-enabled-slider-bg'] = switchForeground
    palette['checkbox-bg'] = picked.accent
    palette['radio-selected-fg'] = picked.accent
    palette['openvk-theme-context-hover-fg'] = contrastingColor(palette['context-menu-item-hover-bg'], colors)
    var iconHover = palette['dialog-input-send-mic-icon-hover'] || picked.accent
    Object.keys(palette).forEach(function (name) { palette[name] = replaceDefaultAccent(palette[name], iconHover) })
    Object.keys(colors).forEach(function (name) { palette['telegram-' + name] = colors[name] })
    return palette
  }

  window.OpenVKTelegramTheme = { parse: parse, makePalette: makePalette }
})()
