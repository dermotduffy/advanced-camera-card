import { describe, expect, it, vi } from 'vitest';
import { ConfigUpgradeIssue } from '../../../../src/card-controller/issues/issues/config-upgrade';
import { isConfigUpgradeable } from '../../../../src/config/management';
import { RawAdvancedCameraCardConfig } from '../../../../src/config/types';
import { createCardAPI } from '../../../test-utils';

vi.mock('../../../../src/config/management.js');

const createAPI = (rawConfig?: RawAdvancedCameraCardConfig) => {
  const api = createCardAPI();
  vi.mocked(api.getConfigManager().getRawConfig).mockReturnValue(rawConfig ?? null);
  return api;
};

describe('ConfigUpgradeIssue', () => {
  it('should have correct key', () => {
    const issue = new ConfigUpgradeIssue(createAPI());
    expect(issue.key).toBe('config_upgrade');
  });

  it('should detect upgradeable config', async () => {
    vi.mocked(isConfigUpgradeable).mockReturnValue(true);
    const rawConfig = { type: 'custom:frigate-card' };
    const issue = new ConfigUpgradeIssue(createAPI(rawConfig));

    await issue.detectStatic();

    expect(issue.hasIssue()).toBe(true);
    expect(isConfigUpgradeable).toBeCalledWith(rawConfig);
  });

  it('should detect non-upgradeable config', async () => {
    vi.mocked(isConfigUpgradeable).mockReturnValue(false);
    const rawConfig = { type: 'custom:advanced-camera-card' };
    const issue = new ConfigUpgradeIssue(createAPI(rawConfig));

    await issue.detectStatic();

    expect(issue.hasIssue()).toBe(false);
  });

  it('should handle null raw config', async () => {
    const issue = new ConfigUpgradeIssue(createAPI());

    await issue.detectStatic();

    expect(issue.hasIssue()).toBe(false);
    expect(issue.getIssue()).toBeNull();
  });

  it('should return result when upgradeable', async () => {
    vi.mocked(isConfigUpgradeable).mockReturnValue(true);
    const issue = new ConfigUpgradeIssue(createAPI({ type: 'custom:frigate-card' }));

    await issue.detectStatic();

    const result = issue.getIssue();
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
