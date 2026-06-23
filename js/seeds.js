import { sb } from './supabase.js';
import { t } from './i18n.js';
import { fmt, today, fmtUAH, parseErr, showErr, clearErr } from './utils.js';
import { toast, openModal, closeModal, openPopup, closePopup } from './ui.js';
import { state } from './state.js';

export async function renderSeeds() {
  var pg = document.getElementById('page-seeds'); pg.innerHTML = '<div class="spinner"></div>';
  try {
    var typeFilter = state.seedTypeFilter || 'all';
    var allSeeds = await sb('seeds', 'GET', null, '?order=created_at.desc');
    var active = allSeeds.filter(function(s) { return s.status !== 'lost'; });
    var lost = allSeeds.filter(function(s) { return s.status === 'lost'; });
    var countAll = active.reduce(function(a,s){ return a + (parseInt(s.quantity)||0); }, 0);
    var countAuto = active.filter(function(s){ return s.seed_type === 'auto'; }).reduce(function(a,s){ return a + (parseInt(s.quantity)||0); }, 0);
    var countPhoto = active.filter(function(s){ return s.seed_type === 'photo'; }).reduce(function(a,s){ return a + (parseInt(s.quantity)||0); }, 0);
    var seeds = typeFilter === 'all' ? active : active.filter(function(s){ return s.seed_type === typeFilter; });
    var lostFiltered = typeFilter === 'all' ? lost : lost.filter(function(s){ return s.seed_type === typeFilter; });
    var html = '<div class="inner-tabs">'
      + '<button class="inner-tab ' + (state.seedsTab === 'bag' ? 'active' : '') + '" onclick="GrowLog.setSeedsTab(\'bag\')">' + t('bagTab') + '</button>'
      + '<button class="inner-tab ' + (state.seedsTab === 'wishlist' ? 'active' : '') + '" onclick="GrowLog.navigate(\'wishlist-list\')">' + t('wishlistTab') + '</button>'
      + '</div>'
      + '<div style="display:flex;gap:6px;margin-bottom:12px">'
      + '<button class="btn btn-sm ' + (typeFilter==='all'?'btn-primary':'btn-ghost') + '" onclick="GrowLog.setSeedTypeFilter(\'all\')">All ' + countAll + '</button>'
      + '<button class="btn btn-sm ' + (typeFilter==='auto'?'btn-primary':'btn-ghost') + '" onclick="GrowLog.setSeedTypeFilter(\'auto\')">Auto ' + countAuto + '</button>'
      + '<button class="btn btn-sm ' + (typeFilter==='photo'?'btn-primary':'btn-ghost') + '" onclick="GrowLog.setSeedTypeFilter(\'photo\')">Photo ' + countPhoto + '</button>'
      + '</div>';
    if (!seeds.length && !lostFiltered.length) {
      html += '<div class="empty"><div class="empty-icon">&#127792;</div><p>' + t('noSeeds') + '</p></div>';
    } else {
      if (seeds.length) html += seeds.map(function(s) { return renderSeedCard(s); }).join('');
      else html += '<div class="empty"><div class="empty-icon">&#127792;</div><p>' + t('noSeeds') + '</p></div>';
      if (lostFiltered.length) {
        html += '<div class="archive-section"><div class="archive-title">&#128451; ' + t('archive') + '</div>';
        html += lostFiltered.map(function(s) { return renderSeedCard(s); }).join('') + '</div>';
      }
    }
    pg.innerHTML = html;
  } catch(e) { pg.innerHTML = '<div class="empty"><p>Error: ' + e.message + '</p></div>'; }
}

