import { maxBy, throttle } from 'lodash-es';

import type { CameraEvent } from '../camera-manager/types';
import { isTriggeredState } from '../ha/is-triggered-state';
import { Timer } from '../utils/timer';
import type { CardCameraTriggersAPI } from './types';

interface CameraTriggerState {
  // The time of the most recent trigger event. Used to determine the most
  // recently triggered camera.
  lastTriggerTime: Date;

  // The set of active trigger source IDs (e.g. entity IDs or Frigate event
  // IDs).
  sources: Set<string>;

  // The set of ignored event IDs (e.g. events that have been forcibly
  // untriggered).
  ignoredSources: Set<string>;

  // A timer used to delay the untrigger action.
  untriggerDelayTimer?: Timer;

  // A one-shot timer used to force untriggering a camera if no end event is
  // seen within a configured duration. This timer starts when the camera first
  // triggers and is not reset by subsequent trigger events.
  untriggerForceTimer?: Timer;
}

// The outcome of evaluating a single camera's already-on trigger entities.
interface InitialTriggerResult {
  // The event to fire as the startup trigger action, or null when none of the
  // camera's triggered entities should drive one.
  actionEvent: CameraEvent | null;

  triggered: boolean;
}

export class CameraTriggersManager {
  private _api: CardCameraTriggersAPI;
  private _states: Map<string, CameraTriggerState> = new Map();

  // Ready cameras whose already-on trigger entities have not been evaluated
  // yet.
  private _camerasPendingEvaluation = new Set<string>();

  private _throttledTriggerAction = throttle(this._triggerAction.bind(this), 1000, {
    trailing: true,
  });

  constructor(api: CardCameraTriggersAPI) {
    this._api = api;
  }

  public getTriggeredCameraIDs(): Set<string> {
    const ids = new Set<string>();
    this._states.forEach((state, cameraID) => {
      if (this._isStateTriggered(state)) {
        ids.add(cameraID);
      }
    });
    return ids;
  }

  public isTriggered(): boolean {
    return [...this._states.values()].some((state) => this._isStateTriggered(state));
  }

  public getMostRecentlyTriggeredCameraID(): string | null {
    const mostRecent = maxBy(
      [...this._states.entries()].filter(([, state]) => this._isStateTriggered(state)),
      ([, state]) => state.lastTriggerTime.getTime(),
    );
    return mostRecent?.[0] ?? null;
  }

  /**
   * Evaluate the cameras that became ready too early to be evaluated then. Run
   * as the initial-trigger initialization aspect, which follows the view being
   * set.
   */
  public handleInitialTriggers = async (): Promise<boolean> => {
    let triggered = false;

    // Each evaluation awaits, during which another camera can become ready and
    // be added. Loop until none is left rather than iterating a snapshot.
    while (this._camerasPendingEvaluation.size) {
      const [cameraID] = this._camerasPendingEvaluation;
      this._camerasPendingEvaluation.delete(cameraID);
      triggered = (await this._evaluateReadyCamera(cameraID)) || triggered;
    }

    return triggered;
  };

  /**
   * Handle a single camera reaching the ready state.
   */
  public handleCameraLifecycleChange = async (cameraID: string): Promise<boolean> => {
    // `handleCameraEvent` drops an event while no camera is selected (i.e.
    // before the card has initialized) since it needs to respect
    // `filter_selected_camera`. Evaluating now would silently lose this
    // camera's already-on entities, so leave it for `handleInitialTriggers`
    // which is run after the view exists.
    if (!this._api.getViewManager().hasView()) {
      this._camerasPendingEvaluation.add(cameraID);
      return false;
    }

    return await this._evaluateReadyCamera(cameraID);
  };

  // Evaluate a ready camera's trigger entities, firing its trigger action if
  // necessary.
  private async _evaluateReadyCamera(cameraID: string): Promise<boolean> {
    const result = await this._getInitialTriggersForCamera(cameraID);
    if (result.actionEvent) {
      await this._throttledTriggerAction(result.actionEvent);
    }
    return result.triggered;
  }

