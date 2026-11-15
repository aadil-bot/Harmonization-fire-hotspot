(() => {
  'use strict';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;

  const selector = [
    '.about-main > section','.about-main > footer','.analysis-view','.insights-panel',
    '.outlook-section','.outlook-chart-panel','.trend-metric','.insight-stat',
    '.outlook-metric','.sensor-card','.limits-grid article','.calibration-panel',
    '.about-source','.preview-window','.data-story',
  ].join(',');
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('is-revealed');
    observer.unobserve(entry.target);
  }), { threshold:.06, rootMargin:'0px 0px -28px 0px' });

  function observe(root) {
    if (root.matches?.(selector) && !root.classList.contains('site-reveal')) {
      root.classList.add('site-reveal'); observer.observe(root);
    }
    root.querySelectorAll?.(selector).forEach((element) => {
      if (element.classList.contains('site-reveal')) return;
      element.classList.add('site-reveal'); observer.observe(element);
    });
  }
  observe(document);
  document.documentElement.classList.add('site-motion-ready');
  new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) observe(node);
  }))).observe(document.body, { childList:true, subtree:true });
})();
