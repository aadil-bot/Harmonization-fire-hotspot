// Map page settings and choices live in one object. Add region entries here
// when additional countries or provinces are ready to be explored.
const CONFIG = {
  minDate: '2000-11-01',
  regions: [
    { value: 'alberta', label: 'Alberta' },
    { value: 'british-columbia', label: 'British Columbia' },
    { value: 'manitoba', label: 'Manitoba' },
    { value: 'new-brunswick', label: 'New Brunswick' },
    { value: 'newfoundland-and-labrador', label: 'Newfoundland and Labrador' },
    { value: 'northwest-territories', label: 'Northwest Territories' },
    { value: 'nova-scotia', label: 'Nova Scotia' },
    { value: 'nunavut', label: 'Nunavut' },
    { value: 'ontario', label: 'Ontario' },
    { value: 'prince-edward-island', label: 'Prince Edward Island' },
    { value: 'quebec', label: 'Quebec' },
    { value: 'saskatchewan', label: 'Saskatchewan' },
    { value: 'yukon', label: 'Yukon' },  ],
  roles: [
    { value: 'general-view', label: 'General View', description: 'Interactive hotspot map, current versus historical fire activity, 7-day weather outlook, and regional hotspot counts.', insights: ['Interactive hotspot map', 'Current versus historical fire activity', '7-day weather outlook', 'Regional hotspot counts'] },
    { value: 'emergency-response', label: 'Emergency Response', description: 'Fire-weather conditions, recent anomalies, preparedness priorities, nearby incidents, and resource readiness.', insights: ['Regions with elevated fire-weather conditions', 'Recent hotspot activity and anomalies', '1–7 day fire-weather outlook', 'Regional preparedness priority indicators', 'Nearby reported fire incidents, if available', 'Suggested resource-readiness reviews'] },
    { value: 'scientist', label: 'Scientists', description: 'Harmonization charts, historical anomalies, sensor calibration, and model validation.', insights: ['Before-and-after harmonization charts', 'Historical anomaly analysis', 'Sensor calibration and model validation'] },
    { value: 'land-manager', label: 'Land Managers', description: 'Burning frequency, seasonal activity, land-cover overlays, and planning recommendations.', insights: ['Historical burning frequency by region', 'Seasonal hotspot activity calendar', 'Vegetation and land-cover overlays', 'Areas with recurring burning activity', 'Land management planning recommendations'] },
    { value: 'firefighter', label: 'Firefighters', description: 'Current detections, confidence, fire radiative power, weather, and incident verification.', insights: ['Latest satellite hotspot detections', 'Hotspot coordinates and timestamps', 'Detection confidence and fire radiative power', 'Wind and weather overlays', 'Incident verification information'] },
  ],
};

// This object is the live page state shared with map and calendar modules.
const state = { region: 'alberta', start: '', end: '', role: 'general-view', view: 'map', mapMaximized: false, mobileSidebarOpen: false, sidebarWidth: null };

const controls = {
  start: document.querySelector('#start'),
  end: document.querySelector('#end'),
  region: document.querySelector('#region'),
  role: document.querySelector('#role'),
};
const errorBox = document.querySelector('#filter-error');
const statusMessage = document.querySelector('#status-message');
const dateSummary = document.querySelector('#date-summary');
// Resolve this before the initial view switch, which may also reset map maximize.
const mapExpandButton = document.querySelector('#map-expand');

function localDateString(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addOptions(select, options) {
  options.forEach((option) => {
    const element = document.createElement('option');
    element.value = option.value;
    element.textContent = option.label;
    select.append(element);
  });
}

function setError(message, focusTarget) {
  errorBox.textContent = message;
  errorBox.hidden = false;
  if (focusTarget) focusTarget.focus();
}

function clearError() {
  errorBox.textContent = '';
  errorBox.hidden = true;
}

function validateState() {
  const today = localDateString();
  if (!state.start || !state.end) return 'Choose both a start and end date.';
  if (state.start < CONFIG.minDate || state.start > today || state.end < CONFIG.minDate || state.end > today) {
    return 'Dates must be between November 1, 2000 and today.';
  }
  if (state.start > state.end) return 'Start date must be on or before the end date.';
  return '';
}

function formatDate(value) {
  if (!value) return '—';
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, day)));
}

function renderRegion() {
  const region = CONFIG.regions.find((item) => item.value === state.region) || CONFIG.regions[0];
  document.querySelector('#map-region-label').textContent = region.label.toUpperCase();
}

