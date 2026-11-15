// Keep the date bounds and selectable options together so the page can grow
// without changing the form's validation and navigation logic.
const CONFIG = {
  minDate: '2000-11-01',
  // A one-month landing window keeps the first map fast while leaving a
  // December 2025 hotspot sample visible in the default Alberta view.
  defaultStartDate: '2025-12-01',
  defaultEndDate: '2025-12-31',
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
    { value: 'general-view', label: 'General View', description: 'Overall hotspot map, historical burning calendar, fire activity statistics, historical trends, and seasonal patterns.' },
    { value: 'emergency-response', label: 'Emergency Response', description: 'Recent archived hotspots, regional historical anomalies, preparedness indicators, suggested actions, and historical seasonal outlooks. Live weather forecasts are not connected.' },
    { value: 'scientist', label: 'Scientists', description: 'Raw MODIS and VIIRS observations, harmonized comparisons, sensor calibration, historical trends, and research data exports.' },
    { value: 'land-manager', label: 'Land Managers', description: 'Seasonal burning patterns, recurring hotspots, regional fire history, management context, and historical seasonal outlooks.' },
    { value: 'firefighter', label: 'Firefighters', description: 'Archived hotspot locations, dates, and FRP. Detection confidence and live environmental conditions are not provided in the current archive.' },
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

// Begin with a lightweight recent period; visitors can expand it as needed.
startInput.value = CONFIG.defaultStartDate;
endInput.value = CONFIG.defaultEndDate;

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

// Keep the decorative preview idle until it is on screen and the tab is active.
const previewWindow = document.querySelector('.preview-window');
if (previewWindow && 'IntersectionObserver' in window) {
  let previewIsVisible = false;
  const updatePreviewMotion = () => {
    previewWindow.classList.toggle('is-paused', !previewIsVisible || document.hidden);
  };
  const previewObserver = new IntersectionObserver((entries) => {
    previewIsVisible = entries.some((entry) => entry.isIntersecting);
    updatePreviewMotion();
  }, { threshold: 0.08 });
  previewObserver.observe(previewWindow);
  document.addEventListener('visibilitychange', updatePreviewMotion);
}
