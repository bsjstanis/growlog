import { sb } from './supabase.js';
import { t } from './i18n.js';
import { getYear, fmtUAH, parseErr, showErr, clearErr } from './utils.js';
import { toast, openModal, closeModal } from './ui.js';
import { state } from './state.js';
import { makeModeTabs } from './grows.js';

export async function renderFinance() {
  var pg = document.getElementById('page-finance'); pg.innerHTML = makeModeTabs() + '<div class="spinner"></div>';
  try {
    if (!state.cache.varieties.length) state.cache.varieties = await sb('varieties', 'GET', null, '?order=name.asc');
    if (state.mode === 'indoor') {
      await renderIndoorFinance(pg);
    } else {
      await renderOutdoorFinance(pg);
    }
  } catch(e) { pg.innerHTML = makeModeTabs() + '<div class="empty"><p>Error: ' + e.message + '</p></div>'; }
}

async function renderOutdoorFinance(pg) {
  var allPlants = await sb('plants', 'GET', null, '?select=id,name,variety_id,plant_date,is_harvested');
  var allHarvests = await sb('harvests', 'GET', null, '?select=plant_id,dry_weight_g,harvest_date');
  var allExpenses = await sb('expenses', 'GET', null, '?mode=eq.outdoor&order=created_at.desc');
  var settings = await sb('year_settings', 'GET', null, '?order=year.desc');
  // Filter plants to outdoor locations
  var outdoorLocs = await sb('locations', 'GET', null, '?or=(mode.eq.outdoor,mode.is.null)&select=id');
  var outdoorLocIds = outdoorLocs.map(function(l) { return l.id; });
  var outdoorPlants = allPlants.filter(function(p) { return outdoorLocIds.indexOf(p.location_id) >= 0; });
  var outdoorPlantIds = outdoorPlants.map(function(p) { return p.id; });
  var outdoorHarvests = allHarvests.filter(function(h) { return outdoorPlantIds.indexOf(h.plant_id) >= 0; });
  var curYear = new Date().getFullYear();
  var allYears = [...new Set([].concat(
    allExpenses.map(function(e) { return e.year; }),
    outdoorHarvests.map(function(h) { return getYear(h.harvest_date); }),
    outdoorPlants.map(function(p) { return getYear(p.plant_date); }),
    [curYear]
  ).filter(Boolean))].sort(function(a,b){return b-a;});
  if (!allYears.includes(state.financeYear)) state.financeYear = allYears[0] || curYear;
  var ys = settings.find(function(s) { return s.year === state.financeYear; }) || { price_per_gram: 0 };
  var ppg = parseFloat(ys.price_per_gram) || 0;
  var yExp = allExpenses.filter(function(e) { return e.year === state.financeYear; });
  var yPlants = outdoorPlants.filter(function(p) { return getYear(p.plant_date) === state.financeYear; });
  var yHarv = outdoorHarvests.filter(function(h) { return getYear(h.harvest_date) === state.financeYear; });
  renderFinancePage(pg, yExp, yPlants, yHarv, ppg, allYears, settings);
}

async function renderIndoorFinance(pg) {
  var grows = await sb('grows', 'GET', null, '?status=neq.archive&order=created_at.desc');
  if (!grows.length) {
    pg.innerHTML = makeModeTabs() + '<div class="empty"><div class="empty-icon">💡</div><p>Немає Indoor Grow циклів</p></div>';
    return;
  }
  // Grow selector
  if (!state.curFinanceGrowId && grows.length) state.curFinanceGrowId = grows[0].id;
  var curGrow = grows.find(function(g) { return g.id === state.curFinanceGrowId; }) || grows[0];
  // Get locations in this grow
  var locs = await sb('locations', 'GET', null, '?grow_id=eq.' + curGrow.id + '&select=id');
  var locIds = locs.map(function(l) { return l.id; });
  var allPlants = await sb('plants', 'GET', null, '?select=id,name,variety_id,plant_date,is_harvested,location_id');
  var plants = allPlants.filter(function(p) { return locIds.indexOf(p.location_id) >= 0; });
  var plantIds = plants.map(function(p) { return p.id; });
  var allHarvests = await sb('harvests', 'GET', null, '?select=plant_id,dry_weight_g,harvest_date');
  var harvests = allHarvests.filter(function(h) { return plantIds.indexOf(h.plant_id) >= 0; });
  var expenses = await sb('expenses', 'GET', null, '?grow_id=eq.' + curGrow.id + '&order=created_at.desc');
  var settings = await sb('year_settings', 'GET', null, '?order=year.desc');
  // Use a fixed price per gram (from current year settings)
  var curYear = new Date().getFullYear();
  var ys = settings.find(function(s) { return s.year === curYear; }) || { price_per_gram: 0 };
  var ppg = parseFloat(ys.price_per_gram) || 0;
  // Grow tabs
  var growTabs = '<div class="year-tabs">' + grows.map(function(g) {
    return '<div class="year-tab ' + (g.id === state.curFinanceGrowId ? 'active' : '') + '" onclick="GrowLog.setFinanceGrow(\'' + g.id + '\')">' + g.name + '</div>';
  }).join('') + '</div>';
  renderFinancePage(pg, expenses, plants, harvests, ppg, [], settings, growTabs);
}

