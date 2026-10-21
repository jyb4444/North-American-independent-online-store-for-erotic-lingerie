// Coordination between full-screen pop-ups (age gate, first-order offer) and the smaller
// promotional slide-ins, so they never stack on top of each other.

export const AGE_COOKIE = 'velour_age_verified';
export const AGE_VERIFIED_EVENT = 'velour:age-verified';

export function isAgeVerified(): boolean {
  return typeof document !== 'undefined'
    && document.cookie.split(';').some((cookie) => cookie.trim().startsWith(`${AGE_COOKIE}=1`));
}

/** True while a blocking modal (marked with data-blocking-modal) is on screen. */
export function isBlockingModalOpen(): boolean {
  return typeof document !== 'undefined' && document.querySelector('[data-blocking-modal]') !== null;
}

/** Runs `callback` once the visitor has passed the age gate (immediately if they already have). */
export function onAgeVerified(callback: () => void): () => void {
  if (isAgeVerified()) {
    callback();
    return () => {};
  }
  window.addEventListener(AGE_VERIFIED_EVENT, callback, { once: true });
  return () => window.removeEventListener(AGE_VERIFIED_EVENT, callback);
}

/**
 * Inline script for <head>: marks <html data-age-verified> before first paint so the
 * server-rendered age gate is hidden immediately for returning, verified visitors.
 */
export const AGE_GATE_PREPAINT_SCRIPT = `try{if(document.cookie.split(';').some(function(c){return c.trim().indexOf('${AGE_COOKIE}=1')===0}))document.documentElement.setAttribute('data-age-verified','')}catch(e){}`;