function renderDateSummary() {
  dateSummary.textContent = `${formatDate(state.start)} — ${formatDate(state.end)}`;
}

function dispatchFiltersChanged(isValid) {
  // Clone the state in the event detail so listeners cannot mutate page state.
  window.dispatchEvent(new CustomEvent('filtersChanged', {
    detail: { ...state, valid: isValid },
  }));
}

function applyControlChange(changedControl) {
  state.start = controls.start.value;
  state.end = controls.end.value;
  state.region = controls.region.value;
  state.role = controls.role.value;

  if (changedControl === controls.region) renderRegion();
  renderDateSummary();

  const error = validateState();
  if (error) setError(error, null);
  else clearError();
  dispatchFiltersChanged(!error);
  statusMessage.textContent = error || 'Filters updated.';
}

function setupFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const today = localDateString();
  const requestedView = params.get('view');
  // Only the map and calendar are welcome-page entry points; fall back safely
  // so initialization uses the same view-switching path as the menu.
  state.view = ['map', 'calendar'].includes(requestedView) ? requestedView : 'map';
  const requestedStart = params.get('start') || '';
  const requestedEnd = params.get('end') || '';
  const validRegion = CONFIG.regions.some((item) => item.value === params.get('region'));
  const validRole = CONFIG.roles.some((item) => item.value === params.get('role'));

  state.region = validRegion ? params.get('region') : CONFIG.regions[0].value;
  state.role = validRole ? params.get('role') : CONFIG.roles[CONFIG.roles.length - 1].value;
  state.start = requestedStart >= CONFIG.minDate && requestedStart <= today ? requestedStart : CONFIG.minDate;
  state.end = requestedEnd >= CONFIG.minDate && requestedEnd <= today ? requestedEnd : today;
  // Keep an invalid reversed range visible as a clear form error for correction.

  controls.start.min = CONFIG.minDate;
  controls.start.max = today;
  controls.end.min = CONFIG.minDate;
  controls.end.max = today;
  controls.start.value = state.start;
  controls.end.value = state.end;
  controls.region.value = state.region;
  controls.role.value = state.role;

  renderRegion();
  renderDateSummary();

  const error = validateState();
  if (error) setError(error, null);
  dispatchFiltersChanged(!error);
}

addOptions(controls.region, CONFIG.regions);
addOptions(controls.role, CONFIG.roles);
setupFromUrl();

Object.values(controls).forEach((control) => {
  control.addEventListener('change', () => applyControlChange(control));
});

// Sidebar resizing is independent from map maximize state. On phones, the
// existing top-bar button controls the overlay drawer instead.
const drawerToggle = document.querySelector('#drawer-toggle');
const drawerClose = document.querySelector('#drawer-close');
const drawerScrim = document.querySelector('#drawer-scrim');
const workspace = document.querySelector('.workspace');
const sidebar = document.querySelector('#sidebar');
const sidebarContent = document.querySelector('#sidebar-content');
const sidebarResizeHandle = document.querySelector('#sidebar-resize-handle');
const mobileMediaQuery = window.matchMedia('(max-width: 767px)');
const SIDEBAR_WIDTH_STORAGE_KEY = 'mosaic-sidebar-width';
let layoutEventTimer;

function isMobileLayout() {
  return mobileMediaQuery.matches;
}

function updateSidebarButtons() {
  const label = state.mobileSidebarOpen ? 'Close filters' : 'Open filters';
  drawerToggle.setAttribute('aria-expanded', String(isMobileLayout() && state.mobileSidebarOpen));
  drawerToggle.setAttribute('aria-label', label);
  drawerToggle.title = label;
  const currentWidth = state.sidebarWidth || Math.round(sidebar.getBoundingClientRect().width);
  sidebarResizeHandle.setAttribute('aria-valuenow', String(currentWidth));
}

function persistSidebarState() {
  try {
    if (state.sidebarWidth) localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(state.sidebarWidth));
  } catch (error) {
    // Storage can be unavailable in private or restricted browsing contexts.
  }
}

function announceLayoutChange() {
  window.dispatchEvent(new CustomEvent('layoutChanged', {
    detail: {
      mobileSidebarOpen: state.mobileSidebarOpen,
      mapMaximized: state.mapMaximized,
      sidebarWidth: state.sidebarWidth || Math.round(sidebar.getBoundingClientRect().width),
    },
  }));
  window.dispatchEvent(new Event('resize'));
}