export function renderSeedCard(s) {
  var statusLabels = { available: t('available'), soaking: t('soaking'), lost: t('lost') };
  var typeLabel = s.seed_type === 'auto' ? t('autoflower') : t('photoperiod');
  var isLost = s.status === 'lost';
  return '<div class="seed-card status-' + s.status + '">'
    + '<div class="card-row">'
      + '<div style="flex:1;min-width:0">'
        + '<div class="card-title">&#127792; ' + s.name + '</div>'
        + '<div class="card-sub">' + (s.brand || '') + (s.brand ? ' &middot; ' : '') + typeLabel
          + (s.flowering_days_min ? ' &middot; ' + s.flowering_days_min + (s.flowering_days_max && s.flowering_days_max !== s.flowering_days_min ? '-' + s.flowering_days_max : '') + ' ' + t('days') : '')
          + (s.purchase_date ? ' &middot; ' + fmt(s.purchase_date) : '') + '</div>'
        + (s.notes ? '<div class="card-sub">' + s.notes + '</div>' : '')
      + '</div>'
      + '<div style="text-align:right;flex-shrink:0;margin-left:12px">'
        + '<div class="seed-qty" style="color:' + (isLost ? 'var(--red)' : 'var(--green)') + '">' + s.quantity + ' ' + '\u0448\u0442.' + '</div>'
        + '<span class="badge badge-' + s.status + '">' + statusLabels[s.status] + '</span>'
        + (s.price_uah ? '<div style="font-size:11px;color:var(--text3);margin-top:2px">' + fmtUAH(s.price_uah) + '/' + '\u0448\u0442.' + '</div>' : '')
      + '</div>'
    + '</div>'
    + (!isLost
      ? '<div class="card-actions">'
          + (s.status === 'available' ? '<button class="btn btn-ghost btn-sm" onclick="GrowLog.openSplitPopup(\'' + s.id + '\',\'soaking\')">' + t('soakAction') + '</button>' : '')
          + '<button class="btn btn-warning btn-sm" onclick="GrowLog.openSplitPopup(\'' + s.id + '\',\'lost\')">' + t('lostAction') + '</button>'
          + '<button class="btn btn-primary btn-sm" onclick="GrowLog.openConvertPopup(\'' + s.id + '\')">' + t('convertAction') + '</button>'
          + '<button class="btn btn-ghost btn-sm" onclick="GrowLog.openSeedModal(\'' + s.id + '\')">&#9999;&#65039;</button>'
          + '<button class="btn btn-danger btn-sm" onclick="GrowLog.deleteSeed(\'' + s.id + '\')">&#128465;</button>'
        + '</div>'
      : '<div class="card-actions"><button class="btn btn-danger btn-sm" onclick="GrowLog.deleteSeed(\'' + s.id + '\')">&#128465;</button></div>')
    + '</div>';
}

export function openSeedModal(id) {
  id = id || null; clearErr('seed-error');
  document.getElementById('seed-edit-id').value = id || '';
  document.getElementById('modal-seed-title').textContent = id ? 'Edit seed' : 'New seed';
  if (id) {
    sb('seeds', 'GET', null, '?id=eq.' + id).then(function(rows) {
      var s = rows[0]; if (!s) return;
      document.getElementById('seed-name').value = s.name || '';
      document.getElementById('seed-brand').value = s.brand || '';
      document.getElementById('seed-type').value = s.seed_type || 'auto';
      document.getElementById('seed-qty').value = s.quantity || 1;
      document.getElementById('seed-price').value = s.price_uah || '';
      document.getElementById('seed-purchase-date').value = s.purchase_date || '';
      document.getElementById('seed-notes').value = s.notes || '';
      document.getElementById('seed-flower-min').value = s.flowering_days_min || '';
      document.getElementById('seed-flower-max').value = s.flowering_days_max || '';
    });
  } else {
    ['seed-name','seed-brand','seed-notes'].forEach(function(id) { document.getElementById(id).value = ''; });
    document.getElementById('seed-qty').value = 1;
    document.getElementById('seed-price').value = '';
    document.getElementById('seed-purchase-date').value = '';
    document.getElementById('seed-type').value = 'auto';
    document.getElementById('seed-flower-min').value = '';
    document.getElementById('seed-flower-max').value = '';
  }
  state.convertFromWLItem = null;
  openModal('modal-seed');
}