function renderFinancePage(pg, yExp, yPlants, yHarv, ppg, allYears, settings, growTabs) {
  var seedExp = yExp.filter(function(e) { return e.category === 'seeds'; });
  var CAT = { soil:'🪴 '+t('soil_cat'), pots:'🫙 '+t('pots_cat'), fertilizer:'🧪 '+t('fert_cat'), seeds:'🌱 '+t('seeds_cat'), other:'📦 '+t('other_cat') };
  function catSum(cat) { return yExp.filter(function(e){return e.category===cat;}).reduce(function(a,e){return a+(parseFloat(e.amount_uah)||0);},0); }
  var soilA=catSum('soil'),potsA=catSum('pots'),fertA=catSum('fertilizer'),seedA=catSum('seeds'),otherA=catSum('other');
  var totalExp=soilA+potsA+fertA+seedA+otherA;
  var totalW=yHarv.reduce(function(a,h){return a+(parseFloat(h.dry_weight_g)||0);},0);
  var revenue=totalW*ppg,profit=revenue-totalExp;
  var genPerPlant=(soilA+potsA+fertA+otherA)/(yPlants.length||1);
  var html = makeModeTabs();
  if (growTabs) html += growTabs;
  else if (allYears.length) {
    html += '<div class="year-tabs">' + allYears.map(function(y){
      return '<div class="year-tab '+(y===state.financeYear?'active':'')+'" onclick="GrowLog.setFinanceYear('+y+')">'+y+'</div>';
    }).join('') + '</div>';
  }
  html += '<div class="fin-tabs">' +
    '<button class="fin-tab '+(state.finTab==='summary'?'active':'')+'" onclick="GrowLog.setFinTab(\'summary\')">'+t('summary')+'</button>' +
    '<button class="fin-tab '+(state.finTab==='expenses'?'active':'')+'" onclick="GrowLog.setFinTab(\'expenses\')">'+t('expenses')+'</button>' +
    '<button class="fin-tab '+(state.finTab==='plants'?'active':'')+'" onclick="GrowLog.setFinTab(\'plants\')">'+t('byPlants')+'</button></div>';
  if (state.finTab === 'summary') {
    html += '<div class="pnl-cards">' +
      '<div class="pnl-card neutral"><div class="pnl-card-val">'+fmtUAH(revenue)+'</div><div class="pnl-card-label">'+t('income')+' ('+totalW.toFixed(1)+'g)</div></div>' +
      '<div class="pnl-card neutral"><div class="pnl-card-val">'+fmtUAH(totalExp)+'</div><div class="pnl-card-label">'+t('expenses')+'</div></div>' +
      '<div class="pnl-card '+(profit>=0?'profit':'loss')+'"><div class="pnl-card-val">'+(profit>=0?'':'-')+fmtUAH(Math.abs(profit))+'</div><div class="pnl-card-label">'+(profit>=0?'✅ '+t('profit'):'❌ '+t('loss'))+'</div></div>' +
      '<div class="pnl-card neutral"><div class="pnl-card-val">'+ppg+'</div><div class="pnl-card-label"><button class="btn btn-ghost btn-sm" onclick="GrowLog.openPriceModal('+state.financeYear+','+ppg+')" style="font-size:11px">💰 '+t('pricePerG')+'</button></div></div></div>';
    html += '<div class="card"><div class="card-title" style="margin-bottom:10px">'+t('expenses')+'</div>';
    [{cat:'soil',amt:soilA},{cat:'pots',amt:potsA},{cat:'fertilizer',amt:fertA},{cat:'seeds',amt:seedA},{cat:'other',amt:otherA}].forEach(function(c){
      if(c.amt===0)return;
      html+='<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border)"><span style="font-size:13px">'+CAT[c.cat]+'</span><span style="font-size:13px;font-weight:600;color:var(--red)">'+fmtUAH(c.amt)+'</span></div>';
    });
    html += '</div>';
  } else if (state.finTab === 'expenses') {
    html += '<div style="display:flex;justify-content:flex-end;margin-bottom:10px"><button class="btn btn-primary btn-sm" onclick="GrowLog.openExpenseModal()">'+t('addExpense')+'</button></div>';
    ['soil','pots','fertilizer','seeds','other'].forEach(function(cat){
      var catItems=yExp.filter(function(e){return e.category===cat;});
      var catTotal=catItems.reduce(function(a,e){return a+(parseFloat(e.amount_uah)||0);},0);
      html+='<div class="exp-cat-card"><div class="exp-cat-header" onclick="GrowLog.toggleExpCat(\'cat-'+cat+'\')">' +
        '<div class="exp-cat-title">'+CAT[cat]+' <span style="font-size:12px;color:var(--text3)">('+catItems.length+')</span></div>' +
        '<div style="display:flex;align-items:center;gap:8px"><span class="exp-cat-total">'+fmtUAH(catTotal)+'</span><span class="exp-cat-chevron" id="ch-cat-'+cat+'">▾</span></div></div>' +
        '<div class="exp-cat-body" id="cat-'+cat+'">';
      if(!catItems.length){html+='<div style="padding:10px 0;font-size:13px;color:var(--text3)">-</div>';}
      else{catItems.forEach(function(e){html+='<div class="exp-item"><div style="font-size:13px">'+(e.notes||CAT[cat])+'</div><div style="display:flex;align-items:center;gap:6px"><span style="font-size:13px;font-weight:600;color:var(--red)">'+fmtUAH(e.amount_uah)+'</span><button class="btn btn-danger btn-sm" onclick="GrowLog.deleteExpense(\''+e.id+'\')">🗑</button></div></div>';});}
      html+='</div></div>';
    });
  } else if (state.finTab === 'plants') {
    html += !yPlants.length ? '<div class="empty"><div class="empty-icon">🌱</div><p>-</p></div>' : '<div class="card">';
    if (yPlants.length) {
      yPlants.forEach(function(p){
        var v=state.cache.varieties.find(function(x){return x.id===p.variety_id;});
        var ph=yHarv.filter(function(h){return h.plant_id===p.id;});
        var pw=ph.reduce(function(a,h){return a+(parseFloat(h.dry_weight_g)||0);},0);
        var pr=pw*ppg;
        var ps=seedExp.filter(function(e){return e.plant_id===p.id;}).reduce(function(a,e){return a+(parseFloat(e.amount_uah)||0);},0);
        var pc=genPerPlant+ps;var pp2=pr-pc;
        html+='<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid var(--border)">' +
          '<div><div style="font-size:14px;font-weight:600">'+(p.name||(v&&v.name)||'Plant')+'</div>' +
          '<div style="font-size:11px;color:var(--text3)">'+pw.toFixed(1)+'g · '+fmtUAH(pc)+'</div></div>' +
          '<span style="font-size:15px;font-weight:700;color:'+(pp2>=0?'var(--green)':'var(--red)')+';">'+(pp2>=0?'+':'')+fmtUAH(pp2)+'</span></div>';
      });
      html += '</div>';
    }
  }
  pg.innerHTML = html;
}

