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

  // A timer used to delay the untrigger action.
  untriggerDelayTimer?: Timer;
}

export class TriggersManager {
  protected _api: CardTriggersAPI;
  protected _states: Map<string, CameraTriggerState> = new Map();

  protected _throttledTriggerAction = throttle(this._triggerAction.bind(this), 1000, {
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
      const state = this._states.get(ev.cameraID);
      state?.sources.delete(ev.id);
      if (!state?.sources.size) {
        await this._startUntrigger(ev.cameraID);
      }
      return true;
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

    let state = this._states.get(ev.cameraID);
    if (!state) {
      state = {
        lastTriggerTime: new Date(),
        sources: new Set(),
      };
      this._states.set(ev.cameraID, state);
    } else {
      state.lastTriggerTime = new Date();
    }

    state.sources.add(ev.id);

    this._deleteUntriggerDelayTimer(ev.cameraID);
    this._setConditionStateIfNecessary();
    if (!skipAction) {
      await this._throttledTriggerAction(ev);
    }
    return true;
  }

  protected _hasAllowableInteractionStateForAction(): boolean {
    const triggersConfig = this._api.getConfigManager().getConfig()?.view.triggers;
    const hasInteraction = this._api.getInteractionManager().hasInteraction();

    return (
      !!triggersConfig &&
      (triggersConfig.actions.interaction_mode === 'all' ||
        (triggersConfig.actions.interaction_mode === 'active' && hasInteraction) ||
        (triggersConfig.actions.interaction_mode === 'inactive' && !hasInteraction))
    );
  }

  protected async _triggerAction(ev: CameraEvent): Promise<void> {
    const config = this._api.getConfigManager().getConfig();
    const triggerAction = config?.view?.triggers.actions.trigger;
    const defaultView = config?.view?.default;

    // If this is a high-fidelity event where we are certain about new media,
    // don't take action unless it's to change to live (Frigate engine may pump
    // out events where there's no new media to show). Other trigger actions
    // (e.g. media, update) do not make sense without having some new media.
    if (
      ev.fidelity === 'high' &&
      !ev.snapshot &&
      !ev.clip &&
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
        await this._api.getViewManager().setViewByParametersWithNewQuery({
          params: {
            view: ev.clip ? 'clip' : 'snapshot',
            camera: ev.cameraID,
          },
        });
      }
    }

    // Must update master element to add border pulsing to live view.
    this._api.getCardElementManager().update();
  }

  protected _setConditionStateIfNecessary(): void {
    const triggeredCameraIDs = this.getTriggeredCameraIDs();
    this._api.getConditionStateManager().setState({
      triggered: triggeredCameraIDs.size ? triggeredCameraIDs : undefined,
    });
  }

  protected async _executeUntriggerAction(): Promise<boolean> {
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

  protected async _untriggerAction(cameraID: string): Promise<void> {
    this._deleteUntriggerDelayTimer(cameraID);

    await this._executeUntriggerAction();
    this._states.delete(cameraID);

    this._setConditionStateIfNecessary();

    // Must update master element to remove border pulsing from live view.
    this._api.getCardElementManager().update();
  }

  protected async _startUntrigger(cameraID: string): Promise<void> {
    this._deleteUntriggerDelayTimer(cameraID);

    const state = this._states.get(cameraID);
    if (!state) {
      return;
    }

    const config = this._api.getConfigManager().getConfig();
    const untriggerSeconds = config?.view?.triggers.untrigger_seconds ?? 0;

    if (untriggerSeconds > 0) {
      state.untriggerDelayTimer = new Timer();
      state.untriggerDelayTimer.start(untriggerSeconds, async () => {
        await this._untriggerAction(cameraID);
      });
    } else {
      await this._untriggerAction(cameraID);
    }
  }

  protected _deleteUntriggerDelayTimer(cameraID: string): void {
    const state = this._states.get(cameraID);
    if (state?.untriggerDelayTimer) {
      state.untriggerDelayTimer.stop();
      delete state.untriggerDelayTimer;
    }
  }

  protected _isStateTriggered(state: CameraTriggerState): boolean {
    return !!(state.sources.size || state.untriggerDelayTimer);
  }
}
