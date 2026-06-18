// Shared state — окремий файл щоб уникнути кругових залежностей
export var state = {
  curPage: 'locations',
  curLocId: null, curLocName: '',
  curWishlistId: null, curWishlistName: '',
  curGrowId: null, curGrowName: '',
  curFinanceGrowId: null,
  mode: localStorage.getItem('gl_mode') || 'outdoor',
  harvestYear: new Date().getFullYear(),
  financeYear: new Date().getFullYear(),
  plantViewMode: 'cards',
  expandedPlantId: null, expandedTimelineId: null,
  finTab: 'summary', seedsTab: 'bag', calOffset: 0,
  convertFromWLItem: null,
  cache: { varieties: [], locations: [] }
};
