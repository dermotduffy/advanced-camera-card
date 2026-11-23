import { CompositeConditionEvaluator } from './composite';

export class NotConditionEvaluator extends CompositeConditionEvaluator {
  // "Not" is an inverted `or` (NOR): it fails at the first child that passes.
  protected readonly _determinant = { childResult: true, compositeResult: false };
}
