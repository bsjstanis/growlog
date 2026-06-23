import { sb } from './supabase.js';
import { t } from './i18n.js';
import { fmt, today, parseErr, showErr, clearErr } from './utils.js';
import { calcStages, getStage, getWarning, getPct, STAGE_COLORS, stageName } from './stages.js';
import { toast, openModal, closeModal } from './ui.js';
import { state } from './state.js';

export var varType = 'auto';

export function setType(type) {
  varType = type;
  document.getElementById('type-auto').classList.toggle('active', type === 'auto');
  document.getElementById('type-photo').classList.toggle('active', type === 'photo');
  document.getElementById('flowering-days-wrap').style.display = type === 'auto' ? 'block' : 'none';
}

export async function renderPlants() {
  var pg = document.getElementById('page-plants');
  var locDec = decodeURIComponent(state.curLocName);
  function hdr() {
    return '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">'
      + '<div style="display:flex;align-items:center;gap:8px">'
      + '<button class="btn btn-ghost btn-sm" onclick="GrowLog.navigate(\'locations\')">&#8592; ' + t('back') + '</button>'
      + '<span style="font-size:16px;font-weight:700">&#127957;&#65039; ' + locDec + '</span></div>'
      + '<div class="view-toggle">'
      + '<button class="view-btn ' + (state.plantViewMode === 'cards' ? 'active' : '') + '" onclick="GrowLog.setViewMode(\'cards\')">&#9638;</button>'
      + '<button class="view-btn ' + (state.plantViewMode === 'list' ? 'active' : '') + '" onclick="GrowLog.setViewMode(\'list\')">&#9776;</button>'
      + '</div></div>';
  }
  pg.innerHTML = hdr() + '<div class="spinner"></div>';
  try {
    state.cache.varieties = await sb('varieties', 'GET', null, '?order=name.asc');
    var plants = await sb('plants', 'GET', null, '?location_id=eq.' + state.curLocId + '&order=plant_date.asc');
    var harvests = await sb('harvests', 'GET', null, '?select=plant_id,dry_weight_g,harvest_date');
    var html = hdr();
    if (!plants.length) html += '<div class="empty"><div class="empty-icon">&#127807;</div><p>' + t('noPlants') + '</p></div>';
    else if (state.plantViewMode === 'list') html += plants.map(function(p) { return renderPlantList(p, harvests); }).join('');
    else html += plants.map(function(p) { return renderPlantCard(p, harvests); }).join('');
    pg.innerHTML = html;
  } catch(e) { pg.innerHTML = '<div class="empty"><p>Error: ' + e.message + '</p></div>'; }
}

export function setViewMode(m) { state.plantViewMode = m; renderPlants(); }

