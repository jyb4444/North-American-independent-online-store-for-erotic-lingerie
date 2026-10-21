/**
 * Returns `value` if it is a same-site relative path (e.g. "/orders?tab=1"), else `fallback`.
 * Redirect targets come from query strings, so values like "//evil.com", "@evil.com" or
 * "https://evil.com" must never be followed.
 */
export function safeRedirectPath(value: string | null | undefined, fallback = '/account'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const url = new URL(value, 'http://same-site.invalid');
    if (url.host !== 'same-site.invalid') return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
