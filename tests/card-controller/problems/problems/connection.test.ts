import { describe, expect, it } from 'vitest';
import { ConnectionProblem } from '../../../../src/card-controller/problems/problems/connection';
import { createHASS } from '../../../test-utils';

describe('ConnectionProblem', () => {
  it('should have correct key', () => {
    const problem = new ConnectionProblem();
    expect(problem.key).toBe('connection');
  });

  it('should report no problem when hass has never been set', () => {
    const problem = new ConnectionProblem();

    problem.detectDynamic({});

    expect(problem.hasProblem()).toBe(false);
    expect(problem.getProblem()).toBeNull();
  });

  it('should report a problem when hass is disconnected', () => {
    const problem = new ConnectionProblem();
    const hass = createHASS();
    hass.connected = false;

    problem.detectDynamic({ hass });

    expect(problem.hasProblem()).toBe(true);
  });

  it('should not report a problem when hass is connected', () => {
    const problem = new ConnectionProblem();
    const hass = createHASS();
    hass.connected = true;

    problem.detectDynamic({ hass });

    expect(problem.hasProblem()).toBe(false);
    expect(problem.getProblem()).toBeNull();
  });

  it('should clear a connection state when hass reconnects', () => {
    const problem = new ConnectionProblem();
    const hass = createHASS();

    hass.connected = false;
    problem.detectDynamic({ hass });
    expect(problem.hasProblem()).toBe(true);

    hass.connected = true;
    problem.detectDynamic({ hass });
    expect(problem.hasProblem()).toBe(false);
  });

  it('should return true for isFullCardProblem', () => {
    const problem = new ConnectionProblem();
    expect(problem.isFullCardProblem()).toBe(true);
  });

  it('should return expected shape from getProblem when connection is lost', () => {
    const problem = new ConnectionProblem();
    const hass = createHASS();
    hass.connected = false;
    problem.detectDynamic({ hass });

    const result = problem.getProblem();
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

  it('should clear the problem after reset', () => {
    const problem = new ConnectionProblem();
    const hass = createHASS();
    hass.connected = false;
    problem.detectDynamic({ hass });
    expect(problem.hasProblem()).toBe(true);

    problem.reset();

    expect(problem.hasProblem()).toBe(false);
    expect(problem.getProblem()).toBeNull();
  });
});
