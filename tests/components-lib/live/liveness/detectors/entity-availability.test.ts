import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { StateWatcherSubscriptionInterface } from '../../../../../src/card-controller/hass/state-watcher';
import {
  EntityAvailabilityDetector,
  LIVENESS_ENTITY_UNAVAILABLE_GRACE_SECONDS,
} from '../../../../../src/components-lib/live/liveness/detectors/entity-availability';
import type { HassStateDifference, HomeAssistant } from '../../../../../src/ha/types';
import {
  callStateWatcherCallback,
  createHASS,
  createStateEntity,
} from '../../../../test-utils';

const ENTITY = 'camera.office';
const GRACE_MS = LIVENESS_ENTITY_UNAVAILABLE_GRACE_SECONDS * 1000;

const setup = (options?: {
  alwaysError?: boolean;
  entity?: string | null;
  initialState?: string;
}) => {
  const entity = options?.entity === undefined ? ENTITY : options.entity;
  let currentEntity = entity;
  const hass: HomeAssistant = createHASS(
    entity
      ? { [entity]: createStateEntity({ state: options?.initialState ?? 'idle' }) }
      : {},
  );
  const stateWatcher = mock<StateWatcherSubscriptionInterface>();
  stateWatcher.subscribe.mockReturnValue(true);
  const onChange = vi.fn();

  const detector = new EntityAvailabilityDetector({
    getHASS: () => hass,
    getStateWatcher: () => stateWatcher,
    getCameraEntity: () => currentEntity,
    isAlwaysError: () => options?.alwaysError ?? false,
    onChange,
  });

  const setEntityState = (state: string): void => {
    if (entity) {
      hass.states[entity] = createStateEntity({ state });
    }
  };
  const setCameraEntity = (value: string | null): void => {
    currentEntity = value;
  };
  const fireStateChange = (): void =>
    callStateWatcherCallback(stateWatcher, mock<HassStateDifference>());

  return {
    detector,
    onChange,
    stateWatcher,
    setEntityState,
    setCameraEntity,
    fireStateChange,
  };
};

