// Map page settings and choices live in one object. Add region entries here
// when additional countries or provinces are ready to be explored.
const CONFIG = {
  minDate: '2000-11-01',
  regions: [
    { value: 'alberta', label: 'Alberta', provinceCode: '48' },
    { value: 'british-columbia', label: 'British Columbia', provinceCode: '59' },
    { value: 'manitoba', label: 'Manitoba', provinceCode: '46' },
    { value: 'new-brunswick', label: 'New Brunswick', provinceCode: '13' },
    { value: 'newfoundland-and-labrador', label: 'Newfoundland and Labrador', provinceCode: '10' },
    { value: 'northwest-territories', label: 'Northwest Territories', provinceCode: '61' },
    { value: 'nova-scotia', label: 'Nova Scotia', provinceCode: '12' },
    { value: 'nunavut', label: 'Nunavut', provinceCode: '62' },
    { value: 'ontario', label: 'Ontario', provinceCode: '35' },
    { value: 'prince-edward-island', label: 'Prince Edward Island', provinceCode: '11' },
    { value: 'quebec', label: 'Quebec', provinceCode: '24' },
    { value: 'saskatchewan', label: 'Saskatchewan', provinceCode: '47' },
    { value: 'yukon', label: 'Yukon', provinceCode: '60' },
  ],
  roles: [
    { value: 'general-view', label: 'General View', description: 'Interactive hotspot map, current versus historical fire activity, 7-day weather outlook, and regional hotspot counts.', insights: ['Interactive hotspot map', 'Current versus historical fire activity', '7-day weather outlook', 'Regional hotspot counts'] },
    { value: 'emergency-response', label: 'Emergency Response', description: 'Fire-weather conditions, recent anomalies, preparedness priorities, nearby incidents, and resource readiness.', insights: ['Regions with elevated fire-weather conditions', 'Recent hotspot activity and anomalies', '1–7 day fire-weather outlook', 'Regional preparedness priority indicators', 'Nearby reported fire incidents, if available', 'Suggested resource-readiness reviews'] },
    { value: 'scientist', label: 'Scientists', description: 'Harmonization charts, historical anomalies, sensor calibration, and model validation.', insights: ['Before-and-after harmonization charts', 'Historical anomaly analysis', 'Sensor calibration and model validation'] },
    { value: 'land-manager', label: 'Land Managers', description: 'Burning frequency, seasonal activity, land-cover overlays, and planning recommendations.', insights: ['Historical burning frequency by region', 'Seasonal hotspot activity calendar', 'Vegetation and land-cover overlays', 'Areas with recurring burning activity', 'Land management planning recommendations'] },
    { value: 'firefighter', label: 'Firefighters', description: 'Current detections, confidence, fire radiative power, weather, and incident verification.', insights: ['Latest satellite hotspot detections', 'Hotspot coordinates and timestamps', 'Detection confidence and fire radiative power', 'Wind and weather overlays', 'Incident verification information'] },
  ],
};

const REGION_BOUNDS = {
  alberta: [-120.1, 48.9, -109.9, 60.1], 'british-columbia': [-139.1, 48.2, -114.0, 60.1],
  manitoba: [-102.1, 48.9, -88.9, 60.1], 'new-brunswick': [-69.2, 44.5, -63.7, 48.1],
  'newfoundland-and-labrador': [-67.9, 46.5, -52.5, 60.5], 'northwest-territories': [-136.5, 59.9, -101.8, 78.8],
  'nova-scotia': [-66.5, 43.3, -59.7, 47.2], nunavut: [-120.0, 51.0, -61.0, 83.2],
  ontario: [-95.2, 41.6, -74.2, 56.9], 'prince-edward-island': [-64.5, 45.9, -61.9, 47.1],
  quebec: [-79.9, 44.9, -57.0, 62.7], saskatchewan: [-110.1, 48.9, -101.3, 60.1],
  yukon: [-141.1, 59.8, -123.8, 69.7],
};

const CANADIAN_PLACES = [
  ['Vancouver', 49.2827, -123.1207, 'british-columbia'], ['Victoria', 48.4284, -123.3656, 'british-columbia'],
  ['Kelowna', 49.888, -119.496, 'british-columbia'], ['Calgary', 51.0447, -114.0719, 'alberta'], ['Edmonton', 53.5461, -113.4938, 'alberta'],
  ['Regina', 50.4452, -104.6189, 'saskatchewan'], ['Saskatoon', 52.1332, -106.67, 'saskatchewan'], ['Winnipeg', 49.8951, -97.1384, 'manitoba'],
  ['Toronto', 43.6532, -79.3832, 'ontario'], ['Ottawa', 45.4215, -75.6972, 'ontario'], ['Thunder Bay', 48.3809, -89.2477, 'ontario'],
  ['Montreal', 45.5019, -73.5674, 'quebec'], ['Quebec City', 46.8139, -71.208, 'quebec'], ['Fredericton', 45.9636, -66.6431, 'new-brunswick'],
  ['Halifax', 44.6488, -63.5752, 'nova-scotia'], ['Charlottetown', 46.2382, -63.1311, 'prince-edward-island'],
  ['St. John\'s', 47.5615, -52.7126, 'newfoundland-and-labrador'], ['Yellowknife', 62.454, -114.3718, 'northwest-territories'],
  ['Whitehorse', 60.7212, -135.0568, 'yukon'], ['Iqaluit', 63.7467, -68.517, 'nunavut'],
];

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
const calendarMapHop = document.querySelector('#calendar-map-hop');

