// Keep the date bounds and selectable options together so the page can grow
// without changing the form's validation and navigation logic.
const CONFIG = {
  minDate: '2000-11-01',
  regions: [
    { value: 'dr-congo', label: 'DR Congo' },
    // Add regions or province entries here as they become available.
  ],
  roles: [
    { value: 'general-view', label: 'General View', description: 'Interactive hotspot map, current versus historical fire activity, 7-day weather outlook, and regional hotspot counts.' },
    { value: 'emergency-response', label: 'Emergency Response', description: 'Fire-weather conditions, recent hotspot activity and anomalies, preparedness indicators, nearby incidents, and resource-readiness reviews.' },
    { value: 'scientist', label: 'Scientists', description: 'Before-and-after harmonization charts, historical anomaly analysis, sensor calibration, and model validation.' },
    { value: 'land-manager', label: 'Land Managers', description: 'Burning frequency, seasonal hotspot calendar, vegetation and land-cover overlays, recurring activity, and planning recommendations.' },
    { value: 'firefighter', label: 'Firefighters', description: 'Latest satellite detections, coordinates and timestamps, detection confidence and FRP, weather overlays, and incident verification.' },
  ],
};

const form = document.querySelector('#setup-form');
const startInput = document.querySelector('#start');
const endInput = document.querySelector('#end');
const regionSelect = document.querySelector('#region');
const roleSelect = document.querySelector('#role');
const errorMessage = document.querySelector('#form-error');

// Use the visitor's local calendar date as the latest selectable date.
function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function populateOptions(select, options, formatOption) {
  options.forEach((option) => {
    const element = document.createElement('option');
    element.value = option.value;
    element.textContent = formatOption(option);
    select.append(element);
  });
}

const today = getLocalDateString();
startInput.min = CONFIG.minDate;
startInput.max = today;
endInput.min = CONFIG.minDate;
endInput.max = today;

populateOptions(regionSelect, CONFIG.regions, (region) => region.label);
populateOptions(roleSelect, CONFIG.roles, (role) => `${role.label} — ${role.description}`);

// Start with the full supported record so the map and calendar include the
// historical data from its first available date. Visitors can narrow it later.
startInput.value = CONFIG.minDate;
endInput.value = today;

function showError(message, focusTarget) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
  if (focusTarget) focusTarget.focus();
}

function clearError() {
  errorMessage.textContent = '';
  errorMessage.hidden = true;
}

// Shared validated navigation for both primary actions.
function goToApp(view) {
  clearError();

  const start = startInput.value;
  const end = endInput.value;
  const dates = [
    { input: startInput, value: start, label: 'Start date' },
    { input: endInput, value: end, label: 'End date' },
  ];

  for (const date of dates) {
    if (!date.value) {
      showError(`Please choose a ${date.label.toLowerCase()}.`, date.input);
      return false;
    }
    if (date.value < CONFIG.minDate || date.value > today) {
      showError(`${date.label} must be between November 1, 2000 and today.`, date.input);
      return false;
    }
  }

  if (start > end) {
    showError('Start date must be on or before the end date.', startInput);
    return false;
  }
  if (!CONFIG.regions.some((region) => region.value === regionSelect.value)) {
    showError('Please choose an available region.', regionSelect);
    return false;
  }
  if (!CONFIG.roles.some((role) => role.value === roleSelect.value)) {
    showError('Please choose a role.', roleSelect);
    return false;
  }

  const params = new URLSearchParams({
    region: regionSelect.value,
    start,
    end,
    role: roleSelect.value,
    view: view === 'calendar' ? 'calendar' : 'map',
  });
  window.location.href = `map.html?${params.toString()}`;
  return true;
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const requestedView = event.submitter?.dataset.view || 'map';
  goToApp(requestedView);
});

// Clear stale errors as soon as the user edits a field.
form.addEventListener('input', clearError);
form.addEventListener('change', clearError);
