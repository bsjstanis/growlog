import { sb } from './supabase.js';
import { fmt, today, fmtUAH, parseErr } from './utils.js';
import { getStage, stageName } from './stages.js';
import { toast, openPopup, closePopup, ensurePopup } from './ui.js';
import { state } from './state.js';
import { openHarvestModal } from './harvest.js';

// ══════════ HELPERS ══════════
export function isClosed(g) { return g && g.status !== 'active'; }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
function lbl(text) { return '<label style="font-size:12px;font-weight:500;color:var(--text3);display:block;margin-bottom:4px;text-transform:uppercase">' + text + '</label>'; }
function isLost(p) { return !!(p.stage_overrides && p.stage_overrides.lost); }

// Outdoor seasons, newest first
export async function loadSeasons() {
  return await sb('grows', 'GET', null, '?mode=eq.outdoor&order=year.desc');
}

// Pick the season to show: keep current choice, else newest open, else newest
export function pickSeason(seasons) {
  if (state.curSeasonId && seasons.some(function(s) { return s.id === state.curSeasonId; })) return state.curSeasonId;
  var open = seasons.find(function(s) { return !isClosed(s); });
  state.curSeasonId = open ? open.id : (seasons[0] ? seasons[0].id : null);
  return state.curSeasonId;
}

export function renderSeasonBar(seasons, curId) {
  var cur = seasons.find(function(s) { return s.id === curId; });
  var html = '<div style="display:flex;gap:6px;align-items:center;margin-bottom:10px;flex-wrap:wrap">' +
    '<div class="year-tabs" style="margin-bottom:0;flex:1;min-width:0">' +
    seasons.map(function(s) {
      return '<div class="year-tab ' + (s.id === curId ? 'active' : '') + '" onclick="GrowLog.selectSeason(\'' + s.id + '\')">' +
        (s.year || s.name) + (isClosed(s) ? ' 🔒' : '') + '</div>';
    }).join('') + '</div>' +
    '<button class="btn btn-ghost btn-sm" onclick="GrowLog.openNewSeasonModal()">＋ Новий сезон</button></div>';
  if (cur && isClosed(cur)) {
    html += '<div style="font-size:12px;color:var(--text3);margin-bottom:12px">🔒 Сезон закрито' + (cur.end_date ? ' ' + fmt(cur.end_date) : '') + ' · дані можна редагувати</div>';
  }
  return html;
}

// Close-season button shown under the list of locations (as in the mockup)
export function renderCloseSeasonButton(seasons, curId) {
  var cur = seasons.find(function(s) { return s.id === curId; });
  if (!cur || isClosed(cur)) return '';
  return '<button class="btn" style="width:100%;margin-top:6px;justify-content:center;text-align:center;background:transparent;border:1.5px solid #f59e0b;color:#b45309" onclick="GrowLog.openCloseWizard(\'' + cur.id + '\')">🔒 Закрити сезон ' + (cur.year || '') + '</button>';
}

function ensureSeasonPopups() {
  ensurePopup('season-popup', 'season-popup-content', '🌿 Новий сезон');
  ensurePopup('close-popup', 'close-popup-content', 'Закрити сезон', 'close-popup-title', 'GrowLog.cancelCloseWizard()', false);
}

