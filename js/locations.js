import { sb } from './supabase.js';
import { t } from './i18n.js';
import { renderStatsBar, parseErr, showErr, clearErr } from './utils.js';
import { getStage, setIndoorLocations } from './stages.js';
import { toast, openModal, closeModal } from './ui.js';
import { state } from './state.js';
import { makeModeTabs, renderGrows } from './grows.js';
import { loadSeasons, pickSeason, renderSeasonBar, renderCloseSeasonButton } from './seasons.js';

export async function renderLocations() {
  if (state.mode === 'indoor') {
    if (state.curGrowId) { await renderGrowLocations(); return; }
    await renderGrows(); return;
  }
  var pg = document.getElementById('page-locations');
  pg.innerHTML = makeModeTabs() + '<div class="spinner"></div>';
  try {
    var seasons = await loadSeasons();
    if (!seasons.length) {
      pg.innerHTML = makeModeTabs() + '<div class="empty"><div class="empty-icon">🌿</div><p>Ще немає жодного сезону.</p>' +
        '<button class="btn btn-primary" style="margin-top:12px" onclick="GrowLog.openNewSeasonModal()">＋ Новий сезон</button></div>';
      return;
    }
    var seasonId = pickSeason(seasons);
    var seasonBar = renderSeasonBar(seasons, seasonId);
    var results = await Promise.all([
      sb('locations', 'GET', null, '?grow_id=eq.' + seasonId + '&order=created_at.asc'),
      sb('plants', 'GET', null, '?select=id,location_id,variety_id,is_harvested,plant_date,stage_overrides'),
      state.cache.varieties.length ? Promise.resolve(state.cache.varieties) : sb('varieties', 'GET', null, '?order=name.asc'),
      sb('harvests', 'GET', null, '?select=plant_id,dry_weight_g')
    ]);
    var allLocs = results[0]; state.cache.locations = allLocs;
    var seasonLocIds = allLocs.map(function(l) { return l.id; });
    // Only plants of this season's locations
    var plants = results[1].filter(function(p) { return seasonLocIds.indexOf(p.location_id) >= 0; });
    state.cache.varieties = results[2];
    var harvests = results[3];
    var activePlants = plants.filter(function(p) { return !p.is_harvested && !(p.stage_overrides && p.stage_overrides.lost); });
    var autoCount = 0, photoCount = 0;
    var sc = { seedling: 0, growth: 0, pre_flower: 0, flower: 0, ripening: 0, harvest: 0 };
    activePlants.forEach(function(p) {
      var v = state.cache.varieties.find(function(x) { return x.id === p.variety_id; }); if (!v) return;
      if (v.seed_type === 'auto') autoCount++; else photoCount++;
      var st = getStage(p, v); if (sc[st] !== undefined) sc[st]++;
    });
    var harvestedCount = plants.filter(function(p) { return p.is_harvested && !(p.stage_overrides && p.stage_overrides.lost); }).length;
    var statsHtml = renderStatsBar('plants', {
      active: activePlants.length, auto: autoCount, photo: photoCount,
      seedling: sc.seedling, growth: sc.growth, pre_flower: sc.pre_flower,
      flower: sc.flower, ripening: sc.ripening + sc.harvest, harvested: harvestedCount
    });
    var html = makeModeTabs() + seasonBar + statsHtml;
    if (!allLocs.length) {
      pg.innerHTML = html + '<div class="empty"><div class="empty-icon">🏕️</div><p>' + t('noLoc') + '</p>' +
        '<button class="btn btn-ghost btn-sm" style="margin-top:10px" onclick="GrowLog.deleteSeason(\'' + seasonId + '\')">🗑 Видалити порожній сезон</button></div>';
      return;
    }
    pg.innerHTML = html + allLocs.map(function(loc) {
      var lp = plants.filter(function(p) { return p.location_id === loc.id; });
      var active = lp.filter(function(p) { return !p.is_harvested; }).length;
      var harv = lp.filter(function(p) { return p.is_harvested && !(p.stage_overrides && p.stage_overrides.lost); });
      var totalW = 0;
      harv.forEach(function(p) {
        harvests.filter(function(h) { return h.plant_id === p.id; }).forEach(function(h) { totalW += (parseFloat(h.dry_weight_g) || 0); });
      });
      return '<div class="card" style="cursor:pointer" onclick="GrowLog.navigate(\'plants\',{locId:\'' + loc.id + '\',locName:\'' + encodeURIComponent(loc.name) + '\'})">' +
        '<div class="card-row"><div><div class="card-title">🏕️ ' + loc.name + '</div>' +
        '<div class="card-sub">' + active + ' ' + t('active').toLowerCase() +
        (harv.length ? ' · ' + harv.length + ' ' + t('harvested').toLowerCase() + (totalW > 0 ? ' · ' + totalW.toFixed(1) + 'g' : '') : '') +
        '</div></div><span style="color:var(--text3);font-size:20px">›</span></div>' +
        '<div class="card-actions">' +
        '<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();GrowLog.openLocModal(\'' + loc.id + '\')">✏️</button>' +
        '<button class="btn btn-danger btn-sm" onclick="event.stopPropagation();GrowLog.deleteLoc(\'' + loc.id + '\')">🗑</button>' +
        '</div></div>';
    }).join('') + renderCloseSeasonButton(seasons, seasonId);
  } catch(e) { pg.innerHTML = makeModeTabs() + '<div class="empty"><p>Error: ' + e.message + '</p></div>'; }
}

