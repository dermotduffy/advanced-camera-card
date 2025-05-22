export const downloadURL = (url: string, filename = 'download'): void => {
  // The download attribute only works on the same origin.
  // See: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#attributes
  const isSameOrigin = new URL(url).origin === window.location.origin;
  const dataURL = url.startsWith('data:');

  if (!isSameOrigin && !dataURL) {
    window.open(url, '_blank');
    return;
  }

  // Use the HTML5 download attribute to prevent a new window from
  // temporarily opening.
  const link = document.createElement('a');
  link.setAttribute('download', filename);
  link.href = url;
  link.click();
  link.remove();
};