// ══════════ NEW SEASON ══════════
export async function openNewSeasonModal() {
  ensureSeasonPopups();
  try {
    var seasons = await loadSeasons();
    var curYear = new Date().getFullYear();
    var years = seasons.map(function(s) { return s.year; }).filter(Boolean);
    var defYear = years.indexOf(curYear) < 0 ? curYear : Math.max.apply(null, years) + 1;
    var last = seasons[0] || null;
    var locs = last ? await sb('locations', 'GET', null, '?grow_id=eq.' + last.id + '&order=created_at.asc') : [];
    var html = '<div style="margin-bottom:12px">' + lbl('Рік <span style="color:var(--red)">*</span>') +
      '<input type="number" id="ns-year" class="fi-input" min="2000" max="2100" step="1" value="' + defYear + '"></div>';
    if (locs.length) {
      html += lbl('Скопіювати локації з сезону ' + (last.year || last.name)) +
        locs.map(function(l) {
          return '<label style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);font-size:14px;cursor:pointer">' +
            '<input type="checkbox" class="ns-loc" value="' + l.id + '" checked style="width:18px;height:18px;accent-color:var(--green)">' + esc(l.name) + '</label>';
        }).join('') +
        '<div style="font-size:12px;color:var(--text3);margin:8px 0">Копіюються тільки назва і нотатки, рослини не переносяться.</div>';
    } else {
      html += '<div style="font-size:12px;color:var(--text3);margin-bottom:8px">Локації додаси після створення сезону.</div>';
    }
    html += '<div id="ns-error" style="color:var(--red);font-size:13px;margin-top:4px"></div>' +
      '<div style="display:flex;gap:10px;margin-top:14px">' +
      '<button class="btn btn-ghost" style="flex:1" onclick="GrowLog.closePopup(\'season-popup\')">Скасувати</button>' +
      '<button class="btn btn-primary" style="flex:1" onclick="GrowLog.saveNewSeason()">Відкрити сезон</button></div>';
    window._nsLocs = locs;
    document.getElementById('season-popup-content').innerHTML = html;
    openPopup('season-popup');
  } catch(e) { toast('Error: ' + parseErr(e)); }
}

export async function saveNewSeason() {
  var errEl = document.getElementById('ns-error');
  var year = parseInt(document.getElementById('ns-year').value);
  if (!year || year < 2000 || year > 2100) { errEl.textContent = '⚠️ Вкажи рік'; return; }
  try {
    var seasons = await loadSeasons();
    if (seasons.some(function(s) { return s.year === year; })) { errEl.textContent = '⚠️ Сезон ' + year + ' вже існує'; return; }
    var created = await sb('grows', 'POST', { name: 'Сезон ' + year, start_date: year + '-01-01', status: 'active', mode: 'outdoor', year: year });
    if (!created || !created[0]) throw new Error('Не вдалося створити сезон');
    var ids = Array.from(document.querySelectorAll('.ns-loc:checked')).map(function(el) { return el.value; });
    var copies = (window._nsLocs || []).filter(function(l) { return ids.indexOf(l.id) >= 0; })
      .map(function(l) { return { name: l.name, notes: l.notes || '', mode: 'outdoor', grow_id: created[0].id }; });
    if (copies.length) await sb('locations', 'POST', copies);
    state.curSeasonId = created[0].id;
    closePopup('season-popup');
    toast('Сезон ' + year + ' відкрито ✅');
    window.GrowLog.navigate('locations');
  } catch(e) { errEl.textContent = '❌ ' + parseErr(e); }
}

export function selectSeason(id) { state.curSeasonId = id; window.GrowLog.navigate('locations'); }

export async function deleteSeason(id) {
  if (!confirm('Видалити порожній сезон?')) return;
  try {
    await sb('grows', 'DELETE', null, '?id=eq.' + id);
    state.curSeasonId = null;
    toast('Видалено'); window.GrowLog.navigate('locations');
  } catch(e) { toast('Error: ' + parseErr(e)); }
}

// ══════════ CLOSE WIZARD ══════════
// state.closeWizard = { growId, grow, plantIds: [...], decisions: { plantId: { type: 'lost'|'move', target } } }

export async function openCloseWizard(growId) {
  ensureSeasonPopups();
  try {
    var gr = await sb('grows', 'GET', null, '?id=eq.' + growId);
    var grow = gr[0]; if (!grow) return;
    var locs = await sb('locations', 'GET', null, '?grow_id=eq.' + growId + '&select=id');
    var locIds = locs.map(function(l) { return l.id; });
    var plants = locIds.length ? await sb('plants', 'GET', null, '?location_id=in.(' + locIds.join(',') + ')&select=id,is_harvested,stage_overrides') : [];
    var cw = state.closeWizard;
    if (!cw || cw.growId !== growId) {
      cw = state.closeWizard = { growId: growId, plantIds: [], decisions: {} };
      cw.plantIds = plants.filter(function(p) { return !p.is_harvested; }).map(function(p) { return p.id; });
    }
    cw.grow = grow;
    cw.pendingHarvest = null;
    await renderStep1();
    openPopup('close-popup');
  } catch(e) { toast('Error: ' + parseErr(e)); }
}

async function wizardTitle(grow) {
  return grow.mode === 'outdoor' ? 'Закрити сезон ' + (grow.year || '') : 'Завершити ' + grow.name;
}

