import { sb } from './supabase.js';
import { t } from './i18n.js';
import { fmt, today, fmtUAH, parseErr, showErr, clearErr } from './utils.js';
import { toast, openModal, closeModal, openPopup, closePopup } from './ui.js';
import { state } from './state.js';

export async function renderSeeds() {
  var pg = document.getElementById('page-seeds'); pg.innerHTML = '<div class="spinner"></div>';
  try {
    var seeds = await sb('seeds', 'GET', null, '?order=created_at.desc');
    var active = seeds.filter(function(s) { return s.status !== 'lost'; });
    var lost = seeds.filter(function(s) { return s.status === 'lost'; });
    // FIX: use single quotes in onclick, no nested quote conflict
    var html = '<div class="inner-tabs">' +
      '<button class="inner-tab ' + (state.seedsTab === 'bag' ? 'active' : '') + '" onclick="GrowLog.setSeedsTab(\'bag\')">' + t('bagTab') + '</button>' +
      '<button class="inner-tab ' + (state.seedsTab === 'wishlist' ? 'active' : '') + '" onclick="GrowLog.navigate(\'wishlist-list\')">' + t('wishlistTab') + '</button>' +
      '</div>';
    if (!active.length && !lost.length) {
      html += '<div class="empty"><div class="empty-icon">🌰</div><p>' + t('noSeeds') + '</p></div>';
    } else {
      if (active.length) html += active.map(function(s) { return renderSeedCard(s); }).join('');
      else html += '<div class="empty"><div class="empty-icon">🌰</div><p>' + t('noSeeds') + '</p></div>';
      if (lost.length) {
        html += '<div class="archive-section"><div class="archive-title">🗃 ' + t('archive') + '</div>';
        html += lost.map(function(s) { return renderSeedCard(s); }).join('') + '</div>';
      }
    }
    pg.innerHTML = html;
  } catch (e) { pg.innerHTML = '<div class="empty"><p>Error: ' + e.message + '</p></div>'; }
}

export function renderSeedCard(s) {
  var statusLabels = { available: t('available'), soaking: t('soaking'), lost: t('lost') };
  var typeLabel = s.seed_type === 'auto' ? t('autoflower') : t('photoperiod');
  var isLost = s.status === 'lost';
  return '<div class="seed-card status-' + s.status + '">' +
    '<div class="card-row">' +
      '<div style="flex:1;min-width:0">' +
        '<div class="card-title">🌰 ' + s.name + '</div>' +
        '<div class="card-sub">' + (s.brand || '') + (s.brand ? ' · ' : '') + typeLabel + (s.purchase_date ? ' · ' + fmt(s.purchase_date) : '') + '</div>' +
        (s.notes ? '<div class="card-sub">' + s.notes + '</div>' : '') +
      '</div>' +
      '<div style="text-align:right;flex-shrink:0;margin-left:12px">' +
        '<div class="seed-qty" style="color:' + (isLost ? 'var(--red)' : 'var(--green)') + '">' + s.quantity + ' шт.</div>' +
        '<span class="badge badge-' + s.status + '">' + statusLabels[s.status] + '</span>' +
        (s.price_uah ? '<div style="font-size:11px;color:var(--text3);margin-top:2px">' + fmtUAH(s.price_uah) + '/шт.</div>' : '') +
      '</div>' +
    '</div>' +
    (!isLost ?
      '<div class="card-actions">' +
        (s.status === 'available' ? '<button class="btn btn-ghost btn-sm" onclick="GrowLog.openSplitPopup(\'' + s.id + '\',\'soaking\')">' + t('soakAction') + '</button>' : '') +
        '<button class="btn btn-warning btn-sm" onclick="GrowLog.openSplitPopup(\'' + s.id + '\',\'lost\')">' + t('lostAction') + '</button>' +
        '<button class="btn btn-primary btn-sm" onclick="GrowLog.openConvertPopup(\'' + s.id + '\')">' + t('convertAction') + '</button>' +
        '<button class="btn btn-ghost btn-sm" onclick="GrowLog.openSeedModal(\'' + s.id + '\')">✏️</button>' +
        '<button class="btn btn-danger btn-sm" onclick="GrowLog.deleteSeed(\'' + s.id + '\')">🗑</button>' +
      '</div>' :
      '<div class="card-actions"><button class="btn btn-danger btn-sm" onclick="GrowLog.deleteSeed(\'' + s.id + '\')">🗑</button></div>') +
  '</div>';
}

