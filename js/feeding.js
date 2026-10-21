import { sb } from './supabase.js';
import { t } from './i18n.js';
import { parseErr } from './utils.js';
import { getStage } from './stages.js';
import { toast, openPopup, closePopup } from './ui.js';
import { state } from './state.js';

var STAGE_LABELS = {
  seedling: 'Розсада', growth: 'Ріст', pre_flower: 'Передцвіт',
  flower: 'Цвітіння', ripening: 'Дозрівання'
};
var STAGE_ORDER = ['seedling', 'growth', 'pre_flower', 'flower', 'ripening'];
var COLOR_PALETTE = ['#d32f2f', '#2d7a3a', '#e65100', '#7c3aed', '#c62828', '#1565c0', '#00838f', '#f9a825'];

// ══════════ CALCULATOR (plant card 💧) ══════════
export async function openFeedingModal(plantId, labelEnc) {
  try {
    var rows = await sb('plants', 'GET', null, '?id=eq.' + plantId + '&select=location_id,variety_id,plant_date,stage_overrides,is_harvested');
    var p = rows[0]; if (!p) return;
    var v = state.cache.varieties.find(function(x) { return x.id === p.variety_id; });
    if (!v) { var vr = await sb('varieties', 'GET', null, '?id=eq.' + p.variety_id); v = vr[0]; }
    var stage = getStage(p, v);
    if (stage === 'done' || stage === 'lost' || stage === 'harvest') stage = 'ripening';
    state.feedingStage = stage;
    state.feedingPlantLabel = decodeURIComponent(labelEnc);
    var sets = await sb('feed_sets', 'GET', null, '?order=sort_order.asc');
    if (!sets.length) {
      document.getElementById('feeding-popup-title').textContent = '💧 Годування';
      document.getElementById('feeding-popup-content').innerHTML =
        '<div style="text-align:center;padding:20px 0"><div style="font-size:32px;margin-bottom:8px">💧</div>' +
        '<p style="color:var(--text3);font-size:14px;margin-bottom:16px">Немає наборів добрив.<br>Створи набір у Сумці → Добрива.</p>' +
        '<button class="btn btn-primary" onclick="GrowLog.closePopup(\'feeding-popup\');GrowLog.navigate(\'seeds\');GrowLog.setSeedsTab(\'feed\')">Відкрити Добрива</button></div>';
      openPopup('feeding-popup');
      return;
    }
    var savedSet = localStorage.getItem('gl_feed_set');
    var activeSet = sets.find(function(s) { return s.id === savedSet; }) || sets[0];
    state.feedingSetId = activeSet.id;
    state.feedingSets = sets;
    await renderCalc(4);
    openPopup('feeding-popup');
  } catch(e) { toast('Error: ' + parseErr(e)); }
}

async function renderCalc(liters) {
  var stageKey = state.feedingStage;
  var setId = state.feedingSetId;
  var products = await sb('feed_products', 'GET', null, '?set_id=eq.' + setId + '&order=sort_order.asc');
  var prodIds = products.map(function(p) { return p.id; });
  var doses = prodIds.length ? await sb('feed_doses', 'GET', null, '?stage_key=eq.' + stageKey + '&product_id=in.(' + prodIds.join(',') + ')') : [];
  var doseMap = {};
  doses.forEach(function(d) { doseMap[d.product_id] = parseFloat(d.ml_per_liter) || 0; });

  var stageLabel = STAGE_LABELS[stageKey] || stageKey;
  document.getElementById('feeding-popup-title').textContent = '💧 Годування · ' + stageLabel;

  var setOpts = state.feedingSets.map(function(s) {
    return '<option value="' + s.id + '"' + (s.id === setId ? ' selected' : '') + '>' + s.name + '</option>';
  }).join('');

  var html = '<div style="margin-bottom:10px;font-size:13px;color:var(--text3)">' + (state.feedingPlantLabel || '') + '</div>';
  html += '<div style="margin-bottom:12px"><label style="font-size:11px;font-weight:500;color:var(--text3);display:block;margin-bottom:4px;text-transform:uppercase">Набір</label>' +
    '<select id="feed-set-select" class="fi-select" onchange="GrowLog.switchFeedSet()">' + setOpts + '</select></div>';
  html += '<div style="margin-bottom:14px"><label style="font-size:11px;font-weight:500;color:var(--text3);display:block;margin-bottom:4px;text-transform:uppercase">Об\u2019єм води (л)</label>' +
    '<input type="number" id="feed-liters" class="fi-input" min="0.5" step="0.5" value="' + liters + '" oninput="GrowLog.recalcFeeding()"></div>';
  html += '<div id="feed-recipe"></div>';
  html += '<div style="font-size:11px;color:var(--text3);margin-top:12px;padding:8px 10px;background:var(--bg3);border-radius:8px">⚠️ Порядок: спочатку Micro, потім Gro, потім Bloom.</div>';
  html += '<div style="margin-top:16px"><button class="btn btn-ghost" style="width:100%" onclick="GrowLog.closePopup(\'feeding-popup\')">Закрити</button></div>';
  document.getElementById('feeding-popup-content').innerHTML = html;

  window._feedProducts = products;
  window._feedDoseMap = doseMap;
  document.getElementById('feed-recipe').innerHTML = buildRecipe(products, doseMap, liters);
}

