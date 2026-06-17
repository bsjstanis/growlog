import { t, setLang, applyLang } from './i18n.js';
import { initModalClosers, toast, openModal, closeModal, openPopup, closePopup, updateRating, previewHarvPhoto, clearHarvPhoto } from './ui.js';
import { renderLocations, openLocModal, saveLoc, deleteLoc } from './locations.js';
import { renderPlants, setViewMode, renderPlantCard, renderPlantList, toggleTl, toggleExpand, openPlantModal, openEditPlant, savePlant, deletePlant, markPlantLost, openStageModal, saveStage, setType } from './plants.js';
import { renderHarvestPage, openHarvestModal, openEditHarvest, saveHarvest, deleteHarvest } from './harvest.js';
import { renderCalendar, showCalPopup } from './calendar.js';
import { renderFinance, toggleExpCat, openExpenseModal, saveExpense, deleteExpense, openPriceModal, savePrice } from './finance.js';
import { renderSeeds, openSeedModal, saveSeed, deleteSeed, openSplitPopup, executeSplit, openConvertPopup, executeConvert } from './seeds.js';
import { renderWishlistList, openWishlistModal, saveWishlist, deleteWishlist, renderWishlistItems, openWishlistItemModal, saveWishlistItem, deleteWishlistItem, convertWishlistItemToBag } from './wishlist.js';

// ═══ SHARED STATE ═══
export var state = {
  curPage: 'locations',
  curLocId: null,
  curLocName: '',
  curWishlistId: null,
  curWishlistName: '',
  harvestYear: new Date().getFullYear(),
  financeYear: new Date().getFullYear(),
  plantViewMode: 'cards',
  expandedPlantId: null,
  expandedTimelineId: null,
  finTab: 'summary',
  seedsTab: 'bag',
  calOffset: 0,
  convertFromWLItem: null,
  cache: { varieties: [], locations: [] }
};

// ═══ NAVIGATION ═══
function navigate(page, data) {
  data = data || {};
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
  var tabPage = page;
  if (page === 'plants') tabPage = 'locations';
  if (page === 'wishlist-list' || page === 'wishlist-items') tabPage = 'seeds';
  var pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');
  var tabEl = document.querySelector('.tab[data-page="' + tabPage + '"]');
  if (tabEl) tabEl.classList.add('active');
  state.curPage = page;
  var showFab = ['locations', 'plants', 'seeds', 'wishlist-list', 'wishlist-items'].indexOf(page) >= 0;
  document.getElementById('fab').style.display = showFab ? 'flex' : 'none';
  if (page === 'locations') renderLocations();
  else if (page === 'plants') { state.curLocId = data.locId; state.curLocName = data.locName || ''; state.cache.varieties = []; renderPlants(); }
  else if (page === 'calendar') renderCalendar();
  else if (page === 'harvest') renderHarvestPage();
  else if (page === 'finance') renderFinance();
  else if (page === 'seeds') renderSeeds();
  else if (page === 'wishlist-list') renderWishlistList();
  else if (page === 'wishlist-items') { state.curWishlistId = data.wlId; state.curWishlistName = data.wlName || ''; renderWishlistItems(); }
}

function renderPage(p) { navigate(p); }

function fabAction() {
  if (state.curPage === 'locations') openLocModal();
  else if (state.curPage === 'plants') openPlantModal();
  else if (state.curPage === 'seeds') { if (state.seedsTab === 'bag') openSeedModal(); else openWishlistModal(); }
  else if (state.curPage === 'wishlist-list') openWishlistModal();
  else if (state.curPage === 'wishlist-items') openWishlistItemModal();
}

// ═══ AUTH ═══
function checkLogin() {
  var v = document.getElementById('login-input').value;
  if (v === atob('R0wyMDI2Iw==')) {
    sessionStorage.setItem('gl_auth', '1');
    document.getElementById('login-screen').style.display = 'none';
    initApp();
  } else {
    document.getElementById('login-error').textContent = t('wrongPass');
    document.getElementById('login-input').value = '';
    setTimeout(function() { document.getElementById('login-error').textContent = ''; }, 2000);
  }
}

// ═══ INIT ═══
function initApp() {
  updateRating(5);
  applyLang();
  initModalClosers();
  navigate('locations');
}

// ═══ GLOBAL API ═══
// All onclick handlers in HTML use GrowLog.xxx()
window.GrowLog = {
  // navigation
  navigate: navigate,
  renderPage: renderPage,
  // auth
  checkLogin: checkLogin,
  // lang
  setLang: setLang,
  // ui
  closeModal: closeModal,
  openPopup: openPopup,
  closePopup: closePopup,
  updateRating: updateRating,
  previewHarvPhoto: previewHarvPhoto,
  clearHarvPhoto: clearHarvPhoto,
  // locations
  openLocModal: openLocModal,
  saveLoc: saveLoc,
  deleteLoc: deleteLoc,
  // plants
  setViewMode: setViewMode,
  toggleTl: toggleTl,
  toggleExpand: toggleExpand,
  openPlantModal: openPlantModal,
  openEditPlant: openEditPlant,
  savePlant: savePlant,
  deletePlant: deletePlant,
  markPlantLost: markPlantLost,
  openStageModal: openStageModal,
  saveStage: saveStage,
  setType: setType,
  // harvest
  openHarvestModal: openHarvestModal,
  openEditHarvest: openEditHarvest,
  saveHarvest: saveHarvest,
  deleteHarvest: deleteHarvest,
  setHarvestYear: function(y) { state.harvestYear = y; renderHarvestPage(); },
  // calendar
  showCalPopup: showCalPopup,
  calBack: function() { state.calOffset -= 12; renderCalendar(); },
  calForward: function() { state.calOffset += 12; renderCalendar(); },
  // finance
  toggleExpCat: toggleExpCat,
  openExpenseModal: openExpenseModal,
  saveExpense: saveExpense,
  deleteExpense: deleteExpense,
  openPriceModal: openPriceModal,
  savePrice: savePrice,
  setFinanceYear: function(y) { state.financeYear = y; renderFinance(); },
  setFinTab: function(tab) { state.finTab = tab; renderFinance(); },
  // seeds
  setSeedsTab: function(tab) { state.seedsTab = tab; renderSeeds(); },
  openSeedModal: openSeedModal,
  saveSeed: saveSeed,
  deleteSeed: deleteSeed,
  openSplitPopup: openSplitPopup,
  executeSplit: executeSplit,
  openConvertPopup: openConvertPopup,
  executeConvert: executeConvert,
  // wishlist
  openWishlistModal: openWishlistModal,
  saveWishlist: saveWishlist,
  deleteWishlist: deleteWishlist,
  openWishlistItemModal: openWishlistItemModal,
  saveWishlistItem: saveWishlistItem,
  deleteWishlistItem: deleteWishlistItem,
  convertWishlistItemToBag: convertWishlistItemToBag,
  // fab
  fabAction: fabAction,
  // state getter
  get curPage() { return state.curPage; }
};

// ═══ BOOTSTRAP ═══
if (sessionStorage.getItem('gl_auth')) {
  document.getElementById('login-screen').style.display = 'none';
  initApp();
} else {
  applyLang();
  document.getElementById('login-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') checkLogin();
  });
  document.getElementById('login-btn').addEventListener('click', checkLogin);
  setTimeout(function() { document.getElementById('login-input').focus(); }, 300);
}
