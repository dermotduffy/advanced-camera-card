import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfigUpgradeFailureIssue } from '../../../../src/card-controller/issues/issues/config-upgrade-failure';
import { hasConfigUpgradeFailures } from '../../../../src/config/management';
import type { RawAdvancedCameraCardConfig } from '../../../../src/config/types';
import { createCardAPI } from '../../../test-utils';

vi.mock('../../../../src/config/management.js');

const createAPI = (rawConfig?: RawAdvancedCameraCardConfig) => {
  const api = createCardAPI();
  vi.mocked(api.getConfigManager().getRawConfig).mockReturnValue(rawConfig ?? null);
  return api;
};

describe('ConfigUpgradeFailureIssue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct key', () => {
    const issue = new ConfigUpgradeFailureIssue(createAPI());
    expect(issue.key).toBe('config_upgrade_failure');
  });

  it('should detect failures and return a description', async () => {
    vi.mocked(hasConfigUpgradeFailures).mockReturnValue(true);
    const rawConfig = { type: 'custom:advanced-camera-card' };
    const issue = new ConfigUpgradeFailureIssue(createAPI(rawConfig));

    await issue.detectStatic();

    expect(issue.hasIssue()).toBe(true);
    expect(hasConfigUpgradeFailures).toHaveBeenCalledWith(rawConfig);
    expect(issue.getIssue()).toEqual(
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

  it('should report no failures and no description for a clean config', async () => {
    vi.mocked(hasConfigUpgradeFailures).mockReturnValue(false);
    const issue = new ConfigUpgradeFailureIssue(
      createAPI({ type: 'custom:advanced-camera-card' }),
    );

    await issue.detectStatic();

    expect(issue.hasIssue()).toBe(false);
    expect(issue.getIssue()).toBeNull();
  });
});