function buildRecipe(products, doseMap, liters) {
  var rows = '';
  products.forEach(function(prod) {
    var perL = doseMap[prod.id] || 0;
    if (perL === 0) return;
    var total = (perL * liters).toFixed(1);
    rows += '<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid var(--border)">' +
      '<span style="display:flex;align-items:center;gap:8px;font-size:14px">' +
      '<span style="width:9px;height:9px;border-radius:50%;background:' + prod.color + '"></span>' + prod.name + '</span>' +
      '<span style="font-size:15px;font-weight:600;color:' + prod.color + '">' + total + ' ml</span></div>';
  });
  if (!rows) rows = '<div style="color:var(--text3);font-size:13px;padding:10px 0">Немає добрив для цієї стадії</div>';
  return rows;
}

export function recalcFeeding() {
  var liters = parseFloat(document.getElementById('feed-liters').value) || 0;
  document.getElementById('feed-recipe').innerHTML = buildRecipe(window._feedProducts || [], window._feedDoseMap || {}, liters);
}

export async function switchFeedSet() {
  var setId = document.getElementById('feed-set-select').value;
  state.feedingSetId = setId;
  localStorage.setItem('gl_feed_set', setId);
  await renderCalc(parseFloat(document.getElementById('feed-liters').value) || 4);
}

