import { isConfigUpgradeable } from '../../../config/management.js';
import { TROUBLESHOOTING_CONFIG_UPGRADE_URL } from '../../../const.js';
import { localize } from '../../../localize/localize.js';
import { CardIssueManagerAPI } from '../../types';
import { Issue, IssueDescription } from '../types';

export class ConfigUpgradeIssue implements Issue {
  public readonly key = 'config_upgrade' as const;

  private _api: CardIssueManagerAPI;
  private _upgradeable = false;

  constructor(api: CardIssueManagerAPI) {
    this._api = api;
  }

  public async detectStatic(): Promise<void> {
    const rawConfig = this._api.getConfigManager().getRawConfig();
    this._upgradeable = !!rawConfig && isConfigUpgradeable(rawConfig);
  }

  public hasIssue(): boolean {
    return this._upgradeable;
  }

  public getIssue(): IssueDescription | null {
    if (!this._upgradeable) {
      return null;
    }
    return {
      icon: 'mdi:update',
      severity: 'medium',
      notification: {
        heading: {
          text: localize('issues.config_upgrade.heading'),
          icon: 'mdi:update',
          severity: 'medium',
        },
        body: { text: localize('issues.config_upgrade.text') },
        link: {
          url: TROUBLESHOOTING_CONFIG_UPGRADE_URL,
          title: localize('issues.troubleshooting_guide'),
        },
      },
    };
  }
}
