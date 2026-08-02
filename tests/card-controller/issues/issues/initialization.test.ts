import { assert, describe, expect, it, vi } from 'vitest';

import type { CardController } from '../../../../src/card-controller/controller';
import { InitializationIssue } from '../../../../src/card-controller/issues/issues/initialization';
import type { InternalCallbackActionConfig } from '../../../../src/config/schema/actions/custom/internal';
import { createCardAPI } from '../../../test-utils';

describe('InitializationIssue', () => {
  const createAPI = (areMandatoryAspectsInitialized = false): CardController => {
    const api = createCardAPI();
    vi.mocked(
      api.getInitializationManager().areMandatoryAspectsInitialized,
    ).mockReturnValue(areMandatoryAspectsInitialized);
    return api;
  };

  it('should have correct key', () => {
    const issue = new InitializationIssue(createAPI());
    expect(issue.key).toBe('initialization');
  });

  it('should report no issue when untriggered', () => {
    const issue = new InitializationIssue(createAPI());
    expect(issue.hasIssue()).toBe(false);
    expect(issue.getIssue()).toBeNull();
  });

  it('should report an issue after trigger', () => {
    const issue = new InitializationIssue(createAPI());
    issue.trigger({ error: new Error('init failed') });

    expect(issue.hasIssue()).toBe(true);
  });

  it('should treat a triggered null/undefined error as no issue', () => {
    const issue = new InitializationIssue(createAPI());
    issue.trigger({ error: undefined });

    expect(issue.hasIssue()).toBe(false);
    expect(issue.getIssue()).toBeNull();
    expect(issue.needsRetry()).toBe(false);
  });

  it('should return true for isFullCardIssue', () => {
    const issue = new InitializationIssue(createAPI());
    expect(issue.isFullCardIssue()).toBe(true);
  });

  it('should return notification from error via getIssue', () => {
    const issue = new InitializationIssue(createAPI());
    issue.trigger({ error: new Error('init failed') });

    const result = issue.getIssue();
    expect(result).toEqual(
      expect.objectContaining({
        icon: 'mdi:alert',
        severity: 'high',
        notification: expect.objectContaining({
          heading: expect.objectContaining({ text: 'Initialization failed' }),
          body: expect.objectContaining({ text: 'init failed' }),
          controls: expect.arrayContaining([
            expect.objectContaining({ icon: 'mdi:refresh', dismiss: true }),
          ]),
        }),
      }),
    );
    expect(result?.notification.in_progress).toBeUndefined();
  });

  it('should call manager.retry with the issue key from getIssue retry control callback', async () => {
    const api = createCardAPI();
    const issue = new InitializationIssue(api);
    issue.trigger({ error: new Error('init failed') });

    const control = issue.getIssue()?.notification.controls?.[0];
    assert(control);
    const tapAction = control.actions?.tap_action as InternalCallbackActionConfig;
    await tapAction.callback(api);

    expect(api.getIssueManager().retry).toHaveBeenCalledWith('initialization', true);
  });

  describe('detectDynamic', () => {
    it('should clear the issue when mandatory init completes', () => {
      const issue = new InitializationIssue(createAPI(true));
      issue.trigger({ error: new Error('init failed') });
      expect(issue.hasIssue()).toBe(true);

      issue.detectDynamic();

      expect(issue.hasIssue()).toBe(false);
      expect(issue.getIssue()).toBeNull();
    });

    it('should keep the issue when mandatory init is not complete', () => {
      const issue = new InitializationIssue(createAPI(false));
      issue.trigger({ error: new Error('init failed') });

      issue.detectDynamic();

      expect(issue.hasIssue()).toBe(true);
    });

    it('should do nothing when mandatory init is not complete', () => {
      const api = createAPI(false);
      const issue = new InitializationIssue(api);

      issue.detectDynamic();

      expect(issue.hasIssue()).toBe(false);
    });

    it('should end an in-flight retry when mandatory init completes', () => {
      const api = createAPI(true);
      const issue = new InitializationIssue(api);
      issue.trigger({ error: new Error('init failed') });
      issue.retry();
      expect(issue.needsRetry()).toBe(true);

      issue.detectDynamic();

      expect(issue.needsRetry()).toBe(false);
      expect(issue.canRetryNow()).toBe(false);
    });
  });

  describe('needsRetry', () => {
    it('should return true when failed', () => {
      const issue = new InitializationIssue(createAPI());
      issue.trigger({ error: new Error('init failed') });
      expect(issue.needsRetry()).toBe(true);
    });

    it('should return false when not failed', () => {
      const issue = new InitializationIssue(createAPI());
      expect(issue.needsRetry()).toBe(false);
    });

    it('should stay true across an in-flight retry so the backoff is not reset', () => {
      const issue = new InitializationIssue(createAPI());
      issue.trigger({ error: new Error('init failed') });

      issue.retry();

      expect(issue.hasIssue()).toBe(false);
      expect(issue.needsRetry()).toBe(true);
    });

    it('should become true again after a fresh failure re-triggers', () => {
      const issue = new InitializationIssue(createAPI());
      issue.trigger({ error: new Error('init failed') });
      issue.retry();

      issue.trigger({ error: new Error('init failed again') });

      expect(issue.needsRetry()).toBe(true);
      expect(issue.canRetryNow()).toBe(true);
    });
  });

  describe('canRetryNow', () => {
    it('should return false when not failed', () => {
      const issue = new InitializationIssue(createAPI());
      expect(issue.canRetryNow()).toBe(false);
    });

    it('should return true when failed and not in flight', () => {
      const issue = new InitializationIssue(createAPI());
      issue.trigger({ error: new Error('init failed') });
      expect(issue.canRetryNow()).toBe(true);
    });

    it('should return false while a retry is in flight', () => {
      const issue = new InitializationIssue(createAPI());
      issue.trigger({ error: new Error('init failed') });

      issue.retry();

      expect(issue.canRetryNow()).toBe(false);
    });
  });

  describe('retry', () => {
    it('should uninitialize mandatory initialization and destroy camera manager', () => {
      const api = createAPI();
      const issue = new InitializationIssue(api);
      issue.trigger({ error: new Error('init failed') });

      const result = issue.retry();

      expect(result).toBe(false);
      expect(issue.hasIssue()).toBe(false);
      expect(
        api.getInitializationManager().invalidateMandatoryAspects,
      ).toHaveBeenCalled();
      expect(api.getCameraManager().destroy).toHaveBeenCalled();

      // What follows is a fresh attempt at starting the card, so the previous
      // session is ended here.
      expect(api.getInitializationManager().getSessionManager().end).toHaveBeenCalled();
    });

    it('should be a no-op while a retry is already in flight', () => {
      const api = createAPI();
      const issue = new InitializationIssue(api);
      issue.trigger({ error: new Error('init failed') });
      issue.retry();
      vi.mocked(api.getInitializationManager().invalidateMandatoryAspects).mockClear();
      vi.mocked(api.getCameraManager().destroy).mockClear();

      const result = issue.retry();

      expect(result).toBe(false);
      expect(
        api.getInitializationManager().invalidateMandatoryAspects,
      ).not.toHaveBeenCalled();
      expect(api.getCameraManager().destroy).not.toHaveBeenCalled();
    });
  });

  it('should clear the issue after reset', () => {
    const issue = new InitializationIssue(createAPI());
    issue.trigger({ error: new Error('oops') });
    expect(issue.hasIssue()).toBe(true);

    issue.reset();

    expect(issue.hasIssue()).toBe(false);
    expect(issue.getIssue()).toBeNull();
  });

  it('should end an in-flight retry after reset', () => {
    const issue = new InitializationIssue(createAPI());
    issue.trigger({ error: new Error('oops') });
    issue.retry();
    expect(issue.needsRetry()).toBe(true);

    issue.reset();

    expect(issue.needsRetry()).toBe(false);
  });
});
