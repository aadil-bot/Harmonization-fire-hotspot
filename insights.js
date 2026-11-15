// Editable demo content for every sidebar role. Scores are illustrative and
// are not operational forecasts or verified hotspot measurements.
const ROLE_CONTENT = {
  'emergency-response': {
    name: 'Emergency Response',
    features: ['Regions with elevated fire-weather conditions', 'Recent hotspot activity and anomalies', '1–7 day fire-weather outlook', 'Regional preparedness priority indicators', 'Nearby reported fire incidents, if available', 'Suggested resource-readiness reviews'],
    title: 'Emergency Preparedness',
    description: 'Support readiness planning using historical activity, recent detections, and forecast conditions.',
    stats: [
      { label: '7-day preparedness outlook', value: 'Elevated', caption: 'Illustrative conditions for the coming week' },
      { label: 'Regional hotspot anomaly', value: '+42%', caption: 'Compared with a typical period' },
      { label: 'Peak forecast conditions', value: 'Day 4', caption: 'Illustrative peak in this outlook' },
    ],
    outlook: [38, 51, 66, 82, 74, 58, 43],
    actions: [
      { icon: '⚑', title: 'Review response readiness', description: 'Check team availability and incident coordination plans.', timing: 'Next 24h' },
      { icon: '⌖', title: 'Prioritize watch areas', description: 'Review repeated or expanding detections with local teams.', timing: 'Today' },
      { icon: '↗', title: 'Coordinate situation updates', description: 'Share relevant observations with response partners.', timing: 'Prepare' },
    ],
  },
  scientist: {
    name: 'Scientists',
    features: ['Before-and-after harmonization charts', 'Historical anomaly analysis', 'Sensor calibration and model validation'],
    title: 'Research context',
    description: 'Explore seasonal patterns and long-term change across the harmonized satellite fire record.',
    stats: [
      { label: '7-day activity signal', value: 'Variable', caption: 'Illustrative outlook score summary' },
      { label: 'Regional hotspot anomaly', value: '+12%', caption: 'Compared with a typical period' },
      { label: 'Peak forecast conditions', value: 'Day 3', caption: 'Illustrative peak in this outlook' },
    ],
    outlook: [24, 46, 61, 55, 39, 28, 33],
    actions: [
      { icon: '⌕', title: 'Compare seasonal windows', description: 'Review matched periods across multiple years.', timing: 'Explore' },
      { icon: '▤', title: 'Check sensor context', description: 'Consider coverage and confidence when interpreting detections.', timing: 'Review' },
      { icon: '↗', title: 'Document assumptions', description: 'Record date bounds and data choices for reproducibility.', timing: 'Ongoing' },
    ],
  },
  'land-manager': {
    name: 'Land Managers',
    features: ['Historical burning frequency by region', 'Seasonal hotspot activity calendar', 'Vegetation and land-cover overlays', 'Areas with recurring burning activity', 'Land management planning recommendations'],
    title: 'Land and fire planning',
    description: 'Use historical fire activity and current signals to inform land stewardship and seasonal planning.',
    stats: [
      { label: '7-day preparedness outlook', value: 'Moderate', caption: 'Illustrative conditions for the coming week' },
      { label: 'Regional hotspot anomaly', value: '+26%', caption: 'Compared with a typical period' },
      { label: 'Peak forecast conditions', value: 'Day 6', caption: 'Illustrative peak in this outlook' },
    ],
    outlook: [27, 34, 42, 48, 59, 72, 63],
    actions: [
      { icon: '⌖', title: 'Review managed areas', description: 'Compare detections with local land and forest boundaries.', timing: 'Today' },
      { icon: '◷', title: 'Check recurring periods', description: 'Identify seasons with repeatedly elevated activity.', timing: 'Plan' },
      { icon: '↗', title: 'Coordinate local context', description: 'Discuss observations with community and field partners.', timing: 'Prepare' },
    ],
  },
  firefighter: {
    name: 'Firefighters',
    features: ['Latest satellite hotspot detections', 'Hotspot coordinates and timestamps', 'Detection confidence and fire radiative power', 'Wind and weather overlays', 'Incident verification information'],
    title: 'Operational awareness',
    description: 'Review recent satellite detections alongside local reports to support situational awareness.',
    stats: [
      { label: '7-day preparedness outlook', value: 'Elevated', caption: 'Illustrative conditions for the coming week' },
      { label: 'Regional hotspot anomaly', value: '+31%', caption: 'Compared with a typical period' },
      { label: 'Peak forecast conditions', value: 'Day 2', caption: 'Illustrative peak in this outlook' },
    ],
    outlook: [71, 78, 64, 53, 47, 39, 33],
    actions: [
      { icon: '⌖', title: 'Check recent detections', description: 'Review timing and location with trusted ground reports.', timing: 'Now' },
      { icon: '⚑', title: 'Review local readiness', description: 'Follow established procedures for staffing and equipment.', timing: 'Next 24h' },
      { icon: '↗', title: 'Share verified updates', description: 'Keep operational partners informed of confirmed conditions.', timing: 'Ongoing' },
    ],
  },
  'general-view': {
    name: 'General View',
    features: ['Interactive hotspot map', 'Current versus historical fire activity', '7-day weather outlook', 'Regional hotspot counts'],
    title: 'Fire activity overview',
    description: 'Explore the broad picture of historical fire activity and an illustrative seven-day outlook.',
    stats: [
      { label: '7-day outlook', value: 'Moderate', caption: 'Illustrative conditions for the coming week' },
      { label: 'Regional hotspot anomaly', value: '+21%', caption: 'Compared with a typical period' },
      { label: 'Peak forecast conditions', value: 'Day 4', caption: 'Illustrative peak in this outlook' },
    ],
    outlook: [29, 41, 53, 67, 61, 48, 35],
    actions: [
      { icon: '⌕', title: 'Explore the selected period', description: 'Review where and when satellite hotspots were detected.', timing: 'Explore' },
      { icon: '◷', title: 'Compare with past seasons', description: 'Look for recurring patterns across the timeline.', timing: 'Review' },
      { icon: 'ℹ', title: 'Interpret detections carefully', description: 'Hotspots are satellite observations, not confirmed fire perimeters.', timing: 'Note' },
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
      ? `No earlier same-month values are available in the selected range. The calendar shows ${Math.round(activity).toLocaleString()} detections for ${selection.monthName} ${selection.year}.`
      : `${Math.round(activity).toLocaleString()} detections in ${region} during ${selection.monthName} ${selection.year}; earlier same-month average is ${Math.round(average).toLocaleString()} across ${prior.length} ${prior.length === 1 ? 'year' : 'years'} (${difference >= 0 ? '+' : ''}${difference.toFixed(0)}%). Values use ${selection.mode}.`;

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
      summary: comparison,
      actions: actionTemplates[selectedRole] || actionTemplates['general-view'],
      monthName: selection.monthName,
      year: selection.year,
    };
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
      const item = makeElement('li', 'hotspot-dialog-action');
      const copy = makeElement('span', 'hotspot-dialog-action-copy');
      copy.append(makeElement('strong', '', action.title));
      copy.append(makeElement('span', '', action.description));
      item.append(copy, makeElement('span', 'hotspot-dialog-action-timing', action.timing));
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

    const badge = makeElement('span', 'demo-badge', 'Demo data');
    badge.setAttribute('aria-label', 'Demo data, illustrative values');
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
    stats.setAttribute('aria-label', 'Illustrative summary statistics');
    (monthContext?.stats || content.stats).forEach((stat) => {
      const card = makeElement('article', 'insight-stat');
      card.append(makeElement('span', 'insight-stat-label', stat.label));
      card.append(makeElement('strong', 'insight-stat-value', stat.value));
      card.append(makeElement('span', 'insight-stat-caption', stat.caption));
      stats.append(card);
    });
    module.append(stats);

    const outlookSection = makeElement('section', 'outlook-section');
    outlookSection.setAttribute('aria-labelledby', 'outlook-title');
    const outlookHeader = makeElement('div', 'outlook-heading');
    outlookHeader.append(makeElement('h3', '', monthContext ? 'Selected month context' : '7-day outlook'));
    outlookHeader.lastElementChild.id = 'outlook-title';
    outlookHeader.append(makeElement('span', 'illustrative-label', monthContext ? 'SELECT A MONTH IN THE CALENDAR TO UPDATE THIS SUMMARY' : 'ILLUSTRATIVE · SCORE OUT OF 100'));
    outlookSection.append(outlookHeader);

    const dayRow = makeElement('div', 'outlook-days');
    dayRow.setAttribute('role', 'group');
    dayRow.setAttribute('aria-label', 'Illustrative daily outlook scores, Monday through Sunday');
    const selection = makeElement('p', 'outlook-selection');
    selection.id = 'outlook-selection';
    selection.setAttribute('aria-live', 'polite');
    selection.textContent = 'Select a day to see its illustrative score.';

    (monthContext ? [] : content.outlook).forEach((score, index) => {
      const day = DAYS[index];
      const band = scoreClass(score);
      const tile = makeElement('button', `outlook-day ${band.className}`);
      tile.type = 'button';
      tile.setAttribute('aria-pressed', 'false');
      tile.setAttribute('aria-label', `${day}: ${score} out of 100, ${band.label.toLowerCase()} illustrative outlook score`);
      tile.append(makeElement('span', 'outlook-day-name', day));
      const icon = makeElement('span', 'outlook-day-icon', DAY_ICONS[index]);
      icon.setAttribute('aria-hidden', 'true');
      tile.append(icon);
      tile.append(makeElement('span', 'outlook-day-score', `${score}/100`));
      tile.append(makeElement('span', 'outlook-day-level', band.label));
      tile.addEventListener('click', () => {
        dayRow.querySelectorAll('.outlook-day').forEach((otherTile) => otherTile.setAttribute('aria-pressed', 'false'));
        tile.setAttribute('aria-pressed', 'true');
        selection.textContent = `${day}: ${score} / 100`;
      });
      dayRow.append(tile);
    });
    if (monthContext) {
      outlookSection.append(makeElement('p', 'outlook-selection', `Showing historical month context for ${monthContext.monthName} ${monthContext.year}. The calendar popup compares this month with earlier years.`));
    } else {
      outlookSection.append(dayRow, selection);
    }
    module.append(outlookSection);

    const actionsSection = makeElement('section', 'actions-section');
    actionsSection.setAttribute('aria-labelledby', 'actions-title');
    const actionsTitle = makeElement('h3', 'actions-heading', 'Recommended action items');
    actionsTitle.id = 'actions-title';
    actionsSection.append(actionsTitle);
    const actionList = makeElement('ul', 'action-list');

    (monthContext ? monthContext.actions.map(([title, description]) => ({ icon: '⌖', title, description, timing: 'Review' })) : content.actions).forEach((action) => {
      const item = makeElement('li', 'action-card');
      const icon = makeElement('span', 'action-icon', action.icon);
      icon.setAttribute('aria-hidden', 'true');
      const copy = makeElement('span', 'action-copy');
      copy.append(makeElement('strong', 'action-title', action.title));
      copy.append(makeElement('span', 'action-description', action.description));
      const timing = makeElement('span', 'action-timing', action.timing);
      timing.setAttribute('aria-label', `Timing: ${action.timing}`);
      item.append(icon, copy, timing);
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