  private async _getInitialTriggersForCamera(
    cameraID: string,
  ): Promise<InitialTriggerResult> {
    const cameraManager = this._api.getCameraManager();
    const camera = cameraManager.getStore().getCamera(cameraID);

    // A camera that has not finished initializing has not subscribed to its
    // trigger entities, so its already-on entities must not synthesize a
    // trigger (yet).
    if (!camera || !cameraManager.isCameraReady(cameraID)) {
      return { actionEvent: null, triggered: false };
    }

    if (!camera.getCapabilities().has('trigger')) {
      return { actionEvent: null, triggered: false };
    }

    const hass = this._api.getHASSManager().getHASS();
    let triggered = false;
    let actionEvent: CameraEvent | null = null;

    for (const entityID of camera.getTriggerEntities()) {
      if (isTriggeredState(hass?.states[entityID]?.state)) {
        triggered = true;
        const event: CameraEvent = {
          cameraID,
          id: entityID,
          type: 'new',
        };
        if (
          await this.handleCameraEvent(event, {
            skipAction: true,
          })
        ) {
          actionEvent ??= event;
        }
      }
    }

    return { actionEvent, triggered };
  }

  // Returns true if the event was accepted into trigger state processing.
  // Returns false if it was ignored (e.g. missing config/view or camera filter
  // mismatch).
  public async handleCameraEvent(
    ev: CameraEvent,
    options?: {
      skipAction?: boolean;
    },
  ): Promise<boolean> {
    const skipAction = options?.skipAction ?? false;
    if (ev.type === 'end') {
      return this._handleEndEvent(ev);
    }

    if (ev.type === 'momentary') {
      const handled = await this.handleCameraEvent({ ...ev, type: 'new' }, options);
      if (handled) {
        // A momentary event has no start/end -- handled as a matched new+end so
        // concurrent continuous sources still gate untriggering correctly. The
        // end leg is tagged `{ momentary: true }` so `_startUntrigger` adds the
        // synthesized on-period (`event_hold_seconds`) on top of the usual
        // post-source-end linger (`untrigger_delay_seconds`).
        await this._handleEndEvent(ev, { momentary: true });
      }
      return handled;
    }

    // Ignore stale updates for force-untriggered IDs before doing any further
    // processing to avoid re-activating muted IDs.
    if (this._isIgnoredUpdateEvent(ev)) {
      return false;
    }

    const config = this._api.getConfigManager().getConfig();
    const triggersConfig = config?.view?.triggers;
    const selectedCameraID = this._api.getViewManager().getView()?.camera;

    if (!triggersConfig || !selectedCameraID) {
      return false;
    }

    const dependentCameraIDs = this._api
      .getCameraManager()
      .getStore()
      .getAllDependentCameras(selectedCameraID);

    if (triggersConfig.filter_selected_camera && !dependentCameraIDs.has(ev.cameraID)) {
      return false;
    }

    const state = this._getOrCreateState(ev.cameraID);
    state.lastTriggerTime = new Date();
    state.sources.add(ev.id);

    this._deleteUntriggerDelayTimer(ev.cameraID);
    this._startForceUntriggerTimerIfNecessary(
      ev.cameraID,
      triggersConfig.untrigger_force_seconds,
    );
    this._setConditionStateIfNecessary();
    if (!skipAction) {
      await this._throttledTriggerAction(ev);
    }
    return true;
  }

  private async _handleEndEvent(
    ev: CameraEvent,
    options?: { momentary?: boolean },
  ): Promise<boolean> {
    this._deleteIgnoredEventID(ev.cameraID, ev.id);

    const state = this._states.get(ev.cameraID);
    state?.sources.delete(ev.id);
    if (!state?.sources.size) {
      await this._startUntrigger(ev.cameraID, options);
    }
    return true;
  }

  private _isIgnoredUpdateEvent(ev: CameraEvent): boolean {
    return (
      (ev.type === 'update' || ev.type === 'genai') &&
      this._hasIgnoredEventID(ev.cameraID, ev.id)
    );
  }

  private _hasAllowableInteractionStateForAction(): boolean {
    const triggersConfig = this._api.getConfigManager().getConfig()?.view.triggers;
    const hasInteraction = this._api.getInteractionManager().hasInteraction();

    return (
      !!triggersConfig &&
      (triggersConfig.actions.interaction_mode === 'all' ||
        (triggersConfig.actions.interaction_mode === 'active' && hasInteraction) ||
        (triggersConfig.actions.interaction_mode === 'inactive' && !hasInteraction))
    );
  }

