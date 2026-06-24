import { hasConfigUpgradeFailures } from '../../../config/management.js';
import { TROUBLESHOOTING_CONFIG_UPGRADE_FAILURE_URL } from '../../../const.js';
import { localize } from '../../../localize/localize.js';
import type { CardIssueManagerAPI } from '../../types';
import type { Issue, IssueDescription } from '../types';

// Raised when the configuration upgrade could not faithfully upgrade part of
// the config.
export class ConfigUpgradeFailureIssue implements Issue {
  public readonly key = 'config_upgrade_failure' as const;

  private _api: CardIssueManagerAPI;
  private _hasFailure = false;

  constructor(api: CardIssueManagerAPI) {
    this._api = api;
  }

  public async detectStatic(): Promise<void> {
    this._hasFailure = hasConfigUpgradeFailures(
      this._api.getConfigManager().getRawConfig(),
    );
  }

  public hasIssue(): boolean {
    return this._hasFailure;
  }

  public getIssue(): IssueDescription | null {
    if (!this._hasFailure) {
      return null;
    }
    return {
      icon: 'mdi:update',
      severity: 'medium',
      notification: {
        heading: {
          text: localize('issues.config_upgrade_failure.heading'),
          icon: 'mdi:update',
          severity: 'medium',
        },
        body: { text: localize('issues.config_upgrade_failure.text') },
        link: {
          url: TROUBLESHOOTING_CONFIG_UPGRADE_FAILURE_URL,
          title: localize('issues.troubleshooting_guide'),
        },
      },
    };
  }
}