// ══════════ MANAGEMENT (Сумка → Добрива) ══════════
export async function renderFeedManager() {
  var pg = document.getElementById('page-seeds');
  try {
    var sets = await sb('feed_sets', 'GET', null, '?order=sort_order.asc');
    var html = seedsTabsHeader();
    html += '<div style="display:flex;gap:8px;margin-bottom:12px;align-items:center">';
    if (sets.length) {
      if (!state.feedManagerSetId || !sets.find(function(s){ return s.id === state.feedManagerSetId; })) {
        state.feedManagerSetId = sets[0].id;
      }
      var opts = sets.map(function(s) { return '<option value="' + s.id + '"' + (s.id === state.feedManagerSetId ? ' selected' : '') + '>' + s.name + '</option>'; }).join('');
      html += '<select class="fi-select" style="flex:1" onchange="GrowLog.selectFeedSet(this.value)">' + opts + '</select>';
      html += '<button class="btn btn-ghost btn-sm" onclick="GrowLog.renameFeedSet()">✏️</button>';
      html += '<button class="btn btn-danger btn-sm" onclick="GrowLog.deleteFeedSet()">🗑</button>';
    }
    html += '<button class="btn btn-primary btn-sm" onclick="GrowLog.newFeedSet()">➕ Набір</button>';
    html += '</div>';

    if (!sets.length) {
      html += '<div class="empty"><div class="empty-icon">💧</div><p>Немає наборів добрив. Створи перший.</p></div>';
      pg.innerHTML = html; return;
    }

    var setId = state.feedManagerSetId;
    var products = await sb('feed_products', 'GET', null, '?set_id=eq.' + setId + '&order=sort_order.asc');
    var prodIds = products.map(function(p) { return p.id; });
    var doses = prodIds.length ? await sb('feed_doses', 'GET', null, '?product_id=in.(' + prodIds.join(',') + ')') : [];

    // Products list
    html += '<div class="form-section" style="margin-top:0">Добрива</div>';
    if (!products.length) {
      html += '<div style="color:var(--text3);font-size:13px;padding:6px 0">Немає добрив у наборі</div>';
    } else {
      products.forEach(function(prod) {
        html += '<div class="card" style="padding:10px 12px"><div style="display:flex;justify-content:space-between;align-items:center">' +
          '<span style="display:flex;align-items:center;gap:8px;font-size:14px;font-weight:500">' +
          '<span style="width:12px;height:12px;border-radius:50%;background:' + prod.color + '"></span>' + prod.name + '</span>' +
          '<span><button class="btn btn-ghost btn-sm" onclick="GrowLog.editFeedProduct(\'' + prod.id + '\')">✏️</button>' +
          '<button class="btn btn-danger btn-sm" onclick="GrowLog.deleteFeedProduct(\'' + prod.id + '\')">🗑</button></span></div></div>';
      });
    }
    html += '<button class="btn btn-ghost btn-sm" style="width:100%;margin-top:6px" onclick="GrowLog.newFeedProduct()">➕ Додати добриво</button>';

    // Dose table by stage tabs
    if (products.length) {
      if (!state.feedManagerStage) state.feedManagerStage = 'growth';
      html += '<div class="form-section">Дози (мл/л)</div>';
      html += '<div class="year-tabs">' + STAGE_ORDER.map(function(sk) {
        return '<div class="year-tab ' + (sk === state.feedManagerStage ? 'active' : '') + '" onclick="GrowLog.selectFeedStage(\'' + sk + '\')">' + STAGE_LABELS[sk] + '</div>';
      }).join('') + '</div>';
      var doseMap = {};
      doses.forEach(function(d) { doseMap[d.product_id + '|' + d.stage_key] = d; });
      products.forEach(function(prod) {
        var d = doseMap[prod.id + '|' + state.feedManagerStage];
        var val = d ? d.ml_per_liter : 0;
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border)">' +
          '<span style="display:flex;align-items:center;gap:8px;font-size:14px"><span style="width:9px;height:9px;border-radius:50%;background:' + prod.color + '"></span>' + prod.name + '</span>' +
          '<input type="number" class="fi-input" style="width:90px" min="0" step="0.1" value="' + val + '" onchange="GrowLog.saveDose(\'' + prod.id + '\',\'' + state.feedManagerStage + '\',this.value)"></div>';
      });
    }
    pg.innerHTML = html;
  } catch(e) { pg.innerHTML = seedsTabsHeader() + '<div class="empty"><p>Error: ' + e.message + '</p></div>'; }
}

function seedsTabsHeader() {
  return '<div class="inner-tabs">' +
    '<button class="inner-tab" onclick="GrowLog.setSeedsTab(\'bag\')">' + t('bagTab') + '</button>' +
    '<button class="inner-tab" onclick="GrowLog.navigate(\'wishlist-list\')">' + t('wishlistTab') + '</button>' +
    '<button class="inner-tab active" onclick="GrowLog.setSeedsTab(\'feed\')">💧 Добрива</button>' +
    '</div>';
}

export function selectFeedSet(id) { state.feedManagerSetId = id; renderFeedManager(); }
export function selectFeedStage(sk) { state.feedManagerStage = sk; renderFeedManager(); }

export async function newFeedSet() {
  var name = prompt('Назва набору:'); if (!name) return;
  try {
    await sb('feed_sets', 'POST', { name: name.trim(), sort_order: 99 });
    toast('Набір створено ✅'); renderFeedManager();
  } catch(e) { toast('Error: ' + parseErr(e)); }
}

export async function renameFeedSet() {
  var sets = state.feedManagerSets || await sb('feed_sets', 'GET', null, '?id=eq.' + state.feedManagerSetId);
  var name = prompt('Нова назва:'); if (!name) return;
  try {
    await sb('feed_sets', 'PATCH', { name: name.trim() }, '?id=eq.' + state.feedManagerSetId);
    toast('Оновлено ✅'); renderFeedManager();
  } catch(e) { toast('Error: ' + parseErr(e)); }
}

export async function deleteFeedSet() {
  if (!confirm('Видалити набір і всі його добрива?')) return;
  try {
    await sb('feed_sets', 'DELETE', null, '?id=eq.' + state.feedManagerSetId);
    state.feedManagerSetId = null;
    toast('Видалено'); renderFeedManager();
  } catch(e) { toast('Error: ' + parseErr(e)); }
}

