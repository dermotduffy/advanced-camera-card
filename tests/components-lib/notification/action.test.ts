// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchActionExecutionRequest } from '../../../src/card-controller/actions/utils/execution-request';
import { handleControlAction } from '../../../src/components-lib/notification/action';
import { NotificationControl } from '../../../src/config/schema/actions/types';
import {
  getActionConfigGivenAction,
  stopEventFromActivatingCardWideActions,
} from '../../../src/utils/action';

vi.mock('../../../src/card-controller/actions/utils/execution-request.js');
vi.mock('../../../src/utils/action.js');

describe('handleControlAction', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const createControl = (
    overrides?: Partial<NotificationControl>,
  ): NotificationControl => ({
    dismiss: true,
    ...overrides,
  });

  it('should stop the event from activating card-wide actions', () => {
    const ev = new CustomEvent('action', { detail: { action: 'tap' } });
    const host = document.createElement('div');
    handleControlAction(ev, createControl(), host);

    expect(stopEventFromActivatingCardWideActions).toBeCalledWith(ev);
  });

  it('should dispatch action when getActionConfigGivenAction returns an action', () => {
    const action = { action: 'navigate' as const, navigation_path: '/foo' };
    vi.mocked(getActionConfigGivenAction).mockReturnValue(action);

    const ev = new CustomEvent('action', { detail: { action: 'tap' } });
    const control = createControl({ actions: { tap_action: action } });
    const host = document.createElement('div');

    handleControlAction(ev, control, host);

    expect(dispatchActionExecutionRequest).toBeCalledWith(host, {
      actions: [action],
    });
  });

  it('should not dispatch when getActionConfigGivenAction returns null', () => {
    vi.mocked(getActionConfigGivenAction).mockReturnValue(null);

    const ev = new CustomEvent('action', { detail: { action: 'tap' } });
    const host = document.createElement('div');

    handleControlAction(ev, createControl(), host);

    expect(dispatchActionExecutionRequest).not.toBeCalled();
  });

  it('should call onDismiss when dismiss is not false', () => {
    vi.mocked(getActionConfigGivenAction).mockReturnValue(null);

    const ev = new CustomEvent('action', { detail: { action: 'tap' } });
    const host = document.createElement('div');
    const onDismiss = vi.fn();

    handleControlAction(ev, createControl({ dismiss: true }), host, onDismiss);

    expect(onDismiss).toBeCalled();
  });

  it('should not call onDismiss when dismiss is false', () => {
    vi.mocked(getActionConfigGivenAction).mockReturnValue(null);

    const ev = new CustomEvent('action', { detail: { action: 'tap' } });
    const host = document.createElement('div');
    const onDismiss = vi.fn();

    handleControlAction(ev, createControl({ dismiss: false }), host, onDismiss);

    expect(onDismiss).not.toBeCalled();
  });

  it('should not call onDismiss when no onDismiss is provided', () => {
    vi.mocked(getActionConfigGivenAction).mockReturnValue(null);

    const ev = new CustomEvent('action', { detail: { action: 'tap' } });
    const host = document.createElement('div');

    // Should not throw when onDismiss is undefined
    expect(() => handleControlAction(ev, createControl(), host)).not.toThrow();
  });
});
