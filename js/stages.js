import { addDays, diffDays, today } from './utils.js';
import { t } from './i18n.js';

export var STAGE_COLORS = {
  seedling: '#1565c0', growth: '#2d7a3a', pre_flower: '#f9a825',
  flower: '#e65100', ripening: '#ad1457', harvest: '#c62828', done: '#c62828'
};
export var STAGE_ICONS = {
  seedling: '🌱', growth: '🌿', pre_flower: '🌼',
  flower: '🌸', ripening: '🟡', harvest: '✂️', done: '✅'
};
var STAGE_KEYS = {
  seedling: 'seedling', growth: 'growthS', pre_flower: 'preflowerS',
  flower: 'flowerS', ripening: 'ripeningS', harvest: 'harvestS', done: 'doneS'
};

export function stageName(sk) { return (STAGE_ICONS[sk] || '') + ' ' + (t(STAGE_KEYS[sk]) || sk); }

export function calcStages(plant, v) {
  var o = plant.stage_overrides || {};
  var avg = v.seed_type === 'auto' ? Math.round((v.flowering_days_min + v.flowering_days_max) / 2) : 70;
  var pd = plant.plant_date; var s = {};
  if (v.seed_type === 'auto') {
    s.seedling = o.seedling || pd; s.growth = o.growth || addDays(pd, 14);
    s.pre_flower = o.pre_flower || addDays(pd, 35); s.flower = o.flower || addDays(pd, 42);
    s.ripening = o.ripening || addDays(s.flower, avg - 10); s.harvest = o.harvest || addDays(s.flower, avg);
  } else {
    var yr = new Date(pd + 'T12:00:00').getFullYear();
    s.seedling = o.seedling || pd; s.growth = o.growth || pd;
    s.flower = o.flower || (yr + '-08-01'); s.pre_flower = o.pre_flower || addDays(s.flower, -7);
    s.ripening = o.ripening || addDays(s.flower, 50); s.harvest = o.harvest || addDays(s.flower, 65);
  }
  return s;
}

export function getStage(plant, v) {
  if (plant.is_harvested) return 'done';
  var tdy = today(), s = calcStages(plant, v);
  if (tdy >= s.harvest) return 'harvest'; if (tdy >= s.ripening) return 'ripening';
  if (tdy >= s.flower) return 'flower'; if (tdy >= s.pre_flower) return 'pre_flower';
  if (tdy >= s.growth) return 'growth'; return 'seedling';
}

export function getWarning(plant, v) {
  if (plant.is_harvested) return null;
  var tdy = today(), s = calcStages(plant, v), stage = getStage(plant, v);
  var order = ['seedling', 'growth', 'pre_flower', 'flower', 'ripening', 'harvest'];
  var idx = order.indexOf(stage); if (idx < 0 || idx >= order.length - 1) return null;
  var nextDate = s[order[idx + 1]]; if (!nextDate) return null;
  var diff = diffDays(tdy, nextDate);
  if (diff < 0) return { type: 'alert', text: stageName(order[idx + 1]) + ' -' + Math.abs(diff) + t('days') };
  if (diff <= 5) return { type: 'warn', text: stageName(order[idx + 1]) + ' +' + diff + t('days') };
  return null;
}

export function getPct(plant, v) {
  var s = calcStages(plant, v); var total = diffDays(plant.plant_date, s.harvest);
  if (total <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round(diffDays(plant.plant_date, today()) / total * 100)));
}
