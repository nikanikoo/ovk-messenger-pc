"""Add the recovered client's native dropdown and checkbox to its login view.

The renderer is a recovered minified bundle. Every replacement is checked so
the patch fails when the upstream bundle changes and is safe to rerun.
"""

from pathlib import Path


bundle = Path(__file__).resolve().parents[1] / "app" / "dist" / "main.js"
source = bundle.read_text(encoding="utf-8")


def replace_once(old: str, new: str) -> None:
    global source
    if source.count(new) == 1 and source.count(old) == 0:
        return
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one occurrence, found {count}: {old[:100]}")
    source = source.replace(old, new, 1)


# OAuth and all API requests use the selected host and protocol.
replace_once(
    'i.setHost(ke),i.setPath("/method/"+e)',
    'i.setHost(window.OpenVKInstance.getHost()),i.setScheme(window.OpenVKInstance.getScheme()),i.setPath("/method/"+e)',
)
replace_once(
    'u.setHost("api.openvk.org"),u.setPath("/token")',
    'u.setHost(window.OpenVKInstance.getHost()),u.setScheme(window.OpenVKInstance.getScheme()),u.setPath("/token")',
)
replace_once(
    'return"https://api.openvk.org/authorize?client_id="+l.default.API_ID+"&redirect_uri=https://api.openvk.org/blank.html&scope=',
    'return window.OpenVKInstance.getOrigin()+"/authorize?client_id="+l.default.API_ID+"&redirect_uri="+encodeURIComponent(window.OpenVKInstance.getOrigin()+"/blank.html")+"&scope=',
)

# The existing login form owns its state; the dropdown (module 811) and
# checkbox (module 216) are the app's existing UI components.
replace_once(
    'o.onPasswordInput=function(e){o.updateButtonEnabledState()},o.onFieldKeyDown=',
    'o.onPasswordInput=function(e){o.updateButtonEnabledState()},o.onInstanceChange=function(e){e=Number(e),window.OpenVKInstance.setSelectedIndex(e),o.setState({instanceIndex:e},o.updateButtonEnabledState)},o.onCustomHostInput=function(e){window.OpenVKInstance.setCustomHost(e.target.value),o.updateButtonEnabledState()},o.onHttpsChange=function(e){window.OpenVKInstance.setHttps(e),o.setState({useHttps:e})},o.onFieldKeyDown=',
)
replace_once(
    't=(0,C.nonEmptyPassword)(o.refs.passwordField.value),n=e&&t;',
    't=(0,C.nonEmptyPassword)(o.refs.passwordField.value),n=e&&t&&window.OpenVKInstance.isValid();',
)
replace_once(
    'o.state={buttonEnabled:!1,buttonWidth:null,passwordVisible:!1}',
    'o.state=Object.assign({buttonEnabled:!1,buttonWidth:null,passwordVisible:!1},window.OpenVKInstance.getState())',
)
replace_once(
    'f.default.createElement("label",null,lang.login_password)),this.renderError(),f.default.createElement("div",{className:"login_submit_wrap"}',
    'f.default.createElement("label",null,lang.login_password)),window.OpenVKInstance.renderSettings(f.default,n(811),n(216),this.state,this.onInstanceChange,this.onCustomHostInput,this.onHttpsChange),this.renderError(),f.default.createElement("div",{className:"login_submit_wrap"}',
)

bundle.write_text(source, encoding="utf-8")
print("Patched login instance selector:", bundle)
