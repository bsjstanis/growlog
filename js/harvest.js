import { sb, uploadPhoto, getPhotoUrl } from './supabase.js';
import { t } from './i18n.js';
import { fmt, today, diffDays, getYear, fmtUAH, parseErr, showErr, makeStatsBar, renderStatsBar } from './utils.js';
import { getStage } from './stages.js';
import { toast, openModal, closeModal, openPopup, updateRating, previewHarvPhoto, clearHarvPhoto } from './ui.js';
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
    if (p) { var vr = state.cache.varieties.find(function(x) { return x.id === p.variety_id; }); label = (vr ? vr.name : '') + (p.name ? ' · ' + p.name : ''); }
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
    if (h.photo_url) {
      if (h.photo_url.indexOf('sb://') === 0) {
        getPhotoUrl(h.photo_url).then(function(url) { if (url) prev.src = url; });
      } else { prev.src = h.photo_url; }
      prev.style.display = 'block'; document.getElementById('harv-photo-delete-btn').style.display = 'inline-flex';
    }
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
    var data = { plant_id: plantId, harvest_date: date, wet_weight_g: parseFloat(document.getElementById('harv-wet').value) || null, dry_weight_g: parseFloat(document.getElementById('harv-weight').value) || null, dry_start_date: document.getElementById('harv-dry-start').value || null, dry_end_date: document.getElementById('harv-dry-end').value || null, rating: parseFloat(document.getElementById('harv-rating').value) || null, notes: document.getElementById('harv-notes').value.trim(), photo_url: photoUrl };
    if (editId) await sb('harvests', 'PATCH', data, '?id=eq.' + editId);
    else { await sb('harvests', 'POST', data); await sb('plants', 'PATCH', { is_harvested: true }, '?id=eq.' + plantId); }
    closeModal('modal-harvest-form'); toast(t('saved') + ' ✅');
    if (state.closeWizard && state.closeWizard.pendingHarvest) { window.GrowLog.reopenCloseWizard(); return; }
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
    // Parallel fetch
    var modeQuery = state.mode === 'indoor' ? '?mode=eq.indoor&select=id,grow_id' : '?or=(mode.eq.outdoor,mode.is.null)&select=id';
    var pre = await Promise.all([
      state.cache.varieties.length ? Promise.resolve(state.cache.varieties) : sb('varieties', 'GET', null, '?order=name.asc'),
      sb('locations', 'GET', null, modeQuery)
    ]);
    state.cache.varieties = pre[0];
    var modeLocs = pre[1];
    // Indoor: show one Grow at a time (tabs)
    var grows = [];
    if (state.mode === 'indoor') {
      grows = await sb('grows', 'GET', null, '?mode=eq.indoor&status=neq.archive&order=created_at.desc');
      if (!grows.some(function(g) { return g.id === state.harvestGrowId; })) state.harvestGrowId = grows.length ? grows[0].id : null;
      modeLocs = modeLocs.filter(function(l) { return l.grow_id === state.harvestGrowId; });
    }
    var modeLocIds = modeLocs.map(function(l) { return l.id; });
    // Get plants in those locations
    var allPlants = await sb('plants', 'GET', null, '?select=id,name,variety_id,location_id,plant_date,is_harvested,stage_overrides');
    var plants = allPlants.filter(function(p) { return modeLocIds.indexOf(p.location_id) >= 0; });
    var realPlants = plants.filter(function(p) { return !(p.stage_overrides && p.stage_overrides.lost); });
    var plantIds = realPlants.map(function(p) { return p.id; });
    var locs = await sb('locations', 'GET', null, '?select=id,name');
    // Get harvests for those plants
    var allHarvests = await sb('harvests', 'GET', null, '?order=harvest_date.desc');
    var harvests = allHarvests.filter(function(h) { return plantIds.indexOf(h.plant_id) >= 0; });


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
    var activePlants = plants.filter(function(p) { return !p.is_harvested && !(p.stage_overrides && p.stage_overrides.lost); });
    var hsc = { seedling: 0, growth: 0, pre_flower: 0, flower: 0, ripening: 0, harvest: 0, harvested: 0 };
    activePlants.forEach(function(p) {
      var v = state.cache.varieties.find(function(x) { return x.id === p.variety_id; }); if (!v) return;
      var st = getStage(p, v); if (hsc[st] !== undefined) hsc[st]++;
    });
    hsc.harvested = plants.filter(function(p) { return p.is_harvested && !(p.stage_overrides && p.stage_overrides.lost); }).length;
    var harvestedPlantsCount = [...new Set(filtered.map(function(h){ return h.plant_id; }))].length;
    var statsBarHtml = renderStatsBar('harvest', {
      plants: activePlants.length,
      harvests: harvestedPlantsCount,
      totalWeight: totalW,
      seedling: hsc.seedling || 0, growth: hsc.growth, pre_flower: hsc.pre_flower || 0,
      flower: hsc.flower, ripening: hsc.ripening + hsc.harvest, harvested: hsc.harvested || 0
    });
    var html = makeModeTabs() + statsBarHtml;
    if (state.mode === 'indoor' && grows.length) {
      html += '<div class="year-tabs">' + grows.map(function(g) { return '<div class="year-tab '+(g.id===state.harvestGrowId?'active':'')+'" onclick="GrowLog.setHarvestGrow(\''+g.id+'\')">'+g.name+(g.status!=='active'?' 🔒':'')+'</div>'; }).join('') + '</div>';
    }
    if (state.mode === 'outdoor' && years.length) {
      html += '<div class="year-tabs">' + years.map(function(y) { return '<div class="year-tab '+(y===state.harvestYear?'active':'')+'" onclick="GrowLog.setHarvestYear('+y+')">'+y+'</div>'; }).join('') + '</div>';
    }
    if (!filtered.length) { html += '<div class="empty"><div class="empty-icon">📊</div><p>' + t('noHarvests') + ' ' + (state.mode === 'outdoor' ? state.harvestYear : '') + '</p></div>'; }
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
        html += '<div class="harv-card" style="cursor:pointer" onclick="GrowLog.openHarvestView(\''+h.id+'\')"><div class="harv-card-top">' +
          (h.photo_url ? (h.photo_url.indexOf('sb://') === 0 ? '<img class="harv-thumb" data-sbpath="' + h.photo_url + '" alt="photo">' : '<img src="' + h.photo_url + '" class="harv-thumb" alt="photo">') : '<div class="harv-thumb-ph">&#127807;</div>') +
          '<div class="harv-info">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:3px">' +
          '<div class="harv-name">' + (v?v.name:'?') + (p&&p.name?' &middot; '+p.name:'') + '</div>' +
          '<div style="font-size:17px;font-weight:700;color:var(--green);flex-shrink:0">' + (h.dry_weight_g||0) + 'g' +
          (shrink!==null?'<span style="font-size:10px;color:var(--blue);margin-left:4px">-'+shrink+'%</span>':'') + '</div></div>' +
          (row2.length ? '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">' +
            '<div class="harv-meta" style="margin:0">' + row2.join(' &middot; ') + '</div>' +
            (h.rating ? '<div style="font-size:11px;color:var(--amber);flex-shrink:0;margin-left:8px">&#11088; ' + h.rating + '/10</div>' : '') +
          '</div>' : (h.rating ? '<div style="font-size:11px;color:var(--amber);margin-bottom:3px">&#11088; ' + h.rating + '/10</div>' : '')) +
          (row3.length ? '<div class="harv-meta" style="color:var(--text2)">' + row3.join('  ') + '</div>' : '') +
          (h.notes ? '<div class="harv-meta" style="font-style:italic">' + h.notes + '</div>' : '') +
          '</div></div>' +
          '<div class="harv-actions"><button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();GrowLog.openEditHarvest(\''+h.id+'\')">✏️</button>' +
          '<button class="btn btn-danger btn-sm" onclick="event.stopPropagation();GrowLog.deleteHarvest(\''+h.id+'\')">🗑</button></div></div>';
      });
    }
    pg.innerHTML = html;
    // Resolve private photo URLs (sb:// scheme) to signed URLs
    document.querySelectorAll('img.harv-thumb[data-sbpath]').forEach(function(img) {
      getPhotoUrl(img.getAttribute('data-sbpath')).then(function(url) {
        if (url) img.src = url;
      });
    });
  } catch(e) { pg.innerHTML = makeModeTabs() + '<div class="empty"><p>Error: '+e.message+'</p></div>'; }
}


