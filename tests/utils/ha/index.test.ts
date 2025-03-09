import { describe, expect, it, vi } from 'vitest';
import { HomeAssistant } from '../../../src/ha/types.js';
import {
  canonicalizeHAURL,
  hasHAConnectionStateChanged,
  isHARelativeURL,
} from '../../../src/utils/ha/index.js';
import { createHASS } from '../../test-utils.js';

const createConnected = (connected: boolean): HomeAssistant => {
  const hass = createHASS();
  hass.connected = connected;
  return hass;
};

describe('hasHAConnectionStateChanged', () => {
  it('initially connected', () => {
    expect(hasHAConnectionStateChanged(null, createConnected(true))).toBeTruthy();
  });
  it('initially disconnected', () => {
    expect(hasHAConnectionStateChanged(null, createConnected(false))).toBeTruthy();
  });
  it('disconnected', () => {
    expect(
      hasHAConnectionStateChanged(createConnected(true), createConnected(false)),
    ).toBeTruthy();
  });
  it('disconnected via absence', () => {
    expect(hasHAConnectionStateChanged(createConnected(true), null)).toBeTruthy();
  });
  it('connected', () => {
    expect(
      hasHAConnectionStateChanged(createConnected(false), createConnected(true)),
    ).toBeTruthy();
  });
  it('still disconnected', () => {
    expect(
      hasHAConnectionStateChanged(createConnected(false), createConnected(false)),
    ).toBeFalsy();
  });
  it('still connected', () => {
    expect(
      hasHAConnectionStateChanged(createConnected(true), createConnected(true)),
    ).toBeFalsy();
  });
  it('still absent', () => {
    expect(hasHAConnectionStateChanged(null, null)).toBeFalsy();
  });
});

describe('isHARelativeURL', () => {
  it('should return true when URL is HA relative', () => {
    expect(isHARelativeURL('/api/foo')).toBeTruthy();
  });

  it('should return false when URL is not HA relative', () => {
    expect(isHARelativeURL('http://localhost/api/foo')).toBeFalsy();
  });
});

describe('canonicalizeHAURL', () => {
  it('should return canonicalized HA url', () => {
    const hass = createHASS();
    vi.mocked(hass.hassUrl).mockReturnValue('http://localhost:8123/foo/bar');

    expect(canonicalizeHAURL(hass, '/api/foo')).toBe('http://localhost:8123/foo/bar');
  });

  it('should return untouched URL when not HA relative', () => {
    expect(canonicalizeHAURL(createHASS(), 'http://localhost:8123/foo/bar')).toBe(
      'http://localhost:8123/foo/bar',
    );
  });

  it('should return null without a URL', () => {
    expect(canonicalizeHAURL(createHASS())).toBeNull();
  });
});
