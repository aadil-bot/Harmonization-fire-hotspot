(function () {
  'use strict';

  const chart = document.querySelector('#calibration-chart');
  const detail = document.querySelector('#calibration-detail');
  const factors = window.MOSAIC_CALIBRATION_FACTORS || {};
  if (!chart || !detail) return;

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const values = months.map((name, index) => ({ name, short: shortMonths[index], month: index + 1, factor: Number(factors[String(index + 1)]) }));
  if (values.some((item) => !Number.isFinite(item.factor))) {
    chart.textContent = 'Monthly calibration factors could not be loaded.';
    return;
  }

  const svgNamespace = 'http://www.w3.org/2000/svg';
  const width = 920, height = 420, left = 56, right = 22, top = 38, bottom = 62;
  const plotWidth = width - left - right, plotHeight = height - top - bottom, scaleMax = 8;
  const makeSvg = (tag, attributes = {}) => {
    const element = document.createElementNS(svgNamespace, tag);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
  };
  const svg = makeSvg('svg', { viewBox: `0 0 ${width} ${height}`, role: 'group', 'aria-label': 'Interactive graph of the twelve monthly MODIS to VIIRS calibration factors. Focus a bar and press Enter or Space to read its value.' });

  [0, 2, 4, 6, 8].forEach((tick) => {
    const y = top + plotHeight - (tick / scaleMax) * plotHeight;
    svg.append(makeSvg('line', { x1: left, x2: width - right, y1: y, y2: y, class: 'grid-line' }));
    const label = makeSvg('text', { x: left - 12, y: y + 4, 'text-anchor': 'end', class: 'axis-label' });
    label.textContent = String(tick);
    svg.append(label);
  });

  const overallFactor = 2.78;
  const overallY = top + plotHeight - (overallFactor / scaleMax) * plotHeight;

  const band = plotWidth / values.length;
  values.forEach((item, index) => {
    const x = left + index * band + band * .23;
    const barWidth = band * .54;
    const barHeight = item.factor / scaleMax * plotHeight;
    const bar = makeSvg('rect', {
      x, y: top + plotHeight - barHeight, width: barWidth, height: barHeight, rx: 3,
      class: 'bar', tabindex: '0', role: 'button', 'data-month': String(item.month),
      'aria-label': `${item.name}, shrunk calibration factor ${item.factor.toFixed(2)}. Activate to see an example.`,
    });
    const title = makeSvg('title'); title.textContent = `${item.name}: k_shrunk = ${item.factor.toFixed(4)}`; bar.append(title);
    const valueLabel = makeSvg('text', { x: x + barWidth / 2, y: top + plotHeight - barHeight - 8, 'text-anchor': 'middle', class: 'axis-label' });
    valueLabel.textContent = item.factor.toFixed(1);
    const monthLabel = makeSvg('text', { x: x + barWidth / 2, y: height - 25, 'text-anchor': 'middle', class: 'month-label' });
    monthLabel.textContent = item.short;
    const activate = () => showMonth(item);
    bar.addEventListener('click', activate);
    bar.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); }
    });
    svg.append(bar, valueLabel, monthLabel);
  });
  // Draw the reference after the bars so it stays visible across the plot.
  svg.append(makeSvg('line', { x1: left, x2: width - right, y1: overallY, y2: overallY, class: 'overall-line' }));
  chart.replaceChildren(svg);

  function showMonth(item) {
    svg.querySelectorAll('.bar').forEach((bar) => bar.classList.toggle('is-selected', Number(bar.dataset.month) === item.month));
    const amount = document.createElement('strong'); amount.textContent = `${item.name} · k = ${item.factor.toFixed(2)}`;
    const explanation = document.createElement('span');
    explanation.textContent = `Example: 10 MODIS fire-cell-days in ${item.name} become about ${(10 * item.factor).toFixed(1)} VIIRS-scale activity units after weighting.`;
    detail.replaceChildren(amount, explanation);
  }
  showMonth(values[6]);
})();
