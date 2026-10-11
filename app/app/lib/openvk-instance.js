(function (root) {
  "use strict";

  var hosts = ["api.openvk.org", "openvk.xyz", "vepurovk.xyz", "api.vepurovk.fun"];
  var labels = hosts.concat(["Вручную"]);
  var selectionKey = "openvk.instance.selection";
  var customKey = "openvk.instance.customHost";
  var httpsKey = "openvk.instance.useHttps";

  function read(key, fallback) {
    try { return root.localStorage.getItem(key) || fallback; } catch (_) { return fallback; }
  }

  function write(key, value) {
    try { root.localStorage.setItem(key, value); } catch (_) {}
  }

  function normalizedHost(value) {
    var host = String(value || "").trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
    return /^[a-z0-9.-]+(?::[0-9]{1,5})?$/i.test(host) ? host.toLowerCase() : "";
  }

  function getState() {
    var selected = read(selectionKey, hosts[0]);
    var index = selected === "manual" ? hosts.length : hosts.indexOf(selected);
    if (index < 0) index = 0;
    return {
      instanceIndex: index,
      customHost: read(customKey, ""),
      useHttps: read(httpsKey, "1") !== "0"
    };
  }

  function setSelectedIndex(index) {
    index = Number(index);
    if (index < 0 || index > hosts.length || !isFinite(index)) index = 0;
    write(selectionKey, index === hosts.length ? "manual" : hosts[index]);
  }

  function setCustomHost(value) { write(customKey, String(value || "")); }
  function setHttps(value) { write(httpsKey, value ? "1" : "0"); }

  function getHost() {
    var state = getState();
    return state.instanceIndex === hosts.length ? normalizedHost(state.customHost) : hosts[state.instanceIndex];
  }

  function getScheme() { return getState().useHttps ? "https:" : "http:"; }
  function getOrigin() { return getScheme() + "//" + getHost(); }
  function isValid() { return !!getHost(); }

  function renderSettings(React, Dropdown, Checkbox, state, onSelect, onCustomInput, onHttps) {
    var items = labels.map(function (title) { return { title: title, subtitle: "" }; });
    return React.createElement("div", { className: "openvk-instance-options" },
      React.createElement("div", { className: "openvk-instance-label" }, "Инстанция"),
      React.createElement(Dropdown, {
        items: items, selectedIndex: state.instanceIndex, onChange: onSelect
      }),
      state.instanceIndex === hosts.length ? React.createElement("div", {
        className: "input_group openvk-custom-instance"
      }, React.createElement("input", {
        type: "text", defaultValue: state.customHost,
        autoComplete: "off", spellCheck: "false", onInput: onCustomInput,
        required: true
      }), React.createElement("label", null, "Адрес инстанции")) : null,
      React.createElement(Checkbox, { checked: state.useHttps, onClick: onHttps }, "Использовать HTTPS"));
  }

  root.OpenVKInstance = {
    getState: getState, setSelectedIndex: setSelectedIndex,
    setCustomHost: setCustomHost, setHttps: setHttps,
    getHost: getHost, getScheme: getScheme, getOrigin: getOrigin,
    isValid: isValid, renderSettings: renderSettings
  };
})(window);
