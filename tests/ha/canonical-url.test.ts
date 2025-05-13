import { describe, expect, it, vi } from 'vitest';
import { canonicalizeHAURL } from '../../src/ha/canonical-url';
import { createHASS } from '../test-utils';

describe('canonicalizeHAURL', () => {
  it('returns canonicalized URL for HA relative URL', () => {
    const hass = createHASS();
    hass.hassUrl = vi.fn((url) => 'hass:' + url);

    const url = '/media/local/file.mp4';
    expect(canonicalizeHAURL(hass, url)).toBe('hass:/media/local/file.mp4');
  });

  it('returns original URL for absolute URL', () => {
    const url = 'https://card.camera/file.mp4';
    expect(canonicalizeHAURL(createHASS(), url)).toBe(url);
  });

  it('returns null if url is null', () => {
    expect(canonicalizeHAURL(createHASS())).toBeNull();
  });
});
