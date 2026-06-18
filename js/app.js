import { t, setLang, applyLang } from './i18n.js';
import { initModalClosers, toast, openModal, closeModal, openPopup, closePopup, updateRating, previewHarvPhoto, clearHarvPhoto } from './ui.js';
import { getSession, signOut, handleAuthSubmit, renderAuthScreen } from './auth.js';
import { renderLocations, openLocModal, saveLoc, deleteLoc } from './locations.js';
import { renderPlants, setViewMode, toggleTl, toggleExpand, openPlantModal, openEditPlant, savePlant, deletePlant, markPlantLost, openStageModal, saveStage, setType } from './plants.js';
import { renderHarvestPage, openHarvestModal, openEditHarvest, saveHarvest, deleteHarvest } from './harvest.js';
import { renderCalendar, showCalPopup } from './calendar.js';
import { renderFinance, toggleExpCat, openExpenseModal, saveExpense, deleteExpense, openPriceModal, savePrice } from './finance.js';
import { renderSeeds, openSeedModal, saveSeed, deleteSeed, openSplitPopup, executeSplit, openConvertPopup, executeConvert } from './seeds.js';
import { renderWishlistList, openWishlistModal, saveWishlist, deleteWishlist, renderWishlistItems, openWishlistItemModal, saveWishlistItem, deleteWishlistItem, convertWishlistItemToBag } from './wishlist.js';
import { renderGrows, openGrowModal, saveGrow, completeGrow, archiveGrow, deleteGrow } from './grows.js';

import { state } from './state.js'; export { state };

// ═══ MODE ═══
function setMode(mode) {
  state.mode = mode;
  state.curGrowId = null; state.curGrowName = '';
  localStorage.setItem('gl_mode', mode);
  renderPage(state.curPage);
}

function navigateToGrow(growId, growNameEnc) {
  state.curGrowId = growId;
  state.curGrowName = growNameEnc;
  renderLocations();
}

function backToGrows() {
  state.curGrowId = null; state.curGrowName = '';
  renderLocations();
}

// ═══ NAVIGATE ═══
function navigate(page, data) {
  data = data || {};
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.tab').forEach(function(tab) { tab.classList.remove('active'); });
  var tabPage = page;
  if (page === 'plants') tabPage = 'locations';
  if (page === 'wishlist-list' || page === 'wishlist-items') tabPage = 'seeds';
  var pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');
  var tabEl = document.querySelector('.tab[data-page="' + tabPage + '"]');
  if (tabEl) tabEl.classList.add('active');
  state.curPage = page;
  var showFab = ['locations','plants','seeds','wishlist-list','wishlist-items'].indexOf(page) >= 0;
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
  if (state.curPage === 'locations') {
    if (state.mode === 'indoor' && !state.curGrowId) openGrowModal();
    else openLocModal();
  } else if (state.curPage === 'plants') openPlantModal();
  else if (state.curPage === 'seeds') { if (state.seedsTab === 'bag') openSeedModal(); else openWishlistModal(); }
  else if (state.curPage === 'wishlist-list') openWishlistModal();
  else if (state.curPage === 'wishlist-items') openWishlistItemModal();
}

// ═══ AUTH ═══
function initApp() {
  updateRating(5);
  applyLang();
  initModalClosers();
  document.getElementById('login-screen').style.display = 'none';
  navigate('locations');
}

async function handleLogout() {
  await signOut();
  state.cache = { varieties: [], locations: [] };
  renderAuthScreen(false);
}

// ═══ GLOBAL API ═══
window.GrowLog = {
  navigate, renderPage, fabAction,
  setLang,
  closeModal, openPopup, closePopup, updateRating, previewHarvPhoto, clearHarvPhoto,
  openLocModal, saveLoc, deleteLoc,
  setViewMode, toggleTl, toggleExpand, openPlantModal, openEditPlant, savePlant, deletePlant,
  markPlantLost, openStageModal, saveStage, setType,
  openHarvestModal, openEditHarvest, saveHarvest, deleteHarvest,
  setHarvestYear: function(y) { state.harvestYear = y; renderHarvestPage(); },
  showCalPopup,
  calBack: function() { state.calOffset -= 12; renderCalendar(); },
  calForward: function() { state.calOffset += 12; renderCalendar(); },
  toggleExpCat, openExpenseModal, saveExpense, deleteExpense, openPriceModal, savePrice,
  setFinanceYear: function(y) { state.financeYear = y; renderFinance(); },
  setFinanceGrow: function(id) { state.curFinanceGrowId = id; renderFinance(); },
  setFinTab: function(tab) { state.finTab = tab; renderFinance(); },
  setSeedsTab: function(tab) { state.seedsTab = tab; renderSeeds(); },
  openSeedModal, saveSeed, deleteSeed, openSplitPopup, executeSplit, openConvertPopup, executeConvert,
  openWishlistModal, saveWishlist, deleteWishlist,
  openWishlistItemModal, saveWishlistItem, deleteWishlistItem, convertWishlistItemToBag,
  openGrowModal, saveGrow, completeGrow, archiveGrow, deleteGrow,
  setMode, navigateToGrow, backToGrows,
  handleLogout,
  handleAuthSubmit,
  toggleAuthMode: function() { renderAuthScreen(!window._authIsRegister); },
  handleForgotPassword: async function() {
    var email = document.getElementById('auth-email').value.trim();
    var errEl = document.getElementById('auth-error');
    if (!email) { errEl.style.color = 'var(--red)'; errEl.textContent = 'Введи email'; return; }
    try {
      var { forgotPassword } = await import('./auth.js');
      await forgotPassword(email);
      errEl.style.color = 'var(--green)';
      errEl.textContent = 'Лист для відновлення відправлено на ' + email;
    } catch(e) { errEl.style.color = 'var(--red)'; errEl.textContent = e.message; }
  },
  _onSignIn: initApp,
  get curPage() { return state.curPage; }
};

// ═══ BOOTSTRAP ═══
(async function() {
  applyLang();
  try {
    var session = await getSession();
    if (session) {
      initApp();
    } else {
      renderAuthScreen(false);
    }
  } catch(e) {
    console.error('Auth error:', e);
    renderAuthScreen(false);
  }
})();
