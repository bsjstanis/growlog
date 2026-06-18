export var LANG = localStorage.getItem('gl_lang') || 'ua';

export var TR = {
  ua: {
    locations:'Локації', calendar:'Календар', harvest:'Врожай', finance:'Фінанси', seeds:'Сумка',
    loginSub:'Введи пароль для входу', loginBtn:'Увійти', wrongPass:'Невірний пароль',
    newLoc:'Нова локація', editLoc:'Редагувати локацію',
    addPlant:'Додати рослину', editPlant:'Редагувати рослину',
    save:'Зберегти', cancel:'Скасувати', back:'Назад',
    noLoc:'Немає локацій. Натисни + щоб додати.',
    noPlants:'Немає рослин. Натисни + щоб додати.',
    noCalPlants:'Додай рослини щоб бачити їх в календарі.',
    active:'Активних', autoW:'Авто', photoW:'Фото',
    growth:'Ріст', preflower:'Передцвіт', flowering:'Цвітіння',
    ripening:'Дозрів.', toHarvest:'До збору', harvested:'Зібрано',
    planting:'Посадка', cycle:'Цикл', drying:'Сушка', days:'дн',
    harvests:'зборів', dry:'сухого', plants:'рослин',
    noHarvests:'Немає зборів за',
    income:'Дохід', expenses:'Витрати', profit:'Прибуток', loss:'Збиток', pricePerG:'Ціна/г',
    addExpense:'+ Додати витрату', summary:'Підсумок', byPlants:'По рослинах',
    soil_cat:'Грунт', pots_cat:'Горщики', fert_cat:'Добрива', seeds_cat:'Насіння', other_cat:'Різне',
    confirmLoc:'Видалити локацію і всі рослини?', confirmPlant:'Видалити рослину?',
    confirmHarv:'Видалити запис врожаю?', confirmExp:'Видалити?',
    confirmSeed:'Видалити насіння?', confirmWL:'Видалити вишлист і всі позиції?', confirmWLItem:'Видалити позицію?',
    saved:'Збережено', added:'Додано', updated:'Оновлено', deleted:'Видалено',
    errDate:'Вкажи дату посадки', errVariety:'Введи назву сорту',
    errMin:'Вкажи мін. цвітіння', errMax:'Вкажи макс. цвітіння', errMinMax:'Мін. > Макс.',
    errAmount:'Введи суму', errHarvDate:'Вибери дату збору',
    stageSet:'Встановити реальну дату', harvModal:'Збір врожаю', editHarvModal:'Редагувати врожай',
    seedling:'Розсада', growthS:'Ріст', preflowerS:'Передцвіт',
    flowerS:'Цвітіння', ripeningS:'Дозрівання', harvestS:'Збір', doneS:'Зібрано',
    autoflower:'Автоцвіт', photoperiod:'Фотоперіод', pct:'% циклу',
    bagTab:'Сумка', wishlistTab:'Вишлист',
    available:'Доступний', soaking:'Замочений', lost:'Пропавший',
    noSeeds:'Немає насіння. Натисни + щоб додати.',
    noWishlists:'Немає вишлистів. Натисни + щоб створити.',
    noWishlistItems:'Немає позицій. Натисни + щоб додати.',
    archive:'Архів (пропавші)',
    soakAction:'Замочити', lostAction:'Пропали', convertAction:'В рослину', buyAction:'Куплено',
    howMany:'Скільки штук перевести?', selectLoc:'Вибери локацію',
    newGrow:'Новий Grow', editGrow:'Редагувати Grow',
    noGrows:'Немає Grow циклів. Натисни + щоб додати.',
    activeGrows:'Активні', completedGrows:'Завершені',
    growActive:'Активний', growCompleted:'Завершений', growArchive:'Архів',
    growComplete:'Завершити', growArchiveBtn:'В архів',
    confirmCompleteGrow:'Завершити цей Grow цикл?',
    indoorLocs:'Локації Grow', selectGrow:'Вибери Grow',
    logout:'Вийти',
    mon:['Січ','Лют','Бер','Кві','Тра','Чер','Лип','Сер','Вер','Жов','Лис','Гру'],
    dow:['Пн','Вт','Ср','Чт','Пт','Сб','Нд']
  },
  en: {
    locations:'Locations', calendar:'Calendar', harvest:'Harvest', finance:'Finance', seeds:'Bag',
    loginSub:'Enter password', loginBtn:'Login', wrongPass:'Wrong password',
    newLoc:'New location', editLoc:'Edit location',
    addPlant:'Add plant', editPlant:'Edit plant',
    save:'Save', cancel:'Cancel', back:'Back',
    noLoc:'No locations. Press + to add.',
    noPlants:'No plants. Press + to add.',
    noCalPlants:'Add plants to see them in the calendar.',
    active:'Active', autoW:'Auto', photoW:'Photo',
    growth:'Veg', preflower:'Pre-flower', flowering:'Flowering',
    ripening:'Ripening', toHarvest:'To harvest', harvested:'Harvested',
    planting:'Planted', cycle:'Cycle', drying:'Drying', days:'d',
    harvests:'harvests', dry:'dry', plants:'plants',
    noHarvests:'No harvests for',
    income:'Revenue', expenses:'Expenses', profit:'Profit', loss:'Loss', pricePerG:'Price/g',
    addExpense:'+ Add expense', summary:'Summary', byPlants:'By plants',
    soil_cat:'Soil', pots_cat:'Pots', fert_cat:'Nutrients', seeds_cat:'Seeds', other_cat:'Other',
    confirmLoc:'Delete location and all plants?', confirmPlant:'Delete plant?',
    confirmHarv:'Delete harvest record?', confirmExp:'Delete?',
    confirmSeed:'Delete seed?', confirmWL:'Delete wishlist?', confirmWLItem:'Delete item?',
    saved:'Saved', added:'Added', updated:'Updated', deleted:'Deleted',
    errDate:'Enter plant date', errVariety:'Enter strain name',
    errMin:'Enter min flowering', errMax:'Enter max flowering', errMinMax:'Min > Max',
    errAmount:'Enter amount', errHarvDate:'Select harvest date',
    stageSet:'Set real date', harvModal:'Harvest', editHarvModal:'Edit harvest',
    seedling:'Seedling', growthS:'Veg', preflowerS:'Pre-flower',
    flowerS:'Flowering', ripeningS:'Ripening', harvestS:'Harvest', doneS:'Done',
    autoflower:'Autoflower', photoperiod:'Photoperiod', pct:'% of cycle',
    bagTab:'Bag', wishlistTab:'Wishlist',
    available:'Available', soaking:'Soaking', lost:'Lost',
    noSeeds:'No seeds. Press + to add.',
    noWishlists:'No wishlists. Press + to create.',
    noWishlistItems:'No items. Press + to add.',
    archive:'Archive (lost)',
    soakAction:'Soak', lostAction:'Lost', convertAction:'To plant', buyAction:'Bought',
    howMany:'How many to transfer?', selectLoc:'Select location',
    newGrow:'New Grow', editGrow:'Edit Grow',
    noGrows:'No Grow cycles. Press + to add.',
    activeGrows:'Active', completedGrows:'Completed',
    growActive:'Active', growCompleted:'Completed', growArchive:'Archive',
    growComplete:'Complete', growArchiveBtn:'Archive',
    confirmCompleteGrow:'Complete this Grow cycle?',
    indoorLocs:'Grow locations', selectGrow:'Select Grow',
    logout:'Logout',
    mon:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    dow:['Mo','Tu','We','Th','Fr','Sa','Su']
  }
};

export function t(k) { return (TR[LANG] && TR[LANG][k]) || TR.ua[k] || k; }

export function setLang(lang) {
  LANG = lang;
  localStorage.setItem('gl_lang', lang);
  applyLang();
  if (window.GrowLog) window.GrowLog.renderPage(window.GrowLog.curPage);
}

export function applyLang() {
  var ua = document.getElementById('lang-ua');
  var en = document.getElementById('lang-en');
  if (ua) ua.className = 'lang-btn' + (LANG === 'ua' ? ' active' : '');
  if (en) en.className = 'lang-btn' + (LANG === 'en' ? ' active' : '');
  var sub = document.getElementById('login-sub');
  if (sub) sub.textContent = t('loginSub');
  document.querySelectorAll('.tab-lbl[data-k]').forEach(function(el) {
    el.textContent = t(el.getAttribute('data-k'));
  });
}
