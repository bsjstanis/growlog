import { sb } from './supabase.js';
import { t } from './i18n.js';
import { fmt, today, parseErr, showErr, clearErr, renderStatsBar } from './utils.js';
import { toast, openModal, closeModal } from './ui.js';
import { state } from './state.js';

export async function renderGrows() {
  var pg = document.getElementById('page-locations');
  pg.innerHTML = makeModeTabs() + '<div class="spinner"></div>';
  try {
    var grows = await sb('grows', 'GET', null, '?order=created_at.desc');
    var active = grows.filter(function(g) { return g.status === 'active'; });
    var done = grows.filter(function(g) { return g.status !== 'active' && g.status !== 'archive'; });
    var archived = grows.filter(function(g) { return g.status === 'archive'; });
    // Stats for all indoor plants
    var indoorLocs = await sb('locations', 'GET', null, '?mode=eq.indoor&select=id');
    var indoorLocIds = indoorLocs.map(function(l){ return l.id; });
    var allPlants = await sb('plants', 'GET', null, '?select=id,location_id,variety_id,is_harvested,plant_date,stage_overrides');
    if (!window._varietiesCache) window._varietiesCache = await sb('varieties', 'GET', null, '?order=name.asc');
    var indoorPlants = allPlants.filter(function(p){ return indoorLocIds.indexOf(p.location_id) >= 0; });
    var activePlants = indoorPlants.filter(function(p){ return !p.is_harvested; });
    var sc = { seedling: 0, growth: 0, pre_flower: 0, flower: 0, ripening: 0, harvest: 0 };
    var { getStage: _gs } = await import('./stages.js');
    activePlants.forEach(function(p){
      var v = window._varietiesCache.find(function(x){ return x.id === p.variety_id; }); if (!v) return;
      var st = _gs(p, v); if (sc[st] !== undefined) sc[st]++;
    });
    var harvestedCount = indoorPlants.filter(function(p){ return p.is_harvested; }).length;
    var statsHtml = renderStatsBar('plants', {
      active: activePlants.length, auto: 0, photo: 0,
      seedling: sc.seedling, growth: sc.growth, pre_flower: sc.pre_flower,
      flower: sc.flower, ripening: sc.harvest, harvested: harvestedCount
    });
    var html = makeModeTabs() + statsHtml;
    html += '<div style="display:flex;justify-content:flex-end;margin-bottom:10px">' +
      '<button class="btn btn-primary btn-sm" onclick="GrowLog.openGrowModal()">＋ ' + t('newGrow') + '</button></div>';
    if (!grows.filter(function(g){ return g.status !== 'archive'; }).length) {
      html += '<div class="empty"><div class="empty-icon">💡</div><p>' + t('noGrows') + '</p></div>';
    } else {
      if (active.length) {
        html += '<div class="form-section" style="margin-top:0">' + t('activeGrows') + '</div>';
        html += active.map(function(g) { return renderGrowCard(g); }).join('');
      }
      if (done.length) {
        html += '<div class="form-section">' + t('completedGrows') + '</div>';
        html += done.map(function(g) { return renderGrowCard(g); }).join('');
      }
      if (archived.length) {
        html += '<div class="archive-section"><div class="archive-title">🗃 ' + t('archive') + '</div>';
        html += archived.map(function(g) { return renderGrowCard(g); }).join('') + '</div>';
      }
    }
    pg.innerHTML = html;
  } catch(e) { pg.innerHTML = makeModeTabs() + '<div class="empty"><p>Error: ' + e.message + '</p></div>'; }
}

export function renderGrowCard(g) {
  var statusColor = g.status === 'active' ? 'var(--green)' : g.status === 'completed' ? 'var(--text3)' : 'var(--text3)';
  var statusLabel = g.status === 'active' ? t('growActive') : g.status === 'completed' ? t('growCompleted') : t('growArchive');
  return '<div class="card" style="cursor:pointer;border-left:4px solid ' + statusColor + '" onclick="GrowLog.navigateToGrow(\'' + g.id + '\',\'' + encodeURIComponent(g.name) + '\')">' +
    '<div class="card-row"><div>' +
      '<div class="card-title">💡 ' + g.name + '</div>' +
      '<div class="card-sub">📅 ' + fmt(g.start_date) + (g.end_date ? ' → ' + fmt(g.end_date) : ' → ...') + ' · ' + statusLabel + '</div>' +
    '</div><span style="color:var(--text3);font-size:20px">›</span></div>' +
    '<div class="card-actions">' +
      (g.status === 'active' ? '<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();GrowLog.completeGrow(\'' + g.id + '\')">' + t('growComplete') + '</button>' : '') +
      '<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();GrowLog.openGrowModal(\'' + g.id + '\')">✏️</button>' +
      (g.status !== 'archive' ? '<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();GrowLog.archiveGrow(\'' + g.id + '\')">' + t('growArchiveBtn') + '</button>' : '') +
      '<button class="btn btn-danger btn-sm" onclick="event.stopPropagation();GrowLog.deleteGrow(\'' + g.id + '\')">🗑</button>' +
    '</div></div>';
}