export function renderPlantCard(p, harvests) {
  var v = state.cache.varieties.find(function(x) { return x.id === p.variety_id; }); if (!v) return '';
  var stages = calcStages(p, v), stage = getStage(p, v), pct = getPct(p, v), warn = getWarning(p, v), o = p.stage_overrides || {};
  var barClass = ['flower', 'ripening'].indexOf(stage) >= 0 ? stage : '';
  var isOpen = state.expandedTimelineId === p.id;
  var ph = harvests ? harvests.filter(function(h) { return h.plant_id === p.id; }) : [];
  var totalW = ph.reduce(function(a, h) { return a + (parseFloat(h.dry_weight_g) || 0); }, 0);
  var stageOrder = ['seedling', 'growth', 'pre_flower', 'flower', 'ripening', 'harvest'];
  var tlHtml = '<div class="stage-timeline" id="tl-' + p.id + '" style="' + (isOpen ? '' : 'display:none') + '">'
    + stageOrder.map(function(sk) {
      var isA = sk === stage && !p.is_harvested, isE = !!(o[sk]);
      return '<div class="stage-row' + (isA ? ' active-stage' : '') + '">'
        + '<div class="stage-dot" style="background:' + STAGE_COLORS[sk] + '"></div>'
        + '<span class="stage-name" style="color:' + (isA ? 'var(--green)' : 'var(--text2)') + '">' + stageName(sk) + '</span>'
        + '<span class="stage-date">' + fmt(stages[sk]) + '</span>'
        + (isE ? '<span class="stage-edited">&#9999;&#65039;</span>' : '')
        + '</div>';
    }).join('') + '</div>';
  var ne = encodeURIComponent(v.name + (p.name ? ' · ' + p.name : ''));
  return '<div class="plant-card stage-' + stage + '">'
    + '<div class="card-row"><div style="flex:1;min-width:0">'
    + '<div class="card-title">' + v.name + (p.name ? ' &middot; ' + p.name : '') + '</div>'
    + '<div class="card-sub">' + (v.brand || '') + (v.brand ? ' &middot; ' : '') + (v.seed_type === 'auto' ? t('autoflower') : t('photoperiod')) + '</div>'
    + (p.soil_type || p.pot_size_l ? '<div class="card-sub">' + (p.pot_size_l ? '&#129699; ' + p.pot_size_l + 'L' : '') + ((p.pot_size_l && p.soil_type) ? ' &middot; ' : '') + (p.soil_type || '') + '</div>' : '')
    + (p.url ? '<a href="' + p.url + '" target="_blank" class="card-sub" style="color:var(--blue);display:block;font-size:12px">&#128279; Link</a>' : '')
    + (p.is_harvested && ph.length ? '<div class="card-sub" style="color:var(--green)">&#10003; ' + ph.length + 'x' + (totalW > 0 ? ' &middot; ' + totalW.toFixed(1) + 'g' : '') + '</div>' : '')
    + '</div><div style="text-align:right;flex-shrink:0;margin-left:8px">'
    + (!p.is_harvested
      ? '<div style="font-size:10px;color:var(--text3)">&#9986;&#65039;</div><div style="font-size:13px;font-weight:600">' + fmt(stages.harvest) + '</div>'
        + (warn ? '<div class="badge badge-' + warn.type + '" style="margin-top:3px;font-size:10px">' + warn.text + '</div>' : '')
      : '<span class="badge badge-done">&#10003;</span>')
    + '</div></div>'
    + (!p.is_harvested
      ? '<div class="progress-wrap"><div class="progress-bar ' + barClass + '" style="width:' + pct + '%"></div></div>'
        + '<div style="font-size:11px;color:var(--text3);text-align:right;margin-bottom:4px">' + pct + '% ' + t('pct') + '</div>'
      : '')
    + '<div class="toggle-row" onclick="GrowLog.toggleTl(\'' + p.id + '\')">'
    + '<span style="font-size:13px;color:var(--text2);font-weight:500">' + stageName(stage) + '</span>'
    + '<span class="toggle-chevron' + (isOpen ? ' open' : '') + '" id="ch-' + p.id + '">&#9662;</span></div>'
    + tlHtml
    + '<div class="card-actions">'
    + '<button class="btn btn-ghost btn-sm" onclick="GrowLog.openEditPlant(\'' + p.id + '\')">&#9999;&#65039;</button>'
    + '<button class="btn btn-ghost btn-sm" onclick="GrowLog.openStageModal(\'' + p.id + '\',\'' + ne + '\')">&#128197;</button>'
    + (!p.is_harvested ? '<button class="btn btn-ghost btn-sm" onclick="GrowLog.openHarvestModal(\'' + p.id + '\',\'' + ne + '\')">&#9986;&#65039;</button>' : '')
    + (!p.is_harvested ? '<button class="btn btn-warning btn-sm" onclick="GrowLog.markPlantLost(\'' + p.id + '\')">&#9760;&#65039;</button>' : '')
    + '<button class="btn btn-danger btn-sm" onclick="GrowLog.deletePlant(\'' + p.id + '\')">&#128465;</button>'
    + '</div></div>';
}

