import { sb } from './supabase.js';
import { t } from './i18n.js';
import { addDays } from './utils.js';
import { calcStages } from './stages.js';
import { openPopup } from './ui.js';
import { state } from './app.js';
import { makeModeTabs } from './grows.js';

export async function renderCalendar() {
  var pg = document.getElementById('page-calendar'); pg.innerHTML = makeModeTabs() + '<div class="spinner"></div>';
  try {
    if (!state.cache.varieties.length) state.cache.varieties = await sb('varieties', 'GET', null, '?order=name.asc');
    // Filter locations by mode
    var modeQuery = state.mode === 'indoor' ? '?mode=eq.indoor&select=id' : '?mode=eq.outdoor&select=id';
    var modeLocs = await sb('locations', 'GET', null, modeQuery);
    var modeLocIds = modeLocs.map(function(l) { return l.id; });
    var allPlants = await sb('plants', 'GET', null, '?order=plant_date.asc');
    var plants = allPlants.filter(function(p) { return modeLocIds.indexOf(p.location_id) >= 0; });
    var locs = await sb('locations', 'GET', null, '?select=id,name');
    if (!plants.length) { pg.innerHTML = makeModeTabs() + '<div class="empty"><div class="empty-icon">📅</div><p>'+t('noCalPlants')+'</p></div>'; return; }
    var evtMap = {}, perMap = {};
    function addEvt(d,obj){if(!d)return;if(!evtMap[d])evtMap[d]=[];evtMap[d].push(obj);}
    function addPer(s,e,type,label){
      if(!s||!e||s>e)return;var cur=s;
      while(cur<=e){
        if(!perMap[cur])perMap[cur]={types:[],labels:[]};
        if(perMap[cur].types.indexOf(type)<0)perMap[cur].types.push(type);
        var dup=perMap[cur].labels.some(function(l){return l.type===type&&l.label===label;});
        if(!dup)perMap[cur].labels.push({type:type,label:label});
        cur=addDays(cur,1);
      }
    }
    plants.forEach(function(p){
      var v=state.cache.varieties.find(function(x){return x.id===p.variety_id;});if(!v)return;
      var s=calcStages(p,v),loc=locs.find(function(l){return l.id===p.location_id;});
      var label=(p.name||v.name)+(loc?' ('+loc.name+')':'');
      addEvt(p.plant_date,{label:label,type:'plant'});
      addEvt(s.harvest,{label:label,type:'harvest'});
      addPer(s.growth,addDays(s.pre_flower||s.flower,-1),'growth',label+' - '+t('growth'));
      addPer(s.flower,addDays(s.ripening,-1),'flower',label+' - '+t('flowering'));
      addPer(s.ripening,addDays(s.harvest,-1),'ripening',label+' - '+t('ripening'));
    });
    window._evtMap=evtMap;window._perMap=perMap;
    var now=new Date(),nowYear=now.getFullYear(),nowMonth=now.getMonth();
    if(state.calOffset<-24)state.calOffset=-24;if(state.calOffset>24)state.calOffset=24;
    var startYear=nowYear+Math.floor((nowMonth+state.calOffset)/12);
    var startMonth=(nowMonth+state.calOffset+120)%12;
    var startLabel=t('mon')[startMonth]+' '+startYear;
    var legend='<div class="cal-legend">'+
      '<div class="cal-legend-item"><div class="cal-legend-dot" style="background:#1565c0"></div>'+t('planting')+'</div>'+
      '<div class="cal-legend-item"><div class="cal-legend-band" style="background:rgba(45,122,58,.2)"></div>'+t('growth')+'</div>'+
      '<div class="cal-legend-item"><div class="cal-legend-band" style="background:rgba(230,81,0,.2)"></div>'+t('flowering')+'</div>'+
      '<div class="cal-legend-item"><div class="cal-legend-band" style="background:rgba(173,20,87,.2)"></div>'+t('ripening')+'</div>'+
      '<div class="cal-legend-item"><div class="cal-legend-dot" style="background:#c2185b"></div>'+t('toHarvest')+'</div></div>';
    var nav='<div class="cal-nav"><button class="cal-nav-btn" onclick="GrowLog.calBack()">←</button>'+
      '<span style="font-size:13px;font-weight:600">'+startLabel+'</span>'+
      '<button class="cal-nav-btn" onclick="GrowLog.calForward()">→</button></div>';
    var rows='';
    for(var m=0;m<12;m+=2){
      rows+='<div class="cal-grid-2col">';
      for(var j=m;j<Math.min(m+2,12);j++){
        var yr=startYear+Math.floor((startMonth+j)/12);
        var mo=(startMonth+j)%12;
        rows+=buildCalMonth(yr,mo,evtMap,perMap);
      }
      rows+='</div>';
    }
    pg.innerHTML=makeModeTabs()+legend+nav+rows;
  }catch(e){pg.innerHTML=makeModeTabs()+'<div class="empty"><p>Error: '+e.message+'</p></div>';}
}

