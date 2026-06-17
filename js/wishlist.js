import { sb } from './supabase.js';
import { t } from './i18n.js';
import { today, fmtUAH, parseErr, showErr, clearErr } from './utils.js';
import { toast, openModal, closeModal } from './ui.js';
import { state } from './app.js';

export async function renderWishlistList() {
  var pg = document.getElementById('page-wishlist-list'); pg.innerHTML = '<div class="spinner"></div>';
  try {
    var wishlists = await sb('wishlists', 'GET', null, '?order=created_at.desc');
    var html = '<div class="inner-tabs">' +
      '<button class="inner-tab" onclick="GrowLog.navigate(\'seeds\')">' + t('bagTab') + '</button>' +
      '<button class="inner-tab active">' + t('wishlistTab') + '</button></div>';
    if (!wishlists.length) {
      html += '<div class="empty"><div class="empty-icon">💫</div><p>' + t('noWishlists') + '</p></div>';
    } else {
      html += wishlists.map(function(wl) {
        return '<div class="card" style="cursor:pointer" onclick="GrowLog.navigate(\'wishlist-items\',{wlId:\'' + wl.id + '\',wlName:\'' + encodeURIComponent(wl.name) + '\'})">' +
          '<div class="card-row"><div><div class="card-title">💫 ' + wl.name + '</div></div><span style="color:var(--text3);font-size:20px">›</span></div>' +
          '<div class="card-actions">' +
          '<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();GrowLog.openWishlistModal(\'' + wl.id + '\')">✏️</button>' +
          '<button class="btn btn-danger btn-sm" onclick="event.stopPropagation();GrowLog.deleteWishlist(\'' + wl.id + '\')">🗑</button>' +
          '</div></div>';
      }).join('');
    }
    pg.innerHTML = html;
  } catch (e) { pg.innerHTML = '<div class="empty"><p>Error: ' + e.message + '</p></div>'; }
}

export function openWishlistModal(id) {
  id = id || null; clearErr('wishlist-error');
  document.getElementById('wishlist-edit-id').value = id || '';
  document.getElementById('modal-wishlist-title').textContent = id ? 'Редагувати вишлист' : 'Новий вишлист';
  if (id) {
    sb('wishlists', 'GET', null, '?id=eq.' + id).then(function(r) { if (r[0]) document.getElementById('wishlist-name').value = r[0].name || ''; });
  } else { document.getElementById('wishlist-name').value = ''; }
  openModal('modal-wishlist');
}

export async function saveWishlist() {
  var name = document.getElementById('wishlist-name').value.trim();
  if (!name) { showErr('wishlist-error', '⚠️ Введи назву'); return; }
  var id = document.getElementById('wishlist-edit-id').value;
  try {
    if (id) await sb('wishlists', 'PATCH', { name: name }, '?id=eq.' + id);
    else await sb('wishlists', 'POST', { name: name });
    closeModal('modal-wishlist'); toast(t(id ? 'updated' : 'added') + ' ✅'); renderWishlistList();
  } catch (e) { showErr('wishlist-error', '❌ ' + parseErr(e)); }
}

export async function deleteWishlist(id) {
  if (!confirm(t('confirmWL'))) return;
  try {
    await sb('wishlist_items', 'DELETE', null, '?wishlist_id=eq.' + id);
    await sb('wishlists', 'DELETE', null, '?id=eq.' + id);
    toast(t('deleted')); renderWishlistList();
  } catch (e) { toast('Error: ' + parseErr(e)); }
}