export function openGrowModal(id) {
  id = id || null; clearErr('grow-error');
  document.getElementById('grow-edit-id').value = id || '';
  document.getElementById('modal-grow-title').textContent = id ? t('editGrow') : t('newGrow');
  if (id) {
    sb('grows', 'GET', null, '?id=eq.' + id).then(function(rows) {
      var g = rows[0]; if (!g) return;
      document.getElementById('grow-name').value = g.name || '';
      document.getElementById('grow-start-date').value = g.start_date || today();
    });
  } else {
    document.getElementById('grow-name').value = '';
    document.getElementById('grow-start-date').value = today();
  }
  openModal('modal-grow');
}

export async function saveGrow() {
  var name = document.getElementById('grow-name').value.trim();
  var startDate = document.getElementById('grow-start-date').value;
  if (!name) { showErr('grow-error', '⚠️ Введи назву'); return; }
  if (!startDate) { showErr('grow-error', '⚠️ Вкажи дату старту'); return; }
  var id = document.getElementById('grow-edit-id').value;
  var data = { name: name, start_date: startDate };
  try {
    if (id) await sb('grows', 'PATCH', data, '?id=eq.' + id);
    else await sb('grows', 'POST', Object.assign(data, { status: 'active' }));
    closeModal('modal-grow'); toast(t(id ? 'updated' : 'added') + ' ✅'); renderGrows();
  } catch(e) { showErr('grow-error', '❌ ' + parseErr(e)); }
}

export async function completeGrow(id) {
  if (!confirm(t('confirmCompleteGrow'))) return;
  try {
    await sb('grows', 'PATCH', { status: 'completed', end_date: today() }, '?id=eq.' + id);
    toast(t('growCompleted') + ' ✅'); renderGrows();
  } catch(e) { toast('Error: ' + parseErr(e)); }
}

export async function archiveGrow(id) {
  try {
    await sb('grows', 'PATCH', { status: 'archive' }, '?id=eq.' + id);
    toast(t('deleted')); renderGrows();
  } catch(e) { toast('Error: ' + parseErr(e)); }
}

export async function deleteGrow(id) {
  if (!confirm('Видалити Grow і всі локації?')) return;
  try {
    var locs = await sb('locations', 'GET', null, '?grow_id=eq.' + id + '&select=id');
    for (var i = 0; i < locs.length; i++) {
      var plants = await sb('plants', 'GET', null, '?location_id=eq.' + locs[i].id + '&select=id');
      for (var j = 0; j < plants.length; j++) {
        await sb('harvests', 'DELETE', null, '?plant_id=eq.' + plants[j].id);
        await sb('expenses', 'DELETE', null, '?plant_id=eq.' + plants[j].id);
      }
      await sb('plants', 'DELETE', null, '?location_id=eq.' + locs[i].id);
    }
    await sb('locations', 'DELETE', null, '?grow_id=eq.' + id);
    await sb('grows', 'DELETE', null, '?id=eq.' + id);
    toast(t('deleted')); renderGrows();
  } catch(e) { toast('Error: ' + parseErr(e)); }
}

export function makeModeTabs() {
  return '<div class="mode-tabs">' +
    '<button class="mode-tab' + (state.mode === 'outdoor' ? ' active outdoor' : '') + '" onclick="GrowLog.setMode(\'outdoor\')">🌿 Outdoor</button>' +
    '<button class="mode-tab' + (state.mode === 'indoor' ? ' active indoor' : '') + '" onclick="GrowLog.setMode(\'indoor\')">💡 Indoor</button>' +
  '</div>';
}
