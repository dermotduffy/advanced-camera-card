// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createRetryControl } from '../../../src/card-controller/issues/retry-control';
import { InternalCallbackActionConfig } from '../../../src/config/schema/actions/custom/internal';
import { createCardAPI } from '../../test-utils';

describe('createRetryControl', () => {
  it('should return a control with expected icon, tooltip, and dismiss', () => {
    const control = createRetryControl('media_load');

    expect(control.icon).toBe('mdi:refresh');
    expect(control.tooltip).toBe('Retry');
    expect(control.dismiss).toBe(true);
  });

  it('should call manager.retry with the issue key when the callback executes', async () => {
    const api = createCardAPI();
    const control = createRetryControl('media_query');

    const tapAction = control.actions?.tap_action as InternalCallbackActionConfig;
    await tapAction.callback(api);

    expect(api.getIssueManager().retry).toBeCalledWith('media_query', true);
  });
});