export function buildCalMonth(year,month,evtMap,perMap){
  var dim=new Date(year,month+1,0).getDate();
  var sdow=(new Date(year,month,1).getDay()+6)%7;
  var mName=t('mon')[month]+' '+(year%100);
  var tdy=new Date().toISOString().slice(0,10);
  var html='<div class="cal-month"><div class="cal-month-title">'+mName+'</div><div class="cal-days-grid">';
  t('dow').forEach(function(d){html+='<div class="cal-dow">'+d+'</div>';});
  for(var i=0;i<sdow;i++)html+='<div></div>';
  for(var day=1;day<=dim;day++){
    var ds=year+'-'+String(month+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');
    var isToday=ds===tdy;
    var dayEvts=evtMap[ds]||[];var periods=perMap[ds];
    var isPlant=dayEvts.some(function(e){return e.type==='plant';});
    var isHarv=dayEvts.some(function(e){return e.type==='harvest';});
    var hasPopup=dayEvts.length>0||(periods&&periods.labels.length>0);
    var cls='cal-day';
    if(isToday)cls+=' is-today';
    else if(isPlant)cls+=' ev-plant';
    else if(isHarv)cls+=' ev-harvest-day';
    else if(periods){
      if(periods.types.indexOf('ripening')>=0)cls+=' period-ripening';
      else if(periods.types.indexOf('flower')>=0)cls+=' period-flower';
      else if(periods.types.indexOf('growth')>=0)cls+=' period-growth';
    }
    if(hasPopup)cls+=' has-popup';
    html+='<div class="'+cls+'"'+(hasPopup?' onclick="GrowLog.showCalPopup(\''+ds+'\')"':'')+'>'+day+'</div>';
  }
  html+='</div></div>';return html;
}

export function showCalPopup(ds){
  var em=window._evtMap||{},pm=window._perMap||{};
  var dayEvts=em[ds]||[];var periods=pm[ds];
  var d=new Date(ds+'T12:00:00');
  document.getElementById('cal-popup-date').textContent=d.toLocaleDateString('uk-UA',{day:'numeric',month:'long',year:'numeric'});
  var html='';
  dayEvts.forEach(function(e){html+='<div style="padding:7px 0;border-bottom:1px solid var(--border);font-size:13px">'+(e.type==='plant'?'🌱':'✂️')+' <b>'+e.label+'</b></div>';});
  if(periods&&periods.labels.length){
    var seen={};
    periods.labels.forEach(function(l){var k=l.type+'|'+l.label;if(seen[k])return;seen[k]=true;var ic=l.type==='flower'?'🌸':l.type==='ripening'?'🟡':'🌿';html+='<div style="padding:7px 0;border-bottom:1px solid var(--border);font-size:13px">'+ic+' '+l.label+'</div>';});
  }
  if(!html)html='<div style="color:var(--text3);font-size:13px;padding:8px 0">-</div>';
  document.getElementById('cal-popup-content').innerHTML=html;openPopup('cal-popup');
}