export async function saveSeed() {
  var name = document.getElementById('seed-name').value.trim();
  var qty = parseInt(document.getElementById('seed-qty').value);
  if (!name) { showErr('seed-error', '\u26a0\ufe0f \u0412\u0432\u0435\u0434\u0438 \u043d\u0430\u0437\u0432\u0443 \u0441\u043e\u0440\u0442\u0443'); return; }
  if (!qty || qty < 1) { showErr('seed-error', '\u26a0\ufe0f \u041a\u0456\u043b\u044c\u043a\u0456\u0441\u0442\u044c \u2265 1'); return; }
  var id = document.getElementById('seed-edit-id').value;
  var data = {
    name: name,
    brand: document.getElementById('seed-brand').value.trim() || null,
    seed_type: document.getElementById('seed-type').value,
    quantity: qty,
    price_uah: parseFloat(document.getElementById('seed-price').value) || null,
    purchase_date: document.getElementById('seed-purchase-date').value || null,
    notes: document.getElementById('seed-notes').value.trim() || null,
    year: new Date().getFullYear(),
    flowering_days_min: parseInt(document.getElementById('seed-flower-min').value) || null,
    flowering_days_max: parseInt(document.getElementById('seed-flower-max').value) || null
  };
  try {
    if (id) await sb('seeds', 'PATCH', data, '?id=eq.' + id);
    else { data.status = 'available'; await sb('seeds', 'POST', data); }
    var wlItemId = state.convertFromWLItem;
    state.convertFromWLItem = null;
    closeModal('modal-seed'); toast(t(id ? 'updated' : 'added') + ' \u2705');
    if (wlItemId) {
      if (confirm('\u0412\u0438\u0434\u0430\u043b\u0438\u0442\u0438 \u043f\u043e\u0437\u0438\u0446\u0456\u044e \u0437 \u0432\u0438\u0448\u043b\u0438\u0441\u0442\u0430?')) {
        await sb('wishlist_items', 'DELETE', null, '?id=eq.' + wlItemId);
      }
      GrowLog.navigate('seeds');
    } else { renderSeeds(); }
  } catch(e) { showErr('seed-error', '\u274c ' + parseErr(e)); }
}

export async function deleteSeed(id) {
  if (!confirm(t('confirmSeed'))) return;
  try { await sb('seeds', 'DELETE', null, '?id=eq.' + id); toast(t('deleted')); renderSeeds(); }
  catch(e) { toast('Error: ' + parseErr(e)); }
}

export async function openSplitPopup(seedId, newStatus) {
  var rows = await sb('seeds', 'GET', null, '?id=eq.' + seedId);
  var s = rows[0]; if (!s) return;
  var actionLabel = newStatus === 'soaking' ? t('soakAction') : t('lostAction');
  var costNote = (newStatus === 'lost' && s.price_uah) ?
    '<div id="split-cost-note" style="background:var(--red2);color:var(--red);padding:8px 12px;border-radius:var(--radius-sm);font-size:13px;margin-top:8px">' + '\u0412\u0438\u0442\u0440\u0430\u0442\u0430: ' + fmtUAH(s.price_uah * s.quantity) + '</div>' : '';
  var content =
    '<div style="margin-bottom:12px"><b>' + s.name + '</b> &middot; ' + s.quantity + ' \u0448\u0442.</div>'
    + '<div style="margin-bottom:12px"><label style="font-size:12px;font-weight:500;color:var(--text3);display:block;margin-bottom:4px;text-transform:uppercase">' + t('howMany') + ' (max ' + s.quantity + ')</label>'
    + '<input type="number" id="split-qty" class="fi-input" min="1" max="' + s.quantity + '" value="' + s.quantity + '"></div>'
    + costNote
    + '<div style="display:flex;gap:10px;margin-top:16px">'
    + '<button class="btn btn-ghost" style="flex:1" onclick="GrowLog.closePopup(\'split-popup\')">' + t('cancel') + '</button>'
    + '<button class="btn btn-primary" style="flex:1" onclick="GrowLog.executeSplit(\'' + seedId + '\',\'' + newStatus + '\',' + (s.price_uah || 0) + ')">' + actionLabel + '</button></div>';
  document.getElementById('split-popup-title').textContent = actionLabel + ': ' + s.name;
  document.getElementById('split-popup-content').innerHTML = content;
  if (newStatus === 'lost' && s.price_uah) {
    setTimeout(function() {
      var qi = document.getElementById('split-qty'), ni = document.getElementById('split-cost-note');
      if (qi && ni) qi.addEventListener('input', function() { ni.textContent = '\u0412\u0438\u0442\u0440\u0430\u0442\u0430: ' + fmtUAH(s.price_uah * (parseInt(qi.value) || 0)); });
    }, 50);
  }
  openPopup('split-popup');
}

