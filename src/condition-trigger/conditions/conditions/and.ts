import { CompositeConditionEvaluator } from './composite';

export class AndConditionEvaluator extends CompositeConditionEvaluator {
  // `and` fails at the first child that fails.
  protected readonly _determinant = { childResult: false, compositeResult: false };
}
