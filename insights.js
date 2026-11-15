// Role-specific summaries and next steps. Activity statistics below are
// calculated from the selected province, date range, and sensor mode.
const ROLE_CONTENT = {
  'emergency-response': {
    name: 'Emergency Response',
    features: ['Recent hotspot activity in the archive (through 2025)', 'Regional anomalies against historical baselines', 'Historical preparedness indicators', 'Seasonal outlook from historical analogues; no live weather forecast feed', 'Suggested action items'],
    title: 'Emergency Preparedness',
    description: 'Use archived activity and historical anomalies to inform readiness. Check current weather and incident sources for operational decisions.',
    guidance: 'Open the seasonal outlook below the calendar for historical analogues. This site has no live fire-weather forecast or incident feed.',
    actions: [
      { icon: '⌖', title: 'Review archived hotspots', description: 'Open the detection list for the selected province and date range.', timing: 'Open detections', view: 'live' },
      { icon: '◷', title: 'Check seasonal baselines', description: 'Compare future dates with historical seasonal activity; confirm current conditions separately.', timing: 'Open calendar', view: 'calendar' },
      { icon: '⚑', title: 'Review historical anomalies', description: 'Inspect yearly activity against the selected historical baseline.', timing: 'Open trends', view: 'trend' },
    ],
  },
  scientist: {
    name: 'Scientists',
    features: ['Raw MODIS and VIIRS observations through sensor-specific modes', 'Raw versus harmonized comparisons', 'Monthly sensor calibration factors', 'Historical trend and anomaly analysis', 'Research data export (CSV)'],
    title: 'Research context',
    description: 'Inspect sensor-specific observations, calibration, harmonized comparisons, and historical variation.',
    guidance: 'Use the Activity data selector to view MODIS or VIIRS, then use Regional trends to compare raw and harmonized activity. CSV export is available for mapped records.',
    actions: [
      { icon: '⌕', title: 'Compare raw and harmonized series', description: 'Overlay uncalibrated sensor counts with harmonized activity.', timing: 'Open trends', view: 'trend' },
      { icon: '▤', title: 'Compare provinces', description: 'Review monthly activity for two provinces over the selected period.', timing: 'Compare regions', view: 'compare' },
      { icon: '↧', title: 'Export mapped records', description: 'Download the currently visible hotspot records as CSV.', timing: 'Download CSV', action: 'download' },
    ],
  },
  'land-manager': {
    name: 'Land Managers',
    features: ['Seasonal burning patterns', 'Recurring hotspot activity', 'Regional fire history', 'Land management insights using local context', 'Seasonal outlooks based on historical patterns'],
    title: 'Land and fire planning',
    description: 'Use recurring seasonal patterns and regional fire history as planning context alongside local land information.',
    guidance: 'The seasonal outlook below the calendar summarizes historical analogues. Add local land-cover, fuel, and management data before applying it to a specific area.',
    actions: [
      { icon: '◷', title: 'Review seasonal patterns', description: 'Open the calendar to compare activity by month and year.', timing: 'Open calendar', view: 'calendar' },
      { icon: '⌖', title: 'Find recurring activity', description: 'Use the trend chart to inspect high-activity seasons and years.', timing: 'Open trends', view: 'trend' },
      { icon: '↗', title: 'Compare regional history', description: 'Compare two provinces, then add local management context.', timing: 'Compare regions', view: 'compare' },
    ],
  },
  firefighter: {
    name: 'Firefighters',
    features: ['Archived hotspot detections (through 2025)', 'Detection coordinates and observation dates', 'Detection confidence (not supplied in the current archive)', 'Fire Radiative Power (FRP), where recorded', 'Environmental conditions (live weather feed not connected)', 'Suggested action items'],
    title: 'Operational awareness',
    description: 'Inspect archived hotspot locations, dates, and FRP. Satellite detections are not confirmed incidents; confidence and live weather are not present in this archive.',
    guidance: 'Use the detection list and map for archived coordinates and FRP where recorded. Verify current incidents, confidence, and environmental conditions with operational sources.',
    actions: [
      { icon: '⌖', title: 'Inspect archived detections', description: 'Open hotspot records with coordinates, observation dates, and FRP when present.', timing: 'Open detections', view: 'live' },
      { icon: '▤', title: 'Open the hotspot map', description: 'Locate mapped cells and inspect their available details.', timing: 'Open map', view: 'map' },
      { icon: '⚑', title: 'Verify through dispatch', description: 'The archive has no confidence or live weather feed; confirm conditions with trusted operational sources.', timing: 'Verify locally' },
    ],
  },
  'general-view': {
    name: 'General View',
    features: ['Overall Canadian hotspot map', 'Historical burning calendar', 'Fire activity statistics', 'Historical trends', 'Seasonal patterns'],
    title: 'Fire activity overview',
    description: 'Explore the Canadian hotspot map, historical activity calendar, regional trends, and seasonal patterns.',
    guidance: 'Use the calendar and trend views to compare the selected province with its own historical record. Hotspots are satellite observations, not confirmed fire perimeters.',
    actions: [
      { icon: '⌖', title: 'Explore the hotspot map', description: 'Review mapped activity for the selected province and year.', timing: 'Open map', view: 'map' },
      { icon: '◷', title: 'Browse the historical calendar', description: 'Compare monthly activity across available years.', timing: 'Open calendar', view: 'calendar' },
      { icon: '⌕', title: 'Review regional trends', description: 'Compare annual totals, seasonality, and historical baselines.', timing: 'Open trends', view: 'trend' },
    ],
  },
};

