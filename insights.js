// Editable demo content for every sidebar role. Scores are illustrative and
// are not operational forecasts or verified hotspot measurements.
const ROLE_CONTENT = {
  'early-warning': {
    name: 'Early Warning',
    title: 'Early warning outlook',
    description: 'Surface emerging activity early by reviewing historical patterns, recent detections, and forecast conditions.',
    stats: [
      { label: '7-day preparedness outlook', value: 'Moderate', caption: 'Illustrative conditions for the coming week' },
      { label: 'Regional hotspot anomaly', value: '+18%', caption: 'Compared with a typical period' },
      { label: 'Peak forecast conditions', value: 'Day 5', caption: 'Illustrative peak in this outlook' },
    ],
    outlook: [32, 38, 44, 57, 68, 52, 36],
    actions: [
      { icon: '⌕', title: 'Review emerging clusters', description: 'Check recent detections near communities and critical services.', timing: 'Today' },
      { icon: '◷', title: 'Compare seasonal activity', description: 'Look for changes against the same period in prior years.', timing: 'Prepare' },
      { icon: '↗', title: 'Share an early signal', description: 'Pass notable changes to local monitoring partners.', timing: 'Next 24h' },
    ],
  },
  'emergency-response': {
    name: 'Emergency Response',
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
    name: 'Scientist',
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
    name: 'Land Manager',
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
    name: 'Firefighter',
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

  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const DAY_ICONS = ['⌁', '☼', '⌖', '◷', '⌁', '☼', '⌖'];
  let selectedRole = roleSelect?.value || 'general-view';

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

  function render() {
    const content = ROLE_CONTENT[selectedRole] || ROLE_CONTENT['general-view'];
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

    const stats = makeElement('div', 'insight-stats');
    stats.setAttribute('aria-label', 'Illustrative summary statistics');
    content.stats.forEach((stat) => {
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
    outlookHeader.append(makeElement('h3', '', '7-day outlook'));
    outlookHeader.lastElementChild.id = 'outlook-title';
    outlookHeader.append(makeElement('span', 'illustrative-label', 'ILLUSTRATIVE · SCORE OUT OF 100'));
    outlookSection.append(outlookHeader);

    const dayRow = makeElement('div', 'outlook-days');
    dayRow.setAttribute('role', 'group');
    dayRow.setAttribute('aria-label', 'Illustrative daily outlook scores, Monday through Sunday');
    const selection = makeElement('p', 'outlook-selection');
    selection.id = 'outlook-selection';
    selection.setAttribute('aria-live', 'polite');
    selection.textContent = 'Select a day to see its illustrative score.';

    content.outlook.forEach((score, index) => {
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
    outlookSection.append(dayRow, selection);
    module.append(outlookSection);

    const actionsSection = makeElement('section', 'actions-section');
    actionsSection.setAttribute('aria-labelledby', 'actions-title');
    const actionsTitle = makeElement('h3', 'actions-heading', 'Recommended action items');
    actionsTitle.id = 'actions-title';
    actionsSection.append(actionsTitle);
    const actionList = makeElement('ul', 'action-list');

    content.actions.forEach((action) => {
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
  }

  // The map page emits this event whenever a sidebar filter changes.
  window.addEventListener('filtersChanged', (event) => {
    const role = event.detail?.role;
    if (role && ROLE_CONTENT[role]) {
      selectedRole = role;
      render();
    }
  });

  // The initial filter event may have fired before this deferred module loaded.
  if (roleSelect && ROLE_CONTENT[roleSelect.value]) selectedRole = roleSelect.value;
  render();
})();