  private async _triggerAction(ev: CameraEvent): Promise<void> {
    const config = this._api.getConfigManager().getConfig();
    const triggersConfig = config?.view?.triggers;
    const triggerAction = triggersConfig?.actions.trigger;
    const defaultView = config?.view?.default;

    // Skip the trigger action for a high-fidelity "no new media" event when
    // the configured action would change to a non-live view (Frigate may pump
    // out such events). `live`, `call`, and default-with-live remain valid
    // since they don't depend on media being available.
    const skipViewAction =
      ev.fidelity === 'high' &&
      !ev.snapshot &&
      !ev.clip &&
      !ev.review &&
      !(
        triggerAction === 'call' ||
        triggerAction === 'live' ||
        (triggerAction === 'default' && defaultView === 'live')
      );

    if (this._hasAllowableInteractionStateForAction() && !skipViewAction) {
      if (triggerAction === 'update') {
        await this._api.getViewManager().setViewByParametersWithNewQuery({
          queryExecutorOptions: { useCache: false },
        });
      } else if (triggerAction === 'live') {
        await this._api.getViewManager().setViewByParametersWithNewQuery({
          params: {
            view: 'live',
            camera: ev.cameraID,
          },
        });
      } else if (triggerAction === 'default') {
        await this._api.getViewManager().setViewDefaultWithNewQuery({
          params: {
            camera: ev.cameraID,
          },
        });
      } else if (triggerAction === 'call') {
        // Auto-call the triggered camera. `start()` itself handles the
        // navigation to live -- it is idempotent if the view already matches.
        await this._api.getCallManager().start({ cameraID: ev.cameraID, inbound: true });
      } else if (ev.fidelity === 'high' && triggerAction === 'media') {
        // Choose the most appropriate media view based on what's available.
        // Priority: review > clip > snapshot
        /* v8 ignore next: the `null` case is unreachable due to `skipViewAction` above -- @preserve */
        const view = ev.review
          ? 'review'
          : ev.clip
            ? 'clip'
            : ev.snapshot
              ? 'snapshot'
              : null;

        /* v8 ignore next: unreachable due to `skipViewAction` above -- @preserve */
        if (view) {
          await this._api.getViewManager().setViewByParametersWithNewQuery({
            params: {
              view,
              camera: ev.cameraID,
            },
          });
        }
      }
    }

    // Must update master element to add border pulsing to live view.
    this._api.getCardElementManager().update();
  }

  private _setConditionStateIfNecessary(): void {
    const triggeredCameraIDs = this.getTriggeredCameraIDs();
    this._api.getConditionStateManager().setState({
      triggered: triggeredCameraIDs.size ? triggeredCameraIDs : undefined,
    });
  }

  private async _executeUntriggerAction(cameraID: string): Promise<boolean> {
    const action = this._api.getConfigManager().getConfig()?.view?.triggers
      .actions.untrigger;

    if (!action || action === 'none') {
      return true;
    }

    if (!this._hasAllowableInteractionStateForAction()) {
      return true;
    }

    switch (action) {
      case 'default':
        await this._api.getViewManager().setViewDefaultWithNewQuery();
        break;
      case 'call':
        // Triggers only end a call if the call is owned by this cameraID, if it
        // was an inbound call and was not yet answered.
        this._api.getCallManager().endIf({ cameraID, inbound: true, answered: false });
        break;
    }
    return true;
  }

  private async _untriggerAction(cameraID: string): Promise<void> {
    this._deleteUntriggerDelayTimer(cameraID);
    this._deleteForceUntriggerTimer(cameraID);

    await this._executeUntriggerAction(cameraID);
    this._deleteStateIfIdle(cameraID);

    this._setConditionStateIfNecessary();

    // Must update master element to remove border pulsing from live view.
    this._api.getCardElementManager().update();
  }