(function () {
  'use strict';

  const root = document.querySelector('#insights');
  const roleSelect = document.querySelector('#role');
  if (!root) return;

  const hotspotDialog = document.querySelector('#hotspot-dialog');
  const hotspotDialogContent = document.querySelector('#hotspot-dialog-content');
  let activeHotspot = null;
  let dialogReturnFocus = null;

  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const DAY_ICONS = ['⌁', '☼', '⌖', '◷', '⌁', '☼', '⌖'];
  let selectedRole = roleSelect?.value || 'general-view';
  let calendarSelection = null;

  function calendarContext(selection) {
    const prior = (selection.history || []).map((entry) => Number(entry.value)).filter(Number.isFinite);
    const average = prior.length ? prior.reduce((sum, value) => sum + value, 0) / prior.length : null;
    const activity = Number(selection.activity) || 0;
    const difference = average > 0 ? ((activity - average) / average) * 100 : null;
    const region = String(selection.region || 'selected region').replaceAll('-', ' ');
    const comparison = average === null
      ? `No earlier same-month values are available in the selected range. The calendar shows ${Math.round(activity).toLocaleString()} activity units for ${selection.monthName} ${selection.year}.`
      : `${Math.round(activity).toLocaleString()} activity units in ${region} during ${selection.monthName} ${selection.year}; earlier same-month average is ${Math.round(average).toLocaleString()} across ${prior.length} ${prior.length === 1 ? 'year' : 'years'} (${difference >= 0 ? '+' : ''}${difference.toFixed(0)}%). Values use ${selection.mode}.`;

    const actionTemplates = {
      'general-view': [
        ['Review the month’s weeks', 'Open the calendar drill-down to see when activity occurred.'],
        ['Compare the same month historically', `Use the ${prior.length} earlier-year ${selection.monthName} values to put this total in context.`],
        ['Interpret satellite detections carefully', 'Hotspot detections indicate observations, not confirmed fire perimeters.'],
      ],
      'emergency-response': [
        ['Review the activity period', `Check the weeks within ${selection.monthName} ${selection.year} for timing and concentration.`],
        ['Compare with prior seasons', 'Use the same-month history as planning context; it is not a current incident report.'],
        ['Verify through local sources', 'Confirm conditions with trusted reports before making operational decisions.'],
      ],
      scientist: [
        ['Inspect weekly distribution', 'Use the month drill-down to see how the total is distributed through the month.'],
        ['Review the historical baseline', `Compare with ${prior.length} available earlier same-month values.`],
        ['Account for sensor mode', `This comparison is currently using ${selection.mode}; consider sensor coverage and calibration when interpreting it.`],
      ],
      'land-manager': [
        ['Check recurring seasonal activity', `Compare ${selection.monthName} with the earlier years shown in the calendar.`],
        ['Inspect activity timing', 'Open the weekly breakdown to identify when detections were concentrated.'],
        ['Add local land context', 'Review detections alongside local land-cover and management information.'],
      ],
      firefighter: [
        ['Open the weekly breakdown', `Review detection timing within ${selection.monthName} ${selection.year}.`],
        ['Check individual observations', 'Use the map and available detection details to inspect location, timestamp, and sensor.'],
        ['Verify before response', 'Satellite hotspots require confirmation from incident reports or field sources.'],
      ],
    };
    return {
      average,
      stats: [
        { label: `${selection.monthName} ${selection.year} activity`, value: Math.round(activity).toLocaleString(), caption: `${region} · ${selection.mode}` },
        { label: 'Earlier same-month average', value: average === null ? '—' : Math.round(average).toLocaleString(), caption: average === null ? 'No earlier records in range' : `${prior.length} earlier ${prior.length === 1 ? 'year' : 'years'}` },
        { label: 'Compared with earlier average', value: difference === null ? '—' : `${difference >= 0 ? '+' : ''}${difference.toFixed(0)}%`, caption: difference === null ? 'Baseline unavailable' : 'Historical comparison, not a forecast' },
      ],
      summary: `${({ 'general-view': 'Explore the selected period.', 'emergency-response': 'Preparedness context:', scientist: 'Research context:', 'land-manager': 'Seasonal planning context:', firefighter: 'Operational context:' })[selectedRole] || 'Selected viewpoint:'} ${comparison}`,
      actions: actionTemplates[selectedRole] || actionTemplates['general-view'],
      monthName: selection.monthName,
      year: selection.year,
    };
  }

  function roleStats(role) {
    const context = window.MOSAIC_VIEW_CONTEXT?.() || {};
    const mode = context.mode || 'harmonized';
    const source = window.MOSAIC_PROVINCE_MONTHS?.[context.region] || {};
    const factors = window.MOSAIC_CALIBRATION_FACTORS || {};
    const start = context.start || '2000-11-01';
    const end = context.end || '2025-12-31';
    const firstYear = Math.max(2002, Number(start.slice(0, 4)), mode === 'viirs' ? 2012 : 2002);
    const lastYear = Math.min(2025, Number(end.slice(0, 4)), mode === 'modis' ? 2011 : 2025);
    const yearly = new Map();
    for (let year = firstYear; year <= lastYear; year += 1) yearly.set(year, 0);
    const monthlyTotals = Array(12).fill(0);
    Object.entries(source).forEach(([month, rawValue]) => {
      if (month < start.slice(0, 7) || month > end.slice(0, 7)) return;
      const [year, monthNumber] = month.split('-').map(Number);
      if (mode === 'modis' && year > 2011) return;
      if (mode === 'viirs' && year < 2012) return;
      const factor = Number(factors[String(monthNumber)]) || 1;
      const value = mode === 'modis' ? Number(rawValue) / factor : Number(rawValue);
      if (!Number.isFinite(value)) return;
      yearly.set(year, (yearly.get(year) || 0) + value);
      monthlyTotals[monthNumber - 1] += value;
    });
    const entries = [...yearly.entries()].sort((a, b) => a[0] - b[0]);
    const total = entries.reduce((sum, [, value]) => sum + value, 0);
    const peakIndex = monthlyTotals.indexOf(Math.max(...monthlyTotals));
    const peakYear = entries.at(-1);
    const previous = entries.slice(-6, -1).map((entry) => entry[1]);
    const baseline = previous.length ? previous.reduce((sum, value) => sum + value, 0) / previous.length : null;
    const anomaly = baseline > 0 && peakYear ? ((peakYear[1] - baseline) / baseline) * 100 : null;
    const fmt = (value) => Math.round(value).toLocaleString();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const modeLabel = mode === 'modis' ? 'MODIS raw' : mode === 'viirs' ? 'VIIRS raw' : 'Harmonized';
    const stat = (label, value, caption) => ({ label, value, caption });
    const defaultStats = [
      stat('Selected-period activity', fmt(total), `${entries.length} archive years · ${modeLabel}`),
      stat('Highest-activity month', monthNames[peakIndex] || '—', `${fmt(monthlyTotals[peakIndex] || 0)} activity units`),
      stat('Archive coverage', entries.length ? `${entries[0][0]}–${entries.at(-1)[0]}` : 'No records', 'Provincial data through 2025'),
    ];
    const byRole = {
      'emergency-response': [
        stat('Latest archive year', peakYear ? fmt(peakYear[1]) : '—', peakYear ? `${peakYear[0]} · activity units` : 'No years in selected range'),
        stat('Historical anomaly', anomaly === null ? '—' : `${anomaly >= 0 ? '+' : ''}${anomaly.toFixed(0)}%`, baseline === null ? 'Baseline unavailable' : `Versus previous ${previous.length} archive years`),
        stat('Forecast information', 'Historical only', 'No live weather or incident feed'),
      ],
      scientist: [
        stat('Selected-period activity', fmt(total), `${entries.length} years · ${modeLabel}`),
        stat('Sensor calibration', mode === 'harmonized' ? 'Applied' : mode === 'modis' ? 'Off' : 'Not needed', mode === 'harmonized' ? 'Monthly MODIS factors; VIIRS unchanged' : 'MODIS calibration can be compared in harmonized mode'),
        stat('Data coverage', entries.length ? `${entries[0][0]}–${entries.at(-1)[0]}` : 'No records', 'Provincial monthly archive'),
      ],
      'land-manager': [
        stat('Peak activity season', monthNames[peakIndex] || '—', `${fmt(monthlyTotals[peakIndex] || 0)} activity units`),
        stat('Active months', monthlyTotals.filter((value) => value > 0).length.toString(), 'Across selected period'),
        stat('Recurring peak month', monthNames[peakIndex] || '—', 'Highest combined monthly activity'),
      ],
      firefighter: [
        stat('Latest archive year', peakYear ? String(peakYear[0]) : '—', peakYear ? `${fmt(peakYear[1])} activity units` : 'No years in selected range'),
        stat('Detection details', 'Map records', 'Coordinates and FRP where recorded'),
        stat('Confidence & conditions', 'Unavailable', 'Not included in the current archive'),
      ],
    };
    return byRole[role] || defaultStats;
  }

  function scoreClass(score) {
    if (score < 25) return { className: 'score-low', label: 'Low' };
    if (score < 50) return { className: 'score-moderate', label: 'Moderate' };
    if (score < 75) return { className: 'score-elevated', label: 'Elevated' };
    return { className: 'score-high', label: 'High' };
  }

  function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function renderHotspotDialog(row, role) {
    if (!hotspotDialogContent) return;
    const content = ROLE_CONTENT[role] || ROLE_CONTENT['general-view'];
    hotspotDialogContent.replaceChildren();

    // Put the selected viewpoint and recommended actions before raw detection data.
    const rolePanel = makeElement('section', 'hotspot-role-panel');
    rolePanel.setAttribute('aria-labelledby', 'hotspot-role-title');
    rolePanel.append(makeElement('p', 'hotspot-role-kicker', `VIEWPOINT · ${content.name}`));
    rolePanel.append(makeElement('h3', '', content.title));
    rolePanel.lastElementChild.id = 'hotspot-role-title';
    rolePanel.append(makeElement('p', 'hotspot-role-description', content.description));
    const cellCount = Number(row.harmonized_cells);
    const fireDays = Number(row.fire_days);
    const cellSummary = `${Number.isFinite(cellCount) ? cellCount.toLocaleString() : '—'} harmonized fire cells · ${Number.isFinite(fireDays) ? fireDays.toLocaleString() : '—'} observed fire days · ${row.year || 'year unavailable'}`;
    rolePanel.append(makeElement('p', 'hotspot-cell-summary', cellSummary));

    const insightHeading = makeElement('h4', 'hotspot-section-heading', 'Role-specific insights');
    rolePanel.append(insightHeading);
    const insightList = makeElement('ul', 'hotspot-role-insights');
    (content.features || []).slice(0, 5).forEach((insight) => insightList.append(makeElement('li', '', insight)));
    rolePanel.append(insightList);

    rolePanel.append(makeElement('h4', 'hotspot-section-heading hotspot-actions-heading', 'Suggested action items'));
    const actionList = makeElement('ul', 'hotspot-dialog-actions');
    (content.actions || []).forEach((action) => {
      const item = makeElement('li', '');
      const card = makeElement(action.view || action.action ? 'button' : 'div', 'hotspot-dialog-action');
      if (card.tagName === 'BUTTON') {
        card.type = 'button';
        card.addEventListener('click', () => {
          hotspotDialog?.close();
          if (action.view) window.setMosaicView?.(action.view);
          else if (action.action === 'download') document.querySelector('#download-csv')?.click();
        });
      }
      const copy = makeElement('span', 'hotspot-dialog-action-copy');
      copy.append(makeElement('strong', '', action.title));
      copy.append(makeElement('span', '', action.description));
      card.append(copy, makeElement('span', 'hotspot-dialog-action-timing', action.timing));
      item.append(card);
      actionList.append(item);
    });
    rolePanel.append(actionList);
    hotspotDialogContent.append(rolePanel);

    const detailsSection = makeElement('section', 'hotspot-detection-section');
    detailsSection.setAttribute('aria-labelledby', 'hotspot-detection-title');
    detailsSection.append(makeElement('h3', 'hotspot-section-heading', 'Detection details'));
    detailsSection.lastElementChild.id = 'hotspot-detection-title';
    const firstDate = row.first_fire || 'Not available';
    const lastDate = row.last_fire || 'Not available';
    const frp = Number(row.frp_total_mw);
    const details = [
      ['Type of fire', 'Satellite active-fire hotspot. A hotspot is not a confirmed wildfire or fire perimeter.'],
      ['Detection date and time', `${firstDate}${lastDate !== firstDate ? ` through ${lastDate}` : ''}. Time of day is not included in this archive.`],
      ['Detection confidence', 'Not available in this annual grid-cell archive.'],
      ['Fire Radiative Power (FRP)', Number.isFinite(frp) ? `${frp.toLocaleString()} MW total for this grid cell in the selected annual record.` : 'Not available in this record.'],
      ['Satellite source', String(row.source || 'Not available')],
      ['Geographic coordinates', `${Number(row.lat).toFixed(4)}°, ${Number(row.lon).toFixed(4)}°`],
    ];
    const grid = makeElement('dl', 'hotspot-detail-grid');
    details.forEach(([label, value]) => {
      const card = makeElement('div', 'hotspot-detail-card');
      card.append(makeElement('dt', '', label));
      card.append(makeElement('dd', '', value));
      grid.append(card);
    });
    detailsSection.append(grid);
    detailsSection.append(makeElement('p', 'hotspot-data-note', 'These values summarize satellite observations in a grid cell. They do not verify an incident on the ground.'));
    hotspotDialogContent.append(detailsSection);
  }

  function openHotspotDialog(event) {
    const detail = event.detail || {};
    if (!detail.row || !hotspotDialog) return;
    activeHotspot = detail.row;
    dialogReturnFocus = document.activeElement;
    renderHotspotDialog(activeHotspot, detail.role || selectedRole);
    if (!hotspotDialog.open) hotspotDialog.showModal();
    document.querySelector('#hotspot-dialog-close')?.focus();
  }

  window.addEventListener('hotspotViewRequested', openHotspotDialog);
  window.addEventListener('filtersChanged', (event) => {
    if (hotspotDialog?.open && activeHotspot) {
      const nextRole = event.detail?.role || selectedRole;
      renderHotspotDialog(activeHotspot, nextRole);
    }
  });
  document.querySelector('#harmonization-mode')?.addEventListener('change', render);
  document.querySelector('#hotspot-dialog-close')?.addEventListener('click', () => hotspotDialog.close());
  hotspotDialog?.addEventListener('click', (event) => {
    if (event.target === hotspotDialog) hotspotDialog.close();
  });
  hotspotDialog?.addEventListener('close', () => {
    activeHotspot = null;
    if (dialogReturnFocus?.isConnected && !dialogReturnFocus.closest('[hidden]')) dialogReturnFocus.focus();
    else {
      const mapRegion = document.querySelector('#fire-map');
      mapRegion?.setAttribute('tabindex', '-1');
      mapRegion?.focus();
    }
  });

  function render() {
    const content = ROLE_CONTENT[selectedRole] || ROLE_CONTENT['general-view'];
    const monthContext = calendarSelection ? calendarContext(calendarSelection) : null;
    root.replaceChildren();

    const module = makeElement('section', 'insights-module');
    module.setAttribute('aria-labelledby', 'insights-title');

    const badge = makeElement('span', 'demo-badge', 'Provincial archive · through 2025');
    badge.setAttribute('aria-label', 'Provincial historical archive through 2025');
    module.append(badge);

    const header = makeElement('header', 'insights-module-header');
    const titleGroup = document.createElement('div');
    titleGroup.append(makeElement('p', 'insights-kicker', content.name));
    titleGroup.append(makeElement('h2', '', content.title));
    titleGroup.lastElementChild.id = 'insights-title';
    titleGroup.append(makeElement('p', 'insights-title-description', content.description));
    header.append(titleGroup);
    module.append(header);

    if (monthContext) {
      const contextBanner = makeElement('div', 'calendar-selection-banner');
      contextBanner.setAttribute('role', 'status');
      contextBanner.append(makeElement('strong', '', `Calendar selection · ${calendarSelection.region.replaceAll('-', ' ')} · ${monthContext.monthName} ${monthContext.year}`));
      contextBanner.append(makeElement('span', '', monthContext.summary));
      module.append(contextBanner);
    }

    const featureList = makeElement('ul', 'role-feature-list');
    featureList.setAttribute('aria-label', `${content.name} view includes`);
    (content.features || []).forEach((feature) => {
      featureList.append(makeElement('li', '', feature));
    });
    module.append(featureList);

    const stats = makeElement('div', 'insight-stats');
    stats.setAttribute('aria-label', 'Selected-period activity statistics');
    (monthContext?.stats || roleStats(selectedRole)).forEach((stat) => {
      const card = makeElement('article', 'insight-stat');
      card.append(makeElement('span', 'insight-stat-label', stat.label));
      card.append(makeElement('strong', 'insight-stat-value', stat.value));
      card.append(makeElement('span', 'insight-stat-caption', stat.caption));
      stats.append(card);
    });
    module.append(stats);

    const outlookSection = makeElement('section', 'outlook-section role-guidance');
    outlookSection.setAttribute('aria-labelledby', 'outlook-title');
    const outlookHeader = makeElement('div', 'outlook-heading');
    outlookHeader.append(makeElement('h3', '', monthContext ? 'Selected month context' : 'View guidance'));
    outlookHeader.lastElementChild.id = 'outlook-title';
    outlookHeader.append(makeElement('span', 'illustrative-label', monthContext ? 'HISTORICAL COMPARISON' : content.name.toUpperCase()));
    outlookSection.append(outlookHeader);
    outlookSection.append(makeElement('p', 'outlook-selection', monthContext
      ? `Historical month context for ${monthContext.monthName} ${monthContext.year}. ${content.guidance}`
      : content.guidance));
    module.append(outlookSection);

    const actionsSection = makeElement('section', 'actions-section');
    actionsSection.setAttribute('aria-labelledby', 'actions-title');
    const actionsTitle = makeElement('h3', 'actions-heading', 'Recommended action items');
    actionsTitle.id = 'actions-title';
    actionsSection.append(actionsTitle);
    const actionList = makeElement('ul', 'action-list');

    (monthContext ? monthContext.actions.map(([title, description]) => ({ icon: '⌖', title, description, timing: 'Review' })) : content.actions).forEach((action) => {
      const item = makeElement('li', '');
      const target = makeElement(action.view || action.action ? 'button' : 'div', 'action-card');
      if (target.tagName === 'BUTTON') {
        target.type = 'button';
        target.addEventListener('click', () => {
          if (action.view) window.setMosaicView?.(action.view);
          else if (action.action === 'download') document.querySelector('#download-csv')?.click();
        });
      }
      const icon = makeElement('span', 'action-icon', action.icon);
      icon.setAttribute('aria-hidden', 'true');
      const copy = makeElement('span', 'action-copy');
      copy.append(makeElement('strong', 'action-title', action.title));
      copy.append(makeElement('span', 'action-description', action.description));
      const timing = makeElement('span', 'action-timing', action.timing);
      timing.setAttribute('aria-label', `Timing: ${action.timing}`);
      target.append(icon, copy, timing);
      item.append(target);
      actionList.append(item);
    });
    actionsSection.append(actionList);
    module.append(actionsSection);
    root.append(module);

    if (monthContext) {
      window.dispatchEvent(new CustomEvent('calendarInsightsUpdated', {
        detail: {
          roleLabel: content.name,
          monthName: monthContext.monthName,
          year: monthContext.year,
          summary: monthContext.summary,
          actions: monthContext.actions.map(([title, description]) => ({ title, description })),
        },
      }));
    }
  }

  // The map page emits this event whenever a sidebar filter changes.
  window.addEventListener('filtersChanged', (event) => {
    const role = event.detail?.role;
    if (role && ROLE_CONTENT[role]) {
      selectedRole = role;
      render();
    }
  });

  window.addEventListener('calendarSelectionChanged', (event) => {
    calendarSelection = event.detail || null;
    if (calendarSelection?.role && ROLE_CONTENT[calendarSelection.role]) selectedRole = calendarSelection.role;
    render();
  });

  window.addEventListener('calendarSelectionCleared', () => {
    calendarSelection = null;
    render();
  });

  // The initial filter event may have fired before this deferred module loaded.
  if (roleSelect && ROLE_CONTENT[roleSelect.value]) selectedRole = roleSelect.value;
  render();
})();
