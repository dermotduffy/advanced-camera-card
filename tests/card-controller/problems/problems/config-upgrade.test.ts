import { describe, expect, it, vi } from 'vitest';
import { ConfigUpgradeProblem } from '../../../../src/card-controller/problems/problems/config-upgrade';
import { isConfigUpgradeable } from '../../../../src/config/management';

vi.mock('../../../../src/config/management.js');

describe('ConfigUpgradeProblem', () => {
  it('should have correct key', () => {
    const problem = new ConfigUpgradeProblem(() => null);
    expect(problem.key).toBe('config_upgrade');
  });

  it('should detect upgradeable config', async () => {
    vi.mocked(isConfigUpgradeable).mockReturnValue(true);
    const rawConfig = { type: 'custom:frigate-card' };
    const problem = new ConfigUpgradeProblem(() => rawConfig);

    await problem.detectStatic();

    expect(problem.hasResult()).toBe(true);
    expect(isConfigUpgradeable).toBeCalledWith(rawConfig);
  });

  it('should detect non-upgradeable config', async () => {
    vi.mocked(isConfigUpgradeable).mockReturnValue(false);
    const rawConfig = { type: 'custom:advanced-camera-card' };
    const problem = new ConfigUpgradeProblem(() => rawConfig);

    await problem.detectStatic();

    expect(problem.hasResult()).toBe(false);
  });

  it('should handle null raw config', async () => {
    const problem = new ConfigUpgradeProblem(() => null);

    await problem.detectStatic();

    expect(problem.hasResult()).toBe(false);
    expect(problem.getResult()).toBeNull();
  });

  it('should return result when upgradeable', async () => {
    vi.mocked(isConfigUpgradeable).mockReturnValue(true);
    const problem = new ConfigUpgradeProblem(() => ({ type: 'custom:frigate-card' }));

    await problem.detectStatic();

    const result = problem.getResult();
    expect(result).toEqual(
      expect.objectContaining({
        icon: 'mdi:update',
        severity: 'medium',
        notification: expect.objectContaining({
          heading: expect.objectContaining({
            icon: 'mdi:update',
            severity: 'medium',
          }),
        }),
      }),
    );
  });
});
