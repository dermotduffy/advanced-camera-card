import { describe, expect, it } from 'vitest';

import { ConnectionIssue } from '../../../../src/card-controller/issues/issues/connection';

describe('ConnectionIssue', () => {
  it('should have correct key', () => {
    const issue = new ConnectionIssue();
    expect(issue.key).toBe('connection');
  });

  it('should report no issue when hassReadiness has never been set', () => {
    const issue = new ConnectionIssue();

    issue.detectDynamic({});

    expect(issue.hasIssue()).toBe(false);
    expect(issue.getIssue()).toBeNull();
  });

  it('should report a lost issue when disconnected', () => {
    const issue = new ConnectionIssue();

    issue.detectDynamic({ hassReadiness: 'disconnected' });

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

  it('should report a starting issue when starting', () => {
    const issue = new ConnectionIssue();

    issue.detectDynamic({ hassReadiness: 'starting' });

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

  it('should not report an issue when ready', () => {
    const issue = new ConnectionIssue();

    issue.detectDynamic({ hassReadiness: 'ready' });

    expect(issue.hasIssue()).toBe(false);
    expect(issue.getIssue()).toBeNull();
  });

  it('should clear when hass transitions disconnected to starting to ready', () => {
    const issue = new ConnectionIssue();

    issue.detectDynamic({ hassReadiness: 'disconnected' });
    expect(issue.hasIssue()).toBe(true);
    expect(issue.getIssue()?.notification.heading?.text).toBe('Connection lost');

    issue.detectDynamic({ hassReadiness: 'starting' });
    expect(issue.hasIssue()).toBe(true);
    expect(issue.getIssue()?.notification.heading?.text).toBe(
      'Home Assistant is starting',
    );

    issue.detectDynamic({ hassReadiness: 'ready' });
    expect(issue.hasIssue()).toBe(false);
  });

  it('should report starting when reconnected with stale config', () => {
    const issue = new ConnectionIssue();

    issue.detectDynamic({ hassReadiness: 'ready' });
    expect(issue.hasIssue()).toBe(false);

    issue.detectDynamic({ hassReadiness: 'disconnected' });
    expect(issue.hasIssue()).toBe(true);

    // HASSManager reports 'starting' when the reconnected hass still carries
    // the pre-disconnect config object.
    issue.detectDynamic({ hassReadiness: 'starting' });
    expect(issue.hasIssue()).toBe(true);
    expect(issue.getIssue()?.notification.heading?.text).toBe(
      'Home Assistant is starting',
    );
  });

  it('should return true for isFullCardIssue', () => {
    const issue = new ConnectionIssue();
    expect(issue.isFullCardIssue()).toBe(true);
  });

  it('should clear the issue after reset', () => {
    const issue = new ConnectionIssue();
    issue.detectDynamic({ hassReadiness: 'disconnected' });
    expect(issue.hasIssue()).toBe(true);

    issue.reset();

    expect(issue.hasIssue()).toBe(false);
    expect(issue.getIssue()).toBeNull();
  });
});