export function renderPlantList(p, harvests) {
  var v = state.cache.varieties.find(function(x) { return x.id === p.variety_id; }); if (!v) return '';
  var stage = getStage(p, v), stages = calcStages(p, v), warn = getWarning(p, v), isExp = state.expandedPlantId === p.id;
  var ph = harvests ? harvests.filter(function(h) { return h.plant_id === p.id; }) : [];
  var totalW = ph.reduce(function(a, h) { return a + (parseFloat(h.dry_weight_g) || 0); }, 0);
  var ne = encodeURIComponent(v.name + (p.name ? ' · ' + p.name : ''));
  var html = '<div class="plant-list-item stage-' + stage + '" onclick="GrowLog.toggleExpand(\'' + p.id + '\')">'
    + '<div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (p.name || v.name) + '</div>'
    + '<div style="font-size:11px;color:var(--text3)">' + v.name + ' &middot; &#9986;&#65039; ' + fmt(stages.harvest) + (warn ? ' &#9888;&#65039;' : '') + (p.is_harvested && ph.length ? ' &#10003; ' + totalW.toFixed(1) + 'g' : '') + '</div></div>'
    + '<span class="badge badge-' + stage + '" style="margin:0 6px;flex-shrink:0">' + stageName(stage) + '</span>'
    + '<span style="color:var(--text3);font-size:12px">' + (isExp ? '&#9650;' : '&#9660;') + '</span></div>';
  if (isExp) {
    html += '<div style="background:var(--bg3);border-radius:0 0 var(--radius-sm) var(--radius-sm);padding:10px 12px;margin-top:-4px;margin-bottom:6px">'
      + (warn ? '<div class="badge badge-' + warn.type + '" style="margin-bottom:8px;display:inline-flex">' + warn.text + '</div>' : '')
      + '<div style="display:flex;gap:6px;flex-wrap:wrap">'
      + '<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();GrowLog.openEditPlant(\'' + p.id + '\')">&#9999;&#65039;</button>'
      + '<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();GrowLog.openStageModal(\'' + p.id + '\',\'' + ne + '\')">&#128197;</button>'
      + (!p.is_harvested ? '<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();GrowLog.openHarvestModal(\'' + p.id + '\',\'' + ne + '\')">&#9986;&#65039;</button>' : '')
      + (!p.is_harvested ? '<button class="btn btn-warning btn-sm" onclick="event.stopPropagation();GrowLog.markPlantLost(\'' + p.id + '\')">&#9760;&#65039;</button>' : '')
      + '<button class="btn btn-danger btn-sm" onclick="event.stopPropagation();GrowLog.deletePlant(\'' + p.id + '\')">&#128465;</button>'
      + '</div></div>';
  }
  return html;
}

export function toggleTl(id) {
  state.expandedTimelineId = state.expandedTimelineId === id ? null : id;
  var el = document.getElementById('tl-' + id), ch = document.getElementById('ch-' + id);
  if (el) el.style.display = state.expandedTimelineId === id ? 'block' : 'none';
  if (ch) ch.className = 'toggle-chevron' + (state.expandedTimelineId === id ? ' open' : '');
}

export function toggleExpand(id) { state.expandedPlantId = state.expandedPlantId === id ? null : id; renderPlants(); }

export function openPlantModal(prefill) {
  prefill = prefill || {};
  clearErr('plant-error');
  document.getElementById('plant-edit-id').value = '';
  document.getElementById('plant-loc-id').value = state.curLocId;
  document.getElementById('modal-plant-title').textContent = t('addPlant');
  document.getElementById('plant-save-btn').textContent = t('save');
  document.getElementById('seed-cost-wrap').style.display = 'none';
  ['plant-name','plant-soil','plant-url'].forEach(function(id) { document.getElementById(id).value = ''; });
  document.getElementById('plant-pot').value = '';
  document.getElementById('var-name').value = prefill.name || '';
  document.getElementById('var-brand').value = prefill.brand || '';
  document.getElementById('var-min').value = prefill.flowering_days_min || '';
  document.getElementById('var-max').value = prefill.flowering_days_max || '';
  document.getElementById('plant-date').value = today();
  setType(prefill.seed_type || 'auto');
  openModal('modal-plant');
}

