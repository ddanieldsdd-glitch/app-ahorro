/**
 * Vercel Web Analytics — thin wrapper for custom events on this static PWA.
 * Page views are automatic via /_vercel/insights/script.js in index.html.
 *
 * Enable first in Vercel Dashboard → Project → Analytics → Enable.
 */
const VercelAnalytics = {
  track(name, data) {
    try {
      if (typeof window.va === 'function') {
        window.va('event', data ? { name, data } : { name });
      }
    } catch { /* ignore offline / local */ }
  },
};

window.VercelAnalytics = VercelAnalytics;
