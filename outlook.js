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
  const guidanceTitle = document.querySelector('#outlook-guidance-title');
  const guidance = document.querySelector('#outlook-guidance');
  const workedExample = document.querySelector('#outlook-example');
  const historyChart = document.querySelector('#outlook-history-chart');
  const monthChart = document.querySelector('#outlook-month-chart');
  const monthChartNote = document.querySelector('#outlook-month-chart-note');
  const horizonNote = document.querySelector('#outlook-horizon');
  const roleStyles = {
    'general-view': { accent: '#ff8750', focus: 'expected', label: 'General View' },
    'emergency-response': { accent: '#ff695f', focus: 'indicator', label: 'Emergency Response' },
    scientist: { accent: '#71bfff', focus: 'range', label: 'Scientists' },
    'land-manager': { accent: '#77d3a8', focus: 'monthly', label: 'Land Managers' },
    firefighter: { accent: '#f0c96b', focus: 'median', label: 'Firefighters' },
  };
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
      const monthLastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const daysInTargetMonth = month === Number(end.slice(5, 7)) && year === Number(end.slice(0, 4))
        ? Number(end.slice(8, 10))
        : monthLastDay;
      const firstDay = year === Number(start.slice(0, 4)) && month === Number(start.slice(5, 7)) ? Number(start.slice(8, 10)) : 1;
      const selectedFirstDate = key === start.slice(0, 7) ? start : `${key}-01`;
      const selectedLastDate = key === end.slice(0, 7) ? end : `${key}-${String(monthLastDay).padStart(2, '0')}`;
      return {
        label: new Intl.DateTimeFormat(undefined, { month:'long', year:'numeric', timeZone:'UTC' }).format(new Date(Date.UTC(year, month - 1, 1))),
        days: Math.max(0, daysInTargetMonth - firstDay + 1),
        firstDate: selectedFirstDate, lastDate: selectedLastDate, fullMonthDays: monthLastDay,
        mean: average(values), median: quantile(values, .5), low: quantile(values, .25), high: quantile(values, .75),
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
      annualDailyRate,
      windowDailyRate: expected / days,
    };
  }

  function renderGuidance(result) {
    const role = document.querySelector('#role').value;
    const style = roleStyles[role] || roleStyles['general-view'];
    const highMonths = [...result.monthly].sort((a, b) => b.mean - a.mean).slice(0, 2).map((month) => month.label);
    const rangeText = `${formatNumber(result.low)} to ${formatNumber(result.high)} activity units`;
    const averageText = formatNumber(result.expected);
    const medianText = formatNumber(result.median);
    const interpretation = {
      'general-view': `For this ${result.days}-day window, the historical mean is ${averageText} activity units and the median is ${medianText}. The middle half of matched periods ranged from ${rangeText}. A mean above the median suggests a few higher-activity years pull the average upward; use the year bars and month profile to see when those differences occurred.`,
      'emergency-response': `The selected window averages ${averageText} activity units across matched years, with the middle half between ${rangeText}. The seasonal indicator compares its average daily activity with the full-year daily baseline; ${result.relativeRate.toFixed(1)}x means the historical rate for these dates was ${result.relativeRate.toFixed(1)} times that baseline, not a fire probability or current threat level. Use this only for advance readiness planning.`,
      scientist: `In ${result.modeLabel}, the mean is ${averageText} and the median is ${medianText}; the interquartile interval is ${rangeText} across ${result.analogs.length} date-matched periods. If the mean is higher than the median, inspect the year bars for influential high years. This spread describes the archive sample, not a confidence interval; compare sensor modes and calibration before interpreting differences.`,
      'land-manager': `The strongest historical months within this selected window are ${highMonths.join(' and ') || 'not available'}. Their values are averages across matched years; the monthly range marks year-to-year variation. Use that recurring timing to schedule planning reviews, then combine it with local fuels, land cover, and management information.`,
      firefighter: `The historical median for this date window is ${medianText} activity units and the middle half ranged from ${rangeText}. These figures summarize past satellite activity for the selected province and dates; they do not locate a future incident, report current conditions, or supply dispatch confidence. Treat the estimate as background context only.`,
    };
    guidanceTitle.textContent = `${style.label}: how to read this outlook`;
    guidance.textContent = interpretation[role] || interpretation['general-view'];

    const lowestPeriod = result.analogs.reduce((lowest, period) => period.total < lowest.total ? period : lowest, result.analogs[0]);
    const highestPeriod = result.analogs.reduce((highest, period) => period.total > highest.total ? period : highest, result.analogs[0]);
    const peakMonth = [...result.monthly].sort((a, b) => b.mean - a.mean)[0];
    const workedExamples = {
      'general-view': `Example from this result: ${highestPeriod.year} had ${formatNumber(highestPeriod.total)} activity units in these same dates, while ${lowestPeriod.year} had ${formatNumber(lowestPeriod.total)}. The ${formatNumber(result.expected)} expected value is the average across all ${result.analogs.length} comparison years, not a promise for the selected future dates.`,
      'emergency-response': `Example: the matching dates averaged ${result.windowDailyRate.toFixed(2)} activity units per day, against ${result.annualDailyRate.toFixed(2)} for an average day across the year. That produces ${result.relativeRate.toFixed(1)}x. A value above 1 means historically busier dates; it does not say a fire will occur or that conditions are dangerous now.`,
      scientist: `Example from the selected ${result.modeLabel} series: ${highestPeriod.year} is the high analogue at ${formatNumber(highestPeriod.total)}, while ${lowestPeriod.year} is the low at ${formatNumber(lowestPeriod.total)}. Compare those bars with the ${formatNumber(result.median)} median and ${formatNumber(result.expected)} mean to see whether a few high years pull the average upward.`,
      'land-manager': `Example: ${peakMonth?.label || 'The peak month'} has the largest mean in the selected window (${formatNumber(peakMonth?.mean || 0)} units); its middle-half range is ${formatNumber(peakMonth?.low || 0)} to ${formatNumber(peakMonth?.high || 0)}. That points to a recurring planning period in the archive, not a forecast of local fuel conditions.`,
      firefighter: `Example: the ${highestPeriod.year} comparison bar means ${formatNumber(highestPeriod.total)} activity units were recorded across the province in those same historical dates. It does not give a future hotspot coordinate, confidence score, or active incident; use current dispatch and detection feeds for those.`,
    };
    workedExample.textContent = workedExamples[role] || workedExamples['general-view'];

    let horizon;
    if (result.days <= 3) horizon = '1-3 days ahead: a short matching-date comparison. It still uses historical analogues only; there is no live weather or recent-activity input.';
    else if (result.days <= 7) horizon = '4-7 days ahead: use the matched seasonal history as context. This is not a weather-informed operational forecast.';
    else if (result.days <= 14) horizon = '8-14 days ahead: year-to-year spread becomes especially useful; daily conditions are not represented.';
    else if (result.days <= 30) horizon = '15-30 days ahead: treat the result as seasonal planning context and give more weight to the range than a single average.';
    else horizon = '31-90 days ahead: this is a broad seasonal comparison. Longer horizons do not add predictive certainty; the historical range shows how variable the matching periods were.';
    horizonNote.textContent = `Selected horizon: ${result.days} days. ${horizon}`;
  }

  function drawHistoricalChart(result) {
    historyChart.replaceChildren();
    historyChart.setAttribute('aria-label', `Historical activity for ${result.analogs.length} matched periods from ${Math.min(...result.analogs.map((item) => item.year))} to ${Math.max(...result.analogs.map((item) => item.year))}. Each bar is the total for the selected month and day range.`);
    const maximum = Math.max(1, ...result.analogs.map((item) => item.total));
    result.analogs.forEach((item) => {
      const column = document.createElement('div'); column.className = 'outlook-history-column';
      const amount = document.createElement('span'); amount.className = 'outlook-chart-value'; amount.textContent = formatNumber(item.total);
      const track = document.createElement('span'); track.className = 'outlook-history-track';
      const bar = document.createElement('span'); bar.className = 'outlook-history-bar'; bar.style.height = `${Math.max(2, item.total / maximum * 100)}%`;
      track.append(bar);
      const year = document.createElement('span'); year.className = 'outlook-chart-label'; year.textContent = String(item.year);
      column.title = `${item.year}: ${formatNumber(item.total)} activity units for the matched dates`;
      column.append(amount, track, year); historyChart.append(column);
    });
  }

  function drawMonthChart(result) {
    monthChart.replaceChildren();
    const maximum = Math.max(1, ...result.monthly.flatMap((item) => [item.high, item.mean]));
    monthChart.setAttribute('aria-label', `Historical averages and middle-half ranges for the selected future dates in ${result.regionLabel}, compared with the same calendar dates in earlier years.`);
    const explanations = [];
    result.monthly.forEach((month) => {
      const row = document.createElement('div'); row.className = 'outlook-range-row';
      const label = document.createElement('span'); label.className = 'outlook-range-label'; label.textContent = month.label;
      const track = document.createElement('span'); track.className = 'outlook-range-track';
      const band = document.createElement('span'); band.className = 'outlook-range-band';
      band.style.left = `${Math.max(0, month.low / maximum * 100)}%`;
      band.style.width = `${Math.max(1, (month.high - month.low) / maximum * 100)}%`;
      const mean = document.createElement('span'); mean.className = 'outlook-range-mean';
      mean.style.left = `${Math.min(100, Math.max(0, month.mean / maximum * 100))}%`;
      track.append(band, mean);
      const values = document.createElement('span'); values.className = 'outlook-range-values';
      values.textContent = `Average ${formatNumber(month.mean)} | middle half ${formatNumber(month.low)}-${formatNumber(month.high)}`;
      row.title = `${month.label}: mean ${formatNumber(month.mean)}, median ${formatNumber(month.median)}, middle 50% ${formatNumber(month.low)} to ${formatNumber(month.high)} activity units`;
      row.append(label, track, values); monthChart.append(row);
      if (month.mean > month.high) explanations.push(`${month.label}: the average (${formatNumber(month.mean)}) is above the middle-half band (${formatNumber(month.low)}-${formatNumber(month.high)}). A few busier past periods are pulling the average up; the median is ${formatNumber(month.median)}.`);
      else if (month.mean < month.low) explanations.push(`${month.label}: the average (${formatNumber(month.mean)}) is below the middle-half band (${formatNumber(month.low)}-${formatNumber(month.high)}). A few quieter past periods are pulling the average down; the median is ${formatNumber(month.median)}.`);
      else explanations.push(`${month.label}: the average (${formatNumber(month.mean)}) falls within the middle-half band (${formatNumber(month.low)}-${formatNumber(month.high)}), so it is close to the range seen in many past matching periods.`);
    });
    monthChartNote.textContent = explanations.join(' ');
    const axis = document.createElement('div'); axis.className = 'outlook-range-axis';
    axis.append(document.createElement('span'));
    const ticks = document.createElement('span'); ticks.className = 'outlook-range-ticks';
    [0, .25, .5, .75, 1].forEach((ratio) => {
      const tick = document.createElement('span'); tick.textContent = formatNumber(maximum * ratio); ticks.append(tick);
    });
    axis.append(ticks, document.createElement('span'));
    monthChart.append(axis);
  }

  function viewpointInterpretation(key, role, result) {
    const highest = result.analogs.reduce((best, item) => item.total > best.total ? item : best, result.analogs[0]);
    const lowest = result.analogs.reduce((best, item) => item.total < best.total ? item : best, result.analogs[0]);
    const peakMonth = [...result.monthly].sort((a, b) => b.mean - a.mean)[0];
    const gap = Math.abs(result.expected - result.median);
    const gapDirection = result.expected > result.median ? 'above' : result.expected < result.median ? 'below' : 'the same as';
    const spread = result.high - result.low;
    const differencePercent = (result.relativeRate - 1) * 100;
    const ratePhrase = Math.abs(differencePercent) < 1
      ? 'about the same as' : `${Math.abs(differencePercent).toFixed(0)}% ${differencePercent > 0 ? 'higher than' : 'lower than'}`;

    const interpretations = {
      expected: {
        'general-view': `The ${formatNumber(result.expected)} mean is ${gapDirection} the ${formatNumber(result.median)} median by ${formatNumber(gap)} units. ${highest.year} is the busiest matched year (${formatNumber(highest.total)} units), so check the bars to see how much that year influences the average.`,
        'emergency-response': `Treat ${formatNumber(result.expected)} as a historical planning baseline for these dates. The busiest analogue was ${highest.year} at ${formatNumber(highest.total)} units; comparing that year with the middle range helps frame how much readiness has varied, without turning this value into an alert threshold.`,
        scientist: `The ${result.modeLabel} mean (${formatNumber(result.expected)}) is ${gapDirection} its median (${formatNumber(result.median)}) by ${formatNumber(gap)} units. The difference signals possible skew from high or low years; inspect ${highest.year} (${formatNumber(highest.total)}) and ${lowest.year} (${formatNumber(lowest.total)}) before comparing sensor modes.`,
        'land-manager': `This is the average activity across the selected seasonal window. ${peakMonth?.label || 'The peak month'} contributes the highest monthly mean (${formatNumber(peakMonth?.mean || 0)} units), which can help time planning reviews; local fuels and land conditions still need separate assessment.`,
        firefighter: `${formatNumber(result.expected)} is a province-wide historical average for the selected dates. For example, ${highest.year} recorded ${formatNumber(highest.total)} units in its matching period; neither figure identifies a current incident or its location.`,
      },
      range: {
        'general-view': `The middle half spans ${formatNumber(spread)} units, from ${formatNumber(result.low)} to ${formatNumber(result.high)}. For example, ${lowest.year} (${formatNumber(lowest.total)}) and ${highest.year} (${formatNumber(highest.total)}) show why the same dates can differ across years.`,
        'emergency-response': `The historical middle-half band is ${formatNumber(result.low)}-${formatNumber(result.high)} units, a spread of ${formatNumber(spread)}. A wide band means past seasons varied substantially, so use flexible readiness planning rather than treating the upper edge as a warning trigger.`,
        scientist: `The interquartile spread is ${formatNumber(spread)} units (${formatNumber(result.low)}-${formatNumber(result.high)}) across the matched sample. This describes observed dispersion; it is not a confidence interval, and it does not include uncertainty from sensor processing or missing data.`,
        'land-manager': `Past matching periods ranged across a ${formatNumber(spread)}-unit middle band. For scheduling, a wider band means the recurring season was less consistent and plans may need room to adapt year to year.`,
        firefighter: `The middle half of historical provincial totals is ${formatNumber(result.low)}-${formatNumber(result.high)} units. This band is about regional past activity, not a safety radius or a range for an individual fire.`,
      },
      median: {
        'general-view': `${formatNumber(result.median)} is the midpoint: about half of the matched periods were lower and half higher. The mean is ${formatNumber(result.expected)}, so the ${formatNumber(gap)}-unit gap shows the average's sensitivity to unusually active years.`,
        'emergency-response': `Use ${formatNumber(result.median)} as the central historical comparison for these dates, alongside the ${formatNumber(result.high)}-unit upper quartile. It is a planning reference from past seasons, not a response target.`,
        scientist: `The mean is ${formatNumber(gap)} units ${gapDirection} the median. That gap can reveal skew: compare the ${formatNumber(result.median)} midpoint with high analogue ${highest.year} (${formatNumber(highest.total)}) and low analogue ${lowest.year} (${formatNumber(lowest.total)}).`,
        'land-manager': `The midpoint is ${formatNumber(result.median)} units; unlike the mean, it is less pulled by an unusually active season. Use it as a steady historical comparator, and use the monthly chart to locate recurring timing.`,
        firefighter: `${formatNumber(result.median)} is the middle provincial total among the matched past periods. It cannot tell you whether a specific location has a fire; use current detection and dispatch systems for incident details.`,
      },
      indicator: {
        'general-view': `At ${result.relativeRate.toFixed(1)}x the annual daily rate, this date window was historically ${ratePhrase} a typical day in those same years. This compares seasonal timing; it is not a probability of fire.`,
        'emergency-response': `The selected dates averaged ${result.windowDailyRate.toFixed(2)} units/day versus ${result.annualDailyRate.toFixed(2)} for a full-year day. That historical ${result.relativeRate.toFixed(1)}x rate can inform seasonal readiness reviews, but it is not a live danger rating.`,
        scientist: `This is a normalized rate: ${result.windowDailyRate.toFixed(2)} units/day for the selected window divided by ${result.annualDailyRate.toFixed(2)} units/day across the year. It supports comparing date windows of different lengths; it is not a model probability.`,
        'land-manager': `The historical rate for these dates was ${ratePhrase} the full-year daily rate (${result.relativeRate.toFixed(1)}x). Use it to identify a season worth reviewing earlier, then verify current site and fuel conditions locally.`,
        firefighter: `The ${result.relativeRate.toFixed(1)}x value describes historical seasonal intensity only. It does not indicate today's conditions or activate an incident response; consult current dispatch and weather information.`,
      },
    };
    return interpretations[key]?.[role] || interpretations[key]?.['general-view'] || '';
  }

  function display(result) {
    lastResult = result;
    const ratio = result.relativeRate;
    const level = ratio >= 1.5 ? ['Elevated', 'is-elevated'] : ratio >= 1.1 ? ['Above typical', 'is-typical'] : ratio <= .75 ? ['Below annual rate', 'is-lower'] : ['Typical', 'is-typical'];
    const role = document.querySelector('#role').value;
    const style = roleStyles[role] || roleStyles['general-view'];
    const statCards = [
      { key: 'expected', label: 'Expected activity', value: formatNumber(result.expected), calc: 'Mean (average) of each matched historical period.', example: `${result.analogs.length} past date-matched totals are averaged; their average is ${formatNumber(result.expected)} activity units for a ${result.days}-day window.`, reason: { 'general-view': 'A concise summary of typical activity for your selected dates.', 'emergency-response': 'Provides a broad seasonal planning reference, not a current incident count.', scientist: 'The arithmetic mean is sensitive to unusually high years; compare it with the median.', 'land-manager': 'Shows average activity over the season window for timing plans.', firefighter: 'Historical background only; it is not a live detection total.' } },
      { key: 'range', label: 'Typical historical range', value: `${formatNumber(result.low)} - ${formatNumber(result.high)}`, calc: '25th to 75th percentiles: the middle half of matched periods.', example: `Here, the middle half of the historical totals falls from ${formatNumber(result.low)} to ${formatNumber(result.high)}; totals outside this band still occurred.`, reason: { 'general-view': 'Shows how much the same dates have varied across years.', 'emergency-response': 'Use the upper end as a historical busy-season reference, not a trigger threshold.', scientist: 'Summarizes sample spread without assuming a statistical confidence interval.', 'land-manager': 'Shows the variation to expect when planning for a recurring season.', firefighter: 'Makes year-to-year variability visible; it cannot bound future incident risk.' } },
      { key: 'median', label: 'Historical median', value: formatNumber(result.median), calc: 'Middle value after sorting the matched period totals.', example: `When the ${result.analogs.length} past totals are ordered, the midpoint is ${formatNumber(result.median)}; about half are lower and half are higher.`, reason: { 'general-view': 'A typical midpoint that is less affected by extreme seasons than the mean.', 'emergency-response': 'A central seasonal reference alongside the upper historical range.', scientist: 'Compare with the mean to identify skew from high-activity analogue years.', 'land-manager': 'A robust midpoint for recurring seasonal planning.', firefighter: 'A central historic comparator, not a prediction for a specific response area.' } },
      { key: 'indicator', label: 'Seasonal activity indicator', value: level[0], calc: `${ratio.toFixed(1)}x the matched years' full-year daily activity rate.`, example: `${result.windowDailyRate.toFixed(2)} units/day in this date window divided by ${result.annualDailyRate.toFixed(2)} units/day across the full year = ${ratio.toFixed(1)}x.`, reason: { 'general-view': 'Puts this date window in context with a typical day across the whole year.', 'emergency-response': 'Highlights historically busier seasonal timing for advance preparedness.', scientist: 'A normalized rate comparison that helps account for the season window length.', 'land-manager': 'Indicates whether these dates have historically been busier than an average day.', firefighter: 'Seasonal context only; it is not a live alert or fire probability.' } },
    ];
    const metricsRoot = document.querySelector('#outlook-metrics');
    const resultsRoot = document.querySelector('#outlook-results');
    resultsRoot.dataset.role = role;
    resultsRoot.style.setProperty('--outlook-accent', style.accent);
    monthChart.closest('.outlook-chart-panel').classList.toggle('is-viewpoint-focus', style.focus === 'monthly');
    metricsRoot.replaceChildren();
    statCards.forEach((stat) => {
      const card = document.createElement('article'); card.className = `outlook-metric${stat.key === style.focus ? ' is-viewpoint-focus' : ''}${stat.key === 'indicator' ? ` ${level[1]}` : ''}`;
      card.dataset.metric = stat.key;
      const title = document.createElement('span'); title.className = 'outlook-metric-title'; title.textContent = stat.label;
      const amount = document.createElement('strong'); amount.textContent = stat.value;
      const calculation = document.createElement('small'); calculation.textContent = `Calculation: ${stat.calc}`;
      const example = document.createElement('small'); example.className = 'outlook-metric-example'; example.textContent = `Example: ${stat.example}`;
      const why = document.createElement('small'); why.className = 'outlook-metric-why'; why.textContent = `Interpretation for ${style.label}: ${viewpointInterpretation(stat.key, role, result)}`;
      card.append(title, amount, calculation, example, why); metricsRoot.append(card);
    });
    const years = result.analogs.map((item) => item.year);
    document.querySelector('.outlook-color-key span').style.backgroundColor = style.accent;
    document.querySelector('.outlook-color-key').lastChild.textContent = ` Colored outline marks the ${style.focus === 'monthly' ? 'monthly pattern' : statCards.find((item) => item.key === style.focus).label.toLowerCase()} most relevant to ${style.label}. The calculations are unchanged across roles.`;
    document.querySelector('#outlook-summary').textContent = `${result.regionLabel} | ${formatDate(result.start)} to ${formatDate(result.end)} | ${result.modeLabel} | ${result.days} future days | ${result.analogs.length} matching historical periods (${Math.min(...years)}-${Math.max(...years)}).`;
    const monthRoot = document.querySelector('#outlook-months'); monthRoot.replaceChildren();
    const monthExplanation = document.querySelector('#outlook-month-explanation');
    monthExplanation.textContent = result.monthly.map((month) => {
      const coverage = month.days === month.fullMonthDays ? 'a full-month total' : 'a partial-month total, not a full-month total';
      return `${month.label} uses ${formatDate(month.firstDate)} to ${formatDate(month.lastDate)} (${month.days} days). For example, the mean ${formatNumber(month.mean)} is the average sum for those same dates in the matched years; it is ${coverage}.`;
    }).join(' ');
    result.monthly.forEach((month) => {
      const card = document.createElement('article'); card.className = 'outlook-month';
      const name = document.createElement('span'); name.textContent = month.label;
      const estimate = document.createElement('strong'); estimate.textContent = formatNumber(month.mean);
      const note = document.createElement('small'); note.textContent = `${month.days} selected days | median ${formatNumber(month.median)} | middle half ${formatNumber(month.low)}-${formatNumber(month.high)}`;
      card.append(name, estimate, note); monthRoot.append(card);
    });
    drawHistoricalChart(result);
    drawMonthChart(result);
    renderGuidance(result);
    resultsRoot.hidden = false;
    status.textContent = `Historical seasonal estimate ready for ${style.label}. The indicator compares archive activity rates; it is not a fire probability.`;
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
    } else display(lastResult);
  });
  document.querySelector('#harmonization-mode').addEventListener('change', () => {
    if (!lastResult) return;
    lastResult = null; document.querySelector('#outlook-results').hidden = true;
    status.textContent = 'Activity data mode changed. Generate the outlook again to refresh the estimate.';
  });
})();
