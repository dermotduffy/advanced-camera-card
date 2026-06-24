import { vi } from 'vitest';
import { mock, MockProxy } from 'vitest-mock-extended';

import { SubscriptionHealthInterface } from '../../src/ha/connection/subscription-health-monitor';

// A benign mocked event-subscription health surface: no failures, listeners
// return a no-op unsubscribe. Tests configure `getFailures`/`retry` as needed.
export const createSubscriptionHealth = (): MockProxy<
  SubscriptionHealthInterface<string>
> => {
  const health = mock<SubscriptionHealthInterface<string>>();
  health.getFailures.mockReturnValue([]);
  health.addListener.mockReturnValue(vi.fn());
  return health;
};
