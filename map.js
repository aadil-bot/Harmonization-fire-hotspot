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
const harmonizationMode = document.querySelector('#harmonization-mode');
const mapLegendTitle = document.querySelector('#map-legend-title');
const mapYearValue = document.querySelector('#map-year-value');
const mapDataStatus = document.querySelector('#map-data-status');
let mapRows = [];
let initialYearRows = window.MOSAIC_YEAR_ROWS || null;
let fireMap = null;
let fireLayer = null;
let fireBoundaryLayer = null;
let mapRenderer = null;
let requestedYear = 0;
// Province shapes load on demand from Statistics Canada's 2021 generalized
// province/territory boundaries; PRUID links each shape to the sidebar choice.
let activeProvinceFeature = null;
let activeProvinceIndex = null;
let activeRegionValue = null;
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

function pointInProvince(lon, lat) {
  if (!activeProvinceIndex) return false;
  const { buckets, bucketSize } = activeProvinceIndex;
  const candidates = buckets.get(`${Math.floor(lon / bucketSize)}:${Math.floor(lat / bucketSize)}`) || [];
  return candidates.some((polygon) => {
    const b = polygon.bounds;
    if (lon < b.minLon || lon > b.maxLon || lat < b.minLat || lat > b.maxLat) return false;
    if (!pointInRing(lon, lat, polygon.rings[0])) return false;
    return !polygon.rings.slice(1).some((hole) => pointInRing(lon, lat, hole));
  });
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
      if (shouldZoom) fireMap.fitBounds(boundary.getBounds(), { padding: [24, 24] });
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
    }).bindPopup(`<strong>${row.year} · ${row.source}</strong><br>${harmonizationMode.value === 'harmonized' ? 'Harmonized fire cells' : 'Sensor fire days'}: ${activity}<br>${harmonizationMode.value === 'modis' ? 'MODIS before 2012 is calibrated for harmonized comparisons.' : ''}<br>Active: ${row.first_fire} → ${row.last_fire}<br>Total fire radiative power: ${Number(row.frp_total_mw).toLocaleString()} MW<br>Peak day: ${row.peak_day}`).addTo(fireLayer);
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
  const year = Number(mapYear.value);
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
  mapYearValue.value = String(year);
  if (activeProvinceIndex) mapDataStatus.textContent = `${rows.length.toLocaleString()} ${harmonizationMode.options[harmonizationMode.selectedIndex].text.toLowerCase()} in ${region} · ${year}${rows.length ? ` · ${rows[0].source}` : ' · no records for this sensor/year'}`;
}

function setRowsForYear(rows, year) {
  mapRows = rows;
  mapYearValue.value = String(year);
  renderVisibleMap();
}

function loadYear(year) {
  requestedYear = year;
  mapDataStatus.textContent = `Loading ${year} fire cells…`;
  const previous = document.querySelector('#map-year-data');
  if (previous) previous.remove();
  if (initialYearRows && year === 2023) {
    const rows = initialYearRows.map((r) => ({ year: r[0], lat: r[1], lon: r[2], fire_days: r[3], harmonized_cells: r[4], frp_total_mw: r[5], first_fire: r[6], last_fire: r[7], source: r[8], peak_day: r[9] }));
    setRowsForYear(rows, year);
    return;
  }
  window.MOSAIC_YEAR_ROWS = null;
  const script = document.createElement('script');
  script.id = 'map-year-data';
  script.src = `data/map-years/${year}.js`;
  script.onload = () => {
    if (requestedYear !== year) return;
    const rows = (window.MOSAIC_YEAR_ROWS || []).map((r) => ({ year: r[0], lat: r[1], lon: r[2], fire_days: r[3], harmonized_cells: r[4], frp_total_mw: r[5], first_fire: r[6], last_fire: r[7], source: r[8], peak_day: r[9] }));
    setRowsForYear(rows, year);
  };
  script.onerror = () => {
    if (requestedYear === year) mapDataStatus.textContent = `Could not load ${year} fire data. Confirm data/map-years/${year}.js is deployed.`;
  };
  document.head.append(script);
}

