import { STATE_RUNNING } from 'home-assistant-js-websocket';
import { describe, expect, it } from 'vitest';

import { isHassReady } from '../../src/ha/is-hass-ready';
import { createHASS } from '../test-utils';

describe('isHassReady', () => {
  it('should return false for null', () => {
    expect(isHassReady(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isHassReady(undefined)).toBe(false);
  });

  it('should return false when disconnected', () => {
    const hass = createHASS();
    hass.connected = false;
    expect(isHassReady(hass)).toBe(false);
  });

  it('should return false when integrations are still loading', () => {
    const hass = createHASS();
    hass.connected = true;
    hass.config.state = 'NOT_RUNNING';
    expect(isHassReady(hass)).toBe(false);
  });

  it('should return true when connected and running', () => {
    const hass = createHASS();
    hass.connected = true;
    hass.config.state = STATE_RUNNING;
    expect(isHassReady(hass)).toBe(true);
  });
});
