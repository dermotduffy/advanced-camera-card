import { CardProblemManagerAPI } from '../types';
import { ProblemManager } from './problem-manager';
import { ConfigErrorProblem } from './problems/config-error';
import { ConfigUpgradeProblem } from './problems/config-upgrade';
import { ConnectionProblem } from './problems/connection';
import { InitializationProblem } from './problems/initialization';
import { LegacyResourceProblem } from './problems/legacy-resource';
import { MediaLoadProblem } from './problems/media-load';
import { MediaQueryProblem } from './problems/media-query';

export const createProblemManager = (api: CardProblemManagerAPI): ProblemManager => {
  const manager = new ProblemManager(api);
  const changeCallback = () => manager.evaluate();

  // Registration order determines both retry priority and full-card display
  // priority. For retries, problems are retried in order and an exclusive retry
  // stops the loop. For display, getFullCardProblem() returns the first active
  // full-card problem. Register broader/more critical problems first.
  manager.addProblem(new ConfigErrorProblem());
  manager.addProblem(new ConfigUpgradeProblem(api));
  manager.addProblem(new ConnectionProblem());
  manager.addProblem(new InitializationProblem(api));
  manager.addProblem(new LegacyResourceProblem(changeCallback));
  manager.addProblem(new MediaQueryProblem(api));
  manager.addProblem(new MediaLoadProblem(api, changeCallback));

  return manager;
};
