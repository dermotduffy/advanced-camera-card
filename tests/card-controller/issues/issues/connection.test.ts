import { STATE_RUNNING, STATE_STARTING } from 'home-assistant-js-websocket';
import { describe, expect, it } from 'vitest';
import { ConnectionIssue } from '../../../../src/card-controller/issues/issues/connection';
import { createHASS } from '../../../test-utils';

describe('ConnectionIssue', () => {
  it('should have correct key', () => {
    const issue = new ConnectionIssue();
    expect(issue.key).toBe('connection');
  });

  it('should report no issue when hass has never been set', () => {
    const issue = new ConnectionIssue();

    issue.detectDynamic({});

    expect(issue.hasIssue()).toBe(false);
    expect(issue.getIssue()).toBeNull();
  });

  it('should report a lost issue when hass is disconnected', () => {
    const issue = new ConnectionIssue();
    const hass = createHASS();
    hass.connected = false;

    issue.detectDynamic({ hass });

    expect(issue.hasIssue()).toBe(true);
    expect(issue.getIssue()).toEqual(
      expect.objectContaining({
        icon: 'mdi:lan-disconnect',
        severity: 'high',
        notification: expect.objectContaining({
          in_progress: true,
          heading: expect.objectContaining({
            text: 'Connection lost',
            icon: 'mdi:lan-disconnect',
            severity: 'high',
          }),
          body: expect.objectContaining({
            text: 'Connection to Home Assistant lost',
          }),
        }),
      }),
    );
  });

  it('should report a starting issue when hass is connected but not running', () => {
    const issue = new ConnectionIssue();
    const hass = createHASS();
    hass.connected = true;
    hass.config.state = STATE_STARTING;

    issue.detectDynamic({ hass });

    expect(issue.hasIssue()).toBe(true);
    expect(issue.getIssue()).toEqual(
      expect.objectContaining({
        icon: 'mdi:home-assistant',
        severity: 'medium',
        notification: expect.objectContaining({
          in_progress: true,
          heading: expect.objectContaining({
            text: 'Home Assistant is starting',
            icon: 'mdi:home-assistant',
            severity: 'medium',
          }),
          body: expect.objectContaining({
            text: 'Waiting for Home Assistant startup to complete',
          }),
        }),
      }),
    );
  });

  it('should not report an issue when hass is connected and running', () => {
    const issue = new ConnectionIssue();
    const hass = createHASS();
    hass.connected = true;
    hass.config.state = STATE_RUNNING;

    issue.detectDynamic({ hass });

    expect(issue.hasIssue()).toBe(false);
    expect(issue.getIssue()).toBeNull();
  });

  it('should clear when hass transitions lost → starting → ready', () => {
    const issue = new ConnectionIssue();
    const hass = createHASS();

    hass.connected = false;
    issue.detectDynamic({ hass });
    expect(issue.hasIssue()).toBe(true);
    expect(issue.getIssue()?.notification.heading?.text).toBe('Connection lost');

    hass.connected = true;
    hass.config.state = STATE_STARTING;
    issue.detectDynamic({ hass });
    expect(issue.hasIssue()).toBe(true);
    expect(issue.getIssue()?.notification.heading?.text).toBe(
      'Home Assistant is starting',
    );

    hass.config.state = STATE_RUNNING;
    issue.detectDynamic({ hass });
    expect(issue.hasIssue()).toBe(false);
  });

  it('should return true for isFullCardIssue', () => {
    const issue = new ConnectionIssue();
    expect(issue.isFullCardIssue()).toBe(true);
  });

  it('should clear the issue after reset', () => {
    const issue = new ConnectionIssue();
    const hass = createHASS();
    hass.connected = false;
    issue.detectDynamic({ hass });
    expect(issue.hasIssue()).toBe(true);

    issue.reset();

    expect(issue.hasIssue()).toBe(false);
    expect(issue.getIssue()).toBeNull();
  });
});