function stepsBar(n) {
  return '<div style="display:flex;gap:4px;margin-bottom:12px"><div style="flex:1;height:3px;border-radius:2px;background:var(--green)"></div>' +
    '<div style="flex:1;height:3px;border-radius:2px;background:' + (n > 1 ? 'var(--green)' : 'var(--border)') + '"></div></div>';
}

// Locations where a plant can be moved: other open seasons/grows of the same mode
async function moveTargets(grow) {
  var others = await sb('grows', 'GET', null, '?mode=eq.' + (grow.mode || 'indoor') + '&status=eq.active&id=neq.' + grow.id + '&order=created_at.desc');
  if (!others.length) return [];
  var locs = await sb('locations', 'GET', null, '?grow_id=in.(' + others.map(function(g) { return g.id; }).join(',') + ')&order=created_at.asc');
  return locs.map(function(l) {
    var g = others.find(function(x) { return x.id === l.grow_id; });
    return { id: l.id, label: (g ? g.name + ' / ' : '') + l.name };
  });
}

async function renderStep1() {
  var cw = state.closeWizard; var grow = cw.grow;
  document.getElementById('close-popup-title').textContent = await wizardTitle(grow);
  var plants = cw.plantIds.length ? await sb('plants', 'GET', null, '?id=in.(' + cw.plantIds.join(',') + ')&select=id,name,variety_id,location_id,plant_date,is_harvested,stage_overrides') : [];
  if (!state.cache.varieties.length) state.cache.varieties = await sb('varieties', 'GET', null, '?order=name.asc');
  var locs = await sb('locations', 'GET', null, '?grow_id=eq.' + grow.id + '&select=id,name');
  var targets = await moveTargets(grow);
  cw.targets = targets;

  var decided = 0;
  var rows = plants.map(function(p) {
    var v = state.cache.varieties.find(function(x) { return x.id === p.variety_id; });
    var loc = locs.find(function(l) { return l.id === p.location_id; });
    var d = cw.decisions[p.id];
    var harvested = p.is_harvested && !isLost(p);
    var lost = isLost(p) || (d && d.type === 'lost');
    var move = !harvested && !isLost(p) && d && d.type === 'move';
    if (harvested || lost || (move && d.target)) decided++;
    var chip = function(on, color, text, action) {
      var st = on ? (color === 'red' ? 'background:var(--red2);border-color:var(--red);color:var(--red)' : 'background:var(--green3);border-color:var(--green);color:var(--green)') : '';
      return '<button class="btn btn-ghost btn-sm" style="flex:1;border:1px solid var(--border);' + st + '"' + (action ? ' onclick="' + action + '"' : ' disabled') + '>' + text + '</button>';
    };
    var locked = harvested || isLost(p);
    var html = '<div class="card" style="padding:10px 12px">' +
      '<div style="font-size:14px;font-weight:600">' + esc(v ? v.name : '?') + (p.name ? ' · ' + esc(p.name) : '') + '</div>' +
      '<div style="font-size:12px;color:var(--text3)">' + esc(loc ? loc.name : '') + (v && !locked ? ' · ' + stageName(getStage(p, v)) : '') + '</div>' +
      '<div style="display:flex;gap:5px;margin-top:7px">' +
      chip(harvested, 'green', '✂️ Зібрано', locked ? null : 'GrowLog.wizardHarvest(\'' + p.id + '\')') +
      chip(lost, 'red', '☠️ Пропала', locked ? null : 'GrowLog.wizardDecide(\'' + p.id + '\',\'lost\')') +
      chip(move, 'green', '➡️ Перенести', locked ? null : 'GrowLog.wizardDecide(\'' + p.id + '\',\'move\')') +
      '</div>';
    if (move) {
      html += targets.length
        ? '<select class="fi-select" style="margin-top:7px" onchange="GrowLog.wizardTarget(\'' + p.id + '\',this.value)"><option value="">-- Куди перенести --</option>' +
          targets.map(function(tg) { return '<option value="' + tg.id + '"' + (d.target === tg.id ? ' selected' : '') + '>' + esc(tg.label) + '</option>'; }).join('') + '</select>'
        : '<div style="font-size:12px;color:var(--red);margin-top:6px">Немає куди переносити: спочатку ' + (grow.mode === 'outdoor' ? 'відкрий новий сезон' : 'створи інший Grow') + ' з локацією.</div>';
    }
    return html + '</div>';
  });

  var allDone = decided === plants.length;
  var html = stepsBar(1);
  if (!plants.length) {
    html += '<div style="font-size:14px;color:var(--text2);padding:12px 0">✓ Усі рослини вже зібрані або позначені. Можна переходити до підсумку.</div>';
  } else {
    html += '<div style="font-size:12px;color:var(--text3);margin-bottom:8px">Вирішено: ' + decided + ' з ' + plants.length + (allDone ? ' ✓' : '. Без цього далі не пройти') + '</div>' + rows.join('');
  }
  html += '<div style="display:flex;gap:10px;margin-top:14px">' +
    '<button class="btn btn-ghost" style="flex:1" onclick="GrowLog.cancelCloseWizard()">Скасувати</button>' +
    '<button class="btn btn-primary" style="flex:1' + (allDone ? '' : ';opacity:.45') + '"' + (allDone ? ' onclick="GrowLog.wizardNext()"' : ' disabled') + '>Далі →</button></div>';
  document.getElementById('close-popup-content').innerHTML = html;
}

