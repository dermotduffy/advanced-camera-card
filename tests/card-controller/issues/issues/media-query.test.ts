import { describe, expect, it } from 'vitest';
import { CardController } from '../../../../src/card-controller/controller';
import { MediaQueryIssue } from '../../../../src/card-controller/issues/issues/media-query';
import { InternalCallbackActionConfig } from '../../../../src/config/schema/actions/custom/internal';
import { createCardAPI } from '../../../test-utils';

const createIssue = (): {
  issue: MediaQueryIssue;
  api: CardController;
} => {
  const api = createCardAPI();
  const issue = new MediaQueryIssue(api);
  return { issue, api };
};

describe('MediaQueryIssue', () => {
  it('should have correct key', () => {
    const { issue } = createIssue();
    expect(issue.key).toBe('media_query');
  });

  it('should report no issue when untriggered', () => {
    const { issue } = createIssue();
    expect(issue.hasIssue()).toBe(false);
    expect(issue.getIssue()).toBeNull();
  });

  it('should report an issue after trigger with an error', () => {
    const { issue } = createIssue();
    issue.trigger({ error: new Error('query failed') });

    expect(issue.hasIssue()).toBe(true);
  });

  it('should treat a triggered null/undefined error as no issue', () => {
    const { issue } = createIssue();
    issue.trigger({ error: undefined });

    expect(issue.hasIssue()).toBe(false);
    expect(issue.getIssue()).toBeNull();
    expect(issue.needsRetry()).toBe(false);
  });

  it('should return expected shape from getIssue when triggered with an error', () => {
    const { issue } = createIssue();
    issue.trigger({ error: new Error('media query failed') });

    const result = issue.getIssue();
    expect(result).toEqual(
      expect.objectContaining({
        icon: 'mdi:alert',
        severity: 'high',
        notification: expect.objectContaining({
          body: expect.objectContaining({
            text: 'media query failed',
          }),
        }),
      }),
    );
  });

  describe('getNotification', () => {
    it('should return null when no error is set', () => {
      const { issue } = createIssue();

      expect(issue.getNotification()).toBeNull();
    });

    it('should return notification with retry control when triggered with an error', () => {
      const { issue } = createIssue();
      issue.trigger({ error: new Error('query failed') });

      const notification = issue.getNotification();
      expect(notification?.controls).toHaveLength(1);
      expect(notification?.controls?.[0]).toMatchObject({
        icon: 'mdi:refresh',
        dismiss: true,
      });
    });

    it('should call manager.retry with the issue key from retry control callback', async () => {
      const { issue, api } = createIssue();
      issue.trigger({ error: new Error('query failed') });

      const control = issue.getNotification()?.controls?.[0];
      const tapAction = control?.actions?.tap_action as InternalCallbackActionConfig;
      await tapAction.callback(api);

      expect(api.getIssueManager().retry).toBeCalledWith('media_query', true);
    });
  });

  describe('needsRetry', () => {
    it('should return true after trigger with an error', () => {
      const { issue } = createIssue();
      issue.trigger({ error: new Error('query failed') });

      expect(issue.needsRetry()).toBe(true);
    });

    it('should return false when not triggered', () => {
      const { issue } = createIssue();

      expect(issue.needsRetry()).toBe(false);
    });
  });

  describe('retry', () => {
    it('should return requery action and clear error and needsRetry', () => {
      const { issue, api } = createIssue();
      issue.trigger({ error: new Error('query failed') });

      const result = issue.retry();

      expect(result).toEqual(true);
      expect(api.getViewManager().setViewByParametersWithNewQuery).toBeCalled();
      expect(issue.needsRetry()).toBe(false);
      expect(issue.hasIssue()).toBe(false);
    });

    it('should return null when needsRetry is false', () => {
      const { issue } = createIssue();

      const result = issue.retry();

      expect(result).toBe(false);
    });
  });

  it('should clear the issue after reset', () => {
    const { issue } = createIssue();
    issue.trigger({ error: new Error('oops') });
    expect(issue.hasIssue()).toBe(true);

    issue.reset();

    expect(issue.hasIssue()).toBe(false);
    expect(issue.getIssue()).toBeNull();
  });

  it('should clear needsRetry after reset', () => {
    const { issue } = createIssue();
    issue.trigger({ error: new Error('oops') });
    expect(issue.needsRetry()).toBe(true);

    issue.reset();

    expect(issue.needsRetry()).toBe(false);
  });
});