async function renderGrowLocations() {
  var pg = document.getElementById('page-locations');
  var growName = decodeURIComponent(state.curGrowName || '');
  pg.innerHTML = '<div class="spinner"></div>';
  try {
    var locs = await sb('locations', 'GET', null, '?grow_id=eq.' + state.curGrowId + '&order=created_at.asc');
    state.cache.locations = locs;
    var gr = await sb('grows', 'GET', null, '?id=eq.' + state.curGrowId);
    var grow = gr[0];
    var plants = await sb('plants', 'GET', null, '?select=id,location_id,is_harvested,stage_overrides');
    var harvests = await sb('harvests', 'GET', null, '?select=plant_id,dry_weight_g');
    var locIds = locs.map(function(l) { return l.id; });
    var growStatsHtml = locs.length ? await buildLocationsStatsBar(locIds) : '';
    var growClosed = grow && grow.status !== 'active';
    var html = makeModeTabs() +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">' +
      '<button class="btn btn-ghost btn-sm" onclick="GrowLog.backToGrows()">← Grows</button>' +
      '<span style="font-size:16px;font-weight:700;flex:1">💡 ' + growName + (growClosed ? ' 🔒' : '') + '</span>' +
      (grow && !growClosed ? '<button class="btn btn-warning btn-sm" onclick="GrowLog.openCloseWizard(\'' + grow.id + '\')">🔒 Завершити Grow</button>' : '') +
      '</div>' +
      growStatsHtml;
    if (!locs.length) {
      pg.innerHTML = html + '<div class="empty"><div class="empty-icon">🏕️</div><p>' + t('noLoc') + '</p></div>';
      return;
    }
    pg.innerHTML = html + locs.map(function(loc) {
      var lp = plants.filter(function(p) { return p.location_id === loc.id; });
      var active = lp.filter(function(p) { return !p.is_harvested; }).length;
      var harv = lp.filter(function(p) { return p.is_harvested && !(p.stage_overrides && p.stage_overrides.lost); });
      var totalW = 0;
      harv.forEach(function(p) {
        harvests.filter(function(h) { return h.plant_id === p.id; }).forEach(function(h) { totalW += (parseFloat(h.dry_weight_g) || 0); });
      });
      return '<div class="card" style="cursor:pointer" onclick="GrowLog.navigate(\'plants\',{locId:\'' + loc.id + '\',locName:\'' + encodeURIComponent(loc.name) + '\'})">' +
        '<div class="card-row"><div><div class="card-title">🏕️ ' + loc.name + '</div>' +
        '<div class="card-sub">' + active + ' ' + t('active').toLowerCase() +
        (harv.length ? ' · ' + harv.length + ' ' + t('harvested').toLowerCase() + (totalW > 0 ? ' · ' + totalW.toFixed(1) + 'g' : '') : '') +
        '</div></div><span style="color:var(--text3);font-size:20px">›</span></div>' +
        '<div class="card-actions">' +
        '<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();GrowLog.openLocModal(\'' + loc.id + '\')">✏️</button>' +
        '<button class="btn btn-danger btn-sm" onclick="event.stopPropagation();GrowLog.deleteLoc(\'' + loc.id + '\')">🗑</button>' +
        '</div></div>';
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
    if (state.mode === 'outdoor') {
      if (!state.curSeasonId) { showErr('loc-error', '⚠️ Спочатку відкрий сезон'); return; }
      data.grow_id = state.curSeasonId;
    }
  }
  try {
    if (id) await sb('locations', 'PATCH', data, '?id=eq.' + id);
    else {
      var created = await sb('locations', 'POST', data);
      if (data.mode === 'indoor' && created && created[0]) setIndoorLocations([created[0].id]);
    }
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

// Helper: build stats bar for a specific set of locations
async function buildLocationsStatsBar(locIds) {
  var { renderStatsBar } = await import('./utils.js');
  var { getStage } = await import('./stages.js');
  var varieties = await (await import('./supabase.js')).sb('varieties', 'GET', null, '?order=name.asc');
  var plants = await (await import('./supabase.js')).sb('plants', 'GET', null, '?select=id,location_id,variety_id,is_harvested,plant_date,stage_overrides');
  var harvests = await (await import('./supabase.js')).sb('harvests', 'GET', null, '?select=plant_id,dry_weight_g');
  var growPlants = plants.filter(function(p) { return locIds.indexOf(p.location_id) >= 0; });
  var activePlants = growPlants.filter(function(p) { return !p.is_harvested; });
  var harvestedPlants = growPlants.filter(function(p) { return p.is_harvested && !(p.stage_overrides && p.stage_overrides.lost); });
  var totalW = 0;
  harvestedPlants.forEach(function(p) {
    harvests.filter(function(h) { return h.plant_id === p.id; }).forEach(function(h) { totalW += (parseFloat(h.dry_weight_g) || 0); });
  });
  var harvestCount = harvests.filter(function(h) {
    return growPlants.some(function(p) { return p.id === h.plant_id; });
  }).length;
  var sc = { seedling: 0, growth: 0, pre_flower: 0, flower: 0, ripening: 0, harvest: 0 };
  activePlants.forEach(function(p) {
    var v = varieties.find(function(x) { return x.id === p.variety_id; }); if (!v) return;
    var st = getStage(p, v); if (sc[st] !== undefined) sc[st]++;
  });
  var autoCount = 0, photoCount = 0;
  growPlants.filter(function(p){ return !p.is_harvested; }).forEach(function(p){
    var v = varieties.find(function(x){ return x.id === p.variety_id; }); if (!v) return;
    if (v.seed_type === 'auto') autoCount++; else photoCount++;
  });
  return renderStatsBar('plants', {
    active: activePlants.length, auto: autoCount, photo: photoCount,
    seedling: sc.seedling, growth: sc.growth, pre_flower: sc.pre_flower,
    flower: sc.flower, ripening: sc.ripening + sc.harvest, harvested: harvestedPlants.length
  });
}