  private async _startUntrigger(
    cameraID: string,
    options?: { momentary?: boolean },
  ): Promise<void> {
    this._deleteUntriggerDelayTimer(cameraID);
    this._deleteForceUntriggerTimer(cameraID);

    const state = this._states.get(cameraID);
    if (!state) {
      return;
    }

    const triggersConfig = this._api.getConfigManager().getConfig()?.view?.triggers;
    const untriggerDelaySeconds = triggersConfig?.untrigger_delay_seconds ?? 0;
    // For momentary events, add the synthesized on-period (they have no
    // native on/off, so hold them visible before the usual post-source-end
    // linger kicks in). The user-facing field is `event_hold_seconds` because
    // HA events are the common case; internally this is the hold for any
    // momentary source.
    const momentaryHoldSeconds = triggersConfig?.event_hold_seconds ?? 0;
    const effectiveDelaySeconds =
      untriggerDelaySeconds + (options?.momentary ? momentaryHoldSeconds : 0);

    if (effectiveDelaySeconds > 0) {
      state.untriggerDelayTimer = new Timer();
      state.untriggerDelayTimer.start(effectiveDelaySeconds, async () => {
        await this._untriggerAction(cameraID);
      });
    } else {
      await this._untriggerAction(cameraID);
    }
  }

  private _startForceUntriggerTimerIfNecessary(
    cameraID: string,
    forceUntriggerSeconds: number,
  ): void {
    if (forceUntriggerSeconds <= 0) {
      return;
    }

    const state = this._states.get(cameraID);
    if (!state || state.untriggerForceTimer) {
      return;
    }

    const timer = new Timer();
    state.untriggerForceTimer = timer;
    timer.start(forceUntriggerSeconds, async () => {
      await this._forceUntrigger(state, cameraID);
    });
  }

  private async _forceUntrigger(
    state: CameraTriggerState,
    cameraID: string,
  ): Promise<void> {
    state.sources.forEach((id) => this._addIgnoredEventID(cameraID, id));
    state.sources.clear();
    this._deleteForceUntriggerTimer(cameraID);
    await this._startUntrigger(cameraID);
  }

  private _addIgnoredEventID(cameraID: string, eventID: string): void {
    const state = this._getOrCreateState(cameraID);
    state.ignoredSources.add(eventID);
  }

  private _deleteIgnoredEventID(cameraID: string, eventID: string): void {
    const state = this._states.get(cameraID);
    if (!state) {
      return;
    }

    state.ignoredSources.delete(eventID);
    this._deleteStateIfIdle(cameraID);
  }

  private _hasIgnoredEventID(cameraID: string, eventID: string): boolean {
    return !!this._states.get(cameraID)?.ignoredSources.has(eventID);
  }

  private _getOrCreateState(cameraID: string): CameraTriggerState {
    let state = this._states.get(cameraID);
    if (!state) {
      state = {
        lastTriggerTime: new Date(),
        sources: new Set(),
        ignoredSources: new Set(),
      };
      this._states.set(cameraID, state);
    }
    return state;
  }

  private _deleteStateIfIdle(cameraID: string): void {
    const state = this._states.get(cameraID);
    if (
      state &&
      !state.sources.size &&
      !state.ignoredSources.size &&
      !state.untriggerDelayTimer &&
      !state.untriggerForceTimer
    ) {
      this._states.delete(cameraID);
    }
  }

  private _deleteUntriggerDelayTimer(cameraID: string): void {
    const state = this._states.get(cameraID);
    if (state?.untriggerDelayTimer) {
      state.untriggerDelayTimer.stop();
      delete state.untriggerDelayTimer;
    }
  }

  private _deleteForceUntriggerTimer(cameraID: string): void {
    const state = this._states.get(cameraID);
    if (state?.untriggerForceTimer) {
      state.untriggerForceTimer.stop();
      delete state.untriggerForceTimer;
    }
  }

  private _stopAllTimers(): void {
    for (const [cameraID] of this._states) {
      this._deleteUntriggerDelayTimer(cameraID);
      this._deleteForceUntriggerTimer(cameraID);
    }
  }

  public reset(): void {
    this._throttledTriggerAction.cancel();
    this._stopAllTimers();
    this._states.clear();
    this._camerasPendingEvaluation.clear();
    this._setConditionStateIfNecessary();
  }

  private _isStateTriggered(state: CameraTriggerState): boolean {
    return !!(state.sources.size || state.untriggerDelayTimer);
  }
}
