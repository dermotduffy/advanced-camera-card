import { describe, expect, it, vi } from 'vitest';
import { LockManager } from '../../../src/card-controller/lock/manager';
import { CardController } from '../../../src/card-controller/controller';
import {
  createCameraAction,
  createDisplayModeAction,
  createGeneralAction,
  createLogAction,
  createMediaPlayerAction,
  createViewAction,
} from '../../../src/utils/action';
import { createCardAPI, createConfig } from '../../test-utils';

const setCallLock = (api: CardController, lock: boolean): void => {
  vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
    createConfig({ live: { controls: { call: { lock } } } }),
  );
};

describe('LockManager', () => {
  it('should report unlocked when no lock source is active', () => {
    const api = createCardAPI();
    setCallLock(api, true);
    vi.mocked(api.getCallManager().isActive).mockReturnValue(false);

    expect(new LockManager(api).isLocked()).toBeFalsy();
  });

  it('should report locked when a call is active', () => {
    const api = createCardAPI();
    setCallLock(api, true);
    vi.mocked(api.getCallManager().isActive).mockReturnValue(true);

    expect(new LockManager(api).isLocked()).toBeTruthy();
  });

  it('should report unlocked when a call is active but the lock is disabled', () => {
    const api = createCardAPI();
    setCallLock(api, false);
    vi.mocked(api.getCallManager().isActive).mockReturnValue(true);

    expect(new LockManager(api).isLocked()).toBeFalsy();
  });

  it('should reuse lock manager epoch until the lock state changes', () => {
    const api = createCardAPI();
    setCallLock(api, true);
    vi.mocked(api.getCallManager().isActive).mockReturnValue(false);
    const manager = new LockManager(api);

    const unlockedEpoch = manager.getEpoch();
    expect(manager.getEpoch()).toBe(unlockedEpoch);
    expect(unlockedEpoch.locked).toBeFalsy();

    vi.mocked(api.getCallManager().isActive).mockReturnValue(true);
    const lockedEpoch = manager.getEpoch();
    expect(lockedEpoch).not.toBe(unlockedEpoch);
    expect(lockedEpoch.locked).toBeTruthy();
    expect(manager.getEpoch()).toBe(lockedEpoch);
  });

  it('should not filter actions when unlocked', () => {
    const api = createCardAPI();
    setCallLock(api, true);
    vi.mocked(api.getCallManager().isActive).mockReturnValue(false);

    const actions = [createGeneralAction('reload'), createLogAction('Allowed')];

    expect(new LockManager(api).getAllowedActions(actions)).toBe(actions);
  });

  it('should reject call-disruptive actions when locked', () => {
    const api = createCardAPI();
    setCallLock(api, true);
    vi.mocked(api.getCallManager().isActive).mockReturnValue(true);
    const manager = new LockManager(api);

    for (const action of [
      createViewAction('clips'),
      createCameraAction('camera_select', 'cam-1'),
      createCameraAction('live_substream_select', 'cam-1'),
      createGeneralAction('live_substream_on'),
      createGeneralAction('live_substream_off'),
      createGeneralAction('default'),
      createGeneralAction('pause'),
      createGeneralAction('reload'),
      createMediaPlayerAction('media_player.living_room', 'play'),
    ]) {
      expect(manager.getAllowedActions(action)).toEqual([]);
    }
  });

  it('should preserve non-disruptive actions when locked', () => {
    const api = createCardAPI();
    setCallLock(api, true);
    vi.mocked(api.getCallManager().isActive).mockReturnValue(true);
    const manager = new LockManager(api);

    for (const action of [
      createGeneralAction('play'),
      createGeneralAction('fullscreen'),
      createGeneralAction('expand'),
      createGeneralAction('pip'),
      createGeneralAction('screenshot'),
      createGeneralAction('mute'),
      createGeneralAction('unmute'),
      createGeneralAction('microphone_unmute'),
      createDisplayModeAction('grid'),
      { action: 'none' as const },
    ]) {
      expect(manager.getAllowedActions(action)).toEqual([action]);
    }
  });

  it('should preserve non-disruptive actions from a mixed action list when locked', () => {
    const api = createCardAPI();
    setCallLock(api, true);
    vi.mocked(api.getCallManager().isActive).mockReturnValue(true);

    const manager = new LockManager(api);
    const allowedAction = createLogAction('Allowed');

    expect(
      manager.getAllowedActions([createGeneralAction('reload'), allowedAction]),
    ).toEqual([allowedAction]);
  });

  it('should report whether all configured actions are blocked', () => {
    const api = createCardAPI();
    setCallLock(api, true);
    vi.mocked(api.getCallManager().isActive).mockReturnValue(true);

    const manager = new LockManager(api);

    expect(
      manager.areAllActionsBlocked({
        tap_action: createGeneralAction('reload'),
        hold_action: createGeneralAction('pause'),
      }),
    ).toBeTruthy();
    expect(
      manager.areAllActionsBlocked({
        tap_action: createGeneralAction('reload'),
        hold_action: createLogAction('Allowed'),
      }),
    ).toBeFalsy();
    expect(manager.areAllActionsBlocked({})).toBeFalsy();
  });

  it('should never report all-actions-blocked when unlocked', () => {
    const api = createCardAPI();
    setCallLock(api, true);
    vi.mocked(api.getCallManager().isActive).mockReturnValue(false);

    const manager = new LockManager(api);

    // Even when every action would be blocked under an active policy, an
    // inactive lock short-circuits to false.
    expect(
      manager.areAllActionsBlocked({
        tap_action: createGeneralAction('reload'),
        hold_action: createGeneralAction('pause'),
      }),
    ).toBeFalsy();
  });
});