// ══════════ HARVEST VIEW (click on card) ══════════
export async function openHarvestView(harvId) {
  try {
    var rows = await sb('harvests', 'GET', null, '?id=eq.' + harvId); var h = rows[0]; if (!h) return;
    var pr = await sb('plants', 'GET', null, '?id=eq.' + h.plant_id + '&select=id,name,variety_id,location_id,plant_date');
    var p = pr[0] || null;
    if (!state.cache.varieties.length) state.cache.varieties = await sb('varieties', 'GET', null, '?order=name.asc');
    var v = p ? state.cache.varieties.find(function(x) { return x.id === p.variety_id; }) : null;
    var lr = p ? await sb('locations', 'GET', null, '?id=eq.' + p.location_id + '&select=name') : [];
    var loc = lr[0] || null;
    var cycle = p && p.plant_date && h.harvest_date ? diffDays(p.plant_date, h.harvest_date) : null;
    var dry = h.dry_start_date && h.dry_end_date ? diffDays(h.dry_start_date, h.dry_end_date) : null;
    var shrink = h.wet_weight_g && h.dry_weight_g ? Math.round((1 - h.dry_weight_g / h.wet_weight_g) * 100) : null;
    var r = parseFloat(h.rating) || 0;
    var kv = function(label, val) { return '<div style="background:var(--bg3);border-radius:8px;padding:7px 9px"><div style="font-size:11px;color:var(--text3)">' + label + '</div><div style="font-size:14px;font-weight:600">' + val + '</div></div>'; };
    var sub = []; if (v && v.brand) sub.push(v.brand); if (loc) sub.push(loc.name);
    var html = (h.photo_url
        ? '<img id="hv-photo" alt="photo" onclick="GrowLog.openLightbox(this.src)" style="display:block;width:100%;max-height:60vh;object-fit:contain;background:#111;border-radius:10px;margin-bottom:12px;cursor:zoom-in"' + (h.photo_url.indexOf('sb://') === 0 ? '' : ' src="' + h.photo_url + '"') + '>'
        : '') +
      '<div style="font-size:17px;font-weight:700">' + (v ? v.name : '?') + (p && p.name ? ' · ' + p.name : '') + '</div>' +
      (sub.length ? '<div style="font-size:13px;color:var(--text3);margin-top:2px">' + sub.join(' · ') + '</div>' : '') +
      (r ? '<div style="display:flex;align-items:center;gap:8px;margin:8px 0"><span class="rating-stars"><span class="rating-stars-bg">★★★★★★★★★★</span><span class="rating-stars-fill" style="width:' + (r / 10 * 100) + '%">★★★★★★★★★★</span></span>' +
        '<span style="font-size:13px;color:var(--text2)">' + (r % 1 === 0 ? r.toFixed(0) : r.toFixed(1)) + '/10</span></div>' : '') +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:10px 0">' +
        kv('Сухий', (h.dry_weight_g || 0) + ' g') +
        kv('Вологий' + (shrink !== null ? ' / усушка' : ''), h.wet_weight_g ? h.wet_weight_g + ' g' + (shrink !== null ? ' · -' + shrink + '%' : '') : '—') +
        kv('Посадка → збір', (p ? fmt(p.plant_date) : '—') + ' → ' + fmt(h.harvest_date)) +
        kv('Від посадки до збору', cycle !== null ? cycle + ' ' + t('days') : '—') +
        (dry !== null ? kv('Сушка', dry + ' ' + t('days')) : '') +
        (h.dry_start_date && h.dry_end_date ? kv('Сушка: дати', fmt(h.dry_start_date) + ' → ' + fmt(h.dry_end_date)) : '') +
      '</div>' +
      (h.notes ? '<div style="font-size:13px;font-style:italic;color:var(--text2);background:var(--bg3);border-radius:8px;padding:9px 10px;margin-bottom:10px;white-space:pre-wrap">' + h.notes.replace(/</g, '&lt;') + '</div>' : '') +
      '<div style="display:flex;gap:10px;margin-top:6px">' +
        '<button class="btn btn-ghost" style="flex:1" onclick="GrowLog.closePopup(\'harv-view-popup\');GrowLog.openEditHarvest(\'' + h.id + '\')">✏️ Редагувати</button>' +
        '<button class="btn btn-danger" style="flex:1" onclick="GrowLog.closePopup(\'harv-view-popup\');GrowLog.deleteHarvest(\'' + h.id + '\')">🗑 Видалити</button>' +
      '</div>';
    document.getElementById('harv-view-content').innerHTML = html;
    openPopup('harv-view-popup');
    if (h.photo_url && h.photo_url.indexOf('sb://') === 0) {
      getPhotoUrl(h.photo_url).then(function(url) { var img = document.getElementById('hv-photo'); if (img && url) img.src = url; });
    }
  } catch(e) { toast('Error: ' + parseErr(e)); }
}

export function openLightbox(src) {
  if (!src) return;
  document.getElementById('lightbox-img').src = src;
  document.getElementById('lightbox').classList.add('open');
}
export function closeLightbox() { document.getElementById('lightbox').classList.remove('open'); }
