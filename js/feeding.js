import { sb } from './supabase.js';
import { t } from './i18n.js';
import { parseErr } from './utils.js';
import { getStage } from './stages.js';
import { toast, openPopup, closePopup } from './ui.js';
import { state } from './state.js';

var STAGE_LABELS = {
  seedling: 'Розсада', growth: 'Ріст', pre_flower: 'Передцвіт',
  flower: 'Цвітіння', ripening: 'Дозрівання', harvest: 'Збір'
};

// Products in mix order (Micro first!)
var PRODUCTS = [
  { key: 'ghe_micro_ml', name: 'FloraMicro HW', color: '#d32f2f' },
  { key: 'ghe_gro_ml', name: 'FloraGro', color: '#2d7a3a' },
  { key: 'ghe_bloom_ml', name: 'FloraBloom', color: '#e65100' },
  { key: 'diamond_nectar_ml', name: 'Diamond Nectar', color: '#7c3aed' },
  { key: 'ripen_ml', name: 'Ripen', color: '#c62828' }
];

export async function openFeedingModal(plantId, labelEnc) {
  try {
    var rows = await sb('plants', 'GET', null, '?id=eq.' + plantId + '&select=variety_id,plant_date,stage_overrides,is_harvested');
    var p = rows[0]; if (!p) return;
    var v = state.cache.varieties.find(function(x) { return x.id === p.variety_id; });
    if (!v) { var vr = await sb('varieties', 'GET', null, '?id=eq.' + p.variety_id); v = vr[0]; }
    var stage = getStage(p, v);
    if (stage === 'done' || stage === 'lost') stage = 'ripening';
    state.feedingStage = stage;
    state.feedingPlantLabel = decodeURIComponent(labelEnc);
    await renderFeedingContent(4); // default 4 liters
    openPopup('feeding-popup');
  } catch(e) { toast('Error: ' + parseErr(e)); }
}

async function renderFeedingContent(liters) {
  var stageKey = state.feedingStage;
  var rows = await sb('feed_stages', 'GET', null, '?stage_key=eq.' + stageKey);
  var fs = rows[0];
  var stageLabel = STAGE_LABELS[stageKey] || stageKey;
  document.getElementById('feeding-popup-title').textContent = '💧 Годування · ' + stageLabel;
  var html = '<div style="margin-bottom:12px;font-size:13px;color:var(--text3)">' + (state.feedingPlantLabel || '') + '</div>';
  if (!fs) {
    html += '<div style="color:var(--text3);font-size:13px">Немає рецепту для цієї стадії</div>';
    document.getElementById('feeding-popup-content').innerHTML = html;
    return;
  }
  html += '<div style="margin-bottom:14px">' +
    '<label style="font-size:12px;font-weight:500;color:var(--text3);display:block;margin-bottom:4px;text-transform:uppercase">Об\u2019єм води (л)</label>' +
    '<input type="number" id="feed-liters" class="fi-input" min="0.5" step="0.5" value="' + liters + '" oninput="GrowLog.recalcFeeding()"></div>';
  html += '<div id="feed-recipe">' + buildRecipeRows(fs, liters) + '</div>';
  html += '<div style="font-size:11px;color:var(--text3);margin-top:12px;padding:8px 10px;background:var(--bg3);border-radius:8px">' +
    '⚠️ Порядок змішування: спочатку Micro, потім Gro, потім Bloom. Інакше нутрієнти випадають в осад.</div>';
  html += '<div style="display:flex;gap:10px;margin-top:16px">' +
    '<button class="btn btn-ghost" style="flex:1" onclick="GrowLog.closePopup(\'feeding-popup\')">Закрити</button>' +
    '<button class="btn btn-ghost btn-sm" onclick="GrowLog.openFeedEditor()">⚙️ Дози</button></div>';
  document.getElementById('feeding-popup-content').innerHTML = html;
  window._feedCurrentStage = fs;
}

function buildRecipeRows(fs, liters) {
  var rows = '';
  PRODUCTS.forEach(function(prod) {
    var perL = parseFloat(fs[prod.key]) || 0;
    if (perL === 0) return; // skip products not used at this stage
    var total = (perL * liters).toFixed(1);
    rows += '<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid var(--border)">' +
      '<span style="display:flex;align-items:center;gap:8px;font-size:14px">' +
        '<span style="width:8px;height:8px;border-radius:50%;background:' + prod.color + '"></span>' + prod.name + '</span>' +
      '<span style="font-size:15px;font-weight:600;color:' + prod.color + '">' + total + ' ml</span></div>';
  });
  if (!rows) rows = '<div style="color:var(--text3);font-size:13px;padding:10px 0">Немає добрив для цієї стадії</div>';
  return rows;
}

export function recalcFeeding() {
  var liters = parseFloat(document.getElementById('feed-liters').value) || 0;
  var fs = window._feedCurrentStage;
  if (fs) document.getElementById('feed-recipe').innerHTML = buildRecipeRows(fs, liters);
}

export async function openFeedEditor() {
  var stageKey = state.feedingStage;
  var rows = await sb('feed_stages', 'GET', null, '?stage_key=eq.' + stageKey);
  var fs = rows[0]; if (!fs) return;
  var stageLabel = STAGE_LABELS[stageKey] || stageKey;
  var html = '<div style="margin-bottom:12px;font-size:13px;color:var(--text3)">Дози на 1 літр · ' + stageLabel + '</div>';
  PRODUCTS.forEach(function(prod) {
    html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0">' +
      '<label style="font-size:13px;display:flex;align-items:center;gap:8px"><span style="width:8px;height:8px;border-radius:50%;background:' + prod.color + '"></span>' + prod.name + '</label>' +
      '<input type="number" id="edit-' + prod.key + '" class="fi-input" style="width:90px" min="0" step="0.1" value="' + (fs[prod.key] || 0) + '"></div>';
  });
  html += '<div style="display:flex;gap:10px;margin-top:16px">' +
    '<button class="btn btn-ghost" style="flex:1" onclick="GrowLog.backToFeeding()">← Назад</button>' +
    '<button class="btn btn-primary" style="flex:1" onclick="GrowLog.saveFeedDoses(\'' + fs.id + '\')">Зберегти</button></div>';
  document.getElementById('feeding-popup-title').textContent = '⚙️ Дози · ' + stageLabel;
  document.getElementById('feeding-popup-content').innerHTML = html;
}

export async function saveFeedDoses(fsId) {
  try {
    var data = {};
    PRODUCTS.forEach(function(prod) {
      data[prod.key] = parseFloat(document.getElementById('edit-' + prod.key).value) || 0;
    });
    await sb('feed_stages', 'PATCH', data, '?id=eq.' + fsId);
    toast('Дози збережено ✅');
    await renderFeedingContent(parseFloat(document.getElementById('feed-liters') ? document.getElementById('feed-liters').value : 4) || 4);
  } catch(e) { toast('Error: ' + parseErr(e)); }
}

export function backToFeeding() {
  renderFeedingContent(4);
}