export async function openEditPlant(plantId) {
  clearErr('plant-error');
  try {
    var rows = await sb('plants', 'GET', null, '?id=eq.' + plantId); var p = rows[0]; if (!p) return;
    var vr = await sb('varieties', 'GET', null, '?id=eq.' + p.variety_id); var variety = vr[0];
    document.getElementById('plant-edit-id').value = plantId;
    document.getElementById('plant-loc-id').value = p.location_id;
    document.getElementById('modal-plant-title').textContent = t('editPlant');
    document.getElementById('plant-save-btn').textContent = t('save');
    document.getElementById('seed-cost-wrap').style.display = 'none';
    document.getElementById('plant-name').value = p.name || '';
    document.getElementById('plant-date').value = p.plant_date || today();
    document.getElementById('plant-pot').value = p.pot_size_l || '';
    document.getElementById('plant-soil').value = p.soil_type || '';
    document.getElementById('plant-url').value = p.url || '';
    document.getElementById('var-name').value = variety ? variety.name || '' : '';
    document.getElementById('var-brand').value = variety ? variety.brand || '' : '';
    if (variety) {
      setType(variety.seed_type || 'auto');
      document.getElementById('var-min').value = variety.flowering_days_min || '';
      document.getElementById('var-max').value = variety.flowering_days_max || '';
    }
    openModal('modal-plant');
  } catch(e) { toast('Error: ' + parseErr(e)); }
}

export async function savePlant() {
  var editId = document.getElementById('plant-edit-id').value;
  var varName = document.getElementById('var-name').value.trim();
  var date = document.getElementById('plant-date').value;
  var minV = document.getElementById('var-min').value, maxV = document.getElementById('var-max').value;
  var min = parseInt(minV), max = parseInt(maxV);
  clearErr('plant-error'); var errs = [];
  if (!date) errs.push(t('errDate'));
  if (!varName) errs.push(t('errVariety'));
  if (varType === 'auto') {
    if (!minV) errs.push(t('errMin'));
    if (!maxV) errs.push(t('errMax'));
    if (minV && maxV && min > max) errs.push(t('errMinMax'));
  }
  if (errs.length) { showErr('plant-error', errs.map(function(e) { return '&#9888;&#65039; ' + e; }).join('<br>')); return; }
  try {
    var varData = { name: varName, brand: document.getElementById('var-brand').value.trim(), seed_type: varType, flowering_days_min: varType === 'auto' ? min : 0, flowering_days_max: varType === 'auto' ? max : 0 };
    var plantData = { name: document.getElementById('plant-name').value.trim(), plant_date: date, soil_type: document.getElementById('plant-soil').value.trim() || null, pot_size_l: parseFloat(document.getElementById('plant-pot').value) || null, url: document.getElementById('plant-url').value.trim() || null };
    if (editId) {
      var rows = await sb('plants', 'GET', null, '?id=eq.' + editId + '&select=variety_id');
      await sb('varieties', 'PATCH', varData, '?id=eq.' + rows[0].variety_id);
      await sb('plants', 'PATCH', plantData, '?id=eq.' + editId);
      closeModal('modal-plant'); toast(t('updated') + ' &#10003;');
    } else {
      var nv = await sb('varieties', 'POST', varData); if (!nv || !nv[0]) throw new Error('Could not create variety');
      plantData.location_id = state.curLocId; plantData.variety_id = nv[0].id;
      plantData.current_stage = 'seedling'; plantData.stage_overrides = {}; plantData.is_harvested = false;
      await sb('plants', 'POST', plantData);
      closeModal('modal-plant'); toast(t('added') + ' &#10003;');
    }
    renderPlants();
  } catch(e) { showErr('plant-error', '&#10060; ' + parseErr(e)); }
}

export async function deletePlant(id) {
  if (!confirm(t('confirmPlant'))) return;
  try {
    await sb('harvests', 'DELETE', null, '?plant_id=eq.' + id);
    await sb('expenses', 'DELETE', null, '?plant_id=eq.' + id);
    await sb('plants', 'DELETE', null, '?id=eq.' + id);
    toast(t('deleted')); renderPlants();
  } catch(e) { toast('Error: ' + parseErr(e)); }
}