if (window.L) {
  fireMap = L.map('fire-map', { preferCanvas: true }).setView([53.5, -113.5], 5);
  mapRenderer = L.canvas({ padding: .5 });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap contributors' }).addTo(fireMap);
  fireBoundaryLayer = L.layerGroup().addTo(fireMap);
  fireLayer = L.layerGroup().addTo(fireMap);
  window.addEventListener('resize', () => fireMap && fireMap.invalidateSize());
}

window.addEventListener('filtersChanged', () => setActiveProvince(true));
window.addEventListener('viewChanged', (event) => { if ((event.detail?.view || event.detail) === 'map') { requestAnimationFrame(() => { if (fireMap) fireMap.invalidateSize(); renderVisibleMap(); }); } });
harmonizationMode.addEventListener('change', () => {
  if (harmonizationMode.value === 'modis') {
    mapYear.min = '2002'; mapYear.max = '2011';
    if (+mapYear.value > 2011) mapYear.value = '2011';
    mapLegendTitle.textContent = 'MODIS HOTSPOTS · OBSERVED FIRE DAYS';
  } else if (harmonizationMode.value === 'viirs') {
    mapYear.min = '2012'; mapYear.max = '2025';
    if (+mapYear.value < 2012) mapYear.value = '2012';
    mapLegendTitle.textContent = 'VIIRS FIRE DAYS';
  } else {
    mapYear.min = '2002'; mapYear.max = '2025';
    mapLegendTitle.textContent = 'HARMONIZED FIRE DAYS';
  }
  loadYear(Number(mapYear.value));
});
mapYear.addEventListener('input', () => loadYear(Number(mapYear.value)));
setActiveProvince(true);
loadYear(Number(mapYear.value));

const compareRegionA = document.querySelector('#compare-region-a');
const compareRegionB = document.querySelector('#compare-region-b');
const compareCanvas = document.querySelector('#compare-chart');
const compareSummary = document.querySelector('#compare-summary');
const liveFeed = document.querySelector('#live-feed');
const liveStatus = document.querySelector('#live-status');
let liveRows = [];
let liveYearRequested = null;

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

function renderComparison() {
  if (!compareCanvas || !compareRegionA.value || !compareRegionB.value) return;
  const a = monthlySeries(compareRegionA.value), b = monthlySeries(compareRegionB.value);
  const names = [CONFIG.regions.find((r) => r.value === compareRegionA.value).label, CONFIG.regions.find((r) => r.value === compareRegionB.value).label];
  const totals = [a.reduce((x, y) => x + y, 0), b.reduce((x, y) => x + y, 0)];
  compareSummary.textContent = `${names[0]}: ${Math.round(totals[0]).toLocaleString()} · ${names[1]}: ${Math.round(totals[1]).toLocaleString()} harmonized fire-cell activity`;
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
  const old=document.querySelector('#live-year-data');if(old)old.remove();
  const script=document.createElement('script');script.id='live-year-data';script.src=`data/map-years/${year}.js`;
  script.onload=()=>{if(liveYearRequested!==year)return;liveRows=(window.MOSAIC_YEAR_ROWS||[]).map(r=>({year:r[0],lat:r[1],lon:r[2],fire_days:r[3],harmonized_cells:r[4],frp_total_mw:r[5],first_fire:r[6],last_fire:r[7],source:r[8],peak_day:r[9]}));renderLiveFeed();};
  script.onerror=()=>{liveStatus.textContent=`Could not load the ${year} hotspot archive.`;};document.head.append(script);
}
compareRegionA.addEventListener('change',renderComparison);compareRegionB.addEventListener('change',renderComparison);
window.addEventListener('resize',renderComparison);
window.addEventListener('filtersChanged',()=>{if(state.view==='compare')renderComparison();if(state.view==='live')loadLiveYear();});
harmonizationMode.addEventListener('change',()=>{if(state.view==='compare')renderComparison();if(state.view==='live')renderLiveFeed();});
window.addEventListener('viewChanged',(event)=>{const view=event.detail?.view||event.detail;if(view==='compare')requestAnimationFrame(renderComparison);if(view==='live')loadLiveYear();});
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
  link.download = `${state.region}-${mapYear.value}-fire-hotspots.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

document.querySelector('#download-csv').addEventListener('click', downloadVisibleCsv);
