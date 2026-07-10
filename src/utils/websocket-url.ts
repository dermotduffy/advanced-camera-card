// Convert an HTTP(S) or origin-relative URL to its WS(S) equivalent.
export const convertToWebSocketURL = (url: string, origin?: string): string => {
  if (/^http/i.test(url)) {
    return 'ws' + url.substring(4);
  }
  if (url.startsWith('/')) {
    return 'ws' + (origin ?? location.origin).substring(4) + url;
  }
  return url;
};
