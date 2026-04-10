import { CardIssueManagerAPI } from '../types';
import { IssueManager } from './issue-manager';
import { ConfigErrorIssue } from './issues/config-error';
import { ConfigUpgradeIssue } from './issues/config-upgrade';
import { ConnectionIssue } from './issues/connection';
import { InitializationIssue } from './issues/initialization';
import { LegacyResourceIssue } from './issues/legacy-resource';
import { MediaLoadIssue } from './issues/media-load';
import { MediaQueryIssue } from './issues/media-query';

export const createIssueManager = (api: CardIssueManagerAPI): IssueManager => {
  const manager = new IssueManager(api);
  const changeCallback = () => manager.evaluate();

  // Registration order determines both retry priority and full-card display
  // priority. For retries, issues are retried in order and an exclusive retry
  // stops the loop. For display, getFullCardIssue() returns the first active
  // full-card issue. Register broader/more critical issues first.
  manager.addIssue(new ConfigErrorIssue());
  manager.addIssue(new ConfigUpgradeIssue(api));
  manager.addIssue(new ConnectionIssue());
  manager.addIssue(new InitializationIssue(api));
  manager.addIssue(new LegacyResourceIssue(changeCallback));
  manager.addIssue(new MediaQueryIssue(api));
  manager.addIssue(new MediaLoadIssue(api, changeCallback));

  return manager;
};
