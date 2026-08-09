import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { StateWatcherSubscriptionInterface } from '../../../../../src/card-controller/hass/state-watcher';
import {
  EntityAvailabilityDetector,
  LIVENESS_ENTITY_UNAVAILABLE_GRACE_SECONDS,
} from '../../../../../src/components-lib/live/liveness/detectors/entity-availability';
import type { HomeAssistant } from '../../../../../src/ha/types';
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
  const fireStateChange = (state: string): void =>
    callStateWatcherCallback(stateWatcher, {
      entityID: entity ?? ENTITY,
      newState: createStateEntity({ state }),
    });

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
    const { detector, onChange, fireStateChange } = setup();
    detector.subscribe();

    fireStateChange('unavailable');

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
    const { detector, onChange, fireStateChange } = setup();
    detector.subscribe();

    fireStateChange('unavailable');
    vi.advanceTimersByTime(GRACE_MS - 1000);
    fireStateChange('streaming');
    vi.advanceTimersByTime(GRACE_MS);

    expect(detector.getVerdict()).toEqual({ state: 'unknown' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('should report not live immediately when always_error is set', () => {
    const { detector, onChange, fireStateChange } = setup({
      alwaysError: true,
    });
    detector.subscribe();

    fireStateChange('unavailable');

    expect(detector.getVerdict()).toEqual({
      state: 'not_live',
      authority: 'hard',
      renderPlaceholder: true,
      reason: 'entity_unavailable',
    });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('should act on the state from the event, not a lagging wrapper hass', () => {
    const { detector, setEntityState, fireStateChange } = setup({ alwaysError: true });
    detector.subscribe();

    // The wrapper's hass (what getHASS reads) has not yet propagated the change,
    // so it still reports the pre-change available state, while the event carries
    // the fresh unavailable state. The detector must act on the event.
    setEntityState('streaming');
    fireStateChange('unavailable');

    expect(detector.getVerdict()).toEqual({
      state: 'not_live',
      authority: 'hard',
      renderPlaceholder: true,
      reason: 'entity_unavailable',
    });
  });

  it('should report live again when the entity returns', () => {
    const { detector, onChange, fireStateChange } = setup();
    detector.subscribe();
    fireStateChange('unavailable');
    vi.advanceTimersByTime(GRACE_MS);
    expect(detector.getVerdict().state).toBe('not_live');
    onChange.mockClear();

    fireStateChange('streaming');

    expect(detector.getVerdict()).toEqual({ state: 'unknown' });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('should retain the verdict on unsubscribe and stop watching', () => {
    const { detector, stateWatcher, fireStateChange } = setup();
    detector.subscribe();
    fireStateChange('unavailable');
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
    const { detector, onChange, fireStateChange } = setup();
    detector.subscribe();
    fireStateChange('unavailable');

    detector.unsubscribe();
    vi.advanceTimersByTime(GRACE_MS);

    expect(onChange).not.toHaveBeenCalled();
    expect(detector.getVerdict()).toEqual({ state: 'unknown' });
  });

  it('should discard the verdict on reset', () => {
    const { detector, setEntityState, fireStateChange } = setup();
    detector.subscribe();
    fireStateChange('unavailable');
    vi.advanceTimersByTime(GRACE_MS);
    expect(detector.getVerdict().state).toBe('not_live');

    // Re-point at the (now available) entity from a fresh state.
    setEntityState('streaming');
    detector.invalidate('stream-changed');

    expect(detector.getVerdict()).toEqual({ state: 'unknown' });
  });

  it('should keep the verdict when media loads', () => {
    const { detector, fireStateChange } = setup();
    detector.subscribe();
    fireStateChange('unavailable');
    vi.advanceTimersByTime(GRACE_MS);

    // This detector watches the camera entity, so media loading tells it
    // nothing about the entity it is watching.
    detector.invalidate('media-loaded');

    expect(detector.getVerdict()).toEqual({
      state: 'not_live',
      authority: 'indirect',
      renderPlaceholder: true,
      reason: 'entity_unavailable',
    });
  });

  it('should re-check the entity when reset', () => {
    // always_error makes the re-check produce a verdict immediately rather than
    // waiting out the grace window.
    const { detector, setEntityState } = setup({ alwaysError: true });
    detector.subscribe();

    // An entity that is already unavailable never fires a state change, so
    // resetting must read it rather than wait to be told.
    setEntityState('unavailable');
    detector.invalidate('stream-changed');

    expect(detector.getVerdict()).toEqual(
      expect.objectContaining({ state: 'not_live', authority: 'hard' }),
    );
  });

  it('should do nothing on reset before subscribe', () => {
    const { detector, stateWatcher } = setup();

    detector.invalidate('stream-changed');

    expect(stateWatcher.subscribe).not.toHaveBeenCalled();
    expect(detector.getVerdict()).toEqual({ state: 'unknown' });
  });

  it('should drop the subscription when the camera entity is removed', () => {
    const { detector, stateWatcher, setCameraEntity } = setup();
    detector.subscribe();

    setCameraEntity(null);
    detector.invalidate('stream-changed');

    expect(stateWatcher.unsubscribe).toHaveBeenCalled();
    expect(detector.getVerdict()).toEqual({ state: 'unknown' });
  });

  it('should not restart the grace timer while it is already running', () => {
    const { detector, onChange, fireStateChange } = setup();
    detector.subscribe();

    fireStateChange('unavailable');

    // Still unavailable, grace timer already running
    fireStateChange('unavailable');
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
    const { detector, onChange, fireStateChange } = setup();
    detector.subscribe();
    fireStateChange('unavailable');
    vi.advanceTimersByTime(GRACE_MS);
    onChange.mockClear();

    // Still unavailable, verdict already not live
    fireStateChange('unavailable');

    expect(detector.getVerdict()).toEqual({
      state: 'not_live',
      authority: 'indirect',
      renderPlaceholder: true,
      reason: 'entity_unavailable',
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});
