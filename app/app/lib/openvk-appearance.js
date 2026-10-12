(function () {
  'use strict'

  var PREF_KEY = 'openvk.appearance.v1'
  var WALLPAPER_KEY = 'openvk.chatWallpaper.v1'
  var themes = [
    { id: 'classic', image: 'classic.png', dark: false, bg: '#FFFFFF', fg: '#222222', defaultAccent: '#7E7E7E', border: '#E2E2E2' },
    { id: 'day', image: 'day.png', dark: false, bg: '#E9F3FB', fg: '#222222', defaultAccent: '#43648B', border: '#D0E2E9' },
    { id: 'tinted', image: 'tinted.png', dark: true, bg: '#1F2333', fg: '#FFFFFF', defaultAccent: '#70A7F0', border: '#3A4051' },
    { id: 'night', image: 'night.png', dark: true, bg: '#242424', fg: '#FFFFFF', defaultAccent: '#A4A4A4', border: '#404040' }
  ]
  var accents = [
    { id: 'blue', color: '#5181B8' },
    { id: 'lightblue', color: '#70A7F0' },
    { id: 'green', color: '#5FBF64' },
    { id: 'pink', color: '#FA50A5' },
    { id: 'orange', color: '#FA9726' },
    { id: 'purple', color: '#C858DC' },
    { id: 'red', color: '#E95A5A' },
    { id: 'darkgray', color: '#586076' },
    { id: 'yellow', color: '#F8CA40' }
  ]
  var lang = window.lang
  var words = {
    accent: lang.appearance_accent,
    custom: lang.appearance_custom_color,
    choose: lang.appearance_choose_accent,
    lightness: lang.appearance_lightness,
    cancel: lang.appearance_cancel,
    save: lang.appearance_save,
    themes: [lang.appearance_theme_classic, lang.appearance_theme_day, lang.appearance_theme_tinted, lang.appearance_theme_night],
    accents: [lang.appearance_color_blue, lang.appearance_color_lightblue, lang.appearance_color_green, lang.appearance_color_pink, lang.appearance_color_orange, lang.appearance_color_purple, lang.appearance_color_red, lang.appearance_color_darkgray, lang.appearance_color_yellow]
  }
  var wallpaperWords = {
    heading: lang.appearance_wallpaper_heading,
    choose: lang.appearance_wallpaper_choose,
    remove: lang.appearance_wallpaper_remove,
    tile: lang.appearance_wallpaper_tile,
    preview: lang.appearance_wallpaper_preview,
    blur: lang.appearance_wallpaper_blur,
    brightness: lang.appearance_wallpaper_brightness,
    outline: lang.appearance_wallpaper_outline,
    outlineStrength: lang.appearance_wallpaper_outline_strength,
    outlineColor: lang.appearance_wallpaper_outline_color,
    outlineAuto: lang.appearance_wallpaper_outline_auto,
    apply: lang.appearance_wallpaper_apply,
    missing: lang.appearance_wallpaper_missing,
    today: lang.appearance_wallpaper_today,
    theme: lang.appearance_wallpaper_theme
  }

  function readWallpaper() {
    try {
      var value = JSON.parse(localStorage.getItem(WALLPAPER_KEY) || '{}')
      return { path: typeof value.path === 'string' ? value.path : '', tile: !!value.tile, blur: !!value.blur, brightness: typeof value.brightness === 'number' ? Math.max(0, Math.min(100, value.brightness)) : 100, outline: !!value.outline, outlineStrength: typeof value.outlineStrength === 'number' ? Math.max(0, Math.min(100, value.outlineStrength)) : 35, outlineColor: /^#[0-9a-f]{6}$/i.test(value.outlineColor || '') ? value.outlineColor.toUpperCase() : '', revision: value.revision || 0 }
    } catch (_) { return { path: '', tile: false, blur: false, brightness: 100, outline: false, outlineStrength: 35, outlineColor: '', revision: 0 } }
  }

  var wallpaper = readWallpaper()
  function fileUrl(filePath) {
    var normalized = filePath.replace(/\\/g, '/')
    return 'file://' + (/^[A-Za-z]:/.test(normalized) ? '/' : '') + normalized.split('/').map(function (part, index) {
      return index === 0 && /^[A-Za-z]:$/.test(part) ? part : encodeURIComponent(part)
    }).join('/')
  }
  function wallpaperUrl() { return wallpaper.path ? fileUrl(wallpaper.path) + '?v=' + wallpaper.revision : '' }
  function outlineColor(theme, strength, customColor) {
    var shade = hexToRgb(customColor) || (theme.dark ? [0, 0, 0] : [255, 255, 255])
    return 'rgba(' + shade.join(', ') + ', ' + (strength * .007).toFixed(3) + ')'
  }
  function setWallpaperSurface(node, url, tile, blur, brightness, outline) {
    if (!node) return
    node.style.setProperty('--openvk-wallpaper-image', url ? 'url(' + JSON.stringify(url) + ')' : 'none')
    node.style.setProperty('--openvk-wallpaper-brightness', brightness + '%')
    node.classList.toggle('openvk-wallpaper-active', !!url)
    node.classList.toggle('openvk-wallpaper-tiled', !!tile)
    node.classList.toggle('openvk-wallpaper-blurred', !!blur)
    node.classList.toggle('openvk-wallpaper-outlined', !!url && !!outline)
  }
  function applyWallpaper() {
    var url = wallpaperUrl()
    document.body.classList.toggle('openvk-wallpaper-outlined', !!url && wallpaper.outline)
    document.body.style.setProperty('--openvk-wallpaper-text-halo', outlineColor(currentTheme(), wallpaper.outlineStrength, wallpaper.outlineColor))
    document.body.style.setProperty('--openvk-wallpaper-selected-bg', rgba(currentAccent(), currentTheme().dark ? .24 : .18))
    document.body.style.setProperty('--openvk-wallpaper-unread-bg', rgba(currentAccent(), currentTheme().dark ? .16 : .12))
    document.querySelectorAll('.im_dialog_messages, .im_right_empty').forEach(function (node) {
      if (!node.closest('.openvk-wallpaper-dialog')) setWallpaperSurface(node, url, wallpaper.tile, wallpaper.blur, wallpaper.brightness, wallpaper.outline)
    })
    document.querySelectorAll('.openvk-wallpaper-thumb').forEach(function (node) {
      setWallpaperSurface(node, url, wallpaper.tile, wallpaper.blur, wallpaper.brightness, wallpaper.outline)
      node.disabled = !wallpaper.path
    })
    document.querySelectorAll('.openvk-wallpaper-remove').forEach(function (node) { node.disabled = !wallpaper.path })
  }

  function checkboxMarkup(className, label) {
    return '<div class="checkbox ' + className + '" role="checkbox" tabindex="0" aria-checked="false">' +
      '<div class="checkbox_icon"><div class="checkbox_icon_icon"></div></div><div class="checkbox_label">' + label + '</div></div>'
  }

  function setCheckbox(node, checked) {
    node.classList.toggle('-checked', checked)
    node.setAttribute('aria-checked', String(checked))
  }

  function onCheckbox(node, callback) {
    node.addEventListener('click', callback)
    node.addEventListener('keydown', function (event) {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()
        callback()
      }
    })
  }

  function readPrefs() {
    try {
      var saved = JSON.parse(localStorage.getItem(PREF_KEY) || '{}')
      return {
        theme: themes.some(function (item) { return item.id === saved.theme }) ? saved.theme : 'classic',
        accent: typeof saved.accent === 'string' ? saved.accent : '',
        accentId: typeof saved.accentId === 'string' ? saved.accentId : '',
        customColor: /^#[0-9a-f]{6}$/i.test(saved.customColor || '') ? saved.customColor.toUpperCase() : '#5181B8',
        lastLightTheme: saved.lastLightTheme === 'day' || (!saved.lastLightTheme && saved.theme === 'day') ? 'day' : 'classic',
        lastDarkTheme: saved.lastDarkTheme === 'tinted' || (!saved.lastDarkTheme && saved.theme === 'tinted') ? 'tinted' : 'night'
      }
    } catch (_) {
      return { theme: 'classic', accent: '', accentId: '', customColor: '#5181B8', lastLightTheme: 'classic', lastDarkTheme: 'night' }
    }
  }

  var prefs = readPrefs()
  var styleNode
  var lastPalette

  function savePrefs() {
    try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)) } catch (_) {}
  }

  function currentTheme() {
    return themes.filter(function (item) { return item.id === prefs.theme })[0] || themes[0]
  }

  function currentAccent() {
    if (prefs.accentId === 'custom') return prefs.customColor
    var chosen = accents.filter(function (item) { return item.id === prefs.accentId })[0]
    return chosen ? chosen.color : currentTheme().defaultAccent
  }

  function rgba(hex, alpha) {
    var value = hex.replace('#', '')
    return 'rgba(' + parseInt(value.slice(0, 2), 16) + ', ' + parseInt(value.slice(2, 4), 16) + ', ' + parseInt(value.slice(4, 6), 16) + ', ' + alpha + ')'
  }

  function scaledColor(hex, factor) {
    var parts = hexToRgb(hex)
    return rgbToHex(parts.map(function (part) { return Math.round(part * factor) }))
  }

  function dayTint(accent, lightness) {
    var hsl = rgbToHsl.apply(null, hexToRgb(accent))
    var saturation = hsl[1] < 5 ? 0 : Math.max(40, Math.min(62, hsl[1]))
    return rgbToHex(hslToRgb(hsl[0], saturation, lightness))
  }

  function dayInk(accent) {
    var hsl = rgbToHsl.apply(null, hexToRgb(accent))
    return rgbToHex(hslToRgb(hsl[0], hsl[1] < 5 ? 0 : Math.max(35, Math.min(65, hsl[1])), 35))
  }

  function recolorSurface(value, accent, themeId) {
    if (themeId !== 'day' && themeId !== 'tinted') return value
    if (!/^#[0-9a-f]{6}$/i.test(value)) return value
    var original = rgbToHsl.apply(null, hexToRgb(value))
    var isDaySurface = themeId === 'day' && original[0] >= 190 && original[0] <= 245 && original[1] >= 5 && original[2] >= 85
    var isTintedSurface = themeId === 'tinted' && original[0] >= 190 && original[0] <= 245 && original[1] >= 5 && original[2] <= 35
    if (!isDaySurface && !isTintedSurface) return value
    var chosen = rgbToHsl.apply(null, hexToRgb(accent))
    var saturation = chosen[1] < 5 ? 0 : original[1]
    return rgbToHex(hslToRgb(chosen[0], saturation, original[2]))
  }

  function verifiedBadge(accent) {
    var outline = 'M13.8403487,9.19893128 C13.6795725,9.79985 14.3001781,10.7246649 13.9959689,11.2505859 C13.6870723,11.7840067 12.5733571,11.7071342 12.1402456,12.1402456 C11.7071342,12.5733571 11.7844755,13.6870723 11.2510547,13.9959689 C10.7251336,14.3001781 9.80031874,13.6800412 9.19940002,13.8403487 C8.61863692,13.9955001 8.12974595,15 7.50023437,15 C6.87072279,15 6.38136308,13.9955001 5.80106872,13.8403487 C5.20015,13.6795725 4.27533515,14.3001781 3.74941408,13.9959689 C3.21599325,13.6870723 3.29286585,12.5733571 2.85975438,12.1402456 C2.42664292,11.7071342 1.31292772,11.7844755 1.00403112,11.2510547 C0.699821881,10.7251336 1.31995875,9.80031874 1.15965126,9.19940002 C1.00449986,8.61863692 0,8.12974595 0,7.50023437 C0,6.87072279 1.00449986,6.38136308 1.15965126,5.80106872 C1.32042749,5.20015 0.699821881,4.27533515 1.00403112,3.74941408 C1.31292772,3.21599325 2.42664292,3.29286585 2.85975438,2.85975438 C3.29286585,2.42664292 3.21552451,1.31292772 3.74894535,1.00403112 C4.27486641,0.699821881 5.19968126,1.31995875 5.80059998,1.15965126 C6.38136308,1.00449986 6.87025405,0 7.49976563,0 C8.12927721,0 8.61863692,1.00449986 9.19893128,1.15965126 C9.79985,1.32042749 10.7246649,0.699821881 11.2505859,1.00403112 C11.7840067,1.31292772 11.7071342,2.42664292 12.1402456,2.85975438 C12.5733571,3.29286585 13.6870723,3.21552451 13.9959689,3.74894535 C14.3001781,4.27486641 13.6800412,5.19968126 13.8403487,5.80059998 C13.9955001,6.38089435 15,6.87025405 15,7.49976563 C15,8.12927721 13.9955001,8.61863692 13.8403487,9.19893128 Z'
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 15 15"><path fill="' + accent + '" d="' + outline + '"/><polygon fill="#fff" points="3.5 8 6.5 11 11.5 6 10.5 5 6.5 9 4.5 7"/></svg>'
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")'
  }

  function recolor(value, accent, dark, night) {
    var original = night
      ? ['#A4A4A4', '#7B7B7B', '#7E7E7E', '#70A7F0', '#5A7DAC', '#5181B8']
      : dark
      ? ['#70A7F0', '#5A7DAC', '#5181B8', '#507299', '#4A76A8', '#628DBE']
      : ['#5B78A3', '#577CA1', '#42648B', '#6083A7', '#5F82A6', '#6E90B8', '#6786AB', '#6387AC', '#5989BD', '#5181B8', '#507299']
    var exact = value.toUpperCase()
    for (var i = 0; i < original.length; i++) {
      var shade = i === 0 ? accent : scaledColor(accent, dark ? .82 : .9)
      if (exact === original[i]) return shade
      var rgb = hexToRgb(original[i])
      var match = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/i.exec(value)
      if (match && Number(match[1]) === rgb[0] && Number(match[2]) === rgb[1] && Number(match[3]) === rgb[2]) {
        return rgba(shade, match[4])
      }
    }
    return value
  }

  function applyTheme() {
    var theme = currentTheme()
    var accent = currentAccent()
    var dark = theme.dark
    var nativeTheme = window.OpenVKTheme && window.OpenVKTheme.getCurrentTheme()
    if (!nativeTheme || !nativeTheme.default || !!nativeTheme.dark !== dark) {
      if (window.OpenVKSettingsController) {
        window.OpenVKSettingsController.setTheme({ isDefault: true, isDark: dark })
      } else if (window.OpenVKTheme && window.OpenVKTheme.setOpenVKDefaultTheme) {
        window.OpenVKTheme.setOpenVKDefaultTheme(dark)
      }
    }
    if (!styleNode) {
      styleNode = document.createElement('style')
      styleNode.id = 'openvk-appearance-overrides'
      document.head.appendChild(styleNode)
    }
    var data = window.OpenVKPaletteData || {}
    var baseline = data[theme.id === 'night' ? 'night' : dark ? 'dark' : 'light'] || {}
    var palette = {}
    Object.keys(baseline).forEach(function (name) {
      palette[name] = recolor(recolorSurface(baseline[name], accent, theme.id), accent, dark, theme.id === 'night')
    })
    palette['base-bg'] = theme.bg
    palette['base-fg'] = theme.fg
    palette['header-border'] = theme.border
    if (theme.id === 'classic' || theme.id === 'day') {
      palette['main-menu-update-icon-fg'] = accent
    }
    if (theme.id === 'classic') {
      palette['dialogitem-selected-bg'] = accent
    }
    if (theme.id === 'day') {
      var dayColors = prefs.accentId ? {
        bg: dayTint(accent, 95),
        surface: dayTint(accent, 98),
        hover: dayTint(accent, 92),
        border: dayTint(accent, 88),
        unread: dayTint(accent, 90)
      } : {
        bg: '#E9F3FB',
        surface: '#F5FAFD',
        hover: '#DFEDF8',
        border: '#D0E2E9',
        unread: '#E3EFF9'
      }
      palette['base-bg'] = dayColors.bg
      palette['layer-box-bg'] = dayColors.surface
      palette['layer-box-header-bg'] = dayColors.bg
      palette['layer-box-header-border'] = dayColors.border
      palette['header-border'] = dayColors.border
      palette['dialogitem-bg'] = dayColors.bg
      palette['dialog-input-bg'] = dayColors.surface
      palette['dialog-input-ta-bg'] = '#FFFFFF'
      palette['dialogitem-hover-bg'] = dayColors.hover
      palette['context-menu-bg'] = dayColors.bg
      palette['context-menu-border'] = dayColors.border
      palette['context-menu-item-hover-bg'] = dayColors.hover
      palette['popover-bg'] = dayColors.bg
      palette['dialog-message-hover-bg'] = dayColors.hover
      palette['dialog-message-unread-bg'] = dayColors.unread
      palette['settings-line-editing-bg'] = dayColors.surface
      palette['settings-separator-bg'] = dayColors.border
      palette['settings-buttonlight-hover-bg'] = dayColors.hover
      palette['dialogitem-selected-bg'] = accent
      palette['dialog-message-selected-select-icon'] = accent
      palette['accpanel-bg'] = dayColors.hover
      palette['accpanel-border-right'] = dayColors.border
      palette['accpanel-sep-border-bottom'] = dayColors.border
      palette['left-border'] = dayColors.border
      palette['input-search-bg'] = dayColors.surface
      palette['input-search-icon'] = dayInk(accent)
      palette['input-search-clear-icon'] = dayInk(accent)
      palette['input-search-placeholder-fg'] = rgba(dayInk(accent), .7)
      palette['toggle-bg'] = dayTint(accent, 82)
      palette['toggle-disabled-bg'] = dayColors.border
      palette['info-icon'] = dayInk(accent)
      palette['info-chat-image-placeholder-icon'] = dayInk(accent)
      palette['header-back-icon'] = dayInk(accent)
      palette['header-4state-icon'] = rgba(dayInk(accent), .65)
      palette['header-4state-icon-hover'] = dayInk(accent)
      palette['header-4state-active-icon'] = accent
      palette['header-4state-active-icon-hover'] = accent
      palette['compose-dialogitem-icon'] = dayInk(accent)
      palette['compose-dialogitem-selected-icon'] = accent
      palette['info-list-item-hover-bg'] = dayColors.hover
    }
    if (theme.id === 'tinted') {
      palette['base-bg'] = recolorSurface(theme.bg, accent, theme.id)
      palette['header-border'] = recolorSurface(theme.border, accent, theme.id)
      palette['dialogitem-selected-bg'] = scaledColor(accent, .72)
    }
    if (theme.id === 'day' || theme.id === 'tinted') {
      palette['dialogitem-online-bg'] = accent
    }
    if (theme.id === 'night') {
      palette['user-name-fg'] = '#B6BBC6'
      palette['gray-fg'] = '#9BA2B2'
      palette['darkgray-fg'] = '#9BA2B2'
    }
    palette['base-icon'] = accent
    palette['gray-icon'] = accent
    palette['user-name-fg'] = accent
    palette['dialogitem-message-fg'] = baseline['dialogitem-message-fg']
    palette['dialogitem-message-out-fg'] = baseline['dialogitem-message-fg']
    palette['dialog-pinned-icon'] = rgba(accent, .7)
    palette['checkbox-bg'] = accent
    palette['radio-selected-fg'] = accent
    palette['toggle-enabled-bg'] = accent
    palette['settings-scale-fg'] = accent
    palette['settings-scale-selected-bg'] = accent
    if (theme.id === 'tinted') {
      palette['settings-line-left-fg'] = accent
      palette['settings-line-toggle-label-fg'] = accent
    }
    palette['link-fg'] = accent
    palette['link-darker-fg'] = accent
    palette['settings-tab-active-fg'] = accent
    palette['settings-tab-underline-bg'] = accent
    palette['buttonwide-bg'] = scaledColor(accent, dark ? .82 : .9)
    var rgb = hexToRgb(accent)
    var bright = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000 > 165
    palette['dialogitem-badge-bg'] = accent
    palette['dialogitem-badge-fg'] = bright ? '#1F2333' : '#FFFFFF'
    palette['dialogitem-outbadge-bg'] = accent
    palette['dialog-header-back-badge-bg'] = accent
    palette['dialog-header-back-badge-fg'] = bright ? '#1F2333' : '#FFFFFF'
    palette['dialog-history-end-button-badge-bg'] = accent
    palette['dialog-history-end-button-badge-fg'] = bright ? '#1F2333' : '#FFFFFF'
    palette['buttonwide-fg'] = bright ? '#1F2333' : '#FFFFFF'
    if ((theme.id === 'classic' || theme.id === 'day') && bright) {
      palette['dialogitem-selected-name-fg'] = '#1F2333'
      palette['dialogitem-selected-message-fg'] = '#1F2333'
      palette['dialogitem-selected-message-out-fg'] = '#1F2333'
      palette['dialogitem-selected-date-fg'] = '#1F2333'
      palette['dialogitem-selected-verified-icon'] = '#1F2333'
    }
    lastPalette = palette
    styleNode.textContent = ':root{' + Object.keys(palette).map(function (name) {
      return '--' + name + ':' + palette[name] + ';'
    }).join('') + '} .im_dialog_messages{background-color:var(--base-bg);}' +
      '.im_dialog_item:not(.-selected) .im_dialog_item_verified,.im_dialog_header_verified{background-image:' + verifiedBadge(accent) + ';}' +
      'body.openvk-theme-classic .update_buttons>.wide_button_light,body.openvk-theme-day .update_buttons>.wide_button_light{color:var(--ovk-accent);}' +
      'body.openvk-theme-classic .update_buttons>.wide_button:not(.-disabled):hover,body.openvk-theme-day .update_buttons>.wide_button:not(.-disabled):hover{background-color:var(--ovk-accent);}' +
      'body.openvk-theme-classic .update_buttons>.wide_button:not(.-disabled):active,body.openvk-theme-day .update_buttons>.wide_button:not(.-disabled):active{background-color:' + scaledColor(accent, .78) + ';}'
      + 'body.openvk-theme-classic .login_submit_button:not(.-disabled):hover,body.openvk-theme-day .login_submit_button:not(.-disabled):hover{background-color:var(--ovk-accent);}'
      + 'body.openvk-theme-classic .login_submit_button:not(.-disabled):active,body.openvk-theme-day .login_submit_button:not(.-disabled):active{background-color:' + scaledColor(accent, .78) + ';}'
    document.body.classList.remove('openvk-theme-classic', 'openvk-theme-day', 'openvk-theme-tinted', 'openvk-theme-night')
    document.body.classList.add('openvk-theme-' + theme.id)
    document.documentElement.style.setProperty('--ovk-accent', accent)
    document.querySelectorAll('.openvk-appearance').forEach(renderPanel)
    applyWallpaper()
  }

  function createPanel(root) {
    root.className = 'settings_content settings_content_appearance openvk-appearance'
    root.innerHTML = '<h2 class="openvk-appearance-title">' + lang.settings_appearance + '</h2>' +
      '<div class="openvk-theme-grid" role="radiogroup" aria-label="' + lang.appearance_theme_label + '"></div>' +
      '<h3 class="openvk-accent-heading">' + words.accent + '</h3>' +
      '<div class="openvk-accent-list"></div>' +
      '<h3 class="openvk-accent-heading">' + wallpaperWords.heading + '</h3>' +
      '<div class="openvk-wallpaper-row"><button type="button" class="openvk-wallpaper-thumb" aria-label="' + wallpaperWords.preview + '" title="' + wallpaperWords.preview + '"></button><button type="button" class="openvk-wallpaper-choose">' + wallpaperWords.choose + '</button><button type="button" class="openvk-wallpaper-remove">' + wallpaperWords.remove + '</button></div>' +
      checkboxMarkup('openvk-wallpaper-tile', wallpaperWords.tile)
    renderPanel(root)
    onCheckbox(root.querySelector('.openvk-wallpaper-tile'), function () {
      wallpaper.tile = !wallpaper.tile
      localStorage.setItem(WALLPAPER_KEY, JSON.stringify(wallpaper))
      setCheckbox(root.querySelector('.openvk-wallpaper-tile'), wallpaper.tile)
      applyWallpaper()
    })
    root.querySelector('.openvk-wallpaper-thumb').addEventListener('click', function () {
      if (!wallpaper.path) return
      if (!require('fs').existsSync(wallpaper.path)) return window.alert(wallpaperWords.missing)
      openWallpaperDialog(wallpaper.path, true)
    })
    root.querySelector('.openvk-wallpaper-choose').addEventListener('click', function () {
      var remote = require('electron').remote
      remote.dialog.showOpenDialog(remote.getCurrentWindow(), {
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] }]
      }, function (paths) {
        if (paths && paths[0]) openWallpaperDialog(paths[0])
      })
    })
    root.querySelector('.openvk-wallpaper-remove').addEventListener('click', function () {
      if (!wallpaper.path) return
      localStorage.removeItem(WALLPAPER_KEY)
      wallpaper = readWallpaper()
      renderPanel(root)
    })
  }

  function renderPanel(root) {
    var grid = root.querySelector('.openvk-theme-grid')
    var swatches = root.querySelector('.openvk-accent-list')
    if (!grid || !swatches) return
    grid.innerHTML = themes.map(function (theme) {
      var selected = theme.id === prefs.theme
      return '<button type="button" class="openvk-theme-option' + (selected ? ' -selected' : '') + '" data-theme="' + theme.id + '" aria-pressed="' + selected + '">' +
        '<span class="openvk-theme-card"><img src="lib/themes/' + theme.image + '" alt=""><span class="openvk-theme-check" aria-hidden="true">✓</span></span>' +
        '<span class="openvk-theme-name">' + words.themes[themes.indexOf(theme)] + '</span></button>'
    }).join('')
    swatches.innerHTML = accents.map(function (accent) {
      var selected = prefs.accentId === accent.id
      return '<button type="button" class="openvk-accent-option' + (selected ? ' -selected' : '') + '" data-accent="' + accent.id + '" aria-pressed="' + selected + '"><span class="openvk-accent-dot" style="background:' + accent.color + '"></span>' + words.accents[accents.indexOf(accent)] + '</button>'
    }).join('') + '<button type="button" class="openvk-accent-option' + (prefs.accentId === 'custom' ? ' -selected' : '') + '" data-accent="custom" aria-pressed="' + (prefs.accentId === 'custom') + '"><span class="openvk-accent-dot -custom"></span>' + words.custom + '</button>'
    root.querySelectorAll('[data-theme]').forEach(function (button) {
      button.addEventListener('click', function () {
        prefs.theme = button.getAttribute('data-theme')
        if (currentTheme().dark) prefs.lastDarkTheme = prefs.theme
        else prefs.lastLightTheme = prefs.theme
        savePrefs()
        applyTheme()
      })
    })
    root.querySelectorAll('[data-accent]').forEach(function (button) {
      button.addEventListener('click', function () {
        var id = button.getAttribute('data-accent')
        if (id === 'custom') return openColorDialog()
        var item = accents.filter(function (color) { return color.id === id })[0]
        if (!item) return
        prefs.accentId = id
        prefs.accent = item.color
        savePrefs()
        applyTheme()
      })
    })
    setCheckbox(root.querySelector('.openvk-wallpaper-tile'), wallpaper.tile)
    applyWallpaper()
  }

  function openWallpaperDialog(filePath, existing) {
    var previewUrl = existing ? wallpaperUrl() : fileUrl(filePath)
    var selectedTheme = prefs.theme
    var blurred = wallpaper.blur
    var brightness = wallpaper.brightness
    var outlined = wallpaper.outline
    var outlineStrength = wallpaper.outlineStrength
    var chosenOutlineColor = wallpaper.outlineColor
    var overlay = document.createElement('div')
    overlay.className = 'openvk-color-overlay openvk-wallpaper-overlay'
    overlay.innerHTML = '<section class="openvk-color-dialog openvk-wallpaper-dialog" role="dialog" aria-modal="true" aria-labelledby="openvk-wallpaper-title">' +
      '<div class="openvk-wallpaper-header"><h2 id="openvk-wallpaper-title">' + wallpaperWords.preview + '</h2><button type="button" class="openvk-wallpaper-theme" aria-label="' + wallpaperWords.theme + '" title="' + wallpaperWords.theme + '"></button></div>' +
      '<div class="openvk-wallpaper-preview im_dialog_messages"><div class="openvk-wallpaper-conversation">' +
      '<div class="im_dialog_date">' + wallpaperWords.today + '</div>' +
      '<div class="im_dialog_message"><div class="im_dialog_message_container"><span class="im_dialog_message_photo openvk-wallpaper-avatar" aria-hidden="true">' + lang.appearance_preview_author_initial + '</span><div class="im_dialog_message_r"><div class="im_dialog_message_name_line"><span class="im_dialog_message_name">' + lang.appearance_preview_author + '</span><span class="im_dialog_message_time">12:40</span></div><div class="im_dialog_message_text">' + lang.appearance_preview_intro + '<br><br>' + lang.appearance_preview_body + '</div></div></div></div>' +
      '<div class="im_dialog_message"><div class="im_dialog_message_container"><span class="im_dialog_message_photo openvk-wallpaper-avatar -mine" aria-hidden="true">' + lang.appearance_preview_me_initial + '</span><div class="im_dialog_message_r"><div class="im_dialog_message_name_line"><span class="im_dialog_message_name">' + lang.appearance_preview_me + '</span><span class="im_dialog_message_time">12:41</span></div><div class="im_dialog_message_text">' + lang.appearance_preview_reply + '</div></div></div></div>' +
      '</div></div>' + checkboxMarkup('openvk-wallpaper-blur', wallpaperWords.blur) +
      checkboxMarkup('openvk-wallpaper-outline', wallpaperWords.outline) +
      '<label class="openvk-wallpaper-outline-strength"' + (outlined ? '' : ' hidden') + '>' + wallpaperWords.outlineStrength + '<input type="range" min="0" max="100" value="' + outlineStrength + '"><output>' + outlineStrength + '%</output></label>' +
      '<div class="openvk-wallpaper-outline-color"' + (outlined ? '' : ' hidden') + '><button type="button" class="openvk-wallpaper-color-choose"><span class="openvk-wallpaper-color-swatch" aria-hidden="true"></span>' + wallpaperWords.outlineColor + '</button><button type="button" class="openvk-wallpaper-color-auto">' + wallpaperWords.outlineAuto + '</button></div>' +
      '<label class="openvk-wallpaper-brightness">' + wallpaperWords.brightness + '<input type="range" min="0" max="100" value="' + brightness + '"><output>' + brightness + '%</output></label>' +
      '<div class="openvk-color-actions"><button type="button" data-action="cancel">' + words.cancel + '</button><button type="button" class="-primary" data-action="apply">' + wallpaperWords.apply + '</button></div></section>'
    document.body.appendChild(overlay)
    var preview = overlay.querySelector('.openvk-wallpaper-preview')
    var themeButton = overlay.querySelector('.openvk-wallpaper-theme')
    var blurControl = overlay.querySelector('.openvk-wallpaper-blur')
    var outlineControl = overlay.querySelector('.openvk-wallpaper-outline')
    var outlineRow = overlay.querySelector('.openvk-wallpaper-outline-strength')
    var outlineInput = outlineRow.querySelector('input')
    var outlineColorRow = overlay.querySelector('.openvk-wallpaper-outline-color')
    var outlineSwatch = outlineColorRow.querySelector('.openvk-wallpaper-color-swatch')
    var outlineAutoButton = outlineColorRow.querySelector('.openvk-wallpaper-color-auto')
    var brightnessInput = overlay.querySelector('.openvk-wallpaper-brightness input')
    setCheckbox(blurControl, blurred)
    setCheckbox(outlineControl, outlined)
    function updatePreview() {
      var theme = themes.filter(function (item) { return item.id === selectedTheme })[0] || themes[0]
      var paletteData = window.OpenVKPaletteData || {}
      var base = paletteData[theme.id === 'night' ? 'night' : theme.dark ? 'dark' : 'light'] || {}
      var previewAccent = prefs.accentId ? currentAccent() : theme.defaultAccent
      var previewBg = theme.id === 'tinted' ? recolorSurface(theme.bg, previewAccent, theme.id) : theme.bg
      var vars = Object.keys(base).map(function (key) { return '--' + key + ':' + recolor(recolorSurface(base[key], previewAccent, theme.id), previewAccent, theme.dark, theme.id === 'night') + ';' }).join('')
      vars += '--base-bg:' + previewBg + ';--base-fg:' + theme.fg + ';--user-name-fg:' + previewAccent + ';' +
        '--openvk-wallpaper-text-halo:' + outlineColor(theme, outlineStrength, chosenOutlineColor) + ';'
      overlay.querySelector('.openvk-wallpaper-dialog').style.cssText = vars
      preview.style.backgroundColor = previewBg
      themeButton.textContent = words.themes[themes.indexOf(theme)] + ' ↻'
      outlineSwatch.style.backgroundColor = chosenOutlineColor || (theme.dark ? '#000000' : '#FFFFFF')
      outlineAutoButton.hidden = !chosenOutlineColor
      setWallpaperSurface(preview, previewUrl, wallpaper.tile, blurred, brightness, outlined)
    }
    themeButton.addEventListener('click', function () {
      selectedTheme = themes[(themes.findIndex(function (item) { return item.id === selectedTheme }) + 1) % themes.length].id
      updatePreview()
    })
    onCheckbox(blurControl, function () {
      blurred = !blurred
      setCheckbox(blurControl, blurred)
      updatePreview()
    })
    onCheckbox(outlineControl, function () {
      outlined = !outlined
      setCheckbox(outlineControl, outlined)
      outlineRow.hidden = !outlined
      outlineColorRow.hidden = !outlined
      updatePreview()
    })
    outlineColorRow.querySelector('.openvk-wallpaper-color-choose').addEventListener('click', function () {
      var theme = themes.filter(function (item) { return item.id === selectedTheme })[0] || themes[0]
      openColorDialog({
        color: chosenOutlineColor || (theme.dark ? '#000000' : '#FFFFFF'),
        title: wallpaperWords.outlineColor,
        onSave: function (color) { chosenOutlineColor = color; updatePreview() }
      })
    })
    outlineAutoButton.addEventListener('click', function () { chosenOutlineColor = ''; updatePreview() })
    outlineInput.addEventListener('input', function () {
      outlineStrength = Number(this.value)
      outlineRow.querySelector('output').textContent = outlineStrength + '%'
      updatePreview()
    })
    brightnessInput.addEventListener('input', function () {
      brightness = Number(this.value)
      overlay.querySelector('.openvk-wallpaper-brightness output').textContent = brightness + '%'
      updatePreview()
    })
    function close() {
      overlay.remove()
      document.removeEventListener('keydown', onKey)
    }
    function onKey(event) {
      if (event.key === 'Escape' && !document.querySelector('.openvk-color-overlay:not(.openvk-wallpaper-overlay)')) close()
    }
    document.addEventListener('keydown', onKey)
    overlay.addEventListener('click', function (event) { if (event.target === overlay) close() })
    overlay.querySelector('[data-action="cancel"]').addEventListener('click', close)
    overlay.querySelector('[data-action="apply"]').addEventListener('click', function () {
      try {
        if (!existing) {
          var fs = require('fs')
          var path = require('path')
          var userData = require('electron').remote.app.getPath('userData')
          var extension = (path.extname(filePath).toLowerCase().match(/^\.(png|jpe?g|webp|gif|bmp)$/) || [])[0] || '.png'
          var target = path.join(userData, 'chat-wallpaper' + extension)
          fs.writeFileSync(target, fs.readFileSync(filePath))
          wallpaper.path = target
          wallpaper.revision = Date.now()
        }
        wallpaper.blur = blurred
        wallpaper.brightness = brightness
        wallpaper.outline = outlined
        wallpaper.outlineStrength = outlineStrength
        wallpaper.outlineColor = chosenOutlineColor
        localStorage.setItem(WALLPAPER_KEY, JSON.stringify(wallpaper))
        applyWallpaper()
        close()
      } catch (error) { window.alert(wallpaperWords.missing + ': ' + error.message) }
    })
    updatePreview()
  }

  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)) }

  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360
    s = clamp(s, 0, 100) / 100
    l = clamp(l, 0, 100) / 100
    if (!s) {
      var gray = Math.round(l * 255)
      return [gray, gray, gray]
    }
    var q = l < .5 ? l * (1 + s) : l + s - l * s
    var p = 2 * l - q
    function channel(t) {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }
    return [Math.round(channel(h + 1 / 3) * 255), Math.round(channel(h) * 255), Math.round(channel(h - 1 / 3) * 255)]
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255
    var max = Math.max(r, g, b), min = Math.min(r, g, b), h = 0, s = 0, l = (max + min) / 2
    if (max !== min) {
      var d = max - min
      s = l > .5 ? d / (2 - max - min) : d / (max + min)
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break
        case g: h = (b - r) / d + 2; break
        default: h = (r - g) / d + 4
      }
      h *= 60
    }
    return [Math.round(h), Math.round(s * 100), Math.round(l * 100)]
  }

  function rgbToHex(rgb) {
    return '#' + rgb.map(function (part) { return clamp(Math.round(part), 0, 255).toString(16).padStart(2, '0') }).join('').toUpperCase()
  }

  function hexToRgb(hex) {
    var match = /^#?([0-9a-f]{6})$/i.exec(hex)
    return match ? [parseInt(match[1].slice(0, 2), 16), parseInt(match[1].slice(2, 4), 16), parseInt(match[1].slice(4, 6), 16)] : null
  }

  function openColorDialog(options) {
    var existing = document.querySelector('.openvk-color-overlay:not(.openvk-wallpaper-overlay)')
    if (existing) existing.remove()
    var start = options && /^#[0-9a-f]{6}$/i.test(options.color || '') ? options.color : prefs.accentId === 'custom' ? prefs.customColor : currentAccent()
    var title = options && options.title ? options.title : words.choose
    var rgb = hexToRgb(start) || [81, 129, 184]
    var hsl = rgbToHsl(rgb[0], rgb[1], rgb[2])
    var h = hsl[0], s = hsl[1], l = hsl[2]
    var overlay = document.createElement('div')
    overlay.className = 'openvk-color-overlay'
    overlay.innerHTML = '<section class="openvk-color-dialog" role="dialog" aria-modal="true" aria-labelledby="openvk-color-title">' +
      '<h2 id="openvk-color-title">' + title + '</h2>' +
      '<div class="openvk-color-picker-layout"><div><div class="openvk-color-plane" role="slider" tabindex="0" aria-label="' + title + '"></div>' +
      '<label class="openvk-lightness-row">' + words.lightness + '<input type="range" min="0" max="100" value="' + l + '" data-field="lightness"></label></div>' +
      '<div class="openvk-color-picker-controls"><span class="openvk-current-preview"><span data-preview="new"></span><span data-preview="old"></span></span>' +
      '<div class="openvk-color-fields"><label class="openvk-color-field">H<input type="number" min="0" max="360" data-field="h"></label><label class="openvk-color-field">S<input type="number" min="0" max="100" data-field="s"></label><label class="openvk-color-field">L<input type="number" min="0" max="100" data-field="l"></label></div>' +
      '<div class="openvk-color-fields"><label class="openvk-color-field">R<input type="number" min="0" max="255" data-field="r"></label><label class="openvk-color-field">G<input type="number" min="0" max="255" data-field="g"></label><label class="openvk-color-field">B<input type="number" min="0" max="255" data-field="b"></label></div>' +
      '<label class="openvk-color-field">#<input type="text" maxlength="7" data-field="hex"></label></div></div>' +
      '<div class="openvk-color-actions"><button type="button" data-action="cancel">' + words.cancel + '</button><button type="button" class="-primary" data-action="save">' + words.save + '</button></div></section>'
    document.body.appendChild(overlay)
    var plane = overlay.querySelector('.openvk-color-plane')

    function chosenColor() { return rgbToHex(hslToRgb(h, s, l)) }
    function updateFields() {
      var color = chosenColor(), parts = hexToRgb(color)
      var gray = rgbToHex(hslToRgb(0, 0, l))
      var rainbow = [0, 60, 120, 180, 240, 300, 360].map(function (hue) {
        return rgbToHex(hslToRgb(hue, 100, l))
      })
      plane.style.backgroundImage = 'linear-gradient(to top, ' + gray + ', transparent), linear-gradient(to right, ' + rainbow.join(', ') + ')'
      overlay.querySelector('[data-preview="new"]').style.background = color
      overlay.querySelector('[data-preview="old"]').style.background = start
      plane.style.setProperty('--picker-x', (h / 360 * 100) + '%')
      plane.style.setProperty('--picker-y', (100 - s) + '%')
      overlay.querySelector('[data-field="h"]').value = h
      overlay.querySelector('[data-field="s"]').value = s
      overlay.querySelector('[data-field="l"]').value = l
      overlay.querySelector('[data-field="lightness"]').value = l
      overlay.querySelector('[data-field="r"]').value = parts[0]
      overlay.querySelector('[data-field="g"]').value = parts[1]
      overlay.querySelector('[data-field="b"]').value = parts[2]
      overlay.querySelector('[data-field="hex"]').value = color
    }
    function setFromHsl() {
      h = clamp(Number(overlay.querySelector('[data-field="h"]').value) || 0, 0, 360)
      s = clamp(Number(overlay.querySelector('[data-field="s"]').value) || 0, 0, 100)
      l = clamp(Number(overlay.querySelector('[data-field="l"]').value) || 0, 0, 100)
      updateFields()
    }
    function setFromRgb() {
      var r = clamp(Number(overlay.querySelector('[data-field="r"]').value) || 0, 0, 255)
      var g = clamp(Number(overlay.querySelector('[data-field="g"]').value) || 0, 0, 255)
      var b = clamp(Number(overlay.querySelector('[data-field="b"]').value) || 0, 0, 255)
      var next = rgbToHsl(r, g, b)
      h = next[0]; s = next[1]; l = next[2]
      updateFields()
    }
    function pick(e) {
      var rect = plane.getBoundingClientRect()
      h = Math.round(clamp((e.clientX - rect.left) / rect.width, 0, 1) * 360)
      s = Math.round((1 - clamp((e.clientY - rect.top) / rect.height, 0, 1)) * 100)
      updateFields()
    }
    plane.addEventListener('pointerdown', function (e) { plane.setPointerCapture(e.pointerId); pick(e) })
    plane.addEventListener('pointermove', function (e) { if (e.buttons) pick(e) })
    overlay.querySelectorAll('[data-field="h"], [data-field="s"], [data-field="l"]').forEach(function (field) { field.addEventListener('change', setFromHsl) })
    overlay.querySelector('[data-field="lightness"]').addEventListener('input', function () { l = Number(this.value); updateFields() })
    overlay.querySelectorAll('[data-field="r"], [data-field="g"], [data-field="b"]').forEach(function (field) { field.addEventListener('change', setFromRgb) })
    overlay.querySelector('[data-field="hex"]').addEventListener('input', function () {
      var next = hexToRgb(this.value)
      if (!next) return
      var nextHsl = rgbToHsl(next[0], next[1], next[2])
      h = nextHsl[0]; s = nextHsl[1]; l = nextHsl[2]
      updateFields()
    })
    function close() {
      overlay.remove()
      document.removeEventListener('keydown', onKey)
      if (!options) applyTheme()
    }
    overlay.querySelector('[data-action="cancel"]').addEventListener('click', close)
    overlay.querySelector('[data-action="save"]').addEventListener('click', function () {
      if (options && options.onSave) options.onSave(chosenColor())
      else {
        prefs.accentId = 'custom'
        prefs.customColor = chosenColor()
        prefs.accent = prefs.customColor
        savePrefs()
      }
      close()
    })
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close() })
    function onKey(e) { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    updateFields()
  }

  function attach() {
    var root = document.getElementById('openvk-appearance-root')
    if (root && !root.dataset.openvkReady) {
      root.dataset.openvkReady = '1'
      createPanel(root)
    }
  }

  function start() {
    if (typeof process !== 'undefined' && process.platform === 'win32' &&
        localStorage.getItem('st_use_nt7') === null && window.OpenVKSettingsController) {
      window.OpenVKSettingsController.setNotificationsSetting('nt7', true)
    }
    applyTheme()
    new MutationObserver(function () { attach(); applyWallpaper() }).observe(document.getElementById('react-root') || document.body, { childList: true, subtree: true })
    attach()
    applyWallpaper()
  }

  window.OpenVKAppearance = {
    getNotificationTheme: function () {
      var palette = lastPalette || {}
      var background = palette['layer-box-bg'] || currentTheme().bg
      return {
        background: background,
        header: palette['layer-box-header-bg'] || background,
        border: palette['header-border'] || currentTheme().border,
        foreground: palette['base-fg'] || currentTheme().fg,
        muted: palette['gray-fg'] || currentTheme().fg,
        accent: currentAccent(),
        input: palette['input-bg'] || background,
        reply: rgba(background, .92)
      }
    },
    toggleDarkTheme: function () {
      prefs.theme = currentTheme().dark ? prefs.lastLightTheme : prefs.lastDarkTheme
      savePrefs()
      applyTheme()
    }
  }

  if (window.OpenVKThemeReady) start()
  else window.addEventListener('openvk-theme-ready', start, { once: true })
})()