export function toggleExpCat(id) {
  var el=document.getElementById(id),ch=document.getElementById('ch-'+id);if(!el)return;
  var open=el.classList.toggle('open');if(ch)ch.className='exp-cat-chevron'+(open?' open':'');
}

export function openExpenseModal() {
  clearErr('exp-error');['exp-amount','exp-notes'].forEach(function(id){document.getElementById(id).value='';});
  document.getElementById('exp-category').value='soil';openModal('modal-expense');
}

export async function saveExpense() {
  var amt=parseFloat(document.getElementById('exp-amount').value);
  if(!amt||amt<=0){showErr('exp-error','⚠️ '+t('errAmount'));return;}
  var data = { category: document.getElementById('exp-category').value, amount_uah: amt, notes: document.getElementById('exp-notes').value.trim(), mode: state.mode };
  if (state.mode === 'outdoor') { data.year = state.financeYear; }
  else if (state.mode === 'indoor' && state.curFinanceGrowId) { data.grow_id = state.curFinanceGrowId; }
  try {
    await sb('expenses','POST',data);
    closeModal('modal-expense');toast(t('added')+' ✅');renderFinance();
  }catch(e){showErr('exp-error','❌ '+parseErr(e));}
}

export async function deleteExpense(id) {
  if(!confirm(t('confirmExp')))return;
  try{await sb('expenses','DELETE',null,'?id=eq.'+id);toast(t('deleted'));renderFinance();}
  catch(e){toast('Error: '+parseErr(e));}
}

export function openPriceModal(year,cur) {
  document.getElementById('modal-price-year').textContent='Year: '+year;
  document.getElementById('price-val').value=cur||'';openModal('modal-price');
}

export async function savePrice() {
  var val=parseFloat(document.getElementById('price-val').value)||0;
  try{
    var ex=await sb('year_settings','GET',null,'?year=eq.'+state.financeYear);
    if(ex&&ex.length>0)await sb('year_settings','PATCH',{price_per_gram:val},'?year=eq.'+state.financeYear);
    else{try{await sb('year_settings','POST',{year:state.financeYear,price_per_gram:val});}catch(x){await sb('year_settings','PATCH',{price_per_gram:val},'?year=eq.'+state.financeYear);}}
    closeModal('modal-price');toast(t('saved')+' ✅');renderFinance();
  }catch(e){toast('Error: '+parseErr(e));}
}
