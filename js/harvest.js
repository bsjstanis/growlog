import { sb, uploadPhoto } from './supabase.js';
import { t } from './i18n.js';
import { fmt, today, diffDays, getYear, fmtUAH, parseErr, showErr, makeStatsBar, renderStatsBar } from './utils.js';
import { getStage } from './stages.js';
import { toast, openModal, closeModal, updateRating, previewHarvPhoto, clearHarvPhoto } from './ui.js';
import { state } from './state.js';
import { makeModeTabs } from './grows.js';

export { updateRating, previewHarvPhoto, clearHarvPhoto };

export function openHarvestModal(plantId, labelEnc) {
  showErr('harv-error', '');
  document.getElementById('harv-edit-id').value = '';
  document.getElementById('harv-plant-id').value = plantId;
  document.getElementById('harv-info').textContent = decodeURIComponent(labelEnc);
  document.getElementById('harv-modal-title').textContent = t('harvModal');
  document.getElementById('harv-save-btn').textContent = t('save');
  document.getElementById('harv-date').value = today();
  ['harv-wet','harv-weight','harv-notes'].forEach(function(id) { document.getElementById(id).value = ''; });
  ['harv-dry-start','harv-dry-end'].forEach(function(id) { document.getElementById(id).value = ''; });
  document.getElementById('harv-photo-input').value = '';
  document.getElementById('harv-photo-preview').style.display = 'none';
  document.getElementById('harv-photo-delete-btn').style.display = 'none';
  document.getElementById('harv-photo-existing').value = '';
  document.getElementById('harv-rating').value = 5; updateRating(5);
  openModal('modal-harvest-form');
}

export async function openEditHarvest(harvId) {
  showErr('harv-error', '');
  try {
    var rows = await sb('harvests', 'GET', null, '?id=eq.' + harvId); var h = rows[0]; if (!h) return;
    var pr = await sb('plants', 'GET', null, '?id=eq.' + h.plant_id + '&select=id,name,variety_id'); var p = pr[0]; var label = '';
    if (p) { var vr = state.cache.varieties.find(function(x) { return x.id === p.variety_id; }); label = (p.name || '') + ' ' + (vr ? vr.name : ''); }
    document.getElementById('harv-edit-id').value = harvId;
    document.getElementById('harv-plant-id').value = h.plant_id;
    document.getElementById('harv-info').textContent = label.trim();
    document.getElementById('harv-modal-title').textContent = t('editHarvModal');
    document.getElementById('harv-save-btn').textContent = t('save');
    document.getElementById('harv-date').value = h.harvest_date || today();
    document.getElementById('harv-wet').value = h.wet_weight_g || '';
    document.getElementById('harv-weight').value = h.dry_weight_g || '';
    document.getElementById('harv-dry-start').value = h.dry_start_date || '';
    document.getElementById('harv-dry-end').value = h.dry_end_date || '';
    document.getElementById('harv-notes').value = h.notes || '';
    document.getElementById('harv-photo-input').value = '';
    document.getElementById('harv-photo-existing').value = h.photo_url || '';
    var prev = document.getElementById('harv-photo-preview');
    if (h.photo_url) { prev.src = h.photo_url; prev.style.display = 'block'; document.getElementById('harv-photo-delete-btn').style.display = 'inline-flex'; }
    else { prev.style.display = 'none'; document.getElementById('harv-photo-delete-btn').style.display = 'none'; }
    var r = h.rating || 5; document.getElementById('harv-rating').value = r; updateRating(r);
    openModal('modal-harvest-form');
  } catch(e) { toast('Error: ' + parseErr(e)); }
}