export async function executeSplit(seedId, newStatus, pricePerUnit) {
  var qtyInput = document.getElementById('split-qty');
  var qty = parseInt(qtyInput ? qtyInput.value : 0);
  if (!qty || qty < 1) { toast('\u0412\u0432\u0435\u0434\u0438 \u043a\u0456\u043b\u044c\u043a\u0456\u0441\u0442\u044c'); return; }
  try {
    var rows = await sb('seeds', 'GET', null, '?id=eq.' + seedId);
    var s = rows[0]; if (!s) return;
    if (qty > s.quantity) { toast('\u041d\u0435 \u0431\u0456\u043b\u044c\u0448\u0435 ' + s.quantity); return; }
    if (qty === s.quantity) {
      await sb('seeds', 'PATCH', { status: newStatus }, '?id=eq.' + seedId);
    } else {
      await sb('seeds', 'PATCH', { quantity: s.quantity - qty }, '?id=eq.' + seedId);
      await sb('seeds', 'POST', { name: s.name, brand: s.brand, seed_type: s.seed_type, quantity: qty, status: newStatus, price_uah: s.price_uah, purchase_date: s.purchase_date, notes: s.notes, year: s.year });
    }
    if (newStatus === 'lost' && pricePerUnit > 0) {
      await sb('expenses', 'POST', { year: new Date().getFullYear(), category: 'seeds', amount_uah: pricePerUnit * qty, notes: '\u041f\u0440\u043e\u043f\u0430\u043b\u043e \u043d\u0430\u0441\u0456\u043d\u043d\u044f: ' + s.name + ' x' + qty });
    }
    closePopup('split-popup'); toast(t('saved') + ' \u2705'); renderSeeds();
  } catch(e) { toast('Error: ' + parseErr(e)); }
}

export async function openConvertPopup(seedId) {
  var rows = await sb('seeds', 'GET', null, '?id=eq.' + seedId);
  var s = rows[0]; if (!s) return;
  var locs = await sb('locations', 'GET', null, '?or=(mode.eq.outdoor,mode.is.null)&order=created_at.asc');
  var locOpts = locs.map(function(l) { return '<option value="' + l.id + '">' + l.name + '</option>'; }).join('');
  var content =
    '<div style="margin-bottom:12px"><b>' + s.name + '</b>' + (s.brand ? ' &middot; ' + s.brand : '') + '</div>'
    + '<div style="margin-bottom:12px"><label style="font-size:12px;font-weight:500;color:var(--text3);display:block;margin-bottom:4px;text-transform:uppercase">\u041a\u0456\u043b\u044c\u043a\u0456\u0441\u0442\u044c (max ' + s.quantity + ') <span style="color:var(--red)">*</span></label>'
    + '<input type="number" id="conv-qty" class="fi-input" min="1" max="' + s.quantity + '" value="1"></div>'
    + '<div style="margin-bottom:12px"><label style="font-size:12px;font-weight:500;color:var(--text3);display:block;margin-bottom:4px;text-transform:uppercase">' + t('selectLoc') + ' <span style="color:var(--red)">*</span></label>'
    + '<select id="conv-loc" class="fi-select"><option value="">-- \u0412\u0438\u0431\u0435\u0440\u0438 --</option>' + locOpts + '</select></div>'
    + '<div style="margin-bottom:12px"><label style="font-size:12px;font-weight:500;color:var(--text3);display:block;margin-bottom:4px;text-transform:uppercase">\u0414\u0430\u0442\u0430 \u043f\u043e\u0441\u0430\u0434\u043a\u0438 <span style="color:var(--red)">*</span></label>'
    + '<input type="date" id="conv-date" class="fi-input" value="' + today() + '"></div>'
    + '<div id="conv-error" style="color:var(--red);font-size:13px;margin-top:4px"></div>'
    + '<div style="display:flex;gap:10px;margin-top:16px">'
    + '<button class="btn btn-ghost" style="flex:1" onclick="GrowLog.closePopup(\'convert-popup\')">' + t('cancel') + '</button>'
    + '<button class="btn btn-primary" style="flex:1" onclick="GrowLog.executeConvert(\'' + seedId + '\',\'' + encodeURIComponent(s.name || '') + '\',\'' + encodeURIComponent(s.brand || '') + '\',\'' + (s.seed_type || 'auto') + '\',' + (s.price_uah || 0) + ')">' + t('convertAction') + '</button></div>';
  document.getElementById('convert-popup-content').innerHTML = content;
  openPopup('convert-popup');
}

