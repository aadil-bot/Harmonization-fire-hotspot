// Map page settings and choices live in one object. Add region entries here
// when additional countries or provinces are ready to be explored.
const CONFIG = {
  minDate: '2000-11-01',
  regions: [
    { value: 'dr-congo', label: 'DR Congo' },
  ],
  roles: [
    {
      value: 'early-warning', label: 'Early Warning', description: 'Spot emerging activity and changing trends.',
      insights: ['Watch for new clusters of detections near populated areas.', 'Compare recent activity with the same period in previous years.', 'Share emerging signals with local monitoring teams.'],
    },
    {
      value: 'emergency-response', label: 'Emergency Response', description: 'Support decisions during active incidents.',
      insights: ['Review recent detections alongside incident reports.', 'Prioritize areas with repeated or expanding hotspot activity.', 'Coordinate situational updates with response partners.'],
    },
    {
      value: 'scientist', label: 'Scientist', description: 'Explore patterns for research and analysis.',
      insights: ['Compare seasonal patterns across the selected time range.', 'Consider sensor coverage and confidence when interpreting detections.', 'Use the harmonized record to examine longer-term change.'],
    },
    {
      value: 'land-manager', label: 'Land Manager', description: 'Understand fire activity across managed lands.',
      insights: ['Review activity near managed forests and land boundaries.', 'Look for recurring periods of elevated fire detections.', 'Use local knowledge to interpret possible land-use drivers.'],
    },
    {
      value: 'firefighter', label: 'Firefighter', description: 'Get a wider view of recent and past hotspots.',
      insights: ['Check the timing and distribution of recent detections.', 'Use satellite hotspots as a situational awareness aid.', 'Confirm conditions on the ground before acting on a detection.'],
    },
    {
      value: 'general-view', label: 'General View', description: 'Explore the data with a broad overview.',
      insights: ['Explore where fire activity has been detected in the selected period.', 'Compare the current view with previous seasons.', 'Hotspots indicate satellite detections and are not confirmed fire perimeters.'],
    },
  ],
};

// This object is the live page state shared with map and calendar modules.
const state = { region: 'dr-congo', start: '', end: '', role: 'general-view', view: 'map' };

const controls = {
  start: document.querySelector('#start'),
  end: document.querySelector('#end'),
  region: document.querySelector('#region'),
  role: document.querySelector('#role'),
};
const errorBox = document.querySelector('#filter-error');
const statusMessage = document.querySelector('#status-message');
const dateSummary = document.querySelector('#date-summary');

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

// Mobile filter drawer: keep the button state and scrim in sync.
const drawerToggle = document.querySelector('#drawer-toggle');
const drawerClose = document.querySelector('#drawer-close');
const drawerScrim = document.querySelector('#drawer-scrim');

function setDrawerOpen(open) {
  document.body.classList.toggle('drawer-open', open);
  drawerToggle.setAttribute('aria-expanded', String(open));
  drawerToggle.setAttribute('aria-label', open ? 'Close filters' : 'Open filters');
  drawerScrim.hidden = !open;
  if (open) drawerClose.focus();
  else drawerToggle.focus();
}

drawerToggle.addEventListener('click', () => setDrawerOpen(true));
drawerClose.addEventListener('click', () => setDrawerOpen(false));
drawerScrim.addEventListener('click', () => setDrawerOpen(false));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && document.body.classList.contains('drawer-open')) setDrawerOpen(false);
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

// No hotspot dataset is connected yet; announce that the export control is a placeholder.
document.querySelector('#download-csv').addEventListener('click', () => {
  statusMessage.textContent = 'CSV download will be available when the hotspot dataset is connected.';
});