export async function saveHarvest() {
  var plantId = document.getElementById('harv-plant-id').value;
  var editId = document.getElementById('harv-edit-id').value;
  var date = document.getElementById('harv-date').value;
  if (!date) { showErr('harv-error', '⚠️ ' + t('errHarvDate')); return; }
  try {
    var photoFile = document.getElementById('harv-photo-input').files[0];
    var existingPhoto = document.getElementById('harv-photo-existing').value;
    var photoUrl = null;
    if (photoFile) photoUrl = await uploadPhoto(photoFile);
    else if (existingPhoto === 'DELETE') photoUrl = null;
    else if (existingPhoto) photoUrl = existingPhoto;
    var data = { plant_id: plantId, harvest_date: date, wet_weight_g: parseFloat(document.getElementById('harv-wet').value) || null, dry_weight_g: parseFloat(document.getElementById('harv-weight').value) || null, dry_start_date: document.getElementById('harv-dry-start').value || null, dry_end_date: document.getElementById('harv-dry-end').value || null, rating: parseInt(document.getElementById('harv-rating').value) || null, notes: document.getElementById('harv-notes').value.trim(), photo_url: photoUrl };
    if (editId) await sb('harvests', 'PATCH', data, '?id=eq.' + editId);
    else { await sb('harvests', 'POST', data); await sb('plants', 'PATCH', { is_harvested: true }, '?id=eq.' + plantId); }
    closeModal('modal-harvest-form'); toast(t('saved') + ' ✅');
    if (state.curPage === 'harvest') renderHarvestPage();
    else if (window.GrowLog) window.GrowLog.navigate('plants', { locId: state.curLocId, locName: state.curLocName });
  } catch(e) { showErr('harv-error', '❌ ' + parseErr(e)); }
}

export async function deleteHarvest(id) {
  if (!confirm(t('confirmHarv'))) return;
  try { await sb('harvests', 'DELETE', null, '?id=eq.' + id); toast(t('deleted')); renderHarvestPage(); }
  catch(e) { toast('Error: ' + parseErr(e)); }
}

