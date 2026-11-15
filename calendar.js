// Self-contained calendar heatmap module. It listens to the page's filter and
// view events, and only fetches/renders data while the calendar is active.
(function () {
  'use strict';

  const MONTHS = [
    { letter: 'J', name: 'January' }, { letter: 'F', name: 'February' },
    { letter: 'M', name: 'March' }, { letter: 'A', name: 'April' },
    { letter: 'M', name: 'May' }, { letter: 'J', name: 'June' },
    { letter: 'J', name: 'July' }, { letter: 'A', name: 'August' },
    { letter: 'S', name: 'September' }, { letter: 'O', name: 'October' },
    { letter: 'N', name: 'November' }, { letter: 'D', name: 'December' },
  ];
  const LEVELS = [
    { className: 'level-1', label: 'Low activity' },
    { className: 'level-2', label: 'Moderate activity' },
    { className: 'level-3', label: 'Elevated activity' },
    { className: 'level-4', label: 'High activity' },
  ];

  const section = document.querySelector('#view-calendar');
  const status = document.querySelector('#calendar-status');
  const regionLabel = document.querySelector('#calendar-region');
  const gridWrap = document.querySelector('#calendar-grid-wrap');
  const table = document.querySelector('#calendar-grid');
  const tooltip = document.querySelector('#calendar-tooltip');
  const description = document.querySelector('#calendar-description');
  const legend = document.querySelector('#calendar-legend');
  const drill = document.querySelector('#calendar-drill');
  const drillTitle = document.querySelector('#calendar-drill-title');
  const drillSummary = document.querySelector('#calendar-drill-summary');
  const weekList = document.querySelector('#calendar-week-list');
  const dayList = document.querySelector('#calendar-day-list');
  const backToYear = document.querySelector('#calendar-back-year');
  const backToMonth = document.querySelector('#calendar-back-month');
  const historyDialog = document.querySelector('#calendar-history-dialog');
  const historyTitle = document.querySelector('#calendar-history-title');
  const historySummary = document.querySelector('#calendar-history-summary');
  const historyBars = document.querySelector('#calendar-history-bars');
  const roleContextHeading = document.querySelector('#calendar-role-heading');
  const roleContextSummary = document.querySelector('#calendar-role-summary');
  const roleContextActions = document.querySelector('#calendar-role-actions');
  if (!section || !status || !table) return;

  let latestFilters = readCurrentFilters();
  let renderNumber = 0;
  let activeCell = null;
  let drillState = { level: 'year', year: null, month: null, weekIndex: null };
  let provinceDailyPromise = null;
  let currentMonthWeeks = [];

  function readCurrentFilters() {
    return {
      region: document.querySelector('#region')?.value || 'alberta',
      start: document.querySelector('#start')?.value || '2000-11-01',
      end: document.querySelector('#end')?.value || new Date().toISOString().slice(0, 10),
      role: document.querySelector('#role')?.value || 'general-view',
    };
  }

  // The supplied weekly calendar is a pre-harmonized Canada-wide series.
  // Convert week totals to dated records for the existing monthly heatmap.
  if (typeof window.getFireData !== 'function') {
    window.getFireData = async function getFireData(region, start, end) {
      const provinceMonths = window.MOSAIC_PROVINCE_MONTHS?.[region] || {};
      const mode = document.querySelector('#harmonization-mode')?.value || 'harmonized';
      const factors = window.MOSAIC_CALIBRATION_FACTORS || {};
      const records = Object.entries(provinceMonths)
        .filter(([month]) => month >= start.slice(0, 7) && month <= end.slice(0, 7))
        .filter(([month]) => mode === 'harmonized' || (mode === 'modis' ? Number(month.slice(0, 4)) <= 2011 : Number(month.slice(0, 4)) >= 2012))
        .map(([month, harmonizedCount]) => ({ date: `${month}-01`, count: mode === 'modis' ? harmonizedCount / Number(factors[String(Number(month.slice(5, 7)))]) : harmonizedCount }));
      if (!Object.keys(provinceMonths).length) throw new Error(`No provincial calendar data found for ${region}`);
      return records;
    };
  }

  function getMonthTotals(records, start, end) {
    const firstYear = Number(start.slice(0, 4));
    const lastYear = Number(end.slice(0, 4));
    const totals = new Map();
    for (let year = firstYear; year <= lastYear; year += 1) {
      for (let month = 1; month <= 12; month += 1) totals.set(`${year}-${String(month).padStart(2, '0')}`, 0);
    }

    records.forEach((record) => {
      if (!record || typeof record.date !== 'string') return;
      const count = Number(record.count);
      if (!Number.isFinite(count)) return;
      const monthKey = record.date.slice(0, 7);
      if (monthKey < start.slice(0, 7) || monthKey > end.slice(0, 7)) return;
      if (totals.has(monthKey)) totals.set(monthKey, totals.get(monthKey) + count);
    });
    return { firstYear, lastYear, totals };
  }

  function quartiles(values) {
    const sorted = values.slice().sort((a, b) => a - b);
    if (!sorted.length) return [0, 0, 0];
    const quantile = (fraction) => {
      const index = (sorted.length - 1) * fraction;
      const lowerIndex = Math.floor(index);
      const upperIndex = Math.ceil(index);
      const portion = index - lowerIndex;
      return sorted[lowerIndex] + (sorted[upperIndex] - sorted[lowerIndex]) * portion;
    };
    return [quantile(0.25), quantile(0.5), quantile(0.75)];
  }

  function getLevel(count, bounds) {
    if (count <= 0 || count <= bounds[0]) return 1;
    if (count <= bounds[1]) return 2;
    if (count <= bounds[2]) return 3;
    return 4;
  }

  function activityColour(count, maximum) {
    const stops = [
      [0, [240, 230, 205]], [0.38, [242, 173, 110]],
      [0.7, [232, 107, 61]], [1, [118, 47, 43]],
    ];
    const position = maximum > 0 ? Math.log1p(Math.max(0, count)) / Math.log1p(maximum) : 0;
    let lower = stops[0], upper = stops[stops.length - 1];
    for (let index = 1; index < stops.length; index += 1) {
      if (position <= stops[index][0]) { lower = stops[index - 1]; upper = stops[index]; break; }
    }
    const portion = (position - lower[0]) / (upper[0] - lower[0] || 1);
    const rgb = lower[1].map((channel, index) => Math.round(channel + (upper[1][index] - channel) * portion));
    return `rgb(${rgb.join(',')})`;
  }

  function monthName(year, monthIndex) {
    return `${MONTHS[monthIndex].name} ${year}`;
  }

  function isoDate(date) { return date.toISOString().slice(0, 10); }

  function dateLabel(date) {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);
  }

  function activityForDate(date) {
    const values = window.MOSAIC_PROVINCE_DAILY?.[latestFilters.region]?.[date];
    if (!values) return 0;
    const mode = document.querySelector('#harmonization-mode')?.value || 'harmonized';
    return Number(values[mode === 'modis' ? 1 : mode === 'viirs' ? 2 : 0]) || 0;
  }

  function loadProvinceDaily() {
    if (window.MOSAIC_PROVINCE_DAILY) return Promise.resolve();
    if (provinceDailyPromise) return provinceDailyPromise;
    provinceDailyPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'data/canada/province_daily.js?v=1';
      script.onload = () => window.MOSAIC_PROVINCE_DAILY ? resolve() : reject(new Error('Daily province data is empty.'));
      script.onerror = () => reject(new Error('Could not load daily province data.'));
      document.head.append(script);
    }).catch((error) => { provinceDailyPromise = null; throw error; });
    return provinceDailyPromise;
  }

  function showYearOverview() {
    drillState = { level: 'year', year: null, month: null, weekIndex: null };
    currentMonthWeeks = [];
    drill.hidden = true;
    gridWrap.hidden = false;
    legend.hidden = false;
    hideTooltip();
  }

  function renderMonthDrill(year, monthIndex) {
    if (!window.MOSAIC_PROVINCE_DAILY || !window.MOSAIC_PROVINCE_DAILY_META) return;
    drillState = { level: 'month', year, month: monthIndex, weekIndex: null };
    gridWrap.hidden = true;
    legend.hidden = true;
    drill.hidden = false;
    backToMonth.hidden = true;
    weekList.hidden = false;
    dayList.hidden = true;
    drillTitle.textContent = monthName(year, monthIndex);
    weekList.replaceChildren();

    const archive = window.MOSAIC_PROVINCE_DAILY_META;
    const firstOfMonth = new Date(Date.UTC(year, monthIndex, 1));
    const lastOfMonth = new Date(Date.UTC(year, monthIndex + 1, 0));
    const firstAllowed = [isoDate(firstOfMonth), latestFilters.start, archive.start].sort().slice(-1)[0];
    const lastAllowed = [isoDate(lastOfMonth), latestFilters.end, archive.end].sort()[0];
    if (firstAllowed > lastAllowed) {
      drillSummary.textContent = `No daily observations are available for ${monthName(year, monthIndex)} within the selected dates. The daily provincial archive covers ${archive.start} to ${archive.end}.`;
      return;
    }

    const weeks = new Map();
    for (let cursor = new Date(`${firstAllowed}T00:00:00Z`); isoDate(cursor) <= lastAllowed; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const date = isoDate(cursor);
      const monday = new Date(cursor);
      monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
      const weekKey = isoDate(monday);
      if (!weeks.has(weekKey)) weeks.set(weekKey, { start: date, end: date, total: 0, days: [] });
      const week = weeks.get(weekKey);
      week.end = date;
      const value = activityForDate(date);
      week.total += value;
      week.days.push({ date, value });
    }
    currentMonthWeeks = [...weeks.values()];
    const total = currentMonthWeeks.reduce((sum, week) => sum + week.total, 0);
    const modeLabel = document.querySelector('#harmonization-mode')?.selectedOptions[0]?.textContent || 'Harmonized Activity';
    drillSummary.textContent = `${latestFilters.region.replaceAll('-', ' ')} · ${firstAllowed} to ${lastAllowed} · ${modeLabel} · ${Math.round(total).toLocaleString()} total activity. Weeks run Monday–Sunday and are clipped to this month and your selected dates.`;

    const max = Math.max(1, ...currentMonthWeeks.map((week) => week.total));
    currentMonthWeeks.forEach((week, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'calendar-week-card';
      button.setAttribute('aria-label', `Open week ${index + 1}, ${dateLabel(new Date(`${week.start}T00:00:00Z`))} to ${dateLabel(new Date(`${week.end}T00:00:00Z`))}, ${Math.round(week.total).toLocaleString()} activity`);
      const title = document.createElement('strong');
      title.textContent = `Week ${index + 1} · ${dateLabel(new Date(`${week.start}T00:00:00Z`))}–${dateLabel(new Date(`${week.end}T00:00:00Z`))}`;
      const amount = document.createElement('span');
      amount.textContent = `${week.total.toLocaleString(undefined, { maximumFractionDigits: 1 })} activity`;
      const track = document.createElement('span');
      track.className = 'calendar-week-track';
      track.setAttribute('aria-hidden', 'true');
      const fill = document.createElement('i');
      fill.style.width = `${week.total / max * 100}%`;
      track.append(fill);
      button.append(title, amount, track);
      button.addEventListener('click', () => renderWeekDrill(index));
      weekList.append(button);
    });
  }

  function renderWeekDrill(weekIndex) {
    const week = currentMonthWeeks[weekIndex];
    if (!week) return;
    drillState = { ...drillState, level: 'week', weekIndex };
    weekList.hidden = true;
    dayList.hidden = false;
    dayList.replaceChildren();
    backToMonth.hidden = false;
    drillTitle.textContent = `${monthName(drillState.year, drillState.month)} · Week ${weekIndex + 1}`;
    drillSummary.textContent = `${week.start} to ${week.end} · ${week.total.toLocaleString(undefined, { maximumFractionDigits: 1 })} activity. Daily values use the sensor mode selected in the sidebar.`;
    week.days.forEach(({ date, value }) => {
      const card = document.createElement('article');
      card.className = 'calendar-day-card';
      const day = document.createElement('time');
      day.dateTime = date;
      day.textContent = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
      const amount = document.createElement('strong');
      amount.textContent = value.toLocaleString(undefined, { maximumFractionDigits: 1 });
      const unit = document.createElement('span');
      unit.textContent = 'fire-cell activity';
      card.append(day, amount, unit);
      dayList.append(card);
    });
  }

  function getMonthHistory(year, monthIndex, selectedCount) {
    const source = window.MOSAIC_PROVINCE_MONTHS?.[latestFilters.region] || {};
    const mode = document.querySelector('#harmonization-mode')?.value || 'harmonized';
    const factors = window.MOSAIC_CALIBRATION_FACTORS || {};
    const archive = window.MOSAIC_PROVINCE_DAILY_META || { start: '2002-07-04', end: '2025-12-31' };
    const selectedMonth = String(monthIndex + 1).padStart(2, '0');
    const startMonth = latestFilters.start.slice(0, 7);
    const endMonth = latestFilters.end.slice(0, 7);
    const firstYear = Math.max(Number(startMonth.slice(0, 4)), Number(archive.start.slice(0, 4)));
    const lastYear = Math.min(year, Number(endMonth.slice(0, 4)), Number(archive.end.slice(0, 4)));
    const result = [];
    for (let currentYear = firstYear; currentYear <= lastYear; currentYear += 1) {
      const key = `${currentYear}-${selectedMonth}`;
      if (key < startMonth || key > endMonth || key < archive.start.slice(0, 7) || key > archive.end.slice(0, 7)) continue;
      if (mode === 'modis' && currentYear > 2011) continue;
      if (mode === 'viirs' && currentYear < 2012) continue;
      const raw = Number(source[key]) || 0;
      const value = mode === 'modis' ? raw / (Number(factors[selectedMonth]) || 1) : raw;
      result.push({ year: currentYear, value: currentYear === year ? Number(selectedCount ?? value) : value });
    }
    return result;
  }

  function showHistoryPopup(year, monthIndex, count) {
    const history = getMonthHistory(year, monthIndex, count);
    const modeLabel = document.querySelector('#harmonization-mode')?.selectedOptions[0]?.textContent || 'Harmonized Activity';
    const previousYears = history.filter((entry) => entry.year < year);
    historyTitle.textContent = `${MONTHS[monthIndex].name} across available years`;
    historySummary.textContent = `${latestFilters.region.replaceAll('-', ' ')} · ${modeLabel} · selected month: ${year} (${Math.round(count).toLocaleString()}) · comparison: the same calendar month in earlier years within your date range.`;
    historyBars.replaceChildren();
    const max = Math.max(1, ...history.map((entry) => entry.value));
    history.forEach((entry) => {
      const row = document.createElement('div');
      row.className = `calendar-history-row${entry.year === year ? ' is-selected' : ''}`;
      row.setAttribute('role', 'listitem');
      const yearLabel = document.createElement('span');
      yearLabel.textContent = String(entry.year);
      const track = document.createElement('span');
      track.className = 'calendar-history-track';
      track.setAttribute('aria-hidden', 'true');
      const fill = document.createElement('i');
      fill.style.width = `${entry.value / max * 100}%`;
      fill.style.setProperty('--activity-color', activityColour(entry.value, max));
      track.append(fill);
      const amount = document.createElement('strong');
      amount.textContent = Math.round(entry.value).toLocaleString();
      row.append(yearLabel, track, amount);
      historyBars.append(row);
    });
    if (!history.length) historySummary.textContent = `No same-month records are available for ${latestFilters.region.replaceAll('-', ' ')} in this date range.`;
    roleContextHeading.textContent = 'Loading role-based month insights…';
    roleContextSummary.textContent = '';
    roleContextActions.replaceChildren();
    const detail = {
      year, month: monthIndex + 1, monthName: MONTHS[monthIndex].name,
      region: latestFilters.region, role: latestFilters.role, mode: modeLabel,
      activity: count, history: previousYears,
    };
    if (!historyDialog.open) historyDialog.showModal();
    window.dispatchEvent(new CustomEvent('calendarSelectionChanged', { detail }));
  }

  document.querySelector('#calendar-history-close').addEventListener('click', () => historyDialog.close());
  historyDialog.addEventListener('click', (event) => {
    if (event.target === historyDialog) historyDialog.close();
  });

  window.addEventListener('calendarInsightsUpdated', (event) => {
    const detail = event.detail;
    if (!detail || !historyDialog.open) return;
    roleContextHeading.textContent = `${detail.roleLabel} · ${detail.monthName} ${detail.year}`;
    roleContextSummary.textContent = detail.summary;
    roleContextActions.replaceChildren();
    detail.actions.forEach((action) => {
      const item = document.createElement('li');
      item.textContent = `${action.title}: ${action.description}`;
      roleContextActions.append(item);
    });
  });

  function createMonthHeaders() {
    const head = document.createElement('tr');
    const yearHeading = document.createElement('th');
    yearHeading.className = 'year-heading';
    yearHeading.scope = 'col';
    yearHeading.textContent = 'Year';
    head.append(yearHeading);

    MONTHS.forEach((month) => {
      const heading = document.createElement('th');
      heading.className = 'month-heading';
      heading.scope = 'col';
      heading.setAttribute('aria-label', month.name);
      const visibleLetter = document.createElement('span');
      visibleLetter.setAttribute('aria-hidden', 'true');
      visibleLetter.textContent = month.letter;
      heading.append(visibleLetter);
      head.append(heading);
    });
    table.querySelector('thead').replaceChildren(head);
  }

  function renderTable(monthData) {
    createMonthHeaders();
    const body = table.querySelector('tbody');
    const values = Array.from(monthData.totals.values());
    const bounds = quartiles(values);
    const maximum = Math.max(0, ...values);
    const rows = document.createDocumentFragment();

    for (let year = monthData.firstYear; year <= monthData.lastYear; year += 1) {
      const row = document.createElement('tr');
      const yearHeading = document.createElement('th');
      yearHeading.scope = 'row';
      yearHeading.textContent = String(year);
      row.append(yearHeading);

      MONTHS.forEach((month, monthIndex) => {
        const count = monthData.totals.get(`${year}-${String(monthIndex + 1).padStart(2, '0')}`) || 0;
        const level = getLevel(count, bounds);
        const cell = document.createElement('td');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `calendar-cell ${LEVELS[level - 1].className}`;
        button.style.setProperty('--activity-color', activityColour(count, maximum));
        button.title = `Open ${monthName(year, monthIndex)} weekly details`;
        button.dataset.month = String(monthIndex);
        button.dataset.year = String(year);
        button.dataset.count = String(count);
        button.dataset.level = String(level);
        button.setAttribute('aria-label', `${monthName(year, monthIndex)}: ${count.toLocaleString()} activity, ${LEVELS[level - 1].label.toLowerCase()}. Activate to view weekly activity.`);
        button.setAttribute('aria-describedby', 'calendar-tooltip');
        cell.append(button);
        row.append(cell);
      });
      rows.append(row);
      if (year === 2011 && year < monthData.lastYear && monthData.firstYear <= 2011) {
        const markerRow = document.createElement('tr');
        markerRow.className = 'sensor-start-row';
        markerRow.setAttribute('aria-label', 'VIIRS observations begin after 2011');
        const markerCell = document.createElement('td');
        markerCell.colSpan = 13;
        const marker = document.createElement('span');
        marker.className = 'sensor-start-marker';
        marker.textContent = 'MODIS → VIIRS';
        marker.title = 'VIIRS observations begin after 2011; MODIS observations continue across the transition.';
        marker.tabIndex = 0;
        marker.setAttribute('role', 'note');
        marker.setAttribute('aria-label', marker.title);
        markerCell.append(marker);
        markerRow.append(markerCell);
        rows.append(markerRow);
      }
    }
    body.replaceChildren(rows);
  }

  function placeTooltip(cell) {
    if (!cell || !tooltip) return;
    const monthIndex = Number(cell.dataset.month);
    const year = Number(cell.dataset.year);
    const count = Number(cell.dataset.count);
    const level = Number(cell.dataset.level);
    tooltip.textContent = `${monthName(year, monthIndex)} · ${count.toLocaleString()} activity · ${LEVELS[level - 1].label} · Click to view weeks`;
    tooltip.hidden = false;

    const wrapRect = gridWrap.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    const left = Math.max(6, Math.min(cellRect.left - wrapRect.left, gridWrap.clientWidth - tooltip.offsetWidth - 6));
    const top = Math.min(cellRect.bottom - wrapRect.top + gridWrap.scrollTop + 5, gridWrap.scrollTop + gridWrap.clientHeight - tooltip.offsetHeight - 6);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${Math.max(gridWrap.scrollTop + 4, top)}px`;
  }

  function placeSensorTooltip(marker) {
    if (!tooltip) return;
    tooltip.textContent = 'MODIS → VIIRS: VIIRS observations begin after 2011.';
    tooltip.hidden = false;
    const wrapRect = gridWrap.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();
    tooltip.style.left = `${Math.max(6, Math.min(markerRect.left - wrapRect.left, gridWrap.clientWidth - tooltip.offsetWidth - 6))}px`;
    tooltip.style.top = `${Math.max(gridWrap.scrollTop + 4, markerRect.bottom - wrapRect.top + gridWrap.scrollTop + 5)}px`;
  }

  function hideTooltip() {
    activeCell = null;
    tooltip.hidden = true;
  }

  function connectTooltips() {
    table.addEventListener('click', (event) => {
      const cell = event.target.closest('.calendar-cell');
      if (!cell) return;
      const year = Number(cell.dataset.year);
      const month = Number(cell.dataset.month);
      drillState = { level: 'month', year, month, weekIndex: null };
      gridWrap.hidden = true;
      legend.hidden = true;
      drill.hidden = false;
      weekList.hidden = false;
      dayList.hidden = true;
      drillTitle.textContent = monthName(year, month);
      drillSummary.textContent = 'Loading daily activity for this province…';
      weekList.replaceChildren();
      showHistoryPopup(year, month, Number(cell.dataset.count) || 0);
      loadProvinceDaily().then(() => {
        if (section.hidden || drillState.year !== year || drillState.month !== month) return;
        renderMonthDrill(year, month);
      }).catch(() => {
        if (drillState.year === year && drillState.month === month) {
          drillSummary.textContent = 'Daily province data could not be loaded. The month totals remain available in the year overview.';
        }
      });
    });
    table.addEventListener('pointerover', (event) => {
      const marker = event.target.closest('.sensor-start-marker');
      if (marker) {
        activeCell = marker;
        placeSensorTooltip(marker);
        return;
      }
      const cell = event.target.closest('.calendar-cell');
      if (!cell || cell === activeCell) return;
      activeCell = cell;
      placeTooltip(cell);
    });
    table.addEventListener('pointerout', (event) => {
      const marker = event.target.closest('.sensor-start-marker');
      if (marker && !marker.contains(event.relatedTarget)) hideTooltip();
      const cell = event.target.closest('.calendar-cell');
      if (cell && !cell.contains(event.relatedTarget) && document.activeElement !== cell) hideTooltip();
    });
    table.addEventListener('focusin', (event) => {
      const cell = event.target.closest('.calendar-cell');
      if (!cell) return;
      activeCell = cell;
      placeTooltip(cell);
    });
    table.addEventListener('focusout', (event) => {
      const cell = event.target.closest('.calendar-cell');
      if (cell && !cell.contains(event.relatedTarget) && !cell.matches(':hover')) hideTooltip();
    });
    gridWrap.addEventListener('scroll', () => {
      if (activeCell && !tooltip.hidden) placeTooltip(activeCell);
    }, { passive: true });
  }

  async function renderCalendar() {
    if (section.hidden) return;
    const thisRender = ++renderNumber;
    const { region } = latestFilters;
    let { start, end } = latestFilters;
    const mode = document.querySelector('#harmonization-mode')?.value || 'harmonized';
    if (mode === 'modis' && end > '2011-12-31') end = '2011-12-31';
    if (mode === 'viirs' && start < '2012-01-01') start = '2012-01-01';
    regionLabel.textContent = region.replaceAll('-', ' ').toUpperCase();
    if (description) description.textContent = mode === 'harmonized'
      ? 'Harmonized monthly activity for this province or territory. Click a month block to open its weeks. MODIS values before 2012 are calibrated to the VIIRS scale.'
      : mode === 'modis'
        ? 'MODIS-only monthly activity before 2012, shown on its uncalibrated sensor scale. Click a month block to open its weeks.'
        : 'VIIRS-only monthly activity from 2012 onward. Click a month block to open its weeks.';
    status.hidden = false;
    status.textContent = `Loading ${region.replaceAll('-', ' ')} ${mode === 'harmonized' ? 'harmonized' : mode.toUpperCase()} calendar…`;    gridWrap.hidden = true;
    legend.hidden = true;
    drill.hidden = true;
    hideTooltip();

    if (!start || !end || start > end) {
      status.textContent = 'Choose a valid start and end date to view the calendar.';
      return;
    }

    try {
      const records = await window.getFireData(region, start, end);
      if (thisRender !== renderNumber || section.hidden) return;
      const monthData = getMonthTotals(Array.isArray(records) ? records : [], start, end);
      renderTable(monthData);
      status.hidden = true;
      if (drillState.level === 'year') {
        showYearOverview();
        gridWrap.scrollTop = gridWrap.scrollHeight;
      } else {
        const previousDrillLevel = drillState.level;
        const previousWeekIndex = drillState.weekIndex;
        const restoreDrill = () => {
          if (thisRender !== renderNumber || section.hidden) return;
          renderMonthDrill(drillState.year, drillState.month);
          if (previousDrillLevel === 'week') renderWeekDrill(previousWeekIndex);
        };
        if (window.MOSAIC_PROVINCE_DAILY) restoreDrill();
        else {
          drill.hidden = false;
          drillSummary.textContent = 'Loading daily province activity…';
          loadProvinceDaily().then(restoreDrill).catch(() => {
            if (thisRender === renderNumber) drillSummary.textContent = 'Daily province data could not be loaded. The month totals remain available in the year overview.';
          });
        }
      }
    } catch (error) {
      if (thisRender !== renderNumber || section.hidden) return;
      status.textContent = 'Fire activity could not be loaded. Please try again.';
      gridWrap.hidden = true;
      legend.hidden = true;
    }
  }

  connectTooltips();
  backToYear.addEventListener('click', showYearOverview);
  backToMonth.addEventListener('click', () => renderMonthDrill(drillState.year, drillState.month));
  document.querySelector('#harmonization-mode')?.addEventListener('change', () => {
    if (historyDialog.open) {
      historyDialog.close();
      window.dispatchEvent(new Event('calendarSelectionCleared'));
    }
    if (!section.hidden) renderCalendar();
  });

  window.addEventListener('filtersChanged', (event) => {
    const details = event.detail || {};
    const nextFilters = {
      region: details.region || latestFilters.region,
      start: details.start || latestFilters.start,
      end: details.end || latestFilters.end,
      role: details.role || latestFilters.role,
    };
    if (nextFilters.region !== latestFilters.region || nextFilters.start !== latestFilters.start || nextFilters.end !== latestFilters.end) {
      drillState = { level: 'year', year: null, month: null, weekIndex: null };
      if (historyDialog.open) historyDialog.close();
      window.dispatchEvent(new Event('calendarSelectionCleared'));
    }
    latestFilters = nextFilters;
    if (!section.hidden) renderCalendar();
  });

  window.addEventListener('viewChanged', (event) => {
    const view = typeof event.detail === 'string' ? event.detail : event.detail?.view;
    if (view === 'calendar') renderCalendar();
    else renderNumber += 1;
  });

  // Support loading this module after the map page has initialized its view.
  if (!section.hidden) renderCalendar();
})();
