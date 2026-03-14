import { isConfigUpgradeable } from '../../../config/management.js';
import { RawAdvancedCameraCardConfig } from '../../../config/types.js';
import { TROUBLESHOOTING_CONFIG_UPGRADE_URL } from '../../../const.js';
import { localize } from '../../../localize/localize.js';
import { Problem, ProblemResult } from '../types';

export class ConfigUpgradeProblem implements Problem {
  public readonly key = 'config_upgrade' as const;

  private _upgradeable = false;
  private _getRawConfig: () => RawAdvancedCameraCardConfig | null;

  constructor(getRawConfig: () => RawAdvancedCameraCardConfig | null) {
    this._getRawConfig = getRawConfig;
  }

  public async detectStatic(): Promise<void> {
    const rawConfig = this._getRawConfig();
    this._upgradeable = !!rawConfig && isConfigUpgradeable(rawConfig);
  }

  public hasResult(): boolean {
    return this._upgradeable;
  }

  public getResult(): ProblemResult | null {
    if (!this._upgradeable) {
      return null;
    }
    return {
      icon: 'mdi:update',
      severity: 'medium',
      notification: {
        heading: {
          text: localize('problems.config_upgrade.heading'),
          icon: 'mdi:update',
          severity: 'medium',
        },
        text: localize('problems.config_upgrade.text'),
        link: {
          url: TROUBLESHOOTING_CONFIG_UPGRADE_URL,
          title: localize('problems.troubleshooting_guide'),
        },
      },
    };
  }
}