function scheduleLayoutChange() {
  window.clearTimeout(layoutEventTimer);
  // Fallback covers reduced-motion styles and browsers that skip transitionend.
  layoutEventTimer = window.setTimeout(announceLayoutChange, 320);
}

function setDrawerOpen(open) {
  state.mobileSidebarOpen = open;
  document.body.classList.toggle('drawer-open', open);
  drawerScrim.hidden = !open;
  sidebarContent.inert = !open;
  updateSidebarButtons();
  scheduleLayoutChange();
  if (open) drawerClose.focus();
  else if (document.activeElement !== drawerToggle) drawerToggle.focus();
}

function toggleSidebar() {
  setDrawerOpen(!state.mobileSidebarOpen);
}

// Restore the last desktop width. The mobile drawer always starts closed.
try {
  const savedWidth = Number(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY));
  if (Number.isFinite(savedWidth) && savedWidth >= 200 && savedWidth <= 420) state.sidebarWidth = savedWidth;
} catch (error) {
  state.sidebarWidth = null;
}
if (state.sidebarWidth) workspace.style.setProperty('--sidebar-width', `${state.sidebarWidth}px`);
sidebarContent.inert = isMobileLayout();
state.mobileSidebarOpen = false;
drawerScrim.hidden = true;
updateSidebarButtons();

drawerToggle.addEventListener('click', toggleSidebar);

// Drag the divider to resize the desktop sidebar; arrow keys resize it too.
let resizePointerActive = false;
let resizeStartX = 0;
let resizeStartWidth = 0;

function setSidebarWidth(width) {
  const maxWidth = Math.max(200, Math.min(420, window.innerWidth - 280));
  state.sidebarWidth = Math.round(Math.max(200, Math.min(maxWidth, width)));
  workspace.style.setProperty('--sidebar-width', `${state.sidebarWidth}px`);
  sidebarResizeHandle.setAttribute('aria-valuemax', String(maxWidth));
  sidebarResizeHandle.setAttribute('aria-valuenow', String(state.sidebarWidth));
  updateSidebarButtons();
}

sidebarResizeHandle.addEventListener('pointerdown', (event) => {
  if (isMobileLayout() || event.button !== 0) return;
  event.preventDefault();
  resizePointerActive = true;
  resizeStartX = event.clientX;
  workspace.classList.add('is-resizing');
  resizeStartWidth = sidebar.getBoundingClientRect().width;
  sidebarResizeHandle.setPointerCapture(event.pointerId);
});

sidebarResizeHandle.addEventListener('pointermove', (event) => {
  if (!resizePointerActive) return;
  setSidebarWidth(resizeStartWidth + event.clientX - resizeStartX);
});

function finishSidebarResize(event) {
  if (!resizePointerActive) return;
  resizePointerActive = false;
  workspace.classList.remove('is-resizing');
  persistSidebarState();
  updateSidebarButtons();
  window.clearTimeout(layoutEventTimer);
  announceLayoutChange();
  if (sidebarResizeHandle.hasPointerCapture(event.pointerId)) sidebarResizeHandle.releasePointerCapture(event.pointerId);
}

sidebarResizeHandle.addEventListener('pointerup', finishSidebarResize);
sidebarResizeHandle.addEventListener('pointercancel', finishSidebarResize);
sidebarResizeHandle.addEventListener('lostpointercapture', finishSidebarResize);

sidebarResizeHandle.addEventListener('keydown', (event) => {
  const currentWidth = state.sidebarWidth || sidebar.getBoundingClientRect().width;
  let nextWidth;
  if (event.key === 'ArrowLeft') nextWidth = currentWidth - 16;
  else if (event.key === 'ArrowRight') nextWidth = currentWidth + 16;
  else if (event.key === 'Home') nextWidth = 200;
  else if (event.key === 'End') nextWidth = 420;
  else return;
  event.preventDefault();
  setSidebarWidth(nextWidth);
  persistSidebarState();
  scheduleLayoutChange();
});
drawerClose.addEventListener('click', () => setDrawerOpen(false));
drawerScrim.addEventListener('click', () => setDrawerOpen(false));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && state.mobileSidebarOpen) {
    setDrawerOpen(false);
  }
});

document.addEventListener('click', (event) => {
  if (state.mobileSidebarOpen && !sidebar.contains(event.target) && !drawerToggle.contains(event.target)) {
    setDrawerOpen(false);
  }
});

