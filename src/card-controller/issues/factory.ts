import type { SubscriptionHealthInterface } from '../../ha/connection/subscription-health-monitor';
import type { CardIssueManagerAPI } from '../types';
import { IssueManager } from './issue-manager';
import { ConfigErrorIssue } from './issues/config-error';
import { ConfigUpgradeIssue } from './issues/config-upgrade';
import { ConfigUpgradeFailureIssue } from './issues/config-upgrade-failure';
import { ConnectionIssue } from './issues/connection';
import { EventSubscriptionIssue } from './issues/event-subscription';
import { InitializationIssue } from './issues/initialization';
import { LegacyResourceIssue } from './issues/legacy-resource';
import { MediaQueryIssue } from './issues/media-query';
import { MediaUnavailableIssue } from './issues/media-unavailable';
import { ViewIncompatibleIssue } from './issues/view-incompatible';

export const createIssueManager = (
  api: CardIssueManagerAPI,
  eventSubscriptionHealth: SubscriptionHealthInterface<string>,
): IssueManager => {
  const manager = new IssueManager(api);
  const changeCallback = () => manager.evaluate();

  // Registration order determines both retry priority and full-card display
  // priority. For retries, issues are retried in order and an exclusive retry
  // stops the loop. For display, getFullCardIssue() returns the first active
  // full-card issue. Register broader/more critical issues first.
  manager.addIssue(new ConfigErrorIssue());
  manager.addIssue(new ConfigUpgradeIssue(api));
  manager.addIssue(new ConfigUpgradeFailureIssue(api));
  manager.addIssue(new ViewIncompatibleIssue(api));
  manager.addIssue(new ConnectionIssue());
  manager.addIssue(new EventSubscriptionIssue(eventSubscriptionHealth, changeCallback));
  manager.addIssue(new InitializationIssue(api));
  manager.addIssue(new LegacyResourceIssue(changeCallback));
  manager.addIssue(new MediaQueryIssue(api));
  manager.addIssue(new MediaUnavailableIssue(api));

  return manager;
};