export async function wizardDecide(plantId, type) {
  var cw = state.closeWizard; if (!cw) return;
  var d = cw.decisions[plantId];
  if (d && d.type === type) delete cw.decisions[plantId];
  else cw.decisions[plantId] = { type: type, target: null };
  await renderStep1();
}

export function wizardTarget(plantId, locId) {
  var cw = state.closeWizard; if (!cw || !cw.decisions[plantId]) return;
  cw.decisions[plantId].target = locId || null;
  renderStep1();
}

export async function wizardHarvest(plantId) {
  var cw = state.closeWizard; if (!cw) return;
  try {
    var rows = await sb('plants', 'GET', null, '?id=eq.' + plantId + '&select=name,variety_id');
    var p = rows[0]; if (!p) return;
    var v = state.cache.varieties.find(function(x) { return x.id === p.variety_id; });
    delete cw.decisions[plantId];
    cw.pendingHarvest = plantId;
    closePopup('close-popup');
    openHarvestModal(plantId, encodeURIComponent((v ? v.name : '') + (p.name ? ' · ' + p.name : '')));
  } catch(e) { toast('Error: ' + parseErr(e)); }
}

// Called by saveHarvest when a harvest was entered from the wizard
export async function reopenCloseWizard() {
  var cw = state.closeWizard; if (!cw) return;
  await openCloseWizard(cw.growId);
}

export function cancelCloseWizard() {
  state.closeWizard = null;
  closePopup('close-popup');
}

export async function wizardBack() { await renderStep1(); }

