// Historical seasonal planning estimate. It is intentionally not presented as
// a weather forecast or as a prediction of a specific fire.
(function () {
  'use strict';

  const form = document.querySelector('#outlook-form');
  if (!form) return;
  const startInput = document.querySelector('#outlook-start');
  const endInput = document.querySelector('#outlook-end');
  const referenceInput = document.querySelector('#outlook-reference');
  const submit = document.querySelector('#outlook-submit');
  const status = document.querySelector('#outlook-status');
  const results = document.querySelector('#outlook-results');
  const summary = document.querySelector('#outlook-summary');
  const metrics = document.querySelector('#outlook-metrics');
  const monthsRoot = document.querySelector('#outlook-months');
  const guidanceTitle = document.querySelector('#outlook-guidance-title');
  const guidance = document.querySelector('#outlook-guidance');
  let lastResult = null;

  function isoToday() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  function addDays(value, count) {
    const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + count); return date.toISOString().slice(0, 10);
  }
  function shiftYear(value, offset) {
    const date = new Date(`${value}T00:00:00Z`), month = date.getUTCMonth();
    date.setUTCFullYear(date.getUTCFullYear() + offset);
    if (date.getUTCMonth() !== month) date.setUTCDate(0);
    return date.toISOString().slice(0, 10);
  }
  function dayCount(start, end) {
    return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) + 1;
  }
  function average(values) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
  function quantile(values, ratio) {
    if (!values.length) return 0;
    const ordered = [...values].sort((a, b) => a - b), index = (ordered.length - 1) * ratio;
    const low = Math.floor(index), part = index - low;
    return ordered[low] + (ordered[Math.min(low + 1, ordered.length - 1)] - ordered[low]) * part;
  }
  function formatNumber(value) { return Math.round(value).toLocaleString(); }
  function formatDate(value) {
    return new Intl.DateTimeFormat(undefined, { year:'numeric', month:'short', day:'numeric', timeZone:'UTC' }).format(new Date(`${value}T00:00:00Z`));
  }
  function activity(regionDaily, date, channel) { return Number(regionDaily[date]?.[channel]) || 0; }

  function validateRange() {
    const tomorrow = addDays(isoToday(), 1);
    const days = dayCount(startInput.value, endInput.value);
    if (startInput.value < tomorrow || endInput.value < startInput.value || days < 1 || days > 90) {
      throw new Error('Choose a future date range between 1 and 90 days.');
    }
    return days;
  }

  async function loadDailyArchive() {
    if (window.MOSAIC_PROVINCE_DAILY) return;
    if (typeof window.loadMosaicProvinceDaily === 'function') return window.loadMosaicProvinceDaily();
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'data/canada/province_daily.js?v=1';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Could not load the provincial historical daily archive.'));
      document.head.append(script);
    });
  }

  function calculate(start, end, days) {
    const regionSelect = document.querySelector('#region');
    const modeSelect = document.querySelector('#harmonization-mode');
    const roleSelect = document.querySelector('#role');
    const region = regionSelect.value;
    const regionLabel = regionSelect.selectedOptions[0]?.textContent || region;
    const mode = modeSelect.value;
    const modeLabel = modeSelect.selectedOptions[0]?.textContent || 'Harmonized Activity';
    const role = roleSelect.value;
    const channel = mode === 'modis' ? 1 : mode === 'viirs' ? 2 : 0;
    const archive = window.MOSAIC_PROVINCE_DAILY_META;
    const regionDaily = window.MOSAIC_PROVINCE_DAILY?.[region];
    if (!archive || !regionDaily) throw new Error('No historical daily data is available for the selected province.');

    const requestedYears = Number(referenceInput.value) || 20;
    const analogs = [];
    for (let offset = 1; offset <= 40 && analogs.length < requestedYears; offset += 1) {
      const historicalStart = shiftYear(start, -offset), historicalEnd = shiftYear(end, -offset);
      if (historicalStart < archive.start || historicalEnd > archive.end) continue;
      const firstYear = Number(historicalStart.slice(0, 4)), lastYear = Number(historicalEnd.slice(0, 4));
      if (mode === 'modis' && lastYear > 2011) continue;
      if (mode === 'viirs' && firstYear < 2012) continue;
      const monthTotals = new Map();
      let total = 0;
      for (let targetDate = start; targetDate <= end; targetDate = addDays(targetDate, 1)) {
        const value = activity(regionDaily, shiftYear(targetDate, -offset), channel);
        total += value;
        const targetMonth = targetDate.slice(0, 7);
        monthTotals.set(targetMonth, (monthTotals.get(targetMonth) || 0) + value);
      }
      analogs.push({ year: firstYear, total, monthTotals });
    }
    if (!analogs.length) throw new Error(`No matching ${modeLabel} seasonal periods are available for these dates.`);

    const annualTotals = new Map();
    Object.entries(regionDaily).forEach(([date, values]) => {
      const year = Number(date.slice(0, 4));
      annualTotals.set(year, (annualTotals.get(year) || 0) + (Number(values[channel]) || 0));
    });
    const referenceYears = [...new Set(analogs.map((item) => item.year))];
    const annualDailyRate = average(referenceYears.map((year) => (annualTotals.get(year) || 0) / 365.25));
    const expected = average(analogs.map((item) => item.total));
    const relativeRate = annualDailyRate ? (expected / days) / annualDailyRate : 0;

    const targetMonths = [];
    for (let date = start; date <= end; date = addDays(date, 1)) {
      const key = date.slice(0, 7);
      if (!targetMonths.includes(key)) targetMonths.push(key);
    }
    const monthly = targetMonths.map((key) => {
      const [year, month] = key.split('-').map(Number);
      const values = analogs.map((item) => item.monthTotals.get(key) || 0);
      const daysInTargetMonth = month === Number(end.slice(5, 7)) && year === Number(end.slice(0, 4))
        ? Number(end.slice(8, 10))
        : new Date(Date.UTC(year, month, 0)).getUTCDate();
      const firstDay = year === Number(start.slice(0, 4)) && month === Number(start.slice(5, 7)) ? Number(start.slice(8, 10)) : 1;
      return {
        label: new Intl.DateTimeFormat(undefined, { month:'long', year:'numeric', timeZone:'UTC' }).format(new Date(Date.UTC(year, month - 1, 1))),
        days: Math.max(0, daysInTargetMonth - firstDay + 1),
        mean: average(values), median: quantile(values, .5),
      };
    });
    // Correct the displayed day count for months between the start and end.
    monthly.forEach((item, index) => {
      const key = targetMonths[index];
      let count = 0;
      for (let date = start; date <= end; date = addDays(date, 1)) if (date.startsWith(key)) count += 1;
      item.days = count;
    });

    return {
      region, regionLabel, modeLabel, role, start, end, days, analogs, monthly,
      expected,
      median: quantile(analogs.map((item) => item.total), .5),
      low: quantile(analogs.map((item) => item.total), .25),
      high: quantile(analogs.map((item) => item.total), .75),
      relativeRate,
    };
  }

  function renderGuidance(result) {
    const role = document.querySelector('#role').value;
    const roleLabel = document.querySelector('#role').selectedOptions[0]?.textContent || 'General View';
    const advice = {
      'general-view': 'Use the month estimates to compare seasonal timing with the calendar and map. They describe historical patterns and do not predict specific fires.',
      'emergency-response': 'Use historically active periods for readiness planning. Check current provincial alerts and weather forecasts before operational decisions; this page has no live weather or incident feed.',
      scientist: `Compare this ${result.modeLabel} baseline with other years and review sensor coverage and calibration before drawing conclusions.`,
      'land-manager': 'Use recurring seasonal patterns to time planning reviews, then add local land-cover, fuel, and management information.',
      firefighter: 'This seasonal estimate does not identify an active incident. Check current dispatch, local reports, and map detections for operational information.',
    };
    document.querySelector('#outlook-guidance-title').textContent = `Preparedness context · ${roleLabel}`;
    document.querySelector('#outlook-guidance').textContent = advice[role] || advice['general-view'];
  }

  function display(result) {
    lastResult = result;
    const ratio = result.relativeRate;
    const level = ratio >= 1.5 ? ['Elevated', 'is-elevated'] : ratio >= 1.1 ? ['Above typical', 'is-typical'] : ratio <= .75 ? ['Below annual rate', 'is-lower'] : ['Typical', 'is-typical'];
    const statCards = [
      ['Expected activity', formatNumber(result.expected), 'Historical mean for this date range'],
      ['Typical historical range', `${formatNumber(result.low)}–${formatNumber(result.high)}`, '25th–75th percentile of analogues'],
      ['Historical median', formatNumber(result.median), `${result.analogs.length} matched periods`],
      ['Seasonal activity indicator', level[0], `${ratio.toFixed(1)}× the annual daily rate`],
    ];
    const metricsRoot = document.querySelector('#outlook-metrics');
    metricsRoot.replaceChildren();
    statCards.forEach(([label, value, hint], index) => {
      const card = document.createElement('article'); card.className = `outlook-metric${index === 3 ? ` ${level[1]}` : ''}`;
      const title = document.createElement('span'); title.textContent = label;
      const amount = document.createElement('strong'); amount.textContent = value;
      const note = document.createElement('small'); note.textContent = hint;
      card.append(title, amount, note); metricsRoot.append(card);
    });
    const years = result.analogs.map((item) => item.year);
    document.querySelector('#outlook-summary').textContent = `${result.regionLabel} · ${formatDate(result.start)} to ${formatDate(result.end)} · ${result.modeLabel} · ${result.analogs.length} matching historical periods (${Math.min(...years)}–${Math.max(...years)}).`;
    const monthRoot = document.querySelector('#outlook-months'); monthRoot.replaceChildren();
    result.monthly.forEach((month) => {
      const card = document.createElement('article'); card.className = 'outlook-month';
      const name = document.createElement('span'); name.textContent = month.label;
      const estimate = document.createElement('strong'); estimate.textContent = formatNumber(month.mean);
      const note = document.createElement('small'); note.textContent = `Median ${formatNumber(month.median)} · ${month.days} days`;
      card.append(name, estimate, note); monthRoot.append(card);
    });
    renderGuidance(result);
    document.querySelector('#outlook-results').hidden = false;
    status.textContent = 'Historical seasonal estimate ready. The activity indicator is a seasonality comparison, not a fire probability.';
  }

  const tomorrow = addDays(isoToday(), 1);
  startInput.min = tomorrow; startInput.max = addDays(isoToday(), 365); startInput.value = tomorrow;
  endInput.min = tomorrow; endInput.max = addDays(tomorrow, 89); endInput.value = addDays(tomorrow, 6);
  startInput.addEventListener('change', () => {
    endInput.min = startInput.value;
    endInput.max = addDays(startInput.value, 89);
    if (endInput.value < startInput.value) endInput.value = startInput.value;
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    document.querySelector('#outlook-results').hidden = true;
    try {
      validateRange();
      status.textContent = 'Loading historical daily provincial data…'; submit.disabled = true;
      await loadDailyArchive();
      const days = validateRange();
      display(calculate(startInput.value, endInput.value, days));
    } catch (error) {
      status.textContent = error.message || 'Could not create the seasonal outlook.';
      document.querySelector('#outlook-results').hidden = true;
    } finally { submit.disabled = false; }
  });
  window.addEventListener('filtersChanged', (event) => {
    if (!lastResult) return;
    const detail = event.detail || {};
    if (detail.region && detail.region !== lastResult.region) {
      lastResult = null; document.querySelector('#outlook-results').hidden = true;
      status.textContent = 'Province changed. Generate the outlook again for the selected province.';
    } else renderGuidance(lastResult);
  });
  document.querySelector('#harmonization-mode').addEventListener('change', () => {
    if (!lastResult) return;
    lastResult = null; document.querySelector('#outlook-results').hidden = true;
    status.textContent = 'Activity data mode changed. Generate the outlook again to refresh the estimate.';
  });
})();