// @vitest-environment jsdom
describe('EntityAvailabilityDetector', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should subscribe to the camera entity and start unknown', () => {
    const { detector, stateWatcher, onChange } = setup();

    detector.subscribe();

    expect(stateWatcher.subscribe).toHaveBeenCalledWith(expect.any(Function), [ENTITY]);
    expect(detector.getVerdict()).toEqual({ state: 'unknown' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('should not subscribe when the camera has no entity', () => {
    const { detector, stateWatcher } = setup({ entity: null });

    detector.subscribe();

    expect(stateWatcher.subscribe).not.toHaveBeenCalled();
    expect(detector.getVerdict()).toEqual({ state: 'unknown' });
  });

  it('should report not live after the grace window when the entity stays unavailable', () => {
    const { detector, onChange, setEntityState, fireStateChange } = setup();
    detector.subscribe();

    setEntityState('unavailable');
    fireStateChange();

    // Still live during the grace window.
    expect(detector.getVerdict()).toEqual({ state: 'unknown' });
    vi.advanceTimersByTime(GRACE_MS);

    expect(detector.getVerdict()).toEqual({
      state: 'not_live',
      authority: 'indirect',
      renderPlaceholder: true,
      reason: 'entity_unavailable',
    });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('should tolerate an unavailable blip shorter than the grace window', () => {
    const { detector, onChange, setEntityState, fireStateChange } = setup();
    detector.subscribe();

    setEntityState('unavailable');
    fireStateChange();
    vi.advanceTimersByTime(GRACE_MS - 1000);
    setEntityState('streaming');
    fireStateChange();
    vi.advanceTimersByTime(GRACE_MS);

    expect(detector.getVerdict()).toEqual({ state: 'unknown' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('should report not live immediately when always_error is set', () => {
    const { detector, onChange, setEntityState, fireStateChange } = setup({
      alwaysError: true,
    });
    detector.subscribe();

    setEntityState('unavailable');
    fireStateChange();

    expect(detector.getVerdict()).toEqual({
      state: 'not_live',
      authority: 'hard',
      renderPlaceholder: true,
      reason: 'entity_unavailable',
    });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('should report live again when the entity returns', () => {
    const { detector, onChange, setEntityState, fireStateChange } = setup();
    detector.subscribe();
    setEntityState('unavailable');
    fireStateChange();
    vi.advanceTimersByTime(GRACE_MS);
    expect(detector.getVerdict().state).toBe('not_live');
    onChange.mockClear();

    setEntityState('streaming');
    fireStateChange();

    expect(detector.getVerdict()).toEqual({ state: 'unknown' });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('should retain the verdict on unsubscribe and stop watching', () => {
    const { detector, stateWatcher, setEntityState, fireStateChange } = setup();
    detector.subscribe();
    setEntityState('unavailable');
    fireStateChange();
    vi.advanceTimersByTime(GRACE_MS);

    detector.unsubscribe();

    expect(stateWatcher.unsubscribe).toHaveBeenCalled();

    // Verdict retained so a reconnect resumes where it left off.
    expect(detector.getVerdict()).toEqual({
      state: 'not_live',
      authority: 'indirect',
      renderPlaceholder: true,
      reason: 'entity_unavailable',
    });
  });

  it('should cancel the pending grace timer on unsubscribe', () => {
    const { detector, onChange, setEntityState, fireStateChange } = setup();
    detector.subscribe();
    setEntityState('unavailable');
    fireStateChange();

    detector.unsubscribe();
    vi.advanceTimersByTime(GRACE_MS);

    expect(onChange).not.toHaveBeenCalled();
    expect(detector.getVerdict()).toEqual({ state: 'unknown' });
  });

  it('should discard the verdict on reset', () => {
    const { detector, setEntityState, fireStateChange } = setup();
    detector.subscribe();
    setEntityState('unavailable');
    fireStateChange();
    vi.advanceTimersByTime(GRACE_MS);
    expect(detector.getVerdict().state).toBe('not_live');

    // Re-point at the (now available) entity from a fresh state.
    setEntityState('streaming');
    detector.reset();

    expect(detector.getVerdict()).toEqual({ state: 'unknown' });
  });

  it('should do nothing on reset before subscribe', () => {
    const { detector, stateWatcher } = setup();

    detector.reset();

    expect(stateWatcher.subscribe).not.toHaveBeenCalled();
    expect(detector.getVerdict()).toEqual({ state: 'unknown' });
  });

  it('should drop the subscription when the camera entity is removed', () => {
    const { detector, stateWatcher, setCameraEntity } = setup();
    detector.subscribe();

    setCameraEntity(null);
    detector.reset();

    expect(stateWatcher.unsubscribe).toHaveBeenCalled();
    expect(detector.getVerdict()).toEqual({ state: 'unknown' });
  });

  it('should not restart the grace timer while it is already running', () => {
    const { detector, onChange, setEntityState, fireStateChange } = setup();
    detector.subscribe();

    setEntityState('unavailable');
    fireStateChange();

    // Still unavailable, grace timer already running
    fireStateChange();
    vi.advanceTimersByTime(GRACE_MS);

    expect(detector.getVerdict()).toEqual({
      state: 'not_live',
      authority: 'indirect',
      renderPlaceholder: true,
      reason: 'entity_unavailable',
    });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('should stay not live on further unavailable events after the grace window', () => {
    const { detector, onChange, setEntityState, fireStateChange } = setup();
    detector.subscribe();
    setEntityState('unavailable');
    fireStateChange();
    vi.advanceTimersByTime(GRACE_MS);
    onChange.mockClear();

    // Still unavailable, verdict already not live
    fireStateChange();

    expect(detector.getVerdict()).toEqual({
      state: 'not_live',
      authority: 'indirect',
      renderPlaceholder: true,
      reason: 'entity_unavailable',
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});
