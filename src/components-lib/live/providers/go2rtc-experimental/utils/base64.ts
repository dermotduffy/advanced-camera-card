export const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';

  // `btoa` needs bytes as a binary string, build char-by-char.
  for (let i = 0; i < bytes.byteLength; ++i) {
    binary += String.fromCharCode(bytes[i]);
  }

  return window.btoa(binary);
};
