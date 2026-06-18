import { sb } from './supabase.js';
import { t } from './i18n.js';
import { makeStatsBar, renderStatsBar, parseErr, showErr, clearErr } from './utils.js';
import { getStage } from './stages.js';
import { toast, openModal, closeModal } from './ui.js';
import { state } from './state.js';
import { makeModeTabs, renderGrows } from './grows.js';

export async function renderLocations() {
  if (state.mode === 'indoor') {
    if (state.curGrowId) {
      await renderGrowLocations();
    } else {
      await renderGrows();
    }
    return;
  }
  // OUTDOOR mode
  var pg = document.getElementById('page-locations'); pg.innerHTML = makeModeTabs() + '<div class="spinner"></div>';
  try {
    var allLocs = await sb('locations', 'GET', null, '?mode=eq.outdoor&order=created_at.asc');
    state.cache.locations = allLocs;
    var plants = await sb('plants', 'GET', null, '?select=id,location_id,variety_id,is_harvested,plant_date,stage_overrides');
    if (!state.cache.varieties.length) state.cache.varieties = await sb('varieties', 'GET', null, '?order=name.asc');
    var harvests = await sb('harvests', 'GET', null, '?select=plant_id,dry_weight_g');
    var activePlants = plants.filter(function(p) { return !p.is_harvested; });
    var autoCount = 0, photoCount = 0;
    var sc = { growth: 0, pre_flower: 0, flower: 0, ripening: 0, harvest: 0 };
    activePlants.forEach(function(p) {
      var v = state.cache.varieties.find(function(x) { return x.id === p.variety_id; }); if (!v) return;
      if (v.seed_type === 'auto') autoCount++; else photoCount++;
      var st = getStage(p, v); if (sc[st] !== undefined) sc[st]++;
    });
    var harvestedCount = plants.filter(function(p) { return p.is_harvested; }).length;
    var hasCycles = sc.growth > 0 || sc.pre_flower > 0 || sc.flower > 0 || sc.ripening > 0 || sc.harvest > 0 || harvestedCount > 0;
    var statsHtml = renderStatsBar('plants', {
      active: activePlants.length, auto: autoCount, photo: photoCount,
      seedling: sc.seedling || 0, growth: sc.growth, pre_flower: sc.pre_flower,
      flower: sc.flower, ripening: sc.ripening, harvested: harvestedCount
    });
import { t } from './i18n.js';
import { makeStatsBar, renderStatsBar, parseErr, showErr, clearErr } from './utils.js';
import { getStage } from './stages.js';
import { toast, openModal, closeModal } from './ui.js';
import { state } from './state.js';
import { makeModeTabs, renderGrows } from './grows.js';

export async function renderLocations() {
  if (state.mode === 'indoor') {
    if (state.curGrowId) {
      await renderGrowLocations();
    } else {
      await renderGrows();
    }
    return;
  }
  // OUTDOOR mode
  var pg = document.getElementById('page-locations'); pg.innerHTML = makeModeTabs() + '<div class="spinner"></div>';
  try {
    var allLocs = await sb('locations', 'GET', null, '?mode=eq.outdoor&order=created_at.asc');
    state.cache.locations = allLocs;
    var plants = await sb('plants', 'GET', null, '?select=id,location_id,variety_id,is_harvested,plant_date,stage_overrides');
    if (!state.cache.varieties.length) state.cache.varieties = await sb('varieties', 'GET', null, '?order=name.asc');
    var harvests = await sb('harvests', 'GET', null, '?select=plant_id,dry_weight_g');
    var activePlants = plants.filter(function(p) { return !p.is_harvested; });
    var autoCount = 0, photoCount = 0;
    var sc = { growth: 0, pre_flower: 0, flower: 0, ripening: 0, harvest: 0 };
    activePlants.forEach(function(p) {
      var v = state.cache.varieties.find(function(x) { return x.id === p.variety_id; }); if (!v) return;
      if (v.seed_type === 'auto') autoCount++; else photoCount++;
      var st = getStage(p, v); if (sc[st] !== undefined) sc[st]++;
    });
    var harvestedCount = plants.filter(function(p) { return p.is_harvested; }).length;
    var hasCycles = sc.growth > 0 || sc.pre_flower > 0 || sc.flower > 0 || sc.ripening > 0 || sc.harvest > 0 || harvestedCount > 0;
    var statsHtml = renderStatsBar('plants', {
      active: activePlants.length, auto: autoCount, photo: photoCount,
      seedling: sc.seedling || 0, growth: sc.growth, pre_flower: sc.pre_flower,
      flower: sc.flower, ripening: sc.ripening, harvested: harvestedCount
    });
    if (!allLocs.length) { pg.innerHTML = html + '<div class="empty"><div class="empty-icon">🏕️</div><p>' + t('noLoc') + '</p></div>'; return; }
    pg.innerHTML = html + allLocs.map(function(loc) {
      var lp = plants.filter(function(p) { return p.location_id === loc.id; });
      var active = lp.filter(function(p) { return !p.is_harvested; }).length;
      var harv = lp.filter(function(p) { return p.is_harvested; });
      var totalW = 0;
      harv.forEach(function(p) { harvests.filter(function(h) { return h.plant_id === p.id; }).forEach(function(h) { totalW += (parseFloat(h.dry_weight_g) || 0); }); });
      return '<div class="card" style="cursor:pointer" onclick="GrowLog.navigate(\'plants\',{locId:\'' + loc.id + '\',locName:\'' + encodeURIComponent(loc.name) + '\'})">' +
        '<div class="card-row"><div><div class="card-title">🏕️ ' + loc.name + '</div>' +
        '<div class="card-sub">' + active + ' ' + t('active').toLowerCase() + (harv.length ? ' · ' + harv.length + ' ' + t('harvested').toLowerCase() + (totalW > 0 ? ' · ' + totalW.toFixed(1) + 'g' : '') : '') + '</div></div>' +
        '<span style="color:var(--text3);font-size:20px">›</span></div>' +
        '<div class="card-actions"><button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();GrowLog.openLocModal(\'' + loc.id + '\')">✏️</button>' +
        '<button class="btn btn-danger btn-sm" onclick="event.stopPropagation();GrowLog.deleteLoc(\'' + loc.id + '\')">🗑</button></div></div>';
    }).join('');
  } catch(e) { pg.innerHTML = makeModeTabs() + '<div class="empty"><p>Error: ' + e.message + '</p></div>'; }
}

async function renderGrowLocations() {
  var pg = document.getElementById('page-locations');
  var growName = decodeURIComponent(state.curGrowName || '');
  pg.innerHTML = '<div class="spinner"></div>';
  try {
    var locs = await sb('locations', 'GET', null, '?grow_id=eq.' + state.curGrowId + '&order=created_at.asc');
    state.cache.locations = locs;
    var plants = await sb('plants', 'GET', null, '?select=id,location_id,is_harvested');
    var harvests = await sb('harvests', 'GET', null, '?select=plant_id,dry_weight_g');
    var html = makeModeTabs() +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">' +
      '<button class="btn btn-ghost btn-sm" onclick="GrowLog.backToGrows()">← Grows</button>' +
      '<span style="font-size:16px;font-weight:700">💡 ' + growName + '</span></div>';
    if (!locs.length) { pg.innerHTML = html + '<div class="empty"><div class="empty-icon">🏕️</div><p>' + t('noLoc') + '</p></div>'; return; }
    pg.innerHTML = html + locs.map(function(loc) {
      var lp = plants.filter(function(p) { return p.location_id === loc.id; });
      var active = lp.filter(function(p) { return !p.is_harvested; }).length;
      var harv = lp.filter(function(p) { return p.is_harvested; });
      var totalW = 0;
      harv.forEach(function(p) { harvests.filter(function(h) { return h.plant_id === p.id; }).forEach(function(h) { totalW += (parseFloat(h.dry_weight_g) || 0); }); });
      return '<div class="card" style="cursor:pointer" onclick="GrowLog.navigate(\'plants\',{locId:\'' + loc.id + '\',locName:\'' + encodeURIComponent(loc.name) + '\'})">' +
        '<div class="card-row"><div><div class="card-title">🏕️ ' + loc.name + '</div>' +
        '<div class="card-sub">' + active + ' ' + t('active').toLowerCase() + (harv.length ? ' · ' + harv.length + ' ' + t('harvested').toLowerCase() + (totalW > 0 ? ' · ' + totalW.toFixed(1) + 'g' : '') : '') + '</div></div>' +
        '<span style="color:var(--text3);font-size:20px">›</span></div>' +
        '<div class="card-actions"><button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();GrowLog.openLocModal(\'' + loc.id + '\')">✏️</button>' +
        '<button class="btn btn-danger btn-sm" onclick="event.stopPropagation();GrowLog.deleteLoc(\'' + loc.id + '\')">🗑</button></div></div>';
    }).join('');
  } catch(e) { pg.innerHTML = makeModeTabs() + '<div class="empty"><p>Error: ' + e.message + '</p></div>'; }
}

export function openLocModal(id) {
  id = id || null; clearErr('loc-error');
  document.getElementById('loc-id').value = id || '';
  document.getElementById('modal-loc-title').textContent = id ? t('editLoc') : t('newLoc');
  var loc = id ? state.cache.locations.find(function(l) { return l.id === id; }) : null;
  document.getElementById('loc-name').value = loc ? loc.name || '' : '';
  document.getElementById('loc-notes').value = loc ? loc.notes || '' : '';
  openModal('modal-loc');
}

export async function saveLoc() {
  var name = document.getElementById('loc-name').value.trim();
  if (!name) { showErr('loc-error', '⚠️ Введи назву'); return; }
  var id = document.getElementById('loc-id').value;
  var data = { name: name, notes: document.getElementById('loc-notes').value.trim() };
  if (!id) {
    data.mode = state.mode;
    if (state.mode === 'indoor' && state.curGrowId) data.grow_id = state.curGrowId;
  }
  try {
    if (id) await sb('locations', 'PATCH', data, '?id=eq.' + id);
    else await sb('locations', 'POST', data);
    closeModal('modal-loc'); toast(t(id ? 'updated' : 'added') + ' ✅'); renderLocations();
  } catch(e) { showErr('loc-error', '❌ ' + parseErr(e)); }
}

export async function deleteLoc(id) {
  if (!confirm(t('confirmLoc'))) return;
  try {
    var ps = await sb('plants', 'GET', null, '?location_id=eq.' + id + '&select=id');
    for (var i = 0; i < ps.length; i++) {
      await sb('harvests', 'DELETE', null, '?plant_id=eq.' + ps[i].id);
      await sb('expenses', 'DELETE', null, '?plant_id=eq.' + ps[i].id);
    }
    await sb('plants', 'DELETE', null, '?location_id=eq.' + id);
    await sb('locations', 'DELETE', null, '?id=eq.' + id);
    toast(t('deleted')); renderLocations();
  } catch(e) { toast('Error: ' + parseErr(e)); }
}
