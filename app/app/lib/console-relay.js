(function () {
  'use strict';

  if (!/[?&]debug=1(?:&|$)/.test(location.search)) return;

  function format(value) {
    if (value instanceof Error) return value.stack || value.message;
    if (typeof value === 'string') return value;
    if (typeof value === 'undefined') return 'undefined';
    try {
      var json = JSON.stringify(value);
      if (value && value.data instanceof Error) json += '\n' + (value.data.stack || value.data.message);
      return json;
    } catch (e) {
      return String(value);
    }
  }

  ['log', 'info', 'warn', 'error'].forEach(function (level) {
    var original = console[level].bind(console);
    console[level] = function () {
      var parts = Array.prototype.map.call(arguments, format);
      original(parts.join(' ').replace(/("access_token"\s*:\s*")[^"]+/g, '$1[redacted]')
        .replace(/(access_token=)[^&\s]+/g, '$1[redacted]'));
    };
  });
})();
