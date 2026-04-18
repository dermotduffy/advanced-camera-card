import { maxBy, throttle } from 'lodash-es';
import { CameraEvent } from '../camera-manager/types';
import { isTriggeredState } from '../ha/is-triggered-state';
import { Timer } from '../utils/timer';
import { CardTriggersAPI } from './types';

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

export class TriggersManager {
  private _api: CardTriggersAPI;
  private _states: Map<string, CameraTriggerState> = new Map();

  private _throttledTriggerAction = throttle(this._triggerAction.bind(this), 1000, {
    trailing: true,
  });

  constructor(api: CardTriggersAPI) {
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

  public handleInitialCameraTriggers = async (): Promise<boolean> => {
    const hass = this._api.getHASSManager().getHASS();
    let triggered = false;
    let startupActionEvent: CameraEvent | null = null;
    this._states.clear();

    for (const [cameraID, camera] of this._api
      .getCameraManager()
      .getStore()
      .getCameras()) {
      for (const entityID of camera.getConfig().triggers.entities) {
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
            startupActionEvent ??= event;
          }
        }
      }
    }

    if (startupActionEvent) {
      await this._throttledTriggerAction(startupActionEvent);
    }

    return triggered;
  };

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

  private async _handleEndEvent(ev: CameraEvent): Promise<boolean> {
    this._deleteIgnoredEventID(ev.cameraID, ev.id);

    const state = this._states.get(ev.cameraID);
    state?.sources.delete(ev.id);
    if (!state?.sources.size) {
      await this._startUntrigger(ev.cameraID);
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
    const triggerAction = config?.view?.triggers.actions.trigger;
    const defaultView = config?.view?.default;

    // Early exit guard: If this is a high-fidelity event where we are certain
    // about new media, don't take action unless it's to change to live (Frigate
    // engine may pump out events where there's no new media to show). Other
    // trigger actions (e.g. media, update) do not make sense without having
    // some new media.
    if (
      ev.fidelity === 'high' &&
      !ev.snapshot &&
      !ev.clip &&
      !ev.review &&
      !(
        triggerAction === 'live' ||
        (triggerAction === 'default' && defaultView === 'live')
      )
    ) {
      return;
    }

    if (this._hasAllowableInteractionStateForAction()) {
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
      } else if (ev.fidelity === 'high' && triggerAction === 'media') {
        // Choose the most appropriate media view based on what's available.
        // Priority: review > clip > snapshot
        const view = ev.review
          ? 'review'
          : ev.clip
            ? 'clip'
            : ev.snapshot
              ? 'snapshot'
              : /* istanbul ignore next: unreachable due to early exit guard above -- @preserve */
                null;

        /* istanbul ignore next: unreachable due to early exit guard above -- @preserve */
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

  private async _executeUntriggerAction(): Promise<boolean> {
    const action = this._api.getConfigManager().getConfig()?.view?.triggers
      .actions.untrigger;

    if (!action || action === 'none') {
      return true;
    }

    if (this._hasAllowableInteractionStateForAction()) {
      await this._api.getViewManager().setViewDefaultWithNewQuery();
    }
    return true;
  }

  private async _untriggerAction(cameraID: string): Promise<void> {
    this._deleteUntriggerDelayTimer(cameraID);
    this._deleteForceUntriggerTimer(cameraID);

    await this._executeUntriggerAction();
    this._deleteStateIfIdle(cameraID);

    this._setConditionStateIfNecessary();

    // Must update master element to remove border pulsing from live view.
    this._api.getCardElementManager().update();
  }

  private async _startUntrigger(cameraID: string): Promise<void> {
    this._deleteUntriggerDelayTimer(cameraID);
    this._deleteForceUntriggerTimer(cameraID);

    const state = this._states.get(cameraID);
    if (!state) {
      return;
    }

    const config = this._api.getConfigManager().getConfig();
    const untriggerDelaySeconds = config?.view?.triggers.untrigger_delay_seconds ?? 0;

    if (untriggerDelaySeconds > 0) {
      state.untriggerDelayTimer = new Timer();
      state.untriggerDelayTimer.start(untriggerDelaySeconds, async () => {
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

  private _isStateTriggered(state: CameraTriggerState): boolean {
    return !!(state.sources.size || state.untriggerDelayTimer);
  }
}
