// Whether the user agent runs the WebKit engine (Safari, and every browser or
// WebView on iOS regardless of branding, e.g. Chrome on iOS is `CriOS`).
// Blink-based browsers also advertise `AppleWebKit`, but are distinguishable by
// their `Chrome/`, `Chromium` or `Android` tokens.
export const isWebKitUserAgent = (userAgent: string): boolean =>
  userAgent.includes('AppleWebKit') && !/Chrome\/|Chromium|Android/.test(userAgent);

// The Safari major version (from the `Version/<n>` token), or null when the user
// agent is not Safari.
export const getSafariMajorVersion = (userAgent: string): number | null => {
  const match = userAgent.match(/Version\/(\d+).+Safari/);
  return match ? Number(match[1]) : null;
};