// Dispatch once at the end of the relevant CSS transition, with a reduced-motion fallback.
workspace.addEventListener('transitionend', (event) => {
  if (!isMobileLayout() && event.target === workspace && event.propertyName === 'grid-template-columns') {
    window.clearTimeout(layoutEventTimer);
    announceLayoutChange();
  }
});
sidebar.addEventListener('transitionend', (event) => {
  if (isMobileLayout() && event.target === sidebar && event.propertyName === 'transform') {
    window.clearTimeout(layoutEventTimer);
    announceLayoutChange();
  }
});

mobileMediaQuery.addEventListener('change', () => {
  state.mobileSidebarOpen = false;
  document.body.classList.remove('drawer-open');
  drawerScrim.hidden = true;
  sidebarContent.inert = isMobileLayout();
  updateSidebarButtons();
  announceLayoutChange();
});

// The menu controls the active content section and remains available to future modules.
const menuToggle = document.querySelector('#menu-toggle');
const menu = document.querySelector('#menu');
const menuItems = Array.from(menu.querySelectorAll('[role="menuitem"]'));

function closeMenu(returnFocus = false) {
  menu.hidden = true;
  menuToggle.setAttribute('aria-expanded', 'false');
  if (returnFocus) menuToggle.focus();
}

function setActiveView(viewName, announce = true) {
  const view = document.querySelector(`#view-${viewName}`);
  const selectedItem = menuItems.find((item) => item.dataset.view === viewName);
  if (!view || !selectedItem) return;

  state.view = viewName;
  if (viewName !== 'map') setMapMaximized(false);
  document.querySelectorAll('.content-view').forEach((section) => {
    section.hidden = section !== view;
  });
  menuItems.forEach((item) => {
    const isActive = item === selectedItem;
    item.classList.toggle('is-active', isActive);
    if (isActive) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });

  if (announce) {
    window.dispatchEvent(new CustomEvent('viewChanged', { detail: { view: viewName } }));
  }
}

function openMenu() {
  menu.hidden = false;
  menuToggle.setAttribute('aria-expanded', 'true');
  const activeItem = menuItems.find((item) => item.dataset.view === state.view);
  (activeItem || menuItems[0]).focus();
}

menuToggle.addEventListener('click', () => {
  if (menu.hidden) openMenu();
  else closeMenu();
});

menuItems.forEach((item) => {
  item.addEventListener('click', () => {
    setActiveView(item.dataset.view);
    closeMenu(true);
  });
});

menu.addEventListener('keydown', (event) => {
  const currentIndex = menuItems.indexOf(document.activeElement);
  let nextIndex;

  if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % menuItems.length;
  else if (event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + menuItems.length) % menuItems.length;
  else if (event.key === 'Home') nextIndex = 0;
  else if (event.key === 'End') nextIndex = menuItems.length - 1;
  else if (event.key === 'Escape') {
    event.preventDefault();
    closeMenu(true);
    return;
  } else return;

  event.preventDefault();
  menuItems[nextIndex].focus();
});

document.addEventListener('click', (event) => {
  if (!menu.hidden && !event.target.closest('.menu-wrap')) closeMenu();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !menu.hidden) closeMenu(true);
});

// The map is the initial view on every page load.
setActiveView(state.view);

// Let the map use the full main panel, then restore the insights layout on demand.
function setMapMaximized(maximized) {
  state.mapMaximized = maximized;
  document.body.classList.toggle('map-maximized', maximized);
  if (mapExpandButton) {
    mapExpandButton.setAttribute('aria-pressed', String(maximized));
    const label = maximized ? 'Restore map size' : 'Maximize map';
    mapExpandButton.setAttribute('aria-label', label);
    mapExpandButton.title = label;
    mapExpandButton.querySelector('span').textContent = maximized ? '▣' : '⛶';
  }
}

mapExpandButton.addEventListener('click', () => setMapMaximized(!state.mapMaximized));