export function openSeedModal(id) {
  id = id || null; clearErr('seed-error');
  document.getElementById('seed-edit-id').value = id || '';
  document.getElementById('modal-seed-title').textContent = id ? 'Редагувати насіння' : 'Нове насіння';
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
    ['seed-name', 'seed-brand', 'seed-notes'].forEach(function(id) { document.getElementById(id).value = ''; });
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
  if (!name) { showErr('seed-error', '⚠️ Введи назву сорту'); return; }
  if (!qty || qty < 1) { showErr('seed-error', '⚠️ Кількість має бути ≥ 1'); return; }
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
    closeModal('modal-seed'); toast(t(id ? 'updated' : 'added') + ' ✅');
    if (wlItemId) {
      if (confirm('Видалити позицію з вишлиста?')) {
        await sb('wishlist_items', 'DELETE', null, '?id=eq.' + wlItemId);
      }
      GrowLog.navigate('seeds');
    } else { renderSeeds(); }
  } catch (e) { showErr('seed-error', '❌ ' + parseErr(e)); }
}

export async function deleteSeed(id) {
  if (!confirm(t('confirmSeed'))) return;
  try { await sb('seeds', 'DELETE', null, '?id=eq.' + id); toast(t('deleted')); renderSeeds(); }
  catch (e) { toast('Error: ' + parseErr(e)); }
}

export async function openSplitPopup(seedId, newStatus) {
  var rows = await sb('seeds', 'GET', null, '?id=eq.' + seedId);
  var s = rows[0]; if (!s) return;
  var actionLabel = newStatus === 'soaking' ? t('soakAction') : t('lostAction');
  var costNote = (newStatus === 'lost' && s.price_uah) ?
    '<div id="split-cost-note" style="background:var(--red2);color:var(--red);padding:8px 12px;border-radius:var(--radius-sm);font-size:13px;margin-top:8px">Витрата: ' + fmtUAH(s.price_uah * s.quantity) + '</div>' : '';
  var content =
    '<div style="margin-bottom:12px"><b>' + s.name + '</b> · ' + s.quantity + ' шт.</div>' +
    '<div style="margin-bottom:12px"><label style="font-size:12px;font-weight:500;color:var(--text3);display:block;margin-bottom:4px;text-transform:uppercase">' + t('howMany') + ' (max ' + s.quantity + ')</label>' +
    '<input type="number" id="split-qty" class="fi-input" min="1" max="' + s.quantity + '" value="' + s.quantity + '"></div>' +
    costNote +
    '<div style="display:flex;gap:10px;margin-top:16px">' +
    '<button class="btn btn-ghost" style="flex:1" onclick="GrowLog.closePopup(\'split-popup\')">' + t('cancel') + '</button>' +
    '<button class="btn btn-primary" style="flex:1" onclick="GrowLog.executeSplit(\'' + seedId + '\',\'' + newStatus + '\',' + (s.price_uah || 0) + ')">' + actionLabel + '</button></div>';
  document.getElementById('split-popup-title').textContent = actionLabel + ': ' + s.name;
  document.getElementById('split-popup-content').innerHTML = content;
  if (newStatus === 'lost' && s.price_uah) {
    setTimeout(function() {
      var qi = document.getElementById('split-qty'), ni = document.getElementById('split-cost-note');
      if (qi && ni) qi.addEventListener('input', function() { ni.textContent = 'Витрата: ' + fmtUAH(s.price_uah * (parseInt(qi.value) || 0)); });
    }, 50);
  }
  openPopup('split-popup');
}

export async function executeSplit(seedId, newStatus, pricePerUnit) {
  var qtyInput = document.getElementById('split-qty');
  var qty = parseInt(qtyInput ? qtyInput.value : 0);
  if (!qty || qty < 1) { toast('Введи кількість'); return; }
  try {
    var rows = await sb('seeds', 'GET', null, '?id=eq.' + seedId);
    var s = rows[0]; if (!s) return;
    if (qty > s.quantity) { toast('Не більше ' + s.quantity); return; }
    if (qty === s.quantity) {
      await sb('seeds', 'PATCH', { status: newStatus }, '?id=eq.' + seedId);
    } else {
      await sb('seeds', 'PATCH', { quantity: s.quantity - qty }, '?id=eq.' + seedId);
      await sb('seeds', 'POST', { name: s.name, brand: s.brand, seed_type: s.seed_type, quantity: qty, status: newStatus, price_uah: s.price_uah, purchase_date: s.purchase_date, notes: s.notes, year: s.year });
    }
    if (newStatus === 'lost' && pricePerUnit > 0) {
      await sb('expenses', 'POST', { year: new Date().getFullYear(), category: 'seeds', amount_uah: pricePerUnit * qty, notes: 'Пропало насіння: ' + s.name + ' x' + qty });
    }
    closePopup('split-popup'); toast(t('saved') + ' ✅'); renderSeeds();
  } catch (e) { toast('Error: ' + parseErr(e)); }
}

