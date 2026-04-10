import { describe, expect, it } from 'vitest';
import { ConfigErrorProblem } from '../../../../src/card-controller/problems/problems/config-error';

describe('ConfigErrorProblem', () => {
  it('should have correct key', () => {
    const problem = new ConfigErrorProblem();
    expect(problem.key).toBe('config_error');
  });

  it('should report no problem when untriggered', () => {
    const problem = new ConfigErrorProblem();
    expect(problem.hasProblem()).toBe(false);
    expect(problem.getProblem()).toBeNull();
  });

  it('should report a problem after trigger with an error', () => {
    const problem = new ConfigErrorProblem();
    problem.trigger({ error: new Error('bad config') });

    expect(problem.hasProblem()).toBe(true);
  });

  it('should report a problem after trigger with a string error', () => {
    const problem = new ConfigErrorProblem();
    problem.trigger({ error: 'string error' });

    expect(problem.hasProblem()).toBe(true);
  });

  it('isFullCardProblem should return true', () => {
    const problem = new ConfigErrorProblem();
    expect(problem.isFullCardProblem()).toBe(true);
  });

  it('getProblem should return a ProblemDescription with expected shape', () => {
    const problem = new ConfigErrorProblem();
    problem.trigger({ error: new Error('config is invalid') });

    const result = problem.getProblem();
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

  it('should clear the problem after reset', () => {
    const problem = new ConfigErrorProblem();
    problem.trigger({ error: new Error('oops') });
    expect(problem.hasProblem()).toBe(true);

    problem.reset();

    expect(problem.hasProblem()).toBe(false);
    expect(problem.getProblem()).toBeNull();
  });
});
