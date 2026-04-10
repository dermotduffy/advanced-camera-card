import { isConfigUpgradeable } from '../../../config/management.js';
import { TROUBLESHOOTING_CONFIG_UPGRADE_URL } from '../../../const.js';
import { localize } from '../../../localize/localize.js';
import { CardProblemManagerAPI } from '../../types';
import { Problem, ProblemDescription } from '../types';

export class ConfigUpgradeProblem implements Problem {
  public readonly key = 'config_upgrade' as const;

  private _api: CardProblemManagerAPI;
  private _upgradeable = false;

  constructor(api: CardProblemManagerAPI) {
    this._api = api;
  }

  public async detectStatic(): Promise<void> {
    const rawConfig = this._api.getConfigManager().getRawConfig();
    this._upgradeable = !!rawConfig && isConfigUpgradeable(rawConfig);
  }

  public hasProblem(): boolean {
    return this._upgradeable;
  }

  public getProblem(): ProblemDescription | null {
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
        body: { text: localize('problems.config_upgrade.text') },
        link: {
          url: TROUBLESHOOTING_CONFIG_UPGRADE_URL,
          title: localize('problems.troubleshooting_guide'),
        },
      },
    };
  }
}
