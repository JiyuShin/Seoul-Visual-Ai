let loadPromise = null;

export function loadWebGazerScript() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('WebGazer can only load in the browser'));
  }

  if (window.webgazer) {
    return Promise.resolve(window.webgazer);
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-webgazer="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.webgazer));
      existing.addEventListener('error', () => reject(new Error('WebGazer script failed to load')));
      return;
    }

    const script = document.createElement('script');
    script.src = '/webgazer.js';
    script.async = false;
    script.dataset.webgazer = 'true';
    script.onload = () => {
      if (window.webgazer) {
        resolve(window.webgazer);
      } else {
        reject(new Error('WebGazer loaded but window.webgazer is missing'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load /webgazer.js'));
    document.head.appendChild(script);
  });

  return loadPromise;
}