export async function wizardNext() {
  var cw = state.closeWizard; if (!cw) return;
  var grow = cw.grow;
  try {
    var locs = await sb('locations', 'GET', null, '?grow_id=eq.' + grow.id + '&select=id');
    var locIds = locs.map(function(l) { return l.id; });
    var plants = locIds.length ? await sb('plants', 'GET', null, '?location_id=in.(' + locIds.join(',') + ')&select=id,is_harvested,stage_overrides') : [];
    var movedIds = Object.keys(cw.decisions).filter(function(k) { return cw.decisions[k].type === 'move'; });
    var pendingLost = Object.keys(cw.decisions).filter(function(k) { return cw.decisions[k].type === 'lost'; });
    var stayPlants = plants.filter(function(p) { return movedIds.indexOf(p.id) < 0; });
    var stayIds = stayPlants.map(function(p) { return p.id; });
    var harvests = stayIds.length ? await sb('harvests', 'GET', null, '?plant_id=in.(' + stayIds.join(',') + ')&select=plant_id,dry_weight_g') : [];
    var weight = harvests.reduce(function(a, h) { return a + (parseFloat(h.dry_weight_g) || 0); }, 0);
    var priceYear = grow.mode === 'outdoor' ? grow.year : new Date().getFullYear();
    var ys = await sb('year_settings', 'GET', null, '?year=eq.' + priceYear);
    var ppg = ys[0] ? parseFloat(ys[0].price_per_gram) || 0 : 0;
    var expenses = grow.mode === 'outdoor'
      ? await sb('expenses', 'GET', null, '?mode=eq.outdoor&year=eq.' + grow.year + '&select=amount_uah')
      : await sb('expenses', 'GET', null, '?grow_id=eq.' + grow.id + '&select=amount_uah');
    var exp = expenses.reduce(function(a, e) { return a + (parseFloat(e.amount_uah) || 0); }, 0);
    var revenue = weight * ppg, pnl = revenue - exp;
    var lostCount = stayPlants.filter(isLost).length + pendingLost.length;

    document.getElementById('close-popup-title').textContent = grow.mode === 'outdoor' ? 'Підсумок сезону ' + (grow.year || '') : 'Підсумок ' + grow.name;
    var box = function(label, val) { return '<div style="background:var(--bg3);border-radius:8px;padding:9px 10px"><div style="font-size:11px;color:var(--text3)">' + label + '</div><div style="font-size:17px;font-weight:700">' + val + '</div></div>'; };
    var html = stepsBar(2) +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">' +
      box('Рослин / зборів', stayPlants.length + ' / ' + harvests.length) +
      box('Сухий вага', weight.toFixed(1) + ' g') +
      box('Дохід', fmtUAH(revenue)) + box('Витрати', fmtUAH(exp)) + '</div>' +
      '<div style="background:' + (pnl >= 0 ? 'var(--green3)' : 'var(--red2)') + ';color:' + (pnl >= 0 ? 'var(--green)' : 'var(--red)') + ';border-radius:8px;padding:10px;margin:8px 0">' +
      '<div style="font-size:11px">P&amp;L</div><div style="font-size:20px;font-weight:700">' + (pnl >= 0 ? '+' : '-') + fmtUAH(Math.abs(pnl)) + '</div></div>' +
      '<div style="font-size:12px;color:var(--text3);line-height:1.6">' +
      (ppg ? '✓ Ціна за грам: ' + ppg + ' ₴' : '<span style="color:var(--red)">⚠️ Ціна за грам не вказана (Фінанси → Підсумок), дохід = 0</span>') +
      '<br>☠️ Пропало: ' + lostCount + (movedIds.length ? ' · ➡️ Переноситься: ' + movedIds.length : '') +
      '<br>🌰 Насіння в Сумці лишається</div>' +
      '<div id="cw-error" style="color:var(--red);font-size:13px;margin-top:6px"></div>' +
      '<div style="display:flex;gap:10px;margin-top:14px">' +
      '<button class="btn btn-ghost" style="flex:1" onclick="GrowLog.wizardBack()">← Назад</button>' +
      '<button class="btn btn-primary" style="flex:1" onclick="GrowLog.confirmCloseSeason()">🔒 Закрити</button></div>';
    document.getElementById('close-popup-content').innerHTML = html;
  } catch(e) { toast('Error: ' + parseErr(e)); }
}

export async function confirmCloseSeason() {
  var cw = state.closeWizard; if (!cw) return;
  var grow = cw.grow;
  try {
    var ids = Object.keys(cw.decisions);
    for (var i = 0; i < ids.length; i++) {
      var d = cw.decisions[ids[i]];
      if (d.type === 'move' && d.target) {
        await sb('plants', 'PATCH', { location_id: d.target }, '?id=eq.' + ids[i]);
      } else if (d.type === 'lost') {
        var r = await sb('plants', 'GET', null, '?id=eq.' + ids[i] + '&select=stage_overrides');
        var o = Object.assign({}, (r[0] && r[0].stage_overrides) || {}); o.lost = today();
        await sb('plants', 'PATCH', { is_harvested: true, stage_overrides: o }, '?id=eq.' + ids[i]);
      }
    }
    await sb('grows', 'PATCH', { status: 'completed', end_date: today() }, '?id=eq.' + grow.id);
    state.closeWizard = null;
    closePopup('close-popup');
    toast((grow.mode === 'outdoor' ? 'Сезон ' + (grow.year || '') + ' закрито' : grow.name + ' завершено') + ' 🔒');
    if (grow.mode === 'outdoor') state.curSeasonId = null; // jump to the next open season if any
    window.GrowLog.navigate('locations');
  } catch(e) {
    var el = document.getElementById('cw-error');
    if (el) el.textContent = '❌ ' + parseErr(e); else toast('Error: ' + parseErr(e));
  }
}
