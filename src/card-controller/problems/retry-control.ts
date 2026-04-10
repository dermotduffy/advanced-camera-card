import { NotificationControl } from '../../config/schema/actions/types.js';
import { localize } from '../../localize/localize.js';
import { createInternalCallbackAction } from '../../utils/action.js';
import { ProblemKey } from './types.js';

export function createRetryControl(key: ProblemKey): NotificationControl {
  return {
    icon: 'mdi:refresh',
    tooltip: localize('common.retry'),
    dismiss: true,
    actions: {
      tap_action: createInternalCallbackAction(async (api) => {
        api.getProblemManager().retry(key, true);
      }),
    },
  };
}