function updateCalendarMapHop() {
  const targetView = state.view === 'map' ? 'calendar' : 'map';
  const label = targetView === 'calendar' ? 'Calendar view' : 'Map view';
  calendarMapHop.innerHTML = `${label} <span aria-hidden="true">↗</span>`;
  calendarMapHop.setAttribute('aria-label', `Go to ${targetView} view`);
  calendarMapHop.title = `Go to ${targetView} view`;
}

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
  updateCalendarMapHop();
  if (viewName !== 'map') setMapMaximized(false);
  document.querySelectorAll('.content-view').forEach((section) => {
    const isActive = section === view;
    section.hidden = !isActive;
    section.setAttribute('aria-hidden', String(!isActive));
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

  // Repaint size-dependent content only after the selected section is visible.
  if (viewName === 'compare') requestAnimationFrame(() => renderComparison());
  if (viewName === 'live') requestAnimationFrame(() => loadLiveYear());
  if (viewName === 'trend') requestAnimationFrame(() => renderTrend());
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

calendarMapHop.addEventListener('click', () => {
  setActiveView(state.view === 'map' ? 'calendar' : 'map');
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

const mapYearStart = document.querySelector('#map-year-start');
const mapYearEnd = document.querySelector('#map-year-end');
const harmonizationMode = document.querySelector('#harmonization-mode');
const mapLegendTitle = document.querySelector('#map-legend-title');
const mapYearStartValue = document.querySelector('#map-year-start-value');
const mapYearEndValue = document.querySelector('#map-year-end-value');
const mapDataStatus = document.querySelector('#map-data-status');
let mapRows = [];
let initialYearRows = window.MOSAIC_YEAR_ROWS || null;
let fireMap = null;
let fireLayer = null;
let fireBoundaryLayer = null;
let provinceClickableLayer = null;
let mapRenderer = null;
// Province shapes load on demand from Statistics Canada's 2021 generalized
// province/territory boundaries; PRUID links each shape to the sidebar choice.
let activeProvinceFeature = null;
let activeProvinceIndex = null;
let activeRegionValue = null;
let pendingMapPlace = null;
const provinceIndexes = new Map();
const pendingProvinceLoads = new Map();

function loadProvinceIndex(region) {
  if (provinceIndexes.has(region.value)) return Promise.resolve(provinceIndexes.get(region.value));
  if (pendingProvinceLoads.has(region.value)) return pendingProvinceLoads.get(region.value);

  const load = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `data/canada/provinces/${region.value}.js`;
    script.onload = () => {
      const feature = window.MOSAIC_PROVINCE_BOUNDARIES?.[region.provinceCode];
      if (!feature) {
        reject(new Error(`Boundary data missing for ${region.label}.`));
        return;
      }
      const entry = { feature, index: makeProvinceIndex(feature) };
      provinceIndexes.set(region.value, entry);
      resolve(entry);
    };
    script.onerror = () => reject(new Error(`Could not load the ${region.label} boundary.`));
    document.head.append(script);
  }).finally(() => pendingProvinceLoads.delete(region.value));

  pendingProvinceLoads.set(region.value, load);
  return load;
}

function makeProvinceIndex(feature) {
  if (!feature) return null;
  const bucketSize = 0.5;
  const buckets = new Map();
  const polygons = [];
  const bounds = { minLon: Infinity, minLat: Infinity, maxLon: -Infinity, maxLat: -Infinity };

  feature.geometry.coordinates.forEach((rings) => {
    const outer = rings[0];
    if (!outer?.length) return;
    const polygonBounds = { minLon: Infinity, minLat: Infinity, maxLon: -Infinity, maxLat: -Infinity };
    outer.forEach(([lon, lat]) => {
      polygonBounds.minLon = Math.min(polygonBounds.minLon, lon);
      polygonBounds.maxLon = Math.max(polygonBounds.maxLon, lon);
      polygonBounds.minLat = Math.min(polygonBounds.minLat, lat);
      polygonBounds.maxLat = Math.max(polygonBounds.maxLat, lat);
    });
    bounds.minLon = Math.min(bounds.minLon, polygonBounds.minLon);
    bounds.maxLon = Math.max(bounds.maxLon, polygonBounds.maxLon);
    bounds.minLat = Math.min(bounds.minLat, polygonBounds.minLat);
    bounds.maxLat = Math.max(bounds.maxLat, polygonBounds.maxLat);
    const polygon = { rings, bounds: polygonBounds };
    polygons.push(polygon);
    for (let x = Math.floor(polygonBounds.minLon / bucketSize); x <= Math.floor(polygonBounds.maxLon / bucketSize); x += 1) {
      for (let y = Math.floor(polygonBounds.minLat / bucketSize); y <= Math.floor(polygonBounds.maxLat / bucketSize); y += 1) {
        const key = `${x}:${y}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(polygon);
      }
    }
  });
  return { buckets, polygons, bounds, bucketSize };
}

function pointInRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function pointInIndex(index, lon, lat) {
  if (!index) return false;
  const { buckets, bucketSize } = index;
  const candidates = buckets.get(`${Math.floor(lon / bucketSize)}:${Math.floor(lat / bucketSize)}`) || [];
  return candidates.some((polygon) => {
    const b = polygon.bounds;
    if (lon < b.minLon || lon > b.maxLon || lat < b.minLat || lat > b.maxLat) return false;
    if (!pointInRing(lon, lat, polygon.rings[0])) return false;
    return !polygon.rings.slice(1).some((hole) => pointInRing(lon, lat, hole));
  });
}

function pointInProvince(lon, lat) { return pointInIndex(activeProvinceIndex, lon, lat); }

async function selectProvinceAt(lat, lon) {
  document.querySelector('#map-search-status').textContent = 'Checking which province or territory contains that point…';
  const candidates = CONFIG.regions.filter((region) => {
    const [west, south, east, north] = REGION_BOUNDS[region.value];
    return lon >= west && lon <= east && lat >= south && lat <= north;
  }).sort((a, b) => {
    const area = (region) => { const [w, s, e, n] = REGION_BOUNDS[region.value]; return (e - w) * (n - s); };
    return area(a) - area(b);
  });
  for (const region of candidates) {
    try {
      const entry = await loadProvinceIndex(region);
      if (pointInIndex(entry.index, lon, lat)) {
        controls.region.value = region.value;
        applyControlChange(controls.region);
        document.querySelector('#map-search-status').textContent = `${region.label} selected from the map.`;
        return;
      }
    } catch { /* Keep checking other overlapping province bounds. */ }
  }
  document.querySelector('#map-search-status').textContent = 'No Canadian province or territory was found at that point.';
}

function setActiveProvince(shouldZoom = true) {
  const region = CONFIG.regions.find((item) => item.value === state.region);
  if (!region) return;
  if (activeRegionValue === region.value) {
    renderVisibleMap();
    return;
  }
  activeRegionValue = region.value;
  activeProvinceFeature = null;
  activeProvinceIndex = null;
  if (window.L && fireMap && fireBoundaryLayer) {
    fireBoundaryLayer.clearLayers();
  }
  mapDataStatus.textContent = `Loading ${region.label} boundaries…`;
  renderVisibleMap();

  loadProvinceIndex(region).then((entry) => {
    if (state.region !== region.value) return;
    activeProvinceFeature = entry.feature;
    activeProvinceIndex = entry.index;
    if (window.L && fireMap && fireBoundaryLayer) {
      const boundary = L.geoJSON(activeProvinceFeature, {
        interactive: false,
        style: { color: '#92a18f', weight: 1.2, opacity: 0.8, fillColor: '#405b45', fillOpacity: 0.13 },
      });
      boundary.addTo(fireBoundaryLayer);
      if (shouldZoom && pendingMapPlace?.regionValue === region.value) {
        fireMap.setView([pendingMapPlace.lat, pendingMapPlace.lon], pendingMapPlace.zoom);
        pendingMapPlace = null;
      } else if (shouldZoom) fireMap.fitBounds(boundary.getBounds(), { padding: [24, 24] });
    }
    renderVisibleMap();
    if(state.view==='live') renderLiveFeed();
  }).catch(() => {
    if (state.region === region.value) mapDataStatus.textContent = `Boundary data for ${region.label} could not be loaded.`;
  });
}

function mapActivityValue(row) { return harmonizationMode.value === 'harmonized' ? Number(row.harmonized_cells) : Number(row.fire_days); }

function getVisibleRows() {
  if (!activeProvinceIndex) return [];
  return mapRows.filter((row) => {
    const withinDateRange = (!row.last_fire || row.last_fire >= state.start) && (!row.first_fire || row.first_fire <= state.end);
    const matchesMode = harmonizationMode.value === 'harmonized' || (harmonizationMode.value === 'modis' ? row.source.toUpperCase().includes('MODIS') : row.source.toUpperCase().includes('VIIRS'));
    return withinDateRange && matchesMode && pointInProvince(row.lon, row.lat);
  });
}

function fireColour(value) {
  const intensity = Math.min(1, Math.log1p(Number(value) || 0) / Math.log(31));
  return { color: `rgb(255,${Math.round(105 - intensity * 75)},${Math.round(50 - intensity * 30)})`, opacity: .48 + intensity * .48 };
}

function drawFireMap(rows) {
  if (!fireMap || !fireLayer) return;
  fireLayer.clearLayers();
  rows.forEach((row) => {
    const activity = mapActivityValue(row);
    const colour = fireColour(activity);
    const radius = Math.min(6, 2.4 + Math.log1p(activity || 0) * .55);
    L.circleMarker([row.lat, row.lon], {
      renderer: mapRenderer, radius, color: '#371e17', weight: .35,
      fillColor: colour.color, fillOpacity: colour.opacity,
    }).bindPopup(`<strong>Fire type: satellite active-fire hotspot</strong><br>Detection source: ${row.source}<br>Location: ${row.lat.toFixed(2)}°, ${row.lon.toFixed(2)}°<br>${harmonizationMode.value === 'harmonized' ? 'Harmonized fire-cell activity' : 'Sensor fire days'}: ${activity}<br>Observed dates: ${row.first_fire} to ${row.last_fire} (daily data; time of day not provided)<br>Detection confidence: not included in this source archive<br>Fire radiative power (total): ${Number(row.frp_total_mw).toLocaleString()} MW<br>Peak day: ${row.peak_day}<br>This hotspot is not a confirmed fire perimeter. The archive does not distinguish wildfire from prescribed fire.${harmonizationMode.value === 'modis' ? '<br>MODIS before 2012 is calibrated for harmonized comparisons.' : ''}`).addTo(fireLayer);
  });
}

function drawFallback(rows) {
  const host = document.querySelector('#fire-map');
  let canvas = host.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'fire-map-fallback';
    canvas.setAttribute('aria-hidden', 'true');
    host.replaceChildren(canvas);
  }
  const ctx = canvas.getContext('2d');
  const box = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, box.width * dpr);
  canvas.height = Math.max(1, box.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#142019';
  ctx.fillRect(0, 0, box.width, box.height);

  const bounds = activeProvinceIndex?.bounds || { minLon: -141.1, maxLon: -52.6, minLat: 41.7, maxLat: 82.6 };
  const padding = 34;
  const centerLat = (bounds.minLat + bounds.maxLat) / 2;
  const xScaleFactor = Math.cos(centerLat * Math.PI / 180);
  const projectX = (lon) => lon * xScaleFactor;
  const xMin = projectX(bounds.minLon), xMax = projectX(bounds.maxLon);
  const scale = Math.min((box.width - padding * 2) / Math.max(.01, xMax - xMin), (box.height - padding * 2) / Math.max(.01, bounds.maxLat - bounds.minLat));
  const offsetX = (box.width - (xMax - xMin) * scale) / 2;
  const offsetY = (box.height - (bounds.maxLat - bounds.minLat) * scale) / 2;
  const project = ([lon, lat]) => [offsetX + (projectX(lon) - xMin) * scale, offsetY + (bounds.maxLat - lat) * scale];

  if (activeProvinceFeature) {
    ctx.beginPath();
    activeProvinceFeature.geometry.coordinates.forEach((polygon) => {
      polygon.forEach((ring) => {
        ring.forEach((point, index) => {
          const [x, y] = project(point);
          if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.closePath();
      });
    });
    ctx.fillStyle = '#1d3024';
    ctx.fill('evenodd');
    ctx.strokeStyle = '#80917f';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  rows.forEach((row) => {
    const [x, y] = project([row.lon, row.lat]);
    const activity = mapActivityValue(row);
    const level = fireColour(activity);
    const radius = Math.min(5.2, 1.8 + Math.log1p(activity || 0) * .45);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = level.color;
    ctx.globalAlpha = level.opacity;
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function renderVisibleMap(shouldZoom = false) {
  const rows = getVisibleRows();
  if (window.L && fireMap && fireLayer) {
    drawFireMap(rows);
    if (shouldZoom && activeProvinceFeature && fireBoundaryLayer.getLayers().length) {
      fireMap.fitBounds(fireBoundaryLayer.getLayers()[0].getBounds(), { padding: [24, 24] });
    }
  } else if (activeProvinceIndex) {
    drawFallback(rows);
  } else {
    drawFallback([]);
  }
  const region = CONFIG.regions.find((item) => item.value === state.region)?.label || state.region;
  const yearLabel = `${mapYearStart.value}–${mapYearEnd.value}`;
  if (activeProvinceIndex) mapDataStatus.textContent = `${rows.length.toLocaleString()} ${harmonizationMode.options[harmonizationMode.selectedIndex].text.toLowerCase()} in ${region} · ${yearLabel}${rows.length ? ` · ${rows[0].source}` : ' · no records in this range'}`;
}

const yearRowsCache = new Map();
const yearRowsPending = new Map();
const decodeYearRows = (rows) => (rows || []).map((r) => ({ year: r[0], lat: r[1], lon: r[2], fire_days: r[3], harmonized_cells: r[4], frp_total_mw: r[5], first_fire: r[6], last_fire: r[7], source: r[8], peak_day: r[9] }));
if (initialYearRows) yearRowsCache.set(2023, decodeYearRows(initialYearRows));

function getYearRows(year) {
  if (yearRowsCache.has(year)) return Promise.resolve(yearRowsCache.get(year));
  if (yearRowsPending.has(year)) return yearRowsPending.get(year);
  const loading = new Promise((resolve, reject) => {
    // Load sequentially because each archive publishes through the shared global.
    const script = document.createElement('script');
    script.src = `data/map-years/${year}.js`;
    script.onload = () => {
      const rows = decodeYearRows(window.MOSAIC_YEAR_ROWS);
      yearRowsCache.set(year, rows);
      resolve(rows);
    };
    script.onerror = () => reject(new Error(`Could not load ${year} fire data.`));
    window.MOSAIC_YEAR_ROWS = null;
    document.head.append(script);
  }).finally(() => yearRowsPending.delete(year));
  yearRowsPending.set(year, loading);
  return loading;
}

let requestedYearRange = '';
async function loadYearRange() {
  const startYear = Number(mapYearStart.value);
  const endYear = Number(mapYearEnd.value);
  const requestKey = `${startYear}:${endYear}:${harmonizationMode.value}`;
  requestedYearRange = requestKey;
  mapYearStartValue.value = String(startYear);
  mapYearEndValue.value = String(endYear);
  mapDataStatus.textContent = `Loading fire cells for ${startYear}–${endYear}…`;
  try {
    const years = [];
    for (let year = startYear; year <= endYear; year += 1) years.push(year);
    const collected = [];
    for (const year of years) collected.push(...await getYearRows(year));
    if (requestedYearRange !== requestKey) return;
    mapRows = collected;
    renderVisibleMap();
  } catch (error) {
    if (requestedYearRange === requestKey) mapDataStatus.textContent = `${error.message} Check that the selected year files are available.`;
  }
}

function updateDateRangeFromSlider() {
  const minAllowedYear = Number(mapYearStart.min);
  let first = Number(mapYearStart.value);
  let last = Number(mapYearEnd.value);
  if (first > last) {
    if (document.activeElement === mapYearStart) last = first;
    else first = last;
    mapYearStart.value = String(first);
    mapYearEnd.value = String(last);
  }
  const today = localDateString();
  controls.start.value = `${Math.max(first, 2000)}-01-01`;
  if (controls.start.value < CONFIG.minDate) controls.start.value = CONFIG.minDate;
  controls.end.value = `${last}-12-31` > today ? today : `${last}-12-31`;
  if (controls.start.value < `${minAllowedYear}-01-01`) controls.start.value = `${minAllowedYear}-01-01`;
  applyControlChange(controls.start);
}

function syncSliderFromDates() {
  const lowerBound = Number(mapYearStart.min);
  const upperBound = Number(mapYearStart.max);
  const first = Math.min(upperBound, Math.max(lowerBound, Number(state.start.slice(0, 4)) || lowerBound));
  const last = Math.min(upperBound, Math.max(lowerBound, Number(state.end.slice(0, 4)) || upperBound));
  mapYearStart.value = String(Math.min(first, last));
  mapYearEnd.value = String(Math.max(first, last));
}

if (window.L) {
  fireMap = L.map('fire-map', { preferCanvas: true }).setView([53.5, -113.5], 5);
  mapRenderer = L.canvas({ padding: .5, tolerance: 10 });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap contributors' }).addTo(fireMap);
  fireBoundaryLayer = L.layerGroup().addTo(fireMap);
  fireLayer = L.layerGroup().addTo(fireMap);
  // A low-z-index province layer makes every province selectable, including
  // remote northern islands that are difficult to target on the map canvas.
  fireMap.createPane('provinceHitPane');
  fireMap.getPane('provinceHitPane').style.zIndex = 350;
  provinceClickableLayer = L.layerGroup().addTo(fireMap);
  Promise.all(CONFIG.regions.map(async (region) => {
    try {
      const entry = await loadProvinceIndex(region);
      const boundary = L.geoJSON(entry.feature, {
        pane: 'provinceHitPane',
        interactive: true,
        style: { color: '#8c9a8e', weight: 1, opacity: .68, fillColor: '#425346', fillOpacity: .015 },
        onEachFeature: (_feature, layer) => layer.on('click', (event) => {
          if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
          if (controls.region.value !== region.value) {
            controls.region.value = region.value;
            applyControlChange(controls.region);
          }
          mapSearchStatus.textContent = `${region.label} selected from the map.`;
        }),
      });
      boundary.addTo(provinceClickableLayer);
    } catch { /* Keep the rest of the province boundaries available. */ }
  }));
  fireMap.on('click', (event) => {
    if (event.originalEvent?.target?.closest?.('.leaflet-interactive')) return;
    selectProvinceAt(event.latlng.lat, event.latlng.lng);
  });
  window.addEventListener('resize', () => fireMap && fireMap.invalidateSize());
}

const mapSearchForm = document.querySelector('#map-search-form');
const mapSearchInput = document.querySelector('#map-search');
const mapSearchStatus = document.querySelector('#map-search-status');
const placesList = document.querySelector('#canadian-places');
CANADIAN_PLACES.forEach(([name]) => { const option = document.createElement('option'); option.value = name; placesList.append(option); });
CONFIG.regions.forEach((region) => { const option = document.createElement('option'); option.value = region.label; placesList.append(option); });

document.querySelector('#map-reset').addEventListener('click', () => {
  if (!fireMap) { mapSearchStatus.textContent = 'Map controls are unavailable because the interactive map library did not load.'; return; }
  const boundary = fireBoundaryLayer?.getLayers()[0];
  if (boundary) fireMap.fitBounds(boundary.getBounds(), { padding: [24, 24] });
  else fireMap.setView([53.5, -113.5], 5);
  mapSearchStatus.textContent = `Map reset to ${CONFIG.regions.find((region) => region.value === state.region)?.label || 'Canada'}.`;
});

// Keep the location search tucked behind an icon until the user needs it.
const mapSearchToggle = document.querySelector('#map-search-toggle');
function setSearchOpen(open) {
  mapSearchForm.hidden = !open;
  mapSearchToggle.setAttribute('aria-expanded', String(open));
  mapSearchToggle.setAttribute('aria-label', open ? 'Close map search' : 'Open map search');
  mapSearchToggle.title = open ? 'Close map search' : 'Search the map';
  if (open) mapSearchInput.focus();
}
mapSearchToggle.addEventListener('click', () => setSearchOpen(mapSearchForm.hidden));
mapSearchForm.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') { setSearchOpen(false); mapSearchToggle.focus(); }
});
document.addEventListener('pointerdown', (event) => {
  if (!mapSearchForm.hidden && !event.target.closest('.map-location-controls')) setSearchOpen(false);
});

mapSearchForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const query = mapSearchInput.value.trim();
  if (!query) { mapSearchStatus.textContent = 'Enter a Canadian city, province or territory, or latitude and longitude.'; return; }
  const coords = query.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (coords) {
    const lat = Number(coords[1]), lon = Number(coords[2]);
    if (lat < 41 || lat > 84 || lon < -142 || lon > -51) { mapSearchStatus.textContent = 'Those coordinates are outside Canada.'; return; }
    fireMap?.setView([lat, lon], 9);
    mapSearchStatus.textContent = `Showing ${lat.toFixed(3)}°, ${lon.toFixed(3)}°.`;
    return;
  }
  const normalized = query.toLocaleLowerCase('en-CA');
  const region = CONFIG.regions.find((item) => item.label.toLocaleLowerCase('en-CA') === normalized || item.value.replaceAll('-', ' ') === normalized);
  if (region) {
    controls.region.value = region.value;
    applyControlChange(controls.region);
    mapSearchStatus.textContent = `${region.label} selected.`;
    return;
  }
  const place = CANADIAN_PLACES.find(([name]) => name.toLocaleLowerCase('en-CA') === normalized);
  if (place) {
    const [name, lat, lon, regionValue] = place;
    if (controls.region.value !== regionValue) {
      controls.region.value = regionValue;
      pendingMapPlace = { regionValue, lat, lon, zoom: 9 };
      applyControlChange(controls.region);
    } else {
      fireMap?.setView([lat, lon], 9);
    }
    mapSearchStatus.textContent = `Showing ${name}, ${CONFIG.regions.find((item) => item.value === regionValue).label}.`;
    return;
  }
  mapSearchStatus.textContent = 'Location not found in the built-in Canadian place list. Try a province, listed city, or latitude, longitude.';
});

window.addEventListener('filtersChanged', () => {
  setActiveProvince(true);
  syncSliderFromDates();
  const key = `${mapYearStart.value}:${mapYearEnd.value}:${harmonizationMode.value}`;
  if (key !== requestedYearRange) loadYearRange();
  else renderVisibleMap();
});
window.addEventListener('viewChanged', (event) => { if ((event.detail?.view || event.detail) === 'map') { requestAnimationFrame(() => { if (fireMap) fireMap.invalidateSize(); renderVisibleMap(); }); } });
harmonizationMode.addEventListener('change', () => {
  if (harmonizationMode.value === 'modis') {
    mapLegendTitle.textContent = 'MODIS HOTSPOTS · OBSERVED FIRE DAYS';
  } else if (harmonizationMode.value === 'viirs') {
    mapLegendTitle.textContent = 'VIIRS FIRE DAYS';
  } else {
    mapLegendTitle.textContent = 'HARMONIZED FIRE DAYS';
  }
  loadYearRange();
});
mapYearStart.addEventListener('input', () => {
  if (+mapYearStart.value > +mapYearEnd.value) mapYearEnd.value = mapYearStart.value;
  mapYearStartValue.value = mapYearStart.value;
  mapYearEndValue.value = mapYearEnd.value;
});
mapYearEnd.addEventListener('input', () => {
  if (+mapYearEnd.value < +mapYearStart.value) mapYearStart.value = mapYearEnd.value;
  mapYearStartValue.value = mapYearStart.value;
  mapYearEndValue.value = mapYearEnd.value;
});
mapYearStart.addEventListener('change', updateDateRangeFromSlider);
mapYearEnd.addEventListener('change', updateDateRangeFromSlider);
setActiveProvince(true);
syncSliderFromDates();
loadYearRange();

const compareRegionA = document.querySelector('#compare-region-a');
const compareRegionB = document.querySelector('#compare-region-b');
const compareCanvas = document.querySelector('#compare-chart');
const compareSummary = document.querySelector('#compare-summary');
const compareLegendA = document.querySelector('#compare-legend-a');
const compareLegendB = document.querySelector('#compare-legend-b');
const trendCanvas = document.querySelector('#trend-chart');
const trendSummary = document.querySelector('#trend-summary');
const trendDisplay = document.querySelector('#trend-display');
const trendBaseline = document.querySelector('#trend-baseline');
const trendShowRaw = document.querySelector('#trend-show-raw');
const trendMetrics = document.querySelector('#trend-metrics');
const trendLegend = document.querySelector('#trend-legend');
const trendTooltip = document.querySelector('#trend-tooltip');
const trendNote = document.querySelector('#trend-note');
const liveFeed = document.querySelector('#live-feed');
const liveStatus = document.querySelector('#live-status');
let liveRows = [];
let liveYearRequested = null;
let trendHits = [];
let selectedTrendYear = null;

function fillRegionSelect(select, selectedValue) {
  CONFIG.regions.forEach((region) => {
    const option = document.createElement('option'); option.value = region.value; option.textContent = region.label; select.append(option);
  });
  select.value = selectedValue;
}
fillRegionSelect(compareRegionA, state.region);
fillRegionSelect(compareRegionB, CONFIG.regions.find((region) => region.value !== state.region)?.value || CONFIG.regions[1].value);

function monthlySeries(regionValue) {
  const source = window.MOSAIC_PROVINCE_MONTHS?.[regionValue] || {};
  const mode = harmonizationMode.value;
  const factors = window.MOSAIC_CALIBRATION_FACTORS || {};
  const start = state.start.slice(0, 7), end = state.end.slice(0, 7);
  const values = Array(12).fill(0);
  Object.entries(source).forEach(([month, harmonizedValue]) => {
    const year = Number(month.slice(0, 4)); const monthIndex = Number(month.slice(5, 7)) - 1;
    if (month < start || month > end) return;
    if (mode === 'modis' && year > 2011) return;
    if (mode === 'viirs' && year < 2012) return;
    const value = mode === 'modis' ? harmonizedValue / Number(factors[String(monthIndex + 1)]) : harmonizedValue;
    values[monthIndex] += value;
  });
  return values;
}

function annualSeries(regionValue, raw = false) {
  const source = window.MOSAIC_PROVINCE_MONTHS?.[regionValue] || {};
  const mode = harmonizationMode.value;
  const factors = window.MOSAIC_CALIBRATION_FACTORS || {};
  const annual = new Map();
  const firstYear = Math.max(2002, Number(state.start.slice(0, 4)), mode === 'viirs' ? 2012 : 2002);
  const lastYear = Math.min(2025, Number(state.end.slice(0, 4)), mode === 'modis' ? 2011 : 2025);
  for (let year = firstYear; year <= lastYear; year += 1) annual.set(year, { year, total: 0, months: Array(12).fill(0) });
  Object.entries(source).forEach(([month, harmonizedValue]) => {
    const year = Number(month.slice(0, 4)), monthNumber = Number(month.slice(5, 7));
    if (month < state.start.slice(0, 7) || month > state.end.slice(0, 7)) return;
    if (mode === 'modis' && year > 2011) return;
    if (mode === 'viirs' && year < 2012) return;
    const value = raw && year <= 2011 ? harmonizedValue / (Number(factors[String(monthNumber)]) || 1) : Number(harmonizedValue) || 0;
    const record = annual.get(year);
    if (!record) return;
    record.total += value;
    record.months[monthNumber - 1] += value;
  });
  return [...annual.values()].sort((a, b) => a.year - b.year);
}

function trendMean(values) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function trendMedian(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
function trendNumber(value) { return Math.round(value).toLocaleString(); }

function renderTrend() {
  if (!trendCanvas || !trendSummary) return;
  const region = CONFIG.regions.find((item) => item.value === state.region);
  const primaryIsRaw = harmonizationMode.value !== 'harmonized';
  const primary = annualSeries(state.region, primaryIsRaw);
  const comparison = trendShowRaw.checked ? annualSeries(state.region, !primaryIsRaw) : [];
  const modeLabel = harmonizationMode.selectedOptions[0]?.textContent || 'Harmonized Activity';
  const years = primary.map((entry) => entry.year);
  if (!years.includes(selectedTrendYear)) selectedTrendYear = years.at(-1) ?? null;
  const selectedIndex = primary.findIndex((entry) => entry.year === selectedTrendYear);
  const selected = primary[selectedIndex];
  const baselineLimit = trendBaseline.value === 'all' ? primary.length : Number(trendBaseline.value);
  const baseline = selected ? primary.slice(Math.max(0, selectedIndex - baselineLimit), selectedIndex) : [];
  const baselineTotals = baseline.map((entry) => entry.total);
  const average = trendMean(baselineTotals), historicalMedian = trendMedian(baselineTotals);
  const deviation = Math.sqrt(trendMean(baselineTotals.map((value) => (value - average) ** 2)));
  const anomaly = deviation ? (selected.total - average) / deviation : null;
  const percentage = average ? ((selected.total - average) / average) * 100 : null;
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const seasons = [
    ['Winter', [11, 0, 1]], ['Spring', [2, 3, 4]], ['Summer', [5, 6, 7]], ['Fall', [8, 9, 10]],
  ].map(([name, months]) => ({ name, total: months.reduce((sum, month) => sum + (selected?.months[month] || 0), 0) }));
  const peakSeason = seasons.reduce((peak, season) => season.total > peak.total ? season : peak, { name: '—', total: 0 });

  const metrics = [
    ['Selected year', selected ? trendNumber(selected.total) : '—', selected ? String(selected.year) : 'No years in range'],
    ['Historical average', baseline.length ? trendNumber(average) : '—', baseline.length ? `${baseline.length} earlier years` : 'Baseline unavailable'],
    ['Historical median', baseline.length ? trendNumber(historicalMedian) : '—', 'Earlier years only'],
    ['Anomaly', anomaly === null ? '—' : `${anomaly >= 0 ? '+' : ''}${anomaly.toFixed(1)}σ`, 'Standard deviations from average'],
    ['Difference from average', percentage === null ? '—' : `${percentage >= 0 ? '+' : ''}${percentage.toFixed(0)}%`, 'Selected year vs baseline'],
    ['Peak season', peakSeason.name, `${trendNumber(peakSeason.total)} activity`],
  ];
  trendMetrics.replaceChildren();
  metrics.forEach(([label, value, caption]) => {
    const card = document.createElement('article'); card.className = 'trend-metric';
    const name = document.createElement('span'); name.textContent = label;
    const amount = document.createElement('strong'); amount.textContent = value;
    const hint = document.createElement('small'); hint.textContent = caption;
    card.append(name, amount, hint); trendMetrics.append(card);
  });

  const currentName = primaryIsRaw ? (harmonizationMode.value === 'modis' ? 'MODIS raw' : 'VIIRS raw') : 'Harmonized';
  trendSummary.textContent = `${region.label} · ${state.start} to ${state.end} · ${modeLabel} · ${primary.length} years · selected: ${selected?.year ?? '—'}${baseline.length ? ` · baseline: ${baseline[0].year}–${baseline.at(-1).year}` : ''}`;
  trendCanvas.setAttribute('aria-label', `${trendDisplay.value === 'annual' ? 'Annual activity' : 'Monthly seasonality'} for ${region.label}. Selected year ${selected?.year ?? 'unavailable'}, ${selected ? trendNumber(selected.total) : 'no'} annual activity. Use left and right arrow keys to select years; hover or click points for details.`);
  trendNote.textContent = `Annual totals sum monthly provincial activity. Baseline statistics use the ${trendBaseline.value === 'all' ? 'full set of earlier years' : `previous ${trendBaseline.value} available years`} before ${selected?.year ?? 'the selected period'}. Anomaly is the z-score from the historical mean; percentage difference is relative to that mean. Monthly seasonality compares five yearly profiles. ${trendShowRaw.checked ? 'Raw/harmonized overlay compares uncalibrated MODIS counts with calibrated activity; VIIRS is unchanged by calibration.' : 'Turn on “Compare raw and harmonized” to show both series.'}`;

  trendLegend.replaceChildren();
  const visibleYears = primary.filter((entry) => entry.year <= selectedTrendYear).slice(-5);
  const lineColors = visibleYears.map((entry, index) => index === visibleYears.length - 1 ? '#ff7438' : `rgba(255,116,56,${0.22 + 0.1 * index})`);
  const comparisonName = primaryIsRaw ? 'Harmonized' : 'Unharmonized counts';
  const legendItems = trendDisplay.value === 'annual'
    ? [[currentName, '#ff7438'], ['Historical mean', '#73cfc3'], ['Historical median', '#94a9ff'], ...(trendShowRaw.checked ? [[comparisonName, primaryIsRaw ? '#73cfc3' : '#e5b96f']] : [])]
    : [...visibleYears.map((entry, index) => [`${entry.year}${entry.year === selectedTrendYear ? ' · selected' : ''}`, lineColors[index]]), ['Monthly mean', '#73cfc3'], ['Monthly median', '#94a9ff'], ...(trendShowRaw.checked ? [[comparisonName, primaryIsRaw ? '#73cfc3' : '#e5b96f']] : [])];
  legendItems.forEach(([label, color]) => {
    const item = document.createElement('span'), swatch = document.createElement('i');
    swatch.style.setProperty('--trend-color', color); item.append(swatch, document.createTextNode(label)); trendLegend.append(item);
  });

  const box = trendCanvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  if (!box.width || !box.height) return;
  trendCanvas.width = Math.max(1, Math.round(box.width * dpr)); trendCanvas.height = Math.max(1, Math.round(box.height * dpr));
  const ctx = trendCanvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, box.width, box.height);
  const pad = { left: 72, right: 24, top: 28, bottom: 48 }, plotW = box.width - pad.left - pad.right, plotH = box.height - pad.top - pad.bottom;
  trendHits = [];
  const chartValues = [];
  if (trendDisplay.value === 'annual') chartValues.push(...primary.map((entry) => entry.total), ...comparison.map((entry) => entry.total), average, historicalMedian);
  else {
    for (let month = 0; month < 12; month += 1) chartValues.push(trendMean(baseline.map((entry) => entry.months[month])), trendMedian(baseline.map((entry) => entry.months[month])));
    visibleYears.forEach((entry) => chartValues.push(...entry.months));
    if (trendShowRaw.checked) { const rawYear = comparison.find((entry) => entry.year === selectedTrendYear); if (rawYear) chartValues.push(...rawYear.months); }
  }
  const maxY = Math.max(1, ...chartValues);
  ctx.font = '12px DM Sans, sans-serif'; ctx.fillStyle = '#aeb8af'; ctx.strokeStyle = '#344039'; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = pad.top + plotH * i / 4;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(box.width - pad.right, y); ctx.stroke();
    ctx.textAlign = 'right'; ctx.fillText(trendNumber(maxY * (1 - i / 4)), pad.left - 10, y + 4);
  }
  const xMonthly = (index) => pad.left + plotW * index / 11;
  const yValue = (value) => pad.top + plotH * (1 - value / maxY);
  const drawLine = (values, color, width, dash = []) => {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash); ctx.beginPath();
    values.forEach((value, index) => { const x = trendDisplay.value === 'annual' ? pad.left + (values.length === 1 ? plotW / 2 : plotW * index / Math.max(1, values.length - 1)) : xMonthly(index); if (!index) ctx.moveTo(x, yValue(value)); else ctx.lineTo(x, yValue(value)); });
    ctx.stroke(); ctx.restore();
  };

  if (trendDisplay.value === 'annual') {
    const xYear = (index) => pad.left + (primary.length === 1 ? plotW / 2 : plotW * index / Math.max(1, primary.length - 1));
    if (baseline.length) { drawLine(Array(primary.length).fill(average), '#73cfc3', 2, [7, 5]); drawLine(Array(primary.length).fill(historicalMedian), '#94a9ff', 2, [3, 4]); }
    drawLine(primary.map((entry) => entry.total), '#ff7438', 3);
    primary.forEach((entry, index) => {
      const x = xYear(index), y = yValue(entry.total);
      ctx.fillStyle = '#ff9b5f'; ctx.beginPath(); ctx.arc(x, y, entry.year === selectedTrendYear ? 5 : 3.2, 0, Math.PI * 2); ctx.fill();
      trendHits.push({ x, y, year: entry.year, value: entry.total, name: currentName });
      if (trendShowRaw.checked) {
        const other = comparison.find((value) => value.year === entry.year);
        if (other) { const otherY = yValue(other.total); ctx.fillStyle = primaryIsRaw ? '#73cfc3' : '#e5b96f'; ctx.beginPath(); ctx.arc(x, otherY, 3, 0, Math.PI * 2); ctx.fill(); trendHits.push({ x, y:otherY, year:other.year, value:other.total, name:comparisonName }); }
      }
      if (index % Math.max(1, Math.ceil(primary.length / 16)) === 0 || entry.year === selectedTrendYear || index === primary.length - 1) { ctx.fillStyle = '#aeb8af'; ctx.textAlign = 'center'; ctx.fillText(String(entry.year), x, box.height - 17); }
    });
    if (trendShowRaw.checked) drawLine(comparison.map((entry) => entry.total), primaryIsRaw ? '#73cfc3' : '#e5b96f', 2, [5, 4]);
  } else {
    visibleYears.forEach((entry, yearIndex) => {
      const color = lineColors[yearIndex]; drawLine(entry.months, color, yearIndex === visibleYears.length - 1 ? 2.8 : 1.6);
      entry.months.forEach((value, month) => { const x=xMonthly(month), y=yValue(value); ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,2.8,0,Math.PI*2);ctx.fill();trendHits.push({x,y,year:entry.year,value,name:monthNames[month]}); });
    });
    const monthlyMean = Array.from({ length:12 }, (_, month) => trendMean(baseline.map((entry) => entry.months[month])));
    const monthlyMedian = Array.from({ length:12 }, (_, month) => trendMedian(baseline.map((entry) => entry.months[month])));
    drawLine(monthlyMean, '#73cfc3', 2, [7, 5]); drawLine(monthlyMedian, '#94a9ff', 2, [3, 4]);
    if (trendShowRaw.checked) {
      const rawYear = comparison.find((entry) => entry.year === selectedTrendYear);
      if (rawYear) { const color=primaryIsRaw?'#73cfc3':'#e5b96f';drawLine(rawYear.months,color,2.2,[5,4]);rawYear.months.forEach((value,month)=>{const x=xMonthly(month),y=yValue(value);ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,2.8,0,Math.PI*2);ctx.fill();trendHits.push({x,y,year:rawYear.year,value,name:`${comparisonName} ${monthNames[month]}`});}); }
    }
    ctx.fillStyle='#aeb8af';ctx.textAlign='center';monthNames.forEach((month,index)=>ctx.fillText(month,xMonthly(index),box.height-17));
  }
  if (!primary.length) { ctx.textAlign='center';ctx.fillStyle='#aeb8af';ctx.fillText('No activity records in this date range and sensor mode.',box.width/2,box.height/2); }
  ctx.textAlign='left';
}

function renderComparison() {
  if (!compareCanvas || !compareRegionA.value || !compareRegionB.value) return;
  const a = monthlySeries(compareRegionA.value), b = monthlySeries(compareRegionB.value);
  const names = [CONFIG.regions.find((r) => r.value === compareRegionA.value).label, CONFIG.regions.find((r) => r.value === compareRegionB.value).label];
  const totals = [a.reduce((x, y) => x + y, 0), b.reduce((x, y) => x + y, 0)];
  compareLegendA.textContent = names[0];
  compareLegendB.textContent = names[1];
  const activityMode = harmonizationMode.selectedOptions[0]?.textContent || 'Harmonized Activity';
  compareSummary.textContent = `Period: ${state.start} to ${state.end} · Measure: total monthly ${activityMode.toLowerCase()} (months overlapping this range) · ${names[0]}: ${Math.round(totals[0]).toLocaleString()} · ${names[1]}: ${Math.round(totals[1]).toLocaleString()}`;
  const box = compareCanvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  compareCanvas.width = Math.max(1, box.width * dpr); compareCanvas.height = Math.max(1, box.height * dpr);
  const ctx = compareCanvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, box.width, box.height);
  const pad = { left: 42, right: 14, top: 20, bottom: 34 }, chartW = box.width-pad.left-pad.right, chartH=box.height-pad.top-pad.bottom;
  const max = Math.max(1, ...a, ...b); ctx.font='10px sans-serif'; ctx.fillStyle='#9da89f'; ctx.strokeStyle='#3a443d';
  for(let i=0;i<=4;i++){const y=pad.top+chartH*i/4;ctx.beginPath();ctx.moveTo(pad.left,y);ctx.lineTo(box.width-pad.right,y);ctx.stroke();ctx.fillText(Math.round(max*(1-i/4)).toLocaleString(),2,y+3);}
  const labels=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const groupW=chartW/12, barW=Math.min(12,groupW*.3);
  for(let i=0;i<12;i++){const x=pad.left+i*groupW+groupW/2;const h1=a[i]/max*chartH,h2=b[i]/max*chartH;ctx.fillStyle='#ff7438';ctx.fillRect(x-barW-1,pad.top+chartH-h1,barW,h1);ctx.fillStyle='#73cfc3';ctx.fillRect(x+1,pad.top+chartH-h2,barW,h2);ctx.fillStyle='#aeb8af';ctx.textAlign='center';ctx.fillText(labels[i],x,box.height-10);}ctx.textAlign='left';
}

function renderLiveFeed() {
  if (!liveFeed || !liveStatus) return;
  const region = CONFIG.regions.find((item) => item.value === state.region);
  document.querySelector('#live-region-label').textContent = region.label.toUpperCase();
  if (!activeProvinceIndex) { liveStatus.textContent = `Loading ${region.label} boundaries…`; return; }
  const mode = harmonizationMode.value;
  const rows = liveRows.filter((row) => pointInProvince(row.lon,row.lat) && (!row.last_fire || row.last_fire >= state.start) && (!row.first_fire || row.first_fire <= state.end) && (mode === 'harmonized' || (mode === 'modis' ? row.source.toUpperCase().includes('MODIS') : row.source.toUpperCase().includes('VIIRS')))).sort((x,y)=>(y.last_fire||'').localeCompare(x.last_fire||'')).slice(0,40);
  liveFeed.replaceChildren();
  if (!rows.length) { liveStatus.textContent = `No matching hotspot cells found for ${region.label} in the selected dates and sensor mode.`; return; }
  liveStatus.textContent = `${rows.length} recent mapped hotspot cells · ${rows[0].year} archive`;
  rows.forEach((row) => {
    const item=document.createElement('li');item.className='live-feed-card';
    const date=document.createElement('time');date.dateTime=row.last_fire;date.textContent=row.last_fire ? new Date(`${row.last_fire}T00:00:00Z`).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'}) : 'Date unavailable';
    const title=document.createElement('strong');title.textContent=`${row.source} · ${row.fire_days} fire days`;
    const detail=document.createElement('span');detail.textContent=`${row.lat.toFixed(2)}°, ${row.lon.toFixed(2)}° · ${row.harmonized_cells} harmonized cell-days · ${Number(row.frp_total_mw).toLocaleString()} MW total FRP`;
    item.append(date,title,detail);liveFeed.append(item);
  });
}

function loadLiveYear() {
  const year = Math.min(2025, Number(state.end.slice(0,4)) || 2025);
  if (year === liveYearRequested) { renderLiveFeed(); return; }
  liveYearRequested=year; liveStatus.textContent=`Loading recent ${year} hotspots…`;
  getYearRows(year).then((rows)=>{if(liveYearRequested!==year)return;liveRows=rows;renderLiveFeed();})
    .catch(()=>{if(liveYearRequested===year)liveStatus.textContent=`Could not load the ${year} hotspot archive.`;});
}
trendCanvas.addEventListener('pointermove', (event) => {
  const rect = trendCanvas.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top;
  let nearest = null, distance = Infinity;
  trendHits.forEach((hit) => { const next = Math.hypot(hit.x - x, hit.y - y); if (next < distance) { nearest = hit; distance = next; } });
  if (!nearest || distance > 18) { trendTooltip.hidden = true; trendCanvas.style.cursor = 'default'; return; }
  trendTooltip.textContent = `${nearest.name} · ${nearest.year} · ${trendNumber(nearest.value)} activity · click to select year`;
  trendTooltip.hidden = false; trendCanvas.style.cursor = 'pointer';
  const wrap = trendCanvas.parentElement.getBoundingClientRect();
  trendTooltip.style.left = `${Math.min(wrap.width - 230, Math.max(8, x + 16))}px`;
  trendTooltip.style.top = `${Math.max(8, y - 42)}px`;
});
trendCanvas.addEventListener('pointerleave', () => { trendTooltip.hidden = true; trendCanvas.style.cursor = 'default'; });
trendCanvas.addEventListener('click', (event) => {
  const rect = trendCanvas.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top;
  const nearest = trendHits.reduce((best, hit) => { const distance = Math.hypot(hit.x-x,hit.y-y); return distance < best.distance ? { hit, distance } : best; }, { hit:null, distance:Infinity });
  if (nearest.hit && nearest.distance <= 18) { selectedTrendYear = nearest.hit.year; trendTooltip.hidden = true; renderTrend(); }
});
trendCanvas.addEventListener('keydown', (event) => {
  if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
  const years = annualSeries(state.region, harmonizationMode.value !== 'harmonized').map((entry) => entry.year);
  if (!years.length) return;
  event.preventDefault();
  const current = Math.max(0, years.indexOf(selectedTrendYear));
  selectedTrendYear = years[Math.min(years.length - 1, Math.max(0, current + (event.key === 'ArrowRight' ? 1 : -1)))];
  trendCanvas.setAttribute('aria-label', `Interactive fire activity trend. Selected year ${selectedTrendYear}. Use arrow keys to change year.`);
  renderTrend();
});
trendDisplay.addEventListener('change', renderTrend);
trendBaseline.addEventListener('change', renderTrend);
trendShowRaw.addEventListener('change', renderTrend);
compareRegionA.addEventListener('change',renderComparison);compareRegionB.addEventListener('change',renderComparison);
window.addEventListener('resize',()=>{renderComparison();renderTrend();});
window.addEventListener('filtersChanged',()=>{if(state.view==='compare')renderComparison();if(state.view==='live')loadLiveYear();if(state.view==='trend')renderTrend();});
harmonizationMode.addEventListener('change',()=>{if(state.view==='compare')renderComparison();if(state.view==='live')renderLiveFeed();if(state.view==='trend')renderTrend();});
function csvValue(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadVisibleCsv() {
  const region = CONFIG.regions.find((item) => item.value === state.region)?.label || state.region;
  const headers = ['Province or territory', 'Year', 'Latitude', 'Longitude', 'Harmonized fire cells', 'Observed fire days', 'Total fire radiative power (MW)', 'First fire date', 'Last fire date', 'Source', 'Peak day'];
  const records = [headers, ...getVisibleRows().map((row) => [region, row.year, row.lat, row.lon, row.harmonized_cells, row.fire_days, row.frp_total_mw, row.first_fire, row.last_fire, row.source, row.peak_day])];
  const csv = `\uFEFF${records.map((record) => record.map(csvValue).join(',')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${state.region}-${mapYearStart.value}-${mapYearEnd.value}-fire-hotspots.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

document.querySelector('#download-csv').addEventListener('click', downloadVisibleCsv);
