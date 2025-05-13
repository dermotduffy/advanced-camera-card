export function isHARelativeURL(url?: string): boolean {
  return !!url?.startsWith('/');
}
