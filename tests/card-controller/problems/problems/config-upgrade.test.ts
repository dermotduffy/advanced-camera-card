import { describe, expect, it, vi } from 'vitest';
import { ConfigUpgradeProblem } from '../../../../src/card-controller/problems/problems/config-upgrade';
import { isConfigUpgradeable } from '../../../../src/config/management';
import { RawAdvancedCameraCardConfig } from '../../../../src/config/types';
import { createCardAPI } from '../../../test-utils';

vi.mock('../../../../src/config/management.js');

const createAPI = (rawConfig?: RawAdvancedCameraCardConfig) => {
  const api = createCardAPI();
  vi.mocked(api.getConfigManager().getRawConfig).mockReturnValue(rawConfig ?? null);
  return api;
};

describe('ConfigUpgradeProblem', () => {
  it('should have correct key', () => {
    const problem = new ConfigUpgradeProblem(createAPI());
    expect(problem.key).toBe('config_upgrade');
  });

  it('should detect upgradeable config', async () => {
    vi.mocked(isConfigUpgradeable).mockReturnValue(true);
    const rawConfig = { type: 'custom:frigate-card' };
    const problem = new ConfigUpgradeProblem(createAPI(rawConfig));

    await problem.detectStatic();

    expect(problem.hasProblem()).toBe(true);
    expect(isConfigUpgradeable).toBeCalledWith(rawConfig);
  });

  it('should detect non-upgradeable config', async () => {
    vi.mocked(isConfigUpgradeable).mockReturnValue(false);
    const rawConfig = { type: 'custom:advanced-camera-card' };
    const problem = new ConfigUpgradeProblem(createAPI(rawConfig));

    await problem.detectStatic();

    expect(problem.hasProblem()).toBe(false);
  });

  it('should handle null raw config', async () => {
    const problem = new ConfigUpgradeProblem(createAPI());

    await problem.detectStatic();

    expect(problem.hasProblem()).toBe(false);
    expect(problem.getProblem()).toBeNull();
  });

  it('should return result when upgradeable', async () => {
    vi.mocked(isConfigUpgradeable).mockReturnValue(true);
    const problem = new ConfigUpgradeProblem(createAPI({ type: 'custom:frigate-card' }));

    await problem.detectStatic();

    const result = problem.getProblem();
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
