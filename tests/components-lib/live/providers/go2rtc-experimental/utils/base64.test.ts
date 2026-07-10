import { describe, expect, it } from 'vitest';

import { arrayBufferToBase64 } from '../../../../../../src/components-lib/live/providers/go2rtc-experimental/utils/base64';

// @vitest-environment jsdom
describe('arrayBufferToBase64', () => {
  it('should base64-encode the bytes', () => {
    const bytes = new TextEncoder().encode('Hi');
    expect(arrayBufferToBase64(bytes.buffer)).toBe('SGk=');
  });

  it('should encode an empty buffer as an empty string', () => {
    expect(arrayBufferToBase64(new ArrayBuffer(0))).toBe('');
  });
});