const mapYear = document.querySelector('#map-year');
const mapYearValue = document.querySelector('#map-year-value');
const mapDataStatus = document.querySelector('#map-data-status');
let mapRows = [];
let initialYearRows = window.MOSAIC_YEAR_ROWS || null;
let fireMap = null;
let fireLayer = null;
let mapRenderer = null;
let requestedYear = 0;
function fireColour(value) { const intensity=Math.min(1,Math.log1p(value)/Math.log(31)); return `rgba(255,${Math.round(105-intensity*75)},${Math.round(50-intensity*30)},${.4+intensity*.6})`; }
function drawFireMap() {
  if (!fireMap || !fireLayer) return;
  fireLayer.clearLayers();
  const year=Number(mapYear.value); const rows=mapRows;
  rows.forEach(r=>L.rectangle([[r.lat-.05,r.lon-.05],[r.lat+.05,r.lon+.05]],{renderer:mapRenderer,stroke:false,fillColor:fireColour(r.harmonized_cells),fillOpacity:1}).bindPopup(`<strong>${r.year} · ${r.source}</strong><br>Harmonized fire days: ${r.harmonized_cells}<br>Observed fire days: ${r.fire_days}<br>Active: ${r.first_fire} → ${r.last_fire}<br>Total fire radiative power: ${r.frp_total_mw.toLocaleString()} MW<br>Peak day: ${r.peak_day}`).addTo(fireLayer));
  mapYearValue.value=String(year); mapDataStatus.textContent=`${rows.length.toLocaleString()} fire cells · ${rows[0]?.source||'No records'} · harmonized scale`;
}
function showFallback(rows,year){
  mapRows=rows; const host=document.querySelector('#fire-map');
  if(fireMap){fireMap.remove();fireMap=null;fireLayer=null;}
  let canvas=host.querySelector('canvas');if(!canvas){canvas=document.createElement('canvas');canvas.className='fire-map-fallback';host.replaceChildren(canvas);}
  const ctx=canvas.getContext('2d');const box=canvas.getBoundingClientRect();const dpr=window.devicePixelRatio||1;canvas.width=Math.max(1,box.width*dpr);canvas.height=Math.max(1,box.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#142019';ctx.fillRect(0,0,box.width,box.height);
  rows.forEach(r=>{const x=(r.lon+141.1)/88.5*box.width,y=(82.6-r.lat)/40.9*box.height,a=Math.min(1,.25+Math.log1p(r.harmonized_cells)/4);ctx.fillStyle=`rgba(255,75,36,${a})`;ctx.fillRect(x-3,y-3,6,6);});
  mapYearValue.value=String(year);mapDataStatus.textContent=`${rows.length.toLocaleString()} fire cells · basemap unavailable; data-only view`;
}
function loadYear(year){
  requestedYear=year;mapDataStatus.textContent=`Loading ${year} fire cells…`;
  const previous=document.querySelector('#map-year-data');if(previous)previous.remove();
  if (initialYearRows && year === 2023) { const rows=initialYearRows.map(r=>({year:r[0],lat:r[1],lon:r[2],fire_days:r[3],harmonized_cells:r[4],frp_total_mw:r[5],first_fire:r[6],last_fire:r[7],source:r[8],peak_day:r[9]})); if(window.L&&fireMap){mapRows=rows;drawFireMap();}else showFallback(rows,year); return; }
  window.MOSAIC_YEAR_ROWS=null;
  const script=document.createElement('script');script.id='map-year-data';script.src=`data/map-years/${year}.js`;
  script.onload=()=>{if(requestedYear!==year)return;const rows=(window.MOSAIC_YEAR_ROWS||[]).map(r=>({year:r[0],lat:r[1],lon:r[2],fire_days:r[3],harmonized_cells:r[4],frp_total_mw:r[5],first_fire:r[6],last_fire:r[7],source:r[8],peak_day:r[9]}));if(window.L&&fireMap){mapRows=rows;drawFireMap();}else showFallback(rows,year);};
  script.onerror=()=>{if(requestedYear===year)mapDataStatus.textContent=`Could not load ${year} fire data. Confirm data/map-years/${year}.js is deployed.`;};document.head.append(script);
}
if(window.L){fireMap=L.map('fire-map',{preferCanvas:true}).setView([58,-105],3);mapRenderer=L.canvas({padding:.5});L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap contributors'}).addTo(fireMap);fireLayer=L.layerGroup().addTo(fireMap);fireMap.fitBounds([[41.7,-141.1],[82.6,-52.6]]);window.addEventListener('resize',()=>fireMap&&fireMap.invalidateSize());}
mapYear.addEventListener('input',()=>loadYear(Number(mapYear.value)));
loadYear(Number(mapYear.value));document.querySelector('#download-csv').addEventListener('click',()=>{window.location.href='data/map_pins_yearly.csv';});