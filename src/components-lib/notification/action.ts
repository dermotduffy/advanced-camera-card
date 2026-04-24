import { dispatchActionExecutionRequest } from '../../card-controller/actions/utils/execution-request.js';
import { NotificationControl } from '../../config/schema/actions/types.js';
import {
  getActionConfigGivenAction,
  stopEventFromActivatingCardWideActions,
} from '../../utils/action.js';
import { arrayify } from '../../utils/basic.js';

export function handleControlAction(
  ev: CustomEvent<{ action: string }>,
  control: NotificationControl,
  host: HTMLElement,
  onDismiss?: () => void,
): void {
  stopEventFromActivatingCardWideActions(ev);
  const action = getActionConfigGivenAction(ev.detail.action, control.actions);
  if (action) {
    dispatchActionExecutionRequest(host, { actions: arrayify(action) });
  }
  if (onDismiss && control.dismiss !== false) {
    onDismiss();
  }
}