export async function openConvertPopup(seedId) {
  var rows = await sb('seeds', 'GET', null, '?id=eq.' + seedId);
  var s = rows[0]; if (!s) return;
  var locs = await sb('locations', 'GET', null, '?order=created_at.asc');
  var locOpts = locs.map(function(l) { return '<option value="' + l.id + '">' + l.name + '</option>'; }).join('');
  var content =
    '<div style="margin-bottom:12px"><b>' + s.name + '</b>' + (s.brand ? ' · ' + s.brand : '') + '</div>' +
    '<div style="margin-bottom:12px"><label style="font-size:12px;font-weight:500;color:var(--text3);display:block;margin-bottom:4px;text-transform:uppercase">Кількість (max ' + s.quantity + ') <span style="color:var(--red)">*</span></label>' +
    '<input type="number" id="conv-qty" class="fi-input" min="1" max="' + s.quantity + '" value="1"></div>' +
    '<div style="margin-bottom:12px"><label style="font-size:12px;font-weight:500;color:var(--text3);display:block;margin-bottom:4px;text-transform:uppercase">' + t('selectLoc') + ' <span style="color:var(--red)">*</span></label>' +
    '<select id="conv-loc" class="fi-select"><option value="">-- Вибери --</option>' + locOpts + '</select></div>' +
    '<div style="margin-bottom:12px"><label style="font-size:12px;font-weight:500;color:var(--text3);display:block;margin-bottom:4px;text-transform:uppercase">Дата посадки <span style="color:var(--red)">*</span></label>' +
    '<input type="date" id="conv-date" class="fi-input" value="' + today() + '"></div>' +
    '<div id="conv-error" style="color:var(--red);font-size:13px;margin-top:4px"></div>' +
    '<div style="display:flex;gap:10px;margin-top:16px">' +
    '<button class="btn btn-ghost" style="flex:1" onclick="GrowLog.closePopup(\'convert-popup\')">' + t('cancel') + '</button>' +
    '<button class="btn btn-primary" style="flex:1" onclick="GrowLog.executeConvert(\'' + seedId + '\',\'' + encodeURIComponent(s.name || '') + '\',\'' + encodeURIComponent(s.brand || '') + '\',\'' + (s.seed_type || 'auto') + '\',' + (s.price_uah || 0) + ')">' + t('convertAction') + '</button></div>';
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
  if (!qty || qty < 1) { errEl.textContent = '⚠️ Вкажи кількість'; return; }
  if (!locId) { errEl.textContent = '⚠️ Вибери локацію'; return; }
  if (!date) { errEl.textContent = '⚠️ Вкажи дату'; return; }
  errEl.textContent = '';
  try {
    var rows = await sb('seeds', 'GET', null, '?id=eq.' + seedId);
    var s = rows[0]; if (!s) return;
    if (qty > s.quantity) { errEl.textContent = '⚠️ Не більше ' + s.quantity; return; }
    var nv = await sb('varieties', 'POST', { name: sName, brand: sBrand, seed_type: sType, flowering_days_min: 0, flowering_days_max: 0 });
    if (!nv || !nv[0]) throw new Error('Could not create variety');
    for (var i = 0; i < qty; i++) {
      await sb('plants', 'POST', { location_id: locId, variety_id: nv[0].id, name: qty > 1 ? sName + ' #' + (i + 1) : '', plant_date: date, current_stage: 'seedling', stage_overrides: {}, is_harvested: false });
    }
    if (pricePerUnit > 0) {
      var yr = new Date(date + 'T12:00:00').getFullYear();
      await sb('expenses', 'POST', { year: yr, category: 'seeds', amount_uah: pricePerUnit * qty, notes: 'Насіння: ' + sName + ' x' + qty });
    }
    if (qty >= s.quantity) await sb('seeds', 'DELETE', null, '?id=eq.' + seedId);
    else await sb('seeds', 'PATCH', { quantity: s.quantity - qty }, '?id=eq.' + seedId);
    closePopup('convert-popup'); toast(t('added') + ' ✅ ' + qty); renderSeeds();
  } catch (e) { errEl.textContent = '❌ ' + parseErr(e); }
}
