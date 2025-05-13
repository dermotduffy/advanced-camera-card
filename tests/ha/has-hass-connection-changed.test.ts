import { describe, expect, it } from 'vitest';
import { hasHAConnectionStateChanged } from '../../src/ha/has-hass-connection-changed';
import { createHASS } from '../test-utils';

describe('hasHAConnectionStateChanged', () => {
  it('returns false if both oldHass and newHass are undefined', () => {
    expect(hasHAConnectionStateChanged()).toBe(false);
  });

  it('returns false if both oldHass and newHass are null', () => {
    expect(hasHAConnectionStateChanged(null, null)).toBe(false);
  });

  it('returns false if both oldHass and newHass are the same object', () => {
    const hass = createHASS();
    expect(hasHAConnectionStateChanged(hass, hass)).toBe(false);
  });

  it('returns false if both oldHass.connected and newHass.connected are the same', () => {
    const oldHass = createHASS();
    const newHass = createHASS();
    oldHass.connected = true;
    newHass.connected = true;
    expect(hasHAConnectionStateChanged(oldHass, newHass)).toBe(false);
  });

  it('returns true if oldHass.connected and newHass.connected are different', () => {
    const oldHass = createHASS();
    const newHass = createHASS();
    oldHass.connected = true;
    newHass.connected = false;
    expect(hasHAConnectionStateChanged(oldHass, newHass)).toBe(true);
  });
});