export async function renderWishlistItems() {
  var pg = document.getElementById('page-wishlist-items');
  var wlDec = decodeURIComponent(state.curWishlistName);
  pg.innerHTML = '<div class="spinner"></div>';
  try {
    var items = await sb('wishlist_items', 'GET', null, '?wishlist_id=eq.' + state.curWishlistId + '&order=created_at.desc');
    var html = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">' +
      '<button class="btn btn-ghost btn-sm" onclick="GrowLog.navigate(\'wishlist-list\')">← ' + t('back') + '</button>' +
      '<span style="font-size:16px;font-weight:700">💫 ' + wlDec + '</span></div>';
    if (!items.length) {
      html += '<div class="empty"><div class="empty-icon">✨</div><p>' + t('noWishlistItems') + '</p></div>';
    } else {
      html += items.map(function(item) {
        var typeLabel = item.seed_type === 'auto' ? t('autoflower') : t('photoperiod');
        return '<div class="card">' +
          '<div class="card-row"><div>' +
          '<div class="card-title">🌱 ' + item.name + '</div>' +
          '<div class="card-sub">' + (item.brand || '') + (item.brand ? ' · ' : '') + typeLabel + (item.price_uah ? ' · ' + fmtUAH(item.price_uah) : '') + '</div>' +
          '</div></div>' +
          '<div class="card-actions">' +
          '<button class="btn btn-primary btn-sm" onclick="GrowLog.convertWishlistItemToBag(\'' + item.id + '\')">' + t('buyAction') + '</button>' +
          '<button class="btn btn-ghost btn-sm" onclick="GrowLog.openWishlistItemModal(\'' + item.id + '\')">✏️</button>' +
          '<button class="btn btn-danger btn-sm" onclick="GrowLog.deleteWishlistItem(\'' + item.id + '\')">🗑</button>' +
          '</div></div>';
      }).join('');
    }
    pg.innerHTML = html;
  } catch (e) { pg.innerHTML = '<div class="empty"><p>Error: ' + e.message + '</p></div>'; }
}

export function openWishlistItemModal(id) {
  id = id || null; clearErr('wi-error');
  document.getElementById('wi-edit-id').value = id || '';
  document.getElementById('wi-wishlist-id').value = state.curWishlistId;
  document.getElementById('modal-wi-title').textContent = id ? 'Редагувати позицію' : 'Додати в вишлист';
  if (id) {
    sb('wishlist_items', 'GET', null, '?id=eq.' + id).then(function(rows) {
      var item = rows[0]; if (!item) return;
      document.getElementById('wi-name').value = item.name || '';
      document.getElementById('wi-brand').value = item.brand || '';
      document.getElementById('wi-type').value = item.seed_type || 'auto';
      document.getElementById('wi-price').value = item.price_uah || '';
    });
  } else {
    ['wi-name', 'wi-brand'].forEach(function(id) { document.getElementById(id).value = ''; });
    document.getElementById('wi-price').value = '';
    document.getElementById('wi-type').value = 'auto';
  }
  openModal('modal-wishlist-item');
}

export async function saveWishlistItem() {
  var name = document.getElementById('wi-name').value.trim();
  if (!name) { showErr('wi-error', '⚠️ Введи назву сорту'); return; }
  var id = document.getElementById('wi-edit-id').value;
  var wlId = document.getElementById('wi-wishlist-id').value;
  var data = {
    name: name,
    brand: document.getElementById('wi-brand').value.trim() || null,
    seed_type: document.getElementById('wi-type').value,
    price_uah: parseFloat(document.getElementById('wi-price').value) || null,
    wishlist_id: wlId
  };
  try {
    if (id) await sb('wishlist_items', 'PATCH', data, '?id=eq.' + id);
    else await sb('wishlist_items', 'POST', data);
    closeModal('modal-wishlist-item'); toast(t(id ? 'updated' : 'added') + ' ✅'); renderWishlistItems();
  } catch (e) { showErr('wi-error', '❌ ' + parseErr(e)); }
}

export async function deleteWishlistItem(id) {
  if (!confirm(t('confirmWLItem'))) return;
  try { await sb('wishlist_items', 'DELETE', null, '?id=eq.' + id); toast(t('deleted')); renderWishlistItems(); }
  catch (e) { toast('Error: ' + parseErr(e)); }
}

export async function convertWishlistItemToBag(itemId) {
  var rows = await sb('wishlist_items', 'GET', null, '?id=eq.' + itemId);
  var item = rows[0]; if (!item) return;
  clearErr('seed-error');
  document.getElementById('seed-edit-id').value = '';
  document.getElementById('modal-seed-title').textContent = 'Куплено — додати в Сумку';
  document.getElementById('seed-name').value = item.name || '';
  document.getElementById('seed-brand').value = item.brand || '';
  document.getElementById('seed-type').value = item.seed_type || 'auto';
  document.getElementById('seed-price').value = item.price_uah || '';
  document.getElementById('seed-qty').value = 1;
  document.getElementById('seed-purchase-date').value = today();
  document.getElementById('seed-notes').value = '';
  state.convertFromWLItem = itemId;
  openModal('modal-seed');
}
