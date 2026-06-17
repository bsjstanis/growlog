export function fmt(d) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
}
export function today() { return new Date().toISOString().slice(0, 10); }
export function addDays(d, n) { var dt = new Date(d + 'T12:00:00'); dt.setDate(dt.getDate() + n); return dt.toISOString().slice(0, 10); }
export function diffDays(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000); }
export function getYear(d) { return d ? new Date(d + 'T12:00:00').getFullYear() : null; }
export function fmtUAH(n) { return (n || 0).toLocaleString('uk-UA', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' \u20b4'; }

export function showErr(id, msg) {
  var el = document.getElementById(id);
  if (el) { el.innerHTML = msg; el.style.display = msg ? 'block' : 'none'; }
}
export function clearErr(id) { showErr(id, ''); }
export function parseErr(e) {
  var m = e.message;
  try { var p = JSON.parse(m); m = p.message || p.details || m; } catch (x) {}
  return m;
}

export function makeStatsBar(chips) {
  var html = '<div class="stats-bar">';
  chips.forEach(function(c) {
    if (c === 'divider') { html += '<div class="stats-divider"></div>'; return; }
    html += '<div class="stat-chip"><div class="stat-chip-val"' +
      (c.color ? ' style="color:' + c.color + '"' : '') + '>' + c.val +
      '</div><div class="stat-chip-label">' + c.label + '</div></div>';
  });
  html += '</div>'; return html;
}
