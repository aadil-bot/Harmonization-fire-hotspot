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
  const legend = document.querySelector('#calendar-legend');
  if (!section || !status || !table) return;

  let latestFilters = readCurrentFilters();
  let renderNumber = 0;
  let activeCell = null;

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
      const records = [];
      (window.MOSAIC_CALENDAR_ROWS || []).forEach((row) => {
        const year = row[0];
        row.slice(1).forEach((value, index) => {
          if (value == null) return;
          const date = new Date(Date.UTC(year, 0, 1 + index * 7)).toISOString().slice(0, 10);
          if (date >= start && date <= end) records.push({ date, count: value });
        });
      });
      if (!records.length) throw new Error('Bundled Canadian activity calendar did not load');
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
      if (!record || typeof record.date !== 'string' || record.date < start || record.date > end) return;
      const count = Number(record.count);
      if (!Number.isFinite(count)) return;
      const monthKey = record.date.slice(0, 7);
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

  function monthName(year, monthIndex) {
    return `${MONTHS[monthIndex].name} ${year}`;
  }

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
        button.dataset.month = String(monthIndex);
        button.dataset.year = String(year);
        button.dataset.count = String(count);
        button.dataset.level = String(level);
        button.setAttribute('aria-label', `${monthName(year, monthIndex)}: ${count.toLocaleString()} detections, ${LEVELS[level - 1].label.toLowerCase()}.`);
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
    tooltip.textContent = `${monthName(year, monthIndex)} · ${count.toLocaleString()} detections · ${LEVELS[level - 1].label}`;
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
    const { region, start, end } = latestFilters;
    regionLabel.textContent = 'CANADA · ' + region.replaceAll('-', ' ').toUpperCase();
    status.hidden = false;
    status.textContent = 'Loading Canada-wide harmonized weekly activity…';
    gridWrap.hidden = true;
    legend.hidden = true;
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
      gridWrap.hidden = false;
      legend.hidden = false;
      gridWrap.scrollTop = gridWrap.scrollHeight;
    } catch (error) {
      if (thisRender !== renderNumber || section.hidden) return;
      status.textContent = 'Fire activity could not be loaded. Please try again.';
      gridWrap.hidden = true;
      legend.hidden = true;
    }
  }

  connectTooltips();

  window.addEventListener('filtersChanged', (event) => {
    const details = event.detail || {};
    latestFilters = {
      region: details.region || latestFilters.region,
      start: details.start || latestFilters.start,
      end: details.end || latestFilters.end,
      role: details.role || latestFilters.role,
    };
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
