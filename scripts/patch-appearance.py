"""Add the OpenVK appearance settings tab to the recovered renderer bundle."""

from pathlib import Path
import re


bundle = Path(__file__).resolve().parents[1] / "app" / "dist" / "main.js"
source = bundle.read_text(encoding="utf-8")

# Earlier revisions could append the same tab and translation on a second run.
appearance_case = (
    '            case "appearance":\n'
    '              i = c.default.createElement("div", {\n'
    '                id: "openvk-appearance-root"\n'
    '              });\n'
    '              break;\n'
)
while appearance_case + appearance_case in source:
    source = source.replace(appearance_case + appearance_case, appearance_case, 1)
source = re.sub(r'(?m)^(\s*settings_appearance: [^\n]+\n)\1+', r'\1', source)


def replace_once(old: str, new: str) -> None:
    global source
    if source.count(new) == 1:
        return
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one occurrence, found {count}: {old[:120]}")
    source = source.replace(old, new, 1)


replace_once(
    'e.Tabs = ["general", "notifications", "blacklist", "communities"]',
    'e.Tabs = ["general", "appearance", "notifications", "blacklist", "communities"]',
)
replace_once(
    'case "interface":\n              i = c.default.createElement(Interface, null);\n            case "notifications":',
    'case "appearance":\n              i = c.default.createElement("div", {\n                id: "openvk-appearance-root"\n              });\n              break;\n            case "interface":\n              i = c.default.createElement(Interface, null);\n            case "notifications":',
)
replace_once(
    '              onChange: this.onLangChange\n            })), t.push(this.renderThemesSelect()), this.props.currentTheme.default || t.push(d.default.createElement(k.default, {\n              key: "theme_watch",\n              secondLevel: !0,\n              enabled: this.props.themeWatchingEnabled,\n              label: lang.designer_mode,\n              onToggle: this.onThemeWatcherToggle\n            })), t.push(d.default.createElement(k.default, {\n              key: "tray",',
    '              onChange: this.onLangChange\n            })), t.push(d.default.createElement(k.default, {\n              key: "tray",',
)
replace_once(
    '    watcher: new G\n  }, e.exports = t.default',
    '    watcher: new G\n  }, window.OpenVKTheme = t.default, e.exports = t.default',
)
replace_once(
    '    loadDefaultTheme: g,\n    getCurrentTheme: y,',
    '    loadDefaultTheme: g,\n    setOpenVKDefaultTheme: function(dark) { C.default.setJSON("theme", { default: 1, dark: dark ? 1 : 0 }); return g({ dark: dark, withTransition: false }) },\n    getCurrentTheme: y,',
)
replace_once(
    '  t.default = new ae, e.exports = t.default',
    '  t.default = new ae, window.OpenVKSettingsController = t.default, e.exports = t.default',
)
replace_once(
    '            B.default.loadDefaultTheme({\n              withTransition: !0,\n              dark: o\n            })',
    '            B.default.loadDefaultTheme({\n              withTransition: !1,\n              dark: o\n            })',
)
replace_once(
    '        }, n.onDarkThemeClick = function() {\n          U.default.toggleDarkTheme()\n        }, n.onDarkThemeChange = function(e) {',
    '        }, n.onDarkThemeClick = function() {\n          window.OpenVKAppearance ? window.OpenVKAppearance.toggleDarkTheme() : U.default.toggleDarkTheme()\n        }, n.onDarkThemeChange = function(e) {',
)
replace_once(
    '                hasReplyButton: !u,\n                data: s\n              });',
    '                hasReplyButton: !u,\n                data: s,\n                appearance: window.OpenVKAppearance && window.OpenVKAppearance.getNotificationTheme()\n              });',
)
replace_once(
    '          }, r().then(function() {\n            s.start(), l.default.render(d.default.createElement(u, null), e)\n          })',
    '          }, r().then(function() {\n            s.start(), l.default.render(d.default.createElement(u, null), e), window.OpenVKThemeReady = true, window.dispatchEvent(new Event("openvk-theme-ready"))\n          })',
)
replace_once(
    '          }, r().then(function() {\n            o.load(), l.default.render(d.default.createElement(i, null), e)\n          });',
    '          }, r().then(function() {\n            o.load(), l.default.render(d.default.createElement(i, null), e), window.OpenVKThemeReady = true, window.dispatchEvent(new Event("openvk-theme-ready"))\n          });',
)
replace_once(
    '            left: this.state.tabUnderlineLeft,\n            width: this.state.tabUnderlineWidth',
    '            left: this.state.tabUnderlineLeft,\n            width: this.state.tabUnderlineWidth,\n            top: this.state.tabUnderlineTop',
)
replace_once(
    '              tabUnderlineLeft: t.offsetLeft,\n              tabUnderlineWidth: t.offsetWidth',
    '              tabUnderlineLeft: t.offsetLeft,\n              tabUnderlineWidth: t.offsetWidth,\n              tabUnderlineTop: t.offsetTop + t.offsetHeight - 2',
)
replace_once(
    '            tabUnderlineWidth: 0,\n            tabUnderlineLeft: 0',
    '            tabUnderlineWidth: 0,\n            tabUnderlineLeft: 0,\n            tabUnderlineTop: 0',
)
replace_once(
    '          n.state.compactMode != e && n.setState({\n            compactMode: e\n          })',
    '          n.setState(Object.assign({ compactMode: e }, n.getTabUnderlineParams()))',
)
replace_once(
    '    var t = e.left,\n      n = e.width,\n      o = {\n        left: t,\n        width: n\n      };',
    '    var t = e.left,\n      n = e.width,\n      o = {\n        left: t,\n        width: n,\n        top: e.top\n      };',
)

for old, new in [
    ('settings_general: "General",', 'settings_general: "General",\n      settings_appearance: "Appearance",'),
    ('settings_general: "Основные",', 'settings_general: "Основные",\n      settings_appearance: "Внешний вид",'),
    ('settings_general: "Основні",', 'settings_general: "Основні",\n      settings_appearance: "Вигляд",'),
]:
    replace_once(old, new)

bundle.write_text(source, encoding="utf-8")
print("Added OpenVK appearance settings tab:", bundle)
