(function () {
  if (window.__onboardaiLoaderInit) return;
  window.__onboardaiLoaderInit = true;

  const script = document.createElement('script');
  script.src = '/static/onboarding-sidebar.js';
  script.defer = true;
  document.head.appendChild(script);
})();
