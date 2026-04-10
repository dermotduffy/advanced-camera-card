import { describe, expect, it } from 'vitest';
import { CardController } from '../../../../src/card-controller/controller';
import { MediaQueryProblem } from '../../../../src/card-controller/problems/problems/media-query';
import { InternalCallbackActionConfig } from '../../../../src/config/schema/actions/custom/internal';
import { createCardAPI } from '../../../test-utils';

const createProblem = (): {
  problem: MediaQueryProblem;
  api: CardController;
} => {
  const api = createCardAPI();
  const problem = new MediaQueryProblem(api);
  return { problem, api };
};

describe('MediaQueryProblem', () => {
  it('should have correct key', () => {
    const { problem } = createProblem();
    expect(problem.key).toBe('media_query');
  });

  it('should report no problem when untriggered', () => {
    const { problem } = createProblem();
    expect(problem.hasProblem()).toBe(false);
    expect(problem.getProblem()).toBeNull();
  });

  it('should report a problem after trigger with an error', () => {
    const { problem } = createProblem();
    problem.trigger({ error: new Error('query failed') });

    expect(problem.hasProblem()).toBe(true);
  });

  it('should return expected shape from getProblem when triggered with an error', () => {
    const { problem } = createProblem();
    problem.trigger({ error: new Error('media query failed') });

    const result = problem.getProblem();
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
      const { problem } = createProblem();

      expect(problem.getNotification()).toBeNull();
    });

    it('should return notification with retry control when triggered with an error', () => {
      const { problem } = createProblem();
      problem.trigger({ error: new Error('query failed') });

      const notification = problem.getNotification();
      expect(notification?.controls).toHaveLength(1);
      expect(notification?.controls?.[0]).toMatchObject({
        icon: 'mdi:refresh',
        dismiss: true,
      });
    });

    it('should call manager.retry with the problem key from retry control callback', async () => {
      const { problem, api } = createProblem();
      problem.trigger({ error: new Error('query failed') });

      const control = problem.getNotification()?.controls?.[0];
      const tapAction = control?.actions?.tap_action as InternalCallbackActionConfig;
      await tapAction.callback(api);

      expect(api.getProblemManager().retry).toBeCalledWith('media_query', true);
    });
  });

  describe('needsRetry', () => {
    it('should return true after trigger with an error', () => {
      const { problem } = createProblem();
      problem.trigger({ error: new Error('query failed') });

      expect(problem.needsRetry()).toBe(true);
    });

    it('should return false when not triggered', () => {
      const { problem } = createProblem();

      expect(problem.needsRetry()).toBe(false);
    });
  });

  describe('retry', () => {
    it('should return requery action and clear error and needsRetry', () => {
      const { problem, api } = createProblem();
      problem.trigger({ error: new Error('query failed') });

      const result = problem.retry();

      expect(result).toEqual(true);
      expect(api.getViewManager().setViewByParametersWithNewQuery).toBeCalled();
      expect(problem.needsRetry()).toBe(false);
      expect(problem.hasProblem()).toBe(false);
    });

    it('should return null when needsRetry is false', () => {
      const { problem } = createProblem();

      const result = problem.retry();

      expect(result).toBe(false);
    });
  });

  it('should clear the problem after reset', () => {
    const { problem } = createProblem();
    problem.trigger({ error: new Error('oops') });
    expect(problem.hasProblem()).toBe(true);

    problem.reset();

    expect(problem.hasProblem()).toBe(false);
    expect(problem.getProblem()).toBeNull();
  });

  it('should clear needsRetry after reset', () => {
    const { problem } = createProblem();
    problem.trigger({ error: new Error('oops') });
    expect(problem.needsRetry()).toBe(true);

    problem.reset();

    expect(problem.needsRetry()).toBe(false);
  });
});
