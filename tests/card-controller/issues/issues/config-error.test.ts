import { describe, expect, it } from 'vitest';
import { ConfigErrorIssue } from '../../../../src/card-controller/issues/issues/config-error';

describe('ConfigErrorIssue', () => {
  it('should have correct key', () => {
    const issue = new ConfigErrorIssue();
    expect(issue.key).toBe('config_error');
  });

  it('should report no issue when untriggered', () => {
    const issue = new ConfigErrorIssue();
    expect(issue.hasIssue()).toBe(false);
    expect(issue.getIssue()).toBeNull();
  });

  it('should report an issue after trigger with an error', () => {
    const issue = new ConfigErrorIssue();
    issue.trigger({ error: new Error('bad config') });

    expect(issue.hasIssue()).toBe(true);
  });

  it('should report an issue after trigger with a string error', () => {
    const issue = new ConfigErrorIssue();
    issue.trigger({ error: 'string error' });

    expect(issue.hasIssue()).toBe(true);
  });

  it('should treat a triggered null/undefined error as no issue', () => {
    const issue = new ConfigErrorIssue();
    issue.trigger({ error: undefined });

    expect(issue.hasIssue()).toBe(false);
    expect(issue.getIssue()).toBeNull();
  });

  it('isFullCardIssue should return true', () => {
    const issue = new ConfigErrorIssue();
    expect(issue.isFullCardIssue()).toBe(true);
  });

  it('getIssue should return a IssueDescription with expected shape', () => {
    const issue = new ConfigErrorIssue();
    issue.trigger({ error: new Error('config is invalid') });

    const result = issue.getIssue();
    expect(result).toEqual(
      expect.objectContaining({
        icon: 'mdi:alert',
        severity: 'high',
        notification: expect.objectContaining({
          body: expect.objectContaining({
            text: 'config is invalid',
          }),
        }),
      }),
    );
  });

  it('should clear the issue after reset', () => {
    const issue = new ConfigErrorIssue();
    issue.trigger({ error: new Error('oops') });
    expect(issue.hasIssue()).toBe(true);

    issue.reset();

    expect(issue.hasIssue()).toBe(false);
    expect(issue.getIssue()).toBeNull();
  });
});