export async function newFeedProduct() {
  showProductEditor(null);
}

export async function editFeedProduct(id) {
  var rows = await sb('feed_products', 'GET', null, '?id=eq.' + id);
  showProductEditor(rows[0]);
}

function showProductEditor(prod) {
  var isEdit = !!prod;
  var colorSwatches = COLOR_PALETTE.map(function(c) {
    var sel = (prod && prod.color === c) ? 'outline:3px solid var(--text2);outline-offset:1px' : '';
    return '<span onclick="GrowLog.pickFeedColor(\'' + c + '\')" data-color="' + c + '" class="feed-color-swatch" style="width:28px;height:28px;border-radius:50%;background:' + c + ';cursor:pointer;display:inline-block;' + sel + '"></span>';
  }).join('');
  var content = '<div style="margin-bottom:12px"><label style="font-size:12px;font-weight:500;color:var(--text3);display:block;margin-bottom:4px;text-transform:uppercase">Назва <span style="color:var(--red)">*</span></label>' +
    '<input type="text" id="feed-prod-name" class="fi-input" value="' + (prod ? prod.name : '') + '" placeholder="FloraMicro..."></div>' +
    '<div style="margin-bottom:12px"><label style="font-size:12px;font-weight:500;color:var(--text3);display:block;margin-bottom:6px;text-transform:uppercase">Колір</label>' +
    '<div style="display:flex;gap:10px;flex-wrap:wrap" id="feed-color-row">' + colorSwatches + '</div></div>' +
    '<input type="hidden" id="feed-prod-color" value="' + (prod ? prod.color : COLOR_PALETTE[0]) + '">' +
    '<input type="hidden" id="feed-prod-id" value="' + (prod ? prod.id : '') + '">' +
    '<div style="display:flex;gap:10px;margin-top:16px">' +
    '<button class="btn btn-ghost" style="flex:1" onclick="GrowLog.closePopup(\'feed-prod-popup\')">Скасувати</button>' +
    '<button class="btn btn-primary" style="flex:1" onclick="GrowLog.saveFeedProduct()">Зберегти</button></div>';
  document.getElementById('feed-prod-popup-title').textContent = isEdit ? 'Редагувати добриво' : 'Нове добриво';
  document.getElementById('feed-prod-popup-content').innerHTML = content;
  openPopup('feed-prod-popup');
}

export function pickFeedColor(color) {
  document.getElementById('feed-prod-color').value = color;
  document.querySelectorAll('#feed-color-row .feed-color-swatch').forEach(function(el) {
    el.style.outline = el.getAttribute('data-color') === color ? '3px solid var(--text2)' : 'none';
    el.style.outlineOffset = '1px';
  });
}

export async function saveFeedProduct() {
  var name = document.getElementById('feed-prod-name').value.trim();
  var color = document.getElementById('feed-prod-color').value;
  var id = document.getElementById('feed-prod-id').value;
  if (!name) { toast('⚠️ Введи назву'); return; }
  try {
    if (id) {
      await sb('feed_products', 'PATCH', { name: name, color: color }, '?id=eq.' + id);
    } else {
      await sb('feed_products', 'POST', { set_id: state.feedManagerSetId, name: name, color: color, sort_order: 99 });
    }
    closePopup('feed-prod-popup'); toast('Збережено ✅'); renderFeedManager();
  } catch(e) { toast('Error: ' + parseErr(e)); }
}

export async function deleteFeedProduct(id) {
  if (!confirm('Видалити добриво?')) return;
  try {
    await sb('feed_products', 'DELETE', null, '?id=eq.' + id);
    toast('Видалено'); renderFeedManager();
  } catch(e) { toast('Error: ' + parseErr(e)); }
}

export async function saveDose(productId, stageKey, value) {
  var ml = parseFloat(value) || 0;
  try {
    var existing = await sb('feed_doses', 'GET', null, '?product_id=eq.' + productId + '&stage_key=eq.' + stageKey);
    if (existing && existing.length) {
      await sb('feed_doses', 'PATCH', { ml_per_liter: ml }, '?id=eq.' + existing[0].id);
    } else {
      await sb('feed_doses', 'POST', { product_id: productId, stage_key: stageKey, ml_per_liter: ml });
    }
  } catch(e) { toast('Error: ' + parseErr(e)); }
}