export async function markPlantLost(id) {
  if (!confirm('Позначити рослину як пропавшу?')) return;
  try {
    var rows = await sb('plants', 'GET', null, '?id=eq.' + id + '&select=stage_overrides');
    var o = Object.assign({}, rows[0] && rows[0].stage_overrides || {});
    o.lost = today();
    await sb('plants', 'PATCH', { is_harvested: true, stage_overrides: o }, '?id=eq.' + id);
    toast('&#9760;&#65039; Позначено як пропавшу'); renderPlants();
  } catch(e) { toast('Error: ' + parseErr(e)); }
}

export async function openStageModal(plantId, labelEnc) {
  clearErr('stage-error');
  document.getElementById('stage-plant-id').value = plantId;
  document.getElementById('stage-info').textContent = decodeURIComponent(labelEnc);
  document.getElementById('stage-date').value = today();
  document.getElementById('modal-stage-title').textContent = t('stageSet');
  // Show which stages have overrides
  try {
    var rows = await sb('plants', 'GET', null, '?id=eq.' + plantId + '&select=stage_overrides');
    var o = (rows[0] && rows[0].stage_overrides) || {};
    var overriddenKeys = Object.keys(o);
    var sel = document.getElementById('stage-key');
    if (sel) {
      Array.from(sel.options).forEach(function(opt) {
        var hasOverride = overriddenKeys.indexOf(opt.value) >= 0;
        opt.text = opt.getAttribute('data-label') + (hasOverride ? ' ✏️' : '');
      });
      // Auto-select first overridden stage if any
      if (overriddenKeys.length > 0) sel.value = overriddenKeys[0];
    }
    var infoEl = document.getElementById('stage-overrides-info');
    if (infoEl) {
      infoEl.textContent = overriddenKeys.length
        ? 'Встановлені вручну: ' + overriddenKeys.map(function(k){ return stageName(k); }).join(', ')
        : '';
      infoEl.style.display = overriddenKeys.length ? 'block' : 'none';
    }
  } catch(e) {}
  openModal('modal-stage');
}

export async function resetStage() {
  var plantId = document.getElementById('stage-plant-id').value;
  var key = document.getElementById('stage-key').value;
  try {
    var rows = await sb('plants', 'GET', null, '?id=eq.' + plantId + '&select=id,stage_overrides');
    var p = rows[0]; if (!p) return;
    var o = Object.assign({}, p.stage_overrides || {});
    if (!(key in o)) {
      toast('ℹ️ Стадія "' + stageName(key) + '" вже за замовчуванням'); return;
    }
    delete o[key];
    await sb('plants', 'PATCH', { stage_overrides: o }, '?id=eq.' + plantId);
    state.cache.varieties = [];
    closeModal('modal-stage');
    toast('✅ Стадію "' + stageName(key) + '" скинуто до авторозрахунку');
    renderPlants();
  } catch(e) { showErr('stage-error', '&#10060; ' + parseErr(e)); }
}

export async function saveStage() {
  var plantId = document.getElementById('stage-plant-id').value;
  var key = document.getElementById('stage-key').value;
  var date = document.getElementById('stage-date').value;
  if (!date) { showErr('stage-error', '&#9888;&#65039; ' + t('errHarvDate')); return; }
  try {
    var rows = await sb('plants', 'GET', null, '?id=eq.' + plantId + '&select=stage_overrides');
    var o = rows[0] ? rows[0].stage_overrides || {} : {}; o[key] = date;
    await sb('plants', 'PATCH', { stage_overrides: o }, '?id=eq.' + plantId);
    state.cache.varieties = [];
    closeModal('modal-stage'); toast(t('saved') + ' &#10003;'); renderPlants();
  } catch(e) { showErr('stage-error', '&#10060; ' + parseErr(e)); }
}
