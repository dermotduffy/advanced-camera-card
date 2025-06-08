import { orderBy, throttle } from 'lodash-es';
import { CameraEvent } from '../camera-manager/types';
import { isTriggeredState } from '../ha/is-triggered-state';
import { Timer } from '../utils/timer';
import { CardTriggersAPI } from './types';

export class TriggersManager {
  protected _api: CardTriggersAPI;

  protected _triggeredCameras: Map<string, Date> = new Map();
  protected _triggeredCameraTimers: Map<string, Timer> = new Map();

  protected _throttledTriggerAction = throttle(this._triggerAction.bind(this), 1000, {
    trailing: true,
  });

  constructor(api: CardTriggersAPI) {
    this._api = api;
  }

  public getTriggeredCameraIDs(): Set<string> {
    return new Set(this._triggeredCameras.keys());
  }

  public isTriggered(): boolean {
    return !!this._triggeredCameras.size;
  }

  public getMostRecentlyTriggeredCameraID(): string | null {
    const sorted = orderBy(
      [...this._triggeredCameras.entries()],
      (entry) => entry[1].getTime(),
      'desc',
    );
    return sorted.length ? sorted[0][0] : null;
  }

  public handleInitialCameraTriggers = async (): Promise<boolean> => {
    const hass = this._api.getHASSManager().getHASS();
    let triggered = false;

    for (const [cameraID, camera] of this._api
      .getCameraManager()
      .getStore()
      .getCameras()) {
      if (
        camera
          .getConfig()
          .triggers.entities.some((entityID) =>
            isTriggeredState(hass?.states[entityID]?.state),
          )
      ) {
        triggered = true;
        await this.handleCameraEvent({
          cameraID,
          type: 'new',
        });
      }
    }
    return triggered;
  };

  public async handleCameraEvent(ev: CameraEvent): Promise<void> {
    const triggersConfig = this._api.getConfigManager().getConfig()?.view.triggers;
    const selectedCameraID = this._api.getViewManager().getView()?.camera;

    if (!triggersConfig || !selectedCameraID) {
      return;
    }

    const dependentCameraIDs = this._api
      .getCameraManager()
      .getStore()
      .getAllDependentCameras(selectedCameraID);

    if (triggersConfig.filter_selected_camera && !dependentCameraIDs.has(ev.cameraID)) {
      return;
    }

    if (ev.type === 'end') {
      this._startUntriggerTimer(ev.cameraID);
      return;
    }

    this._triggeredCameras.set(ev.cameraID, new Date());
    this._setConditionStateIfNecessary();
    await this._throttledTriggerAction(ev);
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
    const triggerAction = this._api.getConfigManager().getConfig()?.view.triggers
      .actions.trigger;
    const defaultView = this._api.getConfigManager().getConfig()?.view.default;

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
    const triggeredCameraIDs = new Set(this._triggeredCameras.keys());
    const triggeredState = triggeredCameraIDs.size ? triggeredCameraIDs : undefined;

    this._api.getConditionStateManager().setState({
      triggered: triggeredState,
    });
  }

  protected async _untriggerAction(cameraID: string): Promise<void> {
    const action = this._api.getConfigManager().getConfig()?.view.triggers
      .actions.untrigger;

    if (action === 'default' && this._hasAllowableInteractionStateForAction()) {
      await this._api.getViewManager().setViewDefaultWithNewQuery();
    }
    this._triggeredCameras.delete(cameraID);
    this._deleteTimer(cameraID);
    this._setConditionStateIfNecessary();

    // Must update master element to remove border pulsing from live view.
    this._api.getCardElementManager().update();
  }

  protected _startUntriggerTimer(cameraID: string): void {
    this._deleteTimer(cameraID);

    const timer = new Timer();
    this._triggeredCameraTimers.set(cameraID, timer);
    timer.start(
      /* istanbul ignore next: the case of config being null here cannot be
         reached, as there's no way to have the untrigger call happen without
         a config. -- @preserve */
      this._api.getConfigManager().getConfig()?.view.triggers.untrigger_seconds ?? 0,
      async () => {
        await this._untriggerAction(cameraID);
      },
    );
  }

  protected _deleteTimer(cameraID: string): void {
    this._triggeredCameraTimers.get(cameraID)?.stop();
    this._triggeredCameraTimers.delete(cameraID);
  }
}
