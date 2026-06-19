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

export function renderStatsBar(variant, data) {
  // data for 'plants': { active, auto, photo, seedling, growth, pre_flower, flower, ripening, harvested }
  // data for 'harvest': { plants, harvests, totalWeight, seedling, growth, pre_flower, flower, ripening, harvested }
  var stageGrid = '<div class="stage-grid">' +
    makeStageCell(data.seedling || 0, '🌱', 'Паросток', 'sc-neutral') +
    makeStageCell(data.growth || 0, '🌿', 'Ріст', 'sc-green') +
    makeStageCell(data.pre_flower || 0, '🌼', 'Передцвіт', 'sc-blue') +
    makeStageCell(data.flower || 0, '🌸', 'Цвітіння', 'sc-purple') +
    makeStageCell(data.ripening || 0, '🟡', 'Дозрів.', 'sc-yellow') +
    makeStageCell(data.harvested || 0, '✅', 'Зібрано', 'sc-neutral') +
  '</div>';

  var leftBlock = '';
  if (variant === 'plants') {
    leftBlock = '<div class="stats-left-plants">' +
      '<div class="slp-big">' + (data.active || 0) + '</div>' +
      '<div class="slp-lbl">Активних</div>' +
      '<div class="slp-div"></div>' +
      '<div class="slp-sub">А' + (data.auto || 0) + ' · Ф' + (data.photo || 0) + '</div>' +
    '</div>';
  } else {
    var wStr = data.totalWeight >= 1000
      ? (data.totalWeight / 1000).toFixed(1) + 'kg'
      : (data.totalWeight || 0).toFixed(1) + 'g';
    leftBlock = '<div class="stats-left-harvest">' +
      '<div class="slh-row">' +
        '<span class="slh-big">' + (data.plants || 0) + '</span>' +
        '<span class="slh-lbl">рослин</span>' +
      '</div>' +
      '<div class="slh-hdiv"></div>' +
      '<div class="slh-row">' +
        '<span class="slh-icon">✂️</span>' +
        '<span class="slh-num">' + (data.harvests || 0) + '</span>' +
      '</div>' +
      '<div class="slh-hdiv"></div>' +
      '<div class="slh-row">' +
        '<span class="slh-num">' + wStr + '</span>' +
      '</div>' +
    '</div>';
  }

  return '<div class="stats-row" style="margin-bottom:14px">' + leftBlock + stageGrid + '</div>';
}

function makeStageCell(count, icon, label, colorClass) {
  return '<div class="sc ' + colorClass + '">' +
    '<span class="sc-num">' + count + '</span>' +
    '<span class="sc-nm">' + icon + ' ' + label + '</span>' +
  '</div>';
}