export async function executeConvert(seedId, nameEnc, brandEnc, sType, pricePerUnit) {
  var sName = decodeURIComponent(nameEnc);
  var sBrand = decodeURIComponent(brandEnc);
  var qty = parseInt(document.getElementById('conv-qty').value) || 0;
  var locId = document.getElementById('conv-loc').value;
  var date = document.getElementById('conv-date').value;
  var errEl = document.getElementById('conv-error');
  if (!qty || qty < 1) { errEl.textContent = '\u26a0\ufe0f \u0412\u043a\u0430\u0436\u0438 \u043a\u0456\u043b\u044c\u043a\u0456\u0441\u0442\u044c'; return; }
  if (!locId) { errEl.textContent = '\u26a0\ufe0f \u0412\u0438\u0431\u0435\u0440\u0438 \u043b\u043e\u043a\u0430\u0446\u0456\u044e'; return; }
  if (!date) { errEl.textContent = '\u26a0\ufe0f \u0412\u043a\u0430\u0436\u0438 \u0434\u0430\u0442\u0443'; return; }
  errEl.textContent = '';
  try {
    var rows = await sb('seeds', 'GET', null, '?id=eq.' + seedId);
    var s = rows[0]; if (!s) return;
    if (qty > s.quantity) { errEl.textContent = '\u26a0\ufe0f \u041d\u0435 \u0431\u0456\u043b\u044c\u0448\u0435 ' + s.quantity; return; }
    var nv = await sb('varieties', 'POST', { name: sName, brand: sBrand, seed_type: sType, flowering_days_min: s.flowering_days_min || 0, flowering_days_max: s.flowering_days_max || 0 });
    if (!nv || !nv[0]) throw new Error('Could not create variety');
    for (var i = 0; i < qty; i++) {
      await sb('plants', 'POST', { location_id: locId, variety_id: nv[0].id, name: qty > 1 ? '#' + (i + 1) : '', plant_date: date, current_stage: 'seedling', stage_overrides: {}, is_harvested: false });
    }
    if (pricePerUnit > 0) {
      var yr = new Date(date + 'T12:00:00').getFullYear();
      await sb('expenses', 'POST', { year: yr, category: 'seeds', amount_uah: pricePerUnit * qty, notes: '\u041d\u0430\u0441\u0456\u043d\u043d\u044f: ' + sName + ' x' + qty });
    }
    if (qty >= s.quantity) await sb('seeds', 'DELETE', null, '?id=eq.' + seedId);
    else await sb('seeds', 'PATCH', { quantity: s.quantity - qty }, '?id=eq.' + seedId);
    closePopup('convert-popup'); toast(t('added') + ' \u2705 ' + qty); renderSeeds();
  } catch(e) { errEl.textContent = '\u274c ' + parseErr(e); }
}