export async function renderHarvestPage() {
  var pg = document.getElementById('page-harvest'); pg.innerHTML = makeModeTabs() + '<div class="spinner"></div>';
  try {
    if (!state.cache.varieties.length) state.cache.varieties = await sb('varieties', 'GET', null, '?order=name.asc');
    // Get all locations filtered by mode
    var modeQuery = state.mode === 'indoor' ? '?mode=eq.indoor&select=id' : '?or=(mode.eq.outdoor,mode.is.null)&select=id';
    var modeLocs = await sb('locations', 'GET', null, modeQuery);
    var modeLocIds = modeLocs.map(function(l) { return l.id; });
    // Get plants in those locations
    var allPlants = await sb('plants', 'GET', null, '?select=id,name,variety_id,location_id,plant_date,is_harvested,stage_overrides');
    var plants = allPlants.filter(function(p) { return modeLocIds.indexOf(p.location_id) >= 0; });
    var plantIds = plants.map(function(p) { return p.id; });
    var locs = await sb('locations', 'GET', null, '?select=id,name');
    // Get harvests for those plants
    var allHarvests = await sb('harvests', 'GET', null, '?order=harvest_date.desc');
    var harvests = allHarvests.filter(function(h) { return plantIds.indexOf(h.plant_id) >= 0; });

    // For Indoor P&L: group by Grow if needed
    var grows = [];
    if (state.mode === 'indoor') grows = await sb('grows', 'GET', null, '?order=created_at.desc');

    var years = state.mode === 'outdoor'
      ? [...new Set(harvests.map(function(h) { return getYear(h.harvest_date); }).filter(Boolean))].sort(function(a,b){return b-a;})
      : [];
    if (state.mode === 'outdoor') {
      if (!years.includes(state.harvestYear) && years.length) state.harvestYear = years[0];
    }
    var filtered = state.mode === 'outdoor'
      ? harvests.filter(function(h) { return getYear(h.harvest_date) === state.harvestYear; })
      : harvests;
    var totalW = filtered.reduce(function(a,h) { return a+(parseFloat(h.dry_weight_g)||0); }, 0);
    var activePlants = plants.filter(function(p) { return !p.is_harvested; });
    var hsc = { seedling: 0, growth: 0, pre_flower: 0, flower: 0, ripening: 0, harvested: 0 };
    activePlants.forEach(function(p) {
      var v = state.cache.varieties.find(function(x) { return x.id === p.variety_id; }); if (!v) return;
      var st = getStage(p, v); if (hsc[st] !== undefined) hsc[st]++;
    });
    hsc.harvested = plants.filter(function(p) { return p.is_harvested; }).length;
    var statsBarHtml = renderStatsBar('harvest', {
      plants: activePlants.length,
      harvests: filtered.length,
      totalWeight: totalW,
      seedling: hsc.seedling || 0, growth: hsc.growth, pre_flower: hsc.pre_flower || 0,
      flower: hsc.flower, ripening: hsc.ripening, harvested: hsc.harvested || 0
    });
    if (state.mode === 'outdoor' && years.length) {
      html += '<div class="year-tabs">' + years.map(function(y) { return '<div class="year-tab '+(y===state.harvestYear?'active':'')+'" onclick="GrowLog.setHarvestYear('+y+')">'+y+'</div>'; }).join('') + '</div>';
    }
    if (!filtered.length) { html += '<div class="empty"><div class="empty-icon">📊</div><p>'+t('noHarvests')+' '+(state.mode==='outdoor'?state.harvestYear:''+'</p></div>'); }
    else {
      filtered.forEach(function(h) {
        var p = plants.find(function(x) { return x.id === h.plant_id; });
        var v = p ? state.cache.varieties.find(function(x) { return x.id === p.variety_id; }) : null;
        var loc = p ? locs.find(function(l) { return l.id === p.location_id; }) : null;
        var plantDate = p ? p.plant_date : null;
        var cycleDays = plantDate && h.harvest_date ? diffDays(plantDate, h.harvest_date) : null;
        var dryDays = h.dry_start_date && h.dry_end_date ? diffDays(h.dry_start_date, h.dry_end_date) : null;
        var shrink = h.wet_weight_g && h.dry_weight_g ? Math.round((1-h.dry_weight_g/h.wet_weight_g)*100) : null;
        var row2 = []; if (v && v.brand) row2.push(v.brand); if (loc) row2.push(loc.name);
        var row3 = [];
        if (plantDate) row3.push('🌱 '+fmt(plantDate));
        if (h.harvest_date) row3.push('✂️ '+fmt(h.harvest_date));
        if (cycleDays !== null) row3.push('🔄 '+cycleDays+' '+t('days'));
        html += '<div class="harv-card"><div class="harv-card-top">' +
          (h.photo_url?'<img src="'+h.photo_url+'" class="harv-thumb" alt="photo">':'<div class="harv-thumb-ph">🌿</div>') +
          '<div class="harv-info"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">' +
          '<div class="harv-name">'+(p&&p.name?p.name+' · ':'')+( v?v.name:'?')+'</div>' +
          '<div style="text-align:right;flex-shrink:0"><div style="font-size:17px;font-weight:700;color:var(--green)">'+(h.dry_weight_g||0)+'g</div>' +
          (h.rating?'<div style="font-size:11px;color:var(--amber)">'+h.rating+'/10</div>':'') +
          (shrink!==null?'<div style="font-size:10px;color:var(--blue)">-'+shrink+'%</div>':'')+'</div></div>' +
          (row2.length?'<div class="harv-meta">'+row2.join(' · ')+'</div>':'') +
          (row3.length?'<div class="harv-meta" style="color:var(--text2)">'+row3.join('  ')+'</div>':'') +
          (h.notes?'<div class="harv-meta" style="font-style:italic">'+h.notes+'</div>':'') +
          '</div></div>' +
          '<div class="harv-actions"><button class="btn btn-ghost btn-sm" onclick="GrowLog.openEditHarvest(\''+h.id+'\')">✏️</button>' +
          '<button class="btn btn-danger btn-sm" onclick="GrowLog.deleteHarvest(\''+h.id+'\')">🗑</button></div></div>';
      });
    }
    pg.innerHTML = html;
  } catch(e) { pg.innerHTML = makeModeTabs() + '<div class="empty"><p>Error: '+e.message+'</p></div>'; }
}

