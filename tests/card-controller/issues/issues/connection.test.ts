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

  it('should report an issue when hass is disconnected', () => {
    const issue = new ConnectionIssue();
    const hass = createHASS();
    hass.connected = false;

    issue.detectDynamic({ hass });

    expect(issue.hasIssue()).toBe(true);
  });

  it('should not report an issue when hass is connected', () => {
    const issue = new ConnectionIssue();
    const hass = createHASS();
    hass.connected = true;

    issue.detectDynamic({ hass });

    expect(issue.hasIssue()).toBe(false);
    expect(issue.getIssue()).toBeNull();
  });

  it('should clear a connection state when hass reconnects', () => {
    const issue = new ConnectionIssue();
    const hass = createHASS();

    hass.connected = false;
    issue.detectDynamic({ hass });
    expect(issue.hasIssue()).toBe(true);

    hass.connected = true;
    issue.detectDynamic({ hass });
    expect(issue.hasIssue()).toBe(false);
  });

  it('should return true for isFullCardIssue', () => {
    const issue = new ConnectionIssue();
    expect(issue.isFullCardIssue()).toBe(true);
  });

  it('should return expected shape from getIssue when connection is lost', () => {
    const issue = new ConnectionIssue();
    const hass = createHASS();
    hass.connected = false;
    issue.detectDynamic({ hass });

    const result = issue.getIssue();
    expect(result).toEqual(
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
            text: 'Connection to Home Assistant lost. Reconnecting',
          }),
        }),
      }),
    );
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
