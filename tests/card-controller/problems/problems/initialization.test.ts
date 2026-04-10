import { assert, describe, expect, it, vi } from 'vitest';
import { CardController } from '../../../../src/card-controller/controller';
import { InitializationProblem } from '../../../../src/card-controller/problems/problems/initialization';
import { InternalCallbackActionConfig } from '../../../../src/config/schema/actions/custom/internal';
import { createCardAPI } from '../../../test-utils';

describe('InitializationProblem', () => {
  const createAPI = (isInitializedMandatory = false): CardController => {
    const api = createCardAPI();
    vi.mocked(api.getInitializationManager().isInitializedMandatory).mockReturnValue(
      isInitializedMandatory,
    );
    return api;
  };

  it('should have correct key', () => {
    const problem = new InitializationProblem(createAPI());
    expect(problem.key).toBe('initialization');
  });

  it('should report no problem when untriggered', () => {
    const problem = new InitializationProblem(createAPI());
    expect(problem.hasProblem()).toBe(false);
    expect(problem.getProblem()).toBeNull();
  });

  it('should report a problem after trigger', () => {
    const problem = new InitializationProblem(createAPI());
    problem.trigger({ error: new Error('init failed') });

    expect(problem.hasProblem()).toBe(true);
  });

  it('should return true for isFullCardProblem', () => {
    const problem = new InitializationProblem(createAPI());
    expect(problem.isFullCardProblem()).toBe(true);
  });

  it('should return notification from error via getProblem', () => {
    const problem = new InitializationProblem(createAPI());
    problem.trigger({ error: new Error('init failed') });

    const result = problem.getProblem();
    expect(result).toEqual(
      expect.objectContaining({
        icon: 'mdi:alert',
        severity: 'high',
        notification: expect.objectContaining({
          in_progress: true,
          body: expect.objectContaining({ text: 'init failed' }),
          controls: expect.arrayContaining([
            expect.objectContaining({ icon: 'mdi:refresh', dismiss: true }),
          ]),
        }),
      }),
    );
  });

  it('should call manager.retry with the problem key from getProblem retry control callback', async () => {
    const api = createCardAPI();
    const problem = new InitializationProblem(api);
    problem.trigger({ error: new Error('init failed') });

    const control = problem.getProblem()?.notification.controls?.[0];
    assert(control);
    const tapAction = control.actions?.tap_action as InternalCallbackActionConfig;
    await tapAction.callback(api);

    expect(api.getProblemManager().retry).toBeCalledWith('initialization', true);
  });

  describe('detectDynamic', () => {
    it('should clear the problem when initialization is now mandatory', () => {
      const problem = new InitializationProblem(createAPI(true));
      problem.trigger({ error: new Error('init failed') });
      expect(problem.hasProblem()).toBe(true);

      problem.detectDynamic();

      expect(problem.hasProblem()).toBe(false);
      expect(problem.getProblem()).toBeNull();
    });

    it('should keep the problem when initialization is still not mandatory', () => {
      const problem = new InitializationProblem(createAPI(false));
      problem.trigger({ error: new Error('init failed') });

      problem.detectDynamic();

      expect(problem.hasProblem()).toBe(true);
    });

    it('should do nothing when not failed', () => {
      const api = createAPI(false);
      const problem = new InitializationProblem(api);

      problem.detectDynamic();

      expect(problem.hasProblem()).toBe(false);
      expect(api.getInitializationManager().isInitializedMandatory).not.toBeCalled();
    });
  });

  describe('needsRetry', () => {
    it('should return true when failed', () => {
      const problem = new InitializationProblem(createAPI());
      problem.trigger({ error: new Error('init failed') });
      expect(problem.needsRetry()).toBe(true);
    });

    it('should return false when not failed', () => {
      const problem = new InitializationProblem(createAPI());
      expect(problem.needsRetry()).toBe(false);
    });
  });

  describe('retry', () => {
    it('should uninitialize mandatory initialization and destroy camera manager', () => {
      const api = createAPI();
      const problem = new InitializationProblem(api);
      problem.trigger({ error: new Error('init failed') });

      const result = problem.retry();

      expect(result).toBe(false);
      expect(problem.hasProblem()).toBe(false);
      expect(problem.needsRetry()).toBe(false);
      expect(api.getInitializationManager().uninitializeMandatory).toBeCalled();
      expect(api.getCameraManager().destroy).toBeCalled();
    });
  });

  it('should clear the problem after reset', () => {
    const problem = new InitializationProblem(createAPI());
    problem.trigger({ error: new Error('oops') });
    expect(problem.hasProblem()).toBe(true);

    problem.reset();

    expect(problem.hasProblem()).toBe(false);
    expect(problem.getProblem()).toBeNull();
  });
});
