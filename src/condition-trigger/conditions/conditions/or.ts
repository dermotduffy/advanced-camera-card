import { CompositeConditionEvaluator } from './composite';

export class OrConditionEvaluator extends CompositeConditionEvaluator {
  // `or` passes at the first child that passes.
  protected readonly _determinant = { childResult: true, compositeResult: true };
}
