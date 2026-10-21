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
  var telegramWords = {
    create: lang.appearance_create_theme,
    import: lang.appearance_import_telegram,
    invalid: lang.appearance_telegram_invalid,
    remove: lang.appearance_delete_theme,
    rename: lang.appearance_rename_theme,
    defaultName: lang.appearance_telegram_theme_name,
    fileFilter: lang.appearance_telegram_file_filter,
    archiveTooLarge: lang.appearance_telegram_archive_too_large,
    noColors: lang.appearance_telegram_no_colors,
    entryTooLarge: lang.appearance_telegram_entry_too_large
  }

  function normalizeWallpaper(value) {
    value = value || {}
    return { path: typeof value.path === 'string' ? value.path : '', tile: !!value.tile, blur: !!value.blur, brightness: typeof value.brightness === 'number' ? Math.max(0, Math.min(100, value.brightness)) : 100, outline: !!value.outline, outlineStrength: typeof value.outlineStrength === 'number' ? Math.max(0, Math.min(100, value.outlineStrength)) : 35, outlineColor: /^#[0-9a-f]{6}$/i.test(value.outlineColor || '') ? value.outlineColor.toUpperCase() : '', revision: value.revision || 0 }
  }

  function readWallpaper() {
    try {
      var value = JSON.parse(localStorage.getItem(WALLPAPER_KEY) || '{}')
      return normalizeWallpaper(value)
    } catch (_) { return normalizeWallpaper({}) }
  }

  var globalWallpaper = readWallpaper()
  var wallpaper = globalWallpaper
  var pendingTelegramThemes = Object.create(null)
  var cssThemesStyle
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
      var telegramThemes = Array.isArray(saved.telegramThemes) ? saved.telegramThemes.filter(function (item) { return item && item.colors && item.id }).map(function (item) {
        var oldWallpaper = saved.theme === 'telegram' && item.id === saved.telegramThemeId ? globalWallpaper : {}
        return { id: item.id, name: item.name || telegramWords.defaultName, colors: item.colors, background: item.background || '', wallpaper: normalizeWallpaper(item.wallpaper || oldWallpaper) }
      }) : []
      var cssThemes = Array.isArray(saved.cssThemes) ? saved.cssThemes.filter(function (item) { return item && typeof item.id === 'string' && typeof item.css === 'string' }).map(function (item) {
        return { id: item.id, name: item.name || 'CSS theme', css: item.css, dark: item.dark === true }
      }) : []
      if (!telegramThemes.length && saved.telegramTheme && saved.telegramTheme.colors) {
        telegramThemes.push({ id: 'legacy-telegram-theme', name: saved.telegramTheme.name || telegramWords.defaultName, colors: saved.telegramTheme.colors, background: saved.telegramTheme.background || '', wallpaper: normalizeWallpaper(saved.telegramTheme.wallpaper || (saved.theme === 'telegram' ? globalWallpaper : {})) })
      }
      var selectedTelegram = telegramThemes.filter(function (item) { return item.id === saved.telegramThemeId })[0] || telegramThemes[0] || null
      return {
        theme: saved.theme === 'telegram' && selectedTelegram ? 'telegram' : cssThemes.some(function (item) { return item.id === saved.theme }) ? saved.theme : themes.some(function (item) { return item.id === saved.theme }) ? saved.theme : 'classic',
        telegramThemes: telegramThemes,
        cssThemes: cssThemes,
        telegramThemeId: selectedTelegram ? selectedTelegram.id : '',
        telegramTheme: selectedTelegram,
        accent: typeof saved.accent === 'string' ? saved.accent : '',
        accentId: typeof saved.accentId === 'string' ? saved.accentId : '',
        customColor: /^#[0-9a-f]{6}$/i.test(saved.customColor || '') ? saved.customColor.toUpperCase() : '#5181B8',
        squareAvatars: saved.squareAvatars === true,
        squareBadges: saved.squareBadges === true,
        lastLightTheme: saved.lastLightTheme === 'day' || (!saved.lastLightTheme && saved.theme === 'day') ? 'day' : 'classic',
        lastDarkTheme: saved.lastDarkTheme === 'tinted' || (!saved.lastDarkTheme && saved.theme === 'tinted') ? 'tinted' : 'night'
      }
    } catch (_) {
      return { theme: 'classic', telegramThemes: [], cssThemes: [], telegramThemeId: '', telegramTheme: null, accent: '', accentId: '', customColor: '#5181B8', squareAvatars: false, squareBadges: false, lastLightTheme: 'classic', lastDarkTheme: 'night' }
    }
  }

  var prefs = readPrefs()
  wallpaper = wallpaperForSelection(prefs.theme, prefs.telegramThemeId)
  var styleNode
  var lastPalette

  function savePrefs() {
    try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)) } catch (_) {}
  }

  function applyShapes() {
    document.body.classList.toggle('openvk-square-avatars', prefs.squareAvatars)
    document.body.classList.toggle('openvk-square-badges', prefs.squareBadges)
    document.querySelectorAll('.openvk-square-avatars-control').forEach(function (node) {
      setCheckbox(node, prefs.squareAvatars)
    })
    document.querySelectorAll('.openvk-square-badges-control').forEach(function (node) {
      setCheckbox(node, prefs.squareBadges)
    })
  }

  function telegramThemeById(id) {
    return prefs.telegramThemes.filter(function (item) { return item.id === id })[0] || pendingTelegramThemes[id] || null
  }

  function discardPendingTelegramTheme(id) {
    var pending = pendingTelegramThemes[id]
    if (!pending) return
    delete pendingTelegramThemes[id]
    if (!pending.background) return
    var path = require('path')
    var userData = require('electron').remote.app.getPath('userData')
    if (path.dirname(pending.background) === userData && path.basename(pending.background).indexOf(id + '.') === 0) {
      require('fs').unlink(pending.background, function () {})
    }
  }

  function wallpaperForSelection(themeId, telegramId) {
    var imported = themeId === 'telegram' ? telegramThemeById(telegramId) : null
    return imported ? normalizeWallpaper(imported.wallpaper) : globalWallpaper
  }

  function saveWallpaper() {
    if (prefs.theme === 'telegram' && prefs.telegramTheme) {
      prefs.telegramTheme.wallpaper = normalizeWallpaper(wallpaper)
      savePrefs()
    } else {
      globalWallpaper = wallpaper
      localStorage.setItem(WALLPAPER_KEY, JSON.stringify(wallpaper))
    }
  }

  function currentTheme() {
    return themeForSelection(prefs.theme, prefs.telegramThemeId)
  }

  function themeForSelection(themeId, telegramId) {
    var cssTheme = prefs.cssThemes.filter(function (item) { return item.id === themeId })[0]
    if (cssTheme) return { id: 'css', dark: cssTheme.dark, bg: cssTheme.dark ? '#242424' : '#FFFFFF', fg: cssTheme.dark ? '#FFFFFF' : '#222222', border: cssTheme.dark ? '#404040' : '#E2E2E2', defaultAccent: '#5181B8' }
    if (themeId === 'telegram' && telegramThemeById(telegramId)) {
      var colors = telegramThemeById(telegramId).colors
      var bg = solidColor(colors.windowBg || colors.dialogsBg || '#242424')
      var fg = solidColor(colors.windowFg || '#FFFFFF')
      var accent = solidColor(colors.activeButtonBg || colors.windowActiveTextFg || '#5181B8')
      var rgb = hexToRgb(bg) || [36, 36, 36]
      return { id: 'telegram', dark: (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000 < 140, bg: bg, fg: fg, border: solidColor(colors.filterInputBorderFg || bg), defaultAccent: accent }
    }
    return themes.filter(function (item) { return item.id === themeId })[0] || themes[0]
  }

  function solidColor(value) {
    if (/^#[0-9a-f]{6}$/i.test(value || '')) return value
    var match = /^rgba\((\d+),\s*(\d+),\s*(\d+),/.exec(value || '')
    return match ? rgbToHex(match.slice(1).map(Number)) : '#242424'
  }

  function currentAccent() {
    return accentForTheme(currentTheme())
  }

  function accentForTheme(theme) {
    if (theme.id === 'telegram') return theme.defaultAccent
    if (prefs.accentId === 'custom') return prefs.customColor
    var chosen = accents.filter(function (item) { return item.id === prefs.accentId })[0]
    return chosen ? chosen.color : theme.defaultAccent
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
    if (theme.id === 'telegram') {
      palette = window.OpenVKTelegramTheme.makePalette(baseline, prefs.telegramTheme.colors)
    } else {
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
    }
    lastPalette = palette
    if (!cssThemesStyle) {
      cssThemesStyle = document.createElement('style')
      cssThemesStyle.id = 'openvk-css-theme'
      document.head.appendChild(cssThemesStyle)
    }
    var selectedCssTheme = prefs.cssThemes.filter(function (item) { return item.id === prefs.theme })[0]
    cssThemesStyle.textContent = selectedCssTheme ? selectedCssTheme.css : ''
    styleNode.textContent = ':root{' + Object.keys(palette).map(function (name) {
      return '--' + name + ':' + palette[name] + ';'
    }).join('') + '} .im_dialog_messages{background-color:var(--base-bg);}' +
      '.im_dialog_item:not(.-selected) .im_dialog_item_verified,.im_dialog_header_verified{background-image:' + verifiedBadge(accent) + ';}' +
      'body.openvk-theme-classic .update_buttons>.wide_button_light,body.openvk-theme-day .update_buttons>.wide_button_light{color:var(--ovk-accent);}' +
      'body.openvk-theme-classic .update_buttons>.wide_button:not(.-disabled):hover,body.openvk-theme-day .update_buttons>.wide_button:not(.-disabled):hover{background-color:var(--ovk-accent);}' +
      'body.openvk-theme-classic .update_buttons>.wide_button:not(.-disabled):active,body.openvk-theme-day .update_buttons>.wide_button:not(.-disabled):active{background-color:' + scaledColor(accent, .78) + ';}'
      + 'body.openvk-theme-classic .login_submit_button:not(.-disabled):hover,body.openvk-theme-day .login_submit_button:not(.-disabled):hover{background-color:var(--ovk-accent);}'
      + 'body.openvk-theme-classic .login_submit_button:not(.-disabled):active,body.openvk-theme-day .login_submit_button:not(.-disabled):active{background-color:' + scaledColor(accent, .78) + ';}'
    document.body.classList.remove('openvk-theme-classic', 'openvk-theme-day', 'openvk-theme-tinted', 'openvk-theme-night', 'openvk-theme-telegram', 'openvk-theme-css')
    document.body.classList.add('openvk-theme-' + theme.id)
    applyShapes()
    document.documentElement.style.setProperty('--ovk-accent', accent)
    var checkRgb = hexToRgb(accent) || [81, 129, 184]
    document.documentElement.style.setProperty('--openvk-check-fg', (checkRgb[0] * 299 + checkRgb[1] * 587 + checkRgb[2] * 114) / 1000 > 150 ? '#20232B' : '#FFFFFF')
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
      checkboxMarkup('openvk-wallpaper-tile', wallpaperWords.tile) +
      checkboxMarkup('openvk-square-avatars-control', lang.appearance_square_avatars) +
      checkboxMarkup('openvk-square-badges-control', lang.appearance_square_badges)
    renderPanel(root)
    installThemeMenu(root)
    onCheckbox(root.querySelector('.openvk-square-avatars-control'), function () {
      prefs.squareAvatars = !prefs.squareAvatars
      savePrefs()
      applyShapes()
    })
    onCheckbox(root.querySelector('.openvk-square-badges-control'), function () {
      prefs.squareBadges = !prefs.squareBadges
      savePrefs()
      applyShapes()
    })
    applyShapes()
    onCheckbox(root.querySelector('.openvk-wallpaper-tile'), function () {
      wallpaper.tile = !wallpaper.tile
      saveWallpaper()
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
      wallpaper = normalizeWallpaper({})
      saveWallpaper()
      renderPanel(root)
    })
  }

  function renderPanel(root) {
    var grid = root.querySelector('.openvk-theme-grid')
    var swatches = root.querySelector('.openvk-accent-list')
    if (!grid || !swatches) return
    root.classList.toggle('openvk-telegram-active', prefs.theme === 'telegram' && !!prefs.telegramTheme)
    grid.innerHTML = themes.map(function (theme) {
      var selected = theme.id === prefs.theme
      return '<button type="button" class="openvk-theme-option' + (selected ? ' -selected' : '') + '" data-theme="' + theme.id + '" aria-pressed="' + selected + '">' +
        '<span class="openvk-theme-card"><img src="lib/themes/' + theme.image + '" alt=""><span class="openvk-theme-check" aria-hidden="true">✓</span></span>' +
        '<span class="openvk-theme-name">' + words.themes[themes.indexOf(theme)] + '</span></button>'
    }).join('') + prefs.telegramThemes.map(function (theme) {
      var selected = prefs.theme === 'telegram' && prefs.telegramThemeId === theme.id
      return '<button type="button" class="openvk-theme-option' + (selected ? ' -selected' : '') + '" data-theme="telegram" data-telegram-id="' + theme.id + '" aria-pressed="' + selected + '"><span class="openvk-theme-card"><img src="lib/themes/night.png" alt=""><span class="openvk-theme-check" aria-hidden="true">✓</span></span><span class="openvk-theme-name"></span></button>'
    }).join('') + prefs.cssThemes.map(function (theme) {
      var selected = theme.id === prefs.theme
      return '<button type="button" class="openvk-theme-option' + (selected ? ' -selected' : '') + '" data-theme="' + theme.id + '" aria-pressed="' + selected + '"><span class="openvk-theme-card"><img src="lib/themes/' + (theme.dark ? 'night.png' : 'day.png') + '" alt=""><span class="openvk-theme-check" aria-hidden="true">✓</span></span><span class="openvk-theme-name"></span></button>'
    }).join('')
    grid.querySelectorAll('[data-theme]:not([data-telegram-id])').forEach(function (button) {
      var custom = prefs.cssThemes.filter(function (item) { return item.id === button.getAttribute('data-theme') })[0]
      if (!custom) return
      button.querySelector('.openvk-theme-name').textContent = custom.name
      button.addEventListener('contextmenu', function (event) { openCssThemeContextMenu(event, custom.id) })
    })
    grid.querySelectorAll('[data-telegram-id]').forEach(function (button) {
      var imported = prefs.telegramThemes.filter(function (item) { return item.id === button.getAttribute('data-telegram-id') })[0]
      if (!imported) return
      button.querySelector('.openvk-theme-name').textContent = imported.name
      recolorTelegramThemeCard(button.querySelector('img'), imported.colors)
      button.addEventListener('contextmenu', function (event) { openThemeContextMenu(event, imported.id) })
    })
    swatches.innerHTML = accents.map(function (accent) {
      var selected = prefs.accentId === accent.id
      return '<button type="button" class="openvk-accent-option' + (selected ? ' -selected' : '') + '" data-accent="' + accent.id + '" aria-pressed="' + selected + '"><span class="openvk-accent-dot" style="background:' + accent.color + '"></span>' + words.accents[accents.indexOf(accent)] + '</button>'
    }).join('') + '<button type="button" class="openvk-accent-option' + (prefs.accentId === 'custom' ? ' -selected' : '') + '" data-accent="custom" aria-pressed="' + (prefs.accentId === 'custom') + '"><span class="openvk-accent-dot -custom"></span>' + words.custom + '</button>'
    root.querySelectorAll('[data-theme]').forEach(function (button) {
      button.addEventListener('click', function () {
        var themeId = button.getAttribute('data-theme')
        var telegramId = button.getAttribute('data-telegram-id') || ''
        if (themeId === 'telegram') {
          var imported = telegramThemeById(telegramId)
          if (!imported) return
          prefs.telegramThemeId = telegramId
          prefs.telegramTheme = imported
        } else if (themeForSelection(themeId).dark) prefs.lastDarkTheme = themeId
        else prefs.lastLightTheme = themeId
        prefs.theme = themeId
        wallpaper = wallpaperForSelection(themeId, telegramId)
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

  function openThemeContextMenu(event, id) {
    event.preventDefault()
    var previous = document.querySelector('.openvk-theme-context-menu')
    if (previous) previous.remove()
    var menu = document.createElement('div')
    menu.className = 'openvk-theme-context-menu'
    menu.setAttribute('role', 'menu')
    menu.innerHTML = '<button type="button" role="menuitem" data-action="rename">' + telegramWords.rename + '</button>' +
      '<button type="button" role="menuitem" data-action="remove">' + telegramWords.remove + '</button>'
    document.body.appendChild(menu)
    menu.style.left = Math.max(8, Math.min(event.clientX, window.innerWidth - menu.offsetWidth - 8)) + 'px'
    menu.style.top = Math.max(8, Math.min(event.clientY, window.innerHeight - menu.offsetHeight - 8)) + 'px'
    function close() {
      menu.remove()
      document.removeEventListener('mousedown', onOutside, true)
      document.removeEventListener('keydown', onKey)
    }
    function onOutside(e) { if (!menu.contains(e.target)) close() }
    function onKey(e) { if (e.key === 'Escape') close() }
    document.addEventListener('mousedown', onOutside, true)
    document.addEventListener('keydown', onKey)
    menu.querySelector('[data-action="rename"]').addEventListener('click', function () {
      close()
      openRenameThemeDialog(id)
    })
    menu.querySelector('[data-action="remove"]').addEventListener('click', function () {
      close()
      removeTelegramTheme(id)
    })
  }

  function openCssThemeContextMenu(event, id) {
    event.preventDefault()
    var previous = document.querySelector('.openvk-theme-context-menu')
    if (previous) previous.remove()
    var menu = document.createElement('div')
    menu.className = 'openvk-theme-context-menu'
    menu.innerHTML = '<button type="button" data-action="export">' + (lang.appearance_export_css || 'Export CSS') + '</button><button type="button" data-action="rename">' + telegramWords.rename + '</button><button type="button" data-action="remove">' + telegramWords.remove + '</button>'
    document.body.appendChild(menu)
    menu.style.left = Math.max(8, Math.min(event.clientX, window.innerWidth - menu.offsetWidth - 8)) + 'px'
    menu.style.top = Math.max(8, Math.min(event.clientY, window.innerHeight - menu.offsetHeight - 8)) + 'px'
    function close() { menu.remove(); document.removeEventListener('mousedown', onOutside, true) }
    function onOutside(e) { if (!menu.contains(e.target)) close() }
    document.addEventListener('mousedown', onOutside, true)
    menu.querySelector('[data-action="export"]').addEventListener('click', function () { close(); exportCssTheme(id) })
    menu.querySelector('[data-action="rename"]').addEventListener('click', function () { close(); openRenameCssThemeDialog(id) })
    menu.querySelector('[data-action="remove"]').addEventListener('click', function () { close(); removeCssTheme(id) })
  }

  function openRenameCssThemeDialog(id) {
    var theme = prefs.cssThemes.filter(function (item) { return item.id === id })[0]
    if (!theme) return
    var name = window.prompt(telegramWords.rename, theme.name)
    if (!name || !name.trim()) return
    theme.name = name.trim().slice(0, 60)
    savePrefs()
    document.querySelectorAll('.openvk-appearance').forEach(renderPanel)
  }

  function removeCssTheme(id) {
    var wasActive = prefs.theme === id
    prefs.cssThemes = prefs.cssThemes.filter(function (item) { return item.id !== id })
    if (wasActive) prefs.theme = 'classic'
    wallpaper = wallpaperForSelection(prefs.theme, prefs.telegramThemeId)
    savePrefs()
    applyTheme()
  }

  function exportCssTheme(id) {
    var theme = prefs.cssThemes.filter(function (item) { return item.id === id })[0]
    if (!theme) return
    saveCssFile(collectDocumentCss(), theme.name)
  }

  function exportCurrentThemeCss() {
    var theme = currentTheme()
    var custom = prefs.cssThemes.filter(function (item) { return item.id === prefs.theme })[0]
    saveCssFile(collectDocumentCss(), custom ? custom.name : theme.id)
  }

  function saveCssFile(css, name) {
    var remote = require('electron').remote
    remote.dialog.showSaveDialog(remote.getCurrentWindow(), { defaultPath: name.replace(/[<>:"/\\|?*]/g, '_') + '.css', filters: [{ name: 'CSS', extensions: ['css'] }] }, function (filePath) {
      if (!filePath) return
      require('fs').writeFile(filePath, css, 'utf8', function (error) { if (error) window.alert(error.message) })
    })
  }

  function collectDocumentCss() {
    var output = []
    var visited = []
    function collectRules(sheet) {
      if (!sheet || visited.indexOf(sheet) !== -1) return ''
      visited.push(sheet)
      var rules = sheet.cssRules
      if (!rules) return ''
      var source = []
      for (var i = 0; i < rules.length; i++) {
        var rule = rules[i]
        if (rule.type === 3 && rule.styleSheet) source.push(collectRules(rule.styleSheet))
        else source.push(resolveCssUrls(rule.cssText, sheet.href || document.baseURI))
      }
      return source.filter(Boolean).join('\n')
    }
    Array.prototype.forEach.call(document.styleSheets, function (sheet) {
      try {
        var source = collectRules(sheet)
        if (source) output.push('/* ' + (sheet.href || 'inline stylesheet') + ' */\n' + source)
      } catch (_) {
        // Stylesheets blocked by the browser's CSSOM access rules are skipped.
      }
    })
    return output.join('\n\n')
  }

  function resolveCssUrls(css, baseUrl) {
    return css.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, function (match, quote, value) {
      var url = value.trim()
      if (!url || /^(?:data:|blob:|https?:|file:|\/\/|\/|#)/i.test(url)) return match
      try { return 'url("' + new window.URL(url, baseUrl).href + '")' } catch (_) { return match }
    })
  }

  function chooseCssTheme() {
    var remote = require('electron').remote
    remote.dialog.showOpenDialog(remote.getCurrentWindow(), { properties: ['openFile'], filters: [{ name: 'CSS', extensions: ['css'] }] }, function (paths) {
      if (!paths || !paths[0]) return
      var fs = require('fs')
      var path = require('path')
      fs.stat(paths[0], function (statError, stats) {
        if (statError) return window.alert(statError.message)
        if (stats.size > 2 * 1024 * 1024) return window.alert(lang.appearance_css_invalid || 'Invalid or oversized CSS file')
        fs.readFile(paths[0], 'utf8', function (error, css) {
          if (error) return window.alert(error.message)
          if (!css.trim()) return window.alert(lang.appearance_css_invalid || 'Invalid or oversized CSS file')
          var id = 'css-' + Date.now() + '-' + Math.floor(Math.random() * 1000000)
          var theme = { id: id, name: path.basename(paths[0], path.extname(paths[0])), css: resolveCssUrls(css, fileUrl(paths[0])), dark: currentTheme().dark }
          prefs.cssThemes.push(theme)
          prefs.theme = id
          wallpaper = wallpaperForSelection(id, '')
          savePrefs()
          applyTheme()
        })
      })
    })
  }

  function openRenameThemeDialog(id) {
    var imported = telegramThemeById(id)
    if (!imported) return
    var overlay = document.createElement('div')
    overlay.className = 'openvk-color-overlay openvk-rename-theme-overlay'
    overlay.innerHTML = '<section class="openvk-color-dialog openvk-rename-theme-dialog" role="dialog" aria-modal="true" aria-labelledby="openvk-rename-theme-title">' +
      '<h2 id="openvk-rename-theme-title">' + telegramWords.rename + '</h2>' +
      '<input type="text" maxlength="60" aria-label="' + telegramWords.rename + '">' +
      '<div class="openvk-color-actions"><button type="button" data-action="cancel">' + words.cancel + '</button><button type="button" class="-primary" data-action="save">' + words.save + '</button></div></section>'
    document.body.appendChild(overlay)
    var input = overlay.querySelector('input')
    input.value = imported.name
    input.focus()
    input.select()
    function close() { overlay.remove(); document.removeEventListener('keydown', onKey) }
    function save() {
      var name = input.value.trim()
      if (!name) { input.focus(); return }
      imported.name = name
      savePrefs()
      document.querySelectorAll('.openvk-appearance').forEach(renderPanel)
      close()
    }
    function onKey(event) {
      if (event.key === 'Escape') close()
      else if (event.key === 'Enter') save()
    }
    document.addEventListener('keydown', onKey)
    overlay.addEventListener('click', function (event) { if (event.target === overlay) close() })
    overlay.querySelector('[data-action="cancel"]').addEventListener('click', close)
    overlay.querySelector('[data-action="save"]').addEventListener('click', save)
  }

  function removeTelegramTheme(id) {
    var removed = prefs.telegramThemes.filter(function (item) { return item.id === id })[0]
    if (!removed) return
    var wasActive = prefs.theme === 'telegram' && prefs.telegramThemeId === id
    var wasDark = wasActive && currentTheme().dark
    prefs.telegramThemes = prefs.telegramThemes.filter(function (item) { return item.id !== id })
    if (prefs.telegramThemeId === id) {
      prefs.telegramTheme = prefs.telegramThemes[0] || null
      prefs.telegramThemeId = prefs.telegramTheme ? prefs.telegramTheme.id : ''
    }
    if (wasActive && !prefs.telegramTheme) prefs.theme = wasDark ? prefs.lastDarkTheme : prefs.lastLightTheme
    wallpaper = wallpaperForSelection(prefs.theme, prefs.telegramThemeId)
    savePrefs()
    applyTheme()
  }

  function recolorTelegramThemeCard(image, colors) {
    function paint() {
      if (!image.naturalWidth) return
      var canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      var context = canvas.getContext('2d')
      context.drawImage(image, 0, 0)
      var picture = context.getImageData(0, 0, canvas.width, canvas.height)
      var pixels = picture.data
      var background = hexToRgb(solidColor(colors.windowBg || colors.dialogsBg || '#242424'))
      var text = hexToRgb(solidColor(colors.dialogsTextFg || colors.windowSubTextFg || '#A4A4A4'))
      var avatar = hexToRgb(solidColor(colors.historyPeer1UserpicBg || colors.activeButtonBg || '#A4A4A4'))
      var baseAt = ((canvas.height - 8) * canvas.width + Math.floor(canvas.width / 2)) * 4
      var backgroundLight = (pixels[baseAt] + pixels[baseAt + 1] + pixels[baseAt + 2]) / 3
      var inkAt = (20 * canvas.width + 25) * 4
      var inkLight = (pixels[inkAt] + pixels[inkAt + 1] + pixels[inkAt + 2]) / 3
      var spread = Math.max(1, inkLight - backgroundLight)
      for (var y = 0; y < canvas.height; y++) {
        for (var x = 0; x < canvas.width; x++) {
          var at = (y * canvas.width + x) * 4
          var light = (pixels[at] + pixels[at + 1] + pixels[at + 2]) / 3
          var amount = clamp((light - backgroundLight) / spread, 0, 1)
          var foreground = x < 48 && y < 155 ? avatar : text
          for (var channel = 0; channel < 3; channel++) pixels[at + channel] = Math.round(background[channel] * (1 - amount) + foreground[channel] * amount)
        }
      }
      context.putImageData(picture, 0, 0)
      image.src = canvas.toDataURL('image/png')
    }
    if (image.complete && image.naturalWidth) paint()
    else image.addEventListener('load', paint, { once: true })
  }

  function installThemeMenu(root) {
    var header = (root.closest('.layer_box') || root.parentElement || document).querySelector('.settings_header') || document.querySelector('.settings_header')
    if (!header || header.querySelector('.openvk-theme-menu')) return
    var host = document.createElement('div')
    host.className = 'openvk-theme-menu'
    host.innerHTML = '<button type="button" class="openvk-theme-menu-trigger" aria-label="' + telegramWords.create + '" title="' + telegramWords.create + '">⋯</button>'
    var close = header.querySelector('.layer_box_close')
    header.insertBefore(host, close || header.firstChild)
    host.querySelector('.openvk-theme-menu-trigger').addEventListener('click', openThemeChoiceDialog)
  }

  function openThemeChoiceDialog() {
    if (document.querySelector('.openvk-theme-choice-overlay')) return
    var overlay = document.createElement('div')
    overlay.className = 'openvk-color-overlay openvk-theme-choice-overlay'
    overlay.innerHTML = '<section class="openvk-color-dialog openvk-theme-choice-dialog" role="dialog" aria-modal="true" aria-labelledby="openvk-theme-choice-title">' +
      '<h2 id="openvk-theme-choice-title">' + telegramWords.create + '</h2>' +
      '<button type="button" class="openvk-theme-choice-import">' + telegramWords.import + '</button>' +
      '<button type="button" class="openvk-theme-choice-import openvk-theme-choice-css">' + (lang.appearance_import_css || 'Import CSS file') + '</button>' +
      '<button type="button" class="openvk-theme-choice-import openvk-theme-choice-export">' + (lang.appearance_export_css || 'Export CSS') + '</button>' +
      '<div class="openvk-color-actions"><button type="button" data-action="cancel">' + words.cancel + '</button></div></section>'
    document.body.appendChild(overlay)
    var trigger = document.querySelector('.openvk-theme-menu-trigger')
    overlay.querySelector('.openvk-theme-choice-import').focus()
    function close() {
      overlay.remove()
      document.removeEventListener('keydown', onKey)
      if (trigger) trigger.focus()
    }
    function onKey(event) { if (event.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    overlay.addEventListener('click', function (event) { if (event.target === overlay) close() })
    overlay.querySelector('[data-action="cancel"]').addEventListener('click', close)
    overlay.querySelector('.openvk-theme-choice-import').addEventListener('click', function () {
      close()
      chooseTelegramTheme()
    })
    overlay.querySelector('.openvk-theme-choice-css').addEventListener('click', function () { close(); chooseCssTheme() })
    overlay.querySelector('.openvk-theme-choice-export').addEventListener('click', function () { close(); exportCurrentThemeCss() })
  }

  function chooseTelegramTheme() {
    var remote = require('electron').remote
    remote.dialog.showOpenDialog(remote.getCurrentWindow(), {
      properties: ['openFile'],
      filters: [{ name: telegramWords.fileFilter, extensions: ['tdesktop-theme'] }]
    }, function (paths) {
      if (!paths || !paths[0]) return
      var id = 'telegram-' + Date.now() + '-' + Math.floor(Math.random() * 1000000)
      importTelegramTheme(paths[0], id, function (error, imported) {
        if (error) return window.alert(telegramWords.invalid + ': ' + error.message)
        pendingTelegramThemes[id] = { id: id, name: imported.name, colors: imported.colors, background: imported.background, wallpaper: normalizeWallpaper({ path: imported.background }) }
        openWallpaperDialog(imported.background, !imported.background, { id: 'telegram', telegramId: id, pendingImport: true })
      })
    })
  }

  function importTelegramTheme(filePath, id, callback) {
    var fs = require('fs')
    var path = require('path')
    var name = path.basename(filePath, '.tdesktop-theme')
    fs.readFile(filePath, function (error, data) {
      if (error) return callback(error)
      if (data.length > 20 * 1024 * 1024) return callback(new Error(telegramWords.archiveTooLarge))
      if (data.slice(0, 2).toString() !== 'PK') {
        var plain = window.OpenVKTelegramTheme.parse(data.toString('utf8'))
        return Object.keys(plain).length ? callback(null, { name: name, colors: plain, background: '' }) : callback(new Error(telegramWords.noColors))
      }
      require('yauzl').fromBuffer(data, { lazyEntries: true }, function (zipError, zip) {
        if (zipError) return callback(zipError)
        var colorsText = ''
        var background = ''
        var done = false
        function finish(err) {
          if (done) return
          done = true
          zip.close()
          if (err) return callback(err)
          var colors = window.OpenVKTelegramTheme.parse(colorsText)
          if (!Object.keys(colors).length) return callback(new Error(telegramWords.noColors))
          callback(null, { name: name, colors: colors, background: background })
        }
        zip.on('error', finish)
        zip.on('end', function () { finish() })
        zip.on('entry', function (entry) {
          var entryName = path.basename(entry.fileName).toLowerCase()
          var isColors = entryName === 'colors.tdesktop-theme'
          var isBackground = /^background\.(png|jpe?g|webp)$/i.test(entryName)
          if ((!isColors && !isBackground) || entry.uncompressedSize > 8 * 1024 * 1024) return zip.readEntry()
          zip.openReadStream(entry, function (streamError, stream) {
            if (streamError) return finish(streamError)
            var chunks = []
            var size = 0
            stream.on('data', function (chunk) {
              size += chunk.length
              if (size > 8 * 1024 * 1024) stream.destroy(new Error(telegramWords.entryTooLarge))
              else chunks.push(chunk)
            })
            stream.on('error', finish)
            stream.on('end', function () {
              if (done) return
              var contents = Buffer.concat(chunks)
              if (isColors) colorsText = contents.toString('utf8')
              if (isBackground) {
                try {
                  background = path.join(require('electron').remote.app.getPath('userData'), id + path.extname(entryName))
                  fs.writeFileSync(background, contents)
                } catch (writeError) { return finish(writeError) }
              }
              zip.readEntry()
            })
          })
        })
        zip.readEntry()
      })
    })
  }

  function openWallpaperDialog(filePath, existing, selection) {
    var pendingImportId = selection && selection.pendingImport ? selection.telegramId : ''
    var selectedTheme = selection ? selection.id : prefs.theme
    var selectedTelegramId = selection ? selection.telegramId : prefs.telegramThemeId
    var sourceWallpaper = wallpaperForSelection(selectedTheme, selectedTelegramId)
    var previewUrl = existing ? sourceWallpaper.path ? fileUrl(sourceWallpaper.path) + '?v=' + sourceWallpaper.revision : '' : filePath ? fileUrl(filePath) : ''
    var tiled = sourceWallpaper.tile
    var blurred = sourceWallpaper.blur
    var brightness = sourceWallpaper.brightness
    var outlined = sourceWallpaper.outline
    var outlineStrength = sourceWallpaper.outlineStrength
    var chosenOutlineColor = sourceWallpaper.outlineColor
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
      var theme = themeForSelection(selectedTheme, selectedTelegramId)
      var paletteData = window.OpenVKPaletteData || {}
      var base = paletteData[theme.id === 'night' ? 'night' : theme.dark ? 'dark' : 'light'] || {}
      var previewAccent = accentForTheme(theme)
      var previewBg = theme.id === 'tinted' ? recolorSurface(theme.bg, previewAccent, theme.id) : theme.bg
      var imported = theme.id === 'telegram' ? telegramThemeById(selectedTelegramId) : null
      var previewPalette = imported ? window.OpenVKTelegramTheme.makePalette(base, imported.colors) : base
      var vars = Object.keys(previewPalette).map(function (key) { return '--' + key + ':' + (theme.id === 'telegram' ? previewPalette[key] : recolor(recolorSurface(base[key], previewAccent, theme.id), previewAccent, theme.dark, theme.id === 'night')) + ';' }).join('')
      vars += '--base-bg:' + previewBg + ';--base-fg:' + theme.fg + ';--user-name-fg:' + previewAccent + ';--ovk-accent:' + previewAccent + ';' +
        '--openvk-wallpaper-text-halo:' + outlineColor(theme, outlineStrength, chosenOutlineColor) + ';'
      overlay.querySelector('.openvk-wallpaper-dialog').style.cssText = vars
      preview.style.backgroundColor = previewBg
      themeButton.textContent = (imported ? imported.name : words.themes[themes.indexOf(theme)]) + ' ↻'
      outlineSwatch.style.backgroundColor = chosenOutlineColor || (theme.dark ? '#000000' : '#FFFFFF')
      outlineAutoButton.hidden = !chosenOutlineColor
      setWallpaperSurface(preview, previewUrl, tiled, blurred, brightness, outlined)
    }
    themeButton.addEventListener('click', function () {
      var choices = themes.map(function (theme) { return { id: theme.id, telegramId: '' } }).concat(prefs.telegramThemes.map(function (theme) { return { id: 'telegram', telegramId: theme.id } }))
      if (pendingImportId && pendingTelegramThemes[pendingImportId]) choices.push({ id: 'telegram', telegramId: pendingImportId })
      var index = choices.findIndex(function (item) { return item.id === selectedTheme && item.telegramId === (selectedTelegramId || '') })
      var next = choices[(index + 1) % choices.length]
      selectedTheme = next.id
      selectedTelegramId = next.telegramId
      sourceWallpaper = wallpaperForSelection(selectedTheme, selectedTelegramId)
      var nextImported = selectedTheme === 'telegram' ? telegramThemeById(selectedTelegramId) : null
      filePath = sourceWallpaper.path || (nextImported && nextImported.background) || ''
      existing = !!sourceWallpaper.path || !filePath
      previewUrl = filePath ? fileUrl(filePath) + (existing ? '?v=' + sourceWallpaper.revision : '') : ''
      tiled = sourceWallpaper.tile
      blurred = sourceWallpaper.blur
      brightness = sourceWallpaper.brightness
      outlined = sourceWallpaper.outline
      outlineStrength = sourceWallpaper.outlineStrength
      chosenOutlineColor = sourceWallpaper.outlineColor
      setCheckbox(blurControl, blurred)
      setCheckbox(outlineControl, outlined)
      outlineRow.hidden = !outlined
      outlineColorRow.hidden = !outlined
      outlineInput.value = outlineStrength
      outlineRow.querySelector('output').textContent = outlineStrength + '%'
      brightnessInput.value = brightness
      overlay.querySelector('.openvk-wallpaper-brightness output').textContent = brightness + '%'
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
      var theme = themeForSelection(selectedTheme, selectedTelegramId)
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
      if (pendingImportId) discardPendingTelegramTheme(pendingImportId)
    }
    function onKey(event) {
      if (event.key === 'Escape' && !document.querySelector('.openvk-color-overlay:not(.openvk-wallpaper-overlay)')) close()
    }
    document.addEventListener('keydown', onKey)
    overlay.addEventListener('click', function (event) { if (event.target === overlay) close() })
    overlay.querySelector('[data-action="cancel"]').addEventListener('click', close)
    overlay.querySelector('[data-action="apply"]').addEventListener('click', function () {
      try {
        var nextWallpaper = normalizeWallpaper(sourceWallpaper)
        if (!existing && filePath) {
          var fs = require('fs')
          var path = require('path')
          var userData = require('electron').remote.app.getPath('userData')
          var extension = (path.extname(filePath).toLowerCase().match(/^\.(png|jpe?g|webp|gif|bmp)$/) || [])[0] || '.png'
          var target = path.join(userData, 'chat-wallpaper' + (selectedTheme === 'telegram' ? '-' + selectedTelegramId : '') + extension)
          fs.writeFileSync(target, fs.readFileSync(filePath))
          nextWallpaper.path = target
          nextWallpaper.revision = Date.now()
        }
        nextWallpaper.tile = tiled
        nextWallpaper.blur = blurred
        nextWallpaper.brightness = brightness
        nextWallpaper.outline = outlined
        nextWallpaper.outlineStrength = outlineStrength
        nextWallpaper.outlineColor = chosenOutlineColor
        if (selectedTheme === 'telegram' && selectedTelegramId === pendingImportId && pendingTelegramThemes[pendingImportId]) {
          prefs.telegramThemes.push(pendingTelegramThemes[pendingImportId])
          delete pendingTelegramThemes[pendingImportId]
        }
        prefs.theme = selectedTheme
        if (selectedTheme === 'telegram') {
          prefs.telegramThemeId = selectedTelegramId
          prefs.telegramTheme = telegramThemeById(selectedTelegramId)
        } else if (themeForSelection(selectedTheme).dark) prefs.lastDarkTheme = selectedTheme
        else prefs.lastLightTheme = selectedTheme
        wallpaper = nextWallpaper
        saveWallpaper()
        savePrefs()
        applyTheme()
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
    areAvatarsSquare: function () { return prefs.squareAvatars },
    getNotificationTheme: function () {
      var palette = lastPalette || {}
      var selectedCssTheme = prefs.cssThemes.filter(function (item) { return item.id === prefs.theme })[0]
      function cssThemeColor(name, fallback) {
        if (!selectedCssTheme) return fallback
        var expression = new RegExp('(?:^|[;{])\\s*--' + name + '\\s*:\\s*([^;}]+)', 'g')
        var match, value
        while ((match = expression.exec(selectedCssTheme.css))) value = match[1].trim()
        return value || fallback
      }
      var background = cssThemeColor('layer-box-bg', palette['layer-box-bg'] || currentTheme().bg)
      return {
        squareAvatars: prefs.squareAvatars,
        background: background,
        header: cssThemeColor('layer-box-header-bg', palette['layer-box-header-bg'] || background),
        border: cssThemeColor('header-border', palette['header-border'] || currentTheme().border),
        foreground: cssThemeColor('base-fg', palette['base-fg'] || currentTheme().fg),
        muted: cssThemeColor('gray-fg', palette['gray-fg'] || currentTheme().fg),
        accent: cssThemeColor('ovk-accent', cssThemeColor('base-icon', currentAccent())),
        title: selectedCssTheme ? cssThemeColor('win32-window-title-fg', '#fff') : null,
        titleWeight: selectedCssTheme ? '700' : null,
        titleFont: selectedCssTheme ? cssThemeColor('win32-window-title-font-family', null) : null,
        close: selectedCssTheme ? cssThemeColor('win32-window-title-btn-fg', '#fff') : null,
        input: cssThemeColor('nt-input-bg', cssThemeColor('input-bg', palette['input-bg'] || background)),
        reply: rgba(solidColor(background), .92)
      }
    },
    toggleDarkTheme: function () {
      prefs.theme = currentTheme().dark ? prefs.lastLightTheme : prefs.lastDarkTheme
      wallpaper = wallpaperForSelection(prefs.theme, prefs.telegramThemeId)
      savePrefs()
      applyTheme()
    }
  }

  if (window.OpenVKThemeReady) start()
  else window.addEventListener('openvk-theme-ready', start, { once: true })
})()
