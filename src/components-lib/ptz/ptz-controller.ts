import { CameraManager } from '../../camera-manager/manager.js';
import { dispatchActionExecutionRequest } from '../../card-controller/actions/utils/execution-request.js';
import { SubmenuInteraction } from '../../components/submenu/types.js';
import { PTZAction } from '../../config/schema/actions/custom/ptz.js';
import { Actions, ActionsConfig } from '../../config/schema/actions/types.js';
import { PTZControlsConfig } from '../../config/schema/common/controls/ptz.js';
import { HomeAssistant } from '../../ha/types.js';
import { Interaction } from '../../types.js';
import { createPTZMultiAction, getActionConfigGivenAction } from '../../utils/action.js';
import { PTZControllerActions } from './types';

export class PTZController {
  private _host: HTMLElement;

  private _config: PTZControlsConfig | null = null;
  private _hass: HomeAssistant | null = null;
  private _cameraManager: CameraManager | null = null;
  private _cameraID: string | null = null;

  private _forceVisibility?: boolean;

  constructor(host: HTMLElement) {
    this._host = host;
  }

  public setConfig(config?: PTZControlsConfig) {
    this._config = config ?? null;

    this._host.setAttribute('data-orientation', config?.orientation ?? 'horizontal');
    this._host.setAttribute('data-position', config?.position ?? 'bottom-right');
    this._host.setAttribute(
      'style',
      Object.entries(config?.style ?? {})
        .map(([k, v]) => `${k}:${v}`)
        .join(';'),
    );
  }

  public getConfig(): PTZControlsConfig | null {
    return this._config;
  }

  public setCamera(cameraManager?: CameraManager, cameraID?: string): void {
    this._cameraManager = cameraManager ?? null;
    this._cameraID = cameraID ?? null;
  }

  public setForceVisibility(forceVisibility?: boolean): void {
    this._forceVisibility = forceVisibility;
  }

  public handleAction(
    ev: CustomEvent<Interaction & Partial<SubmenuInteraction>>,
    buttonConfig?: ActionsConfig | null,
  ): void {
    const config: ActionsConfig | null = buttonConfig ?? ev.detail.item ?? null;

    // Nothing else has the configuration for this action, so don't let it
    // propagate further.
    ev.stopPropagation();

    const interaction: string = ev.detail.action;
    const action = getActionConfigGivenAction(interaction, config);
    if (action) {
      dispatchActionExecutionRequest(this._host, {
        action: action,
        ...(config && { config: config }),
      });
    }
  }

  public shouldDisplay(): boolean {
    return this._forceVisibility !== undefined
      ? this._forceVisibility
      : this._config?.mode === 'auto'
        ? !!this._cameraID &&
          !!this._cameraManager
            ?.getCameraCapabilities(this._cameraID)
            ?.hasPTZCapability()
        : this._config?.mode === 'on';
  }

  public getPTZActions(): PTZControllerActions {
    const cameraCapabilities = this._cameraID
      ? this._cameraManager?.getCameraCapabilities(this._cameraID)
      : null;
    const hasRealPTZCapability =
      cameraCapabilities && cameraCapabilities.hasPTZCapability();
    const ptzCapabilities = cameraCapabilities?.getPTZCapabilities();

    const getContinuousActions = (options?: {
      ptzAction?: PTZAction;
      preset?: string;
    }): Actions => ({
      start_tap_action: createPTZMultiAction({
        ptzAction: options?.ptzAction,
        ptzPhase: 'start',
        ptzPreset: options?.preset,
      }),
      end_tap_action: createPTZMultiAction({
        ptzAction: options?.ptzAction,
        ptzPhase: 'stop',
        ptzPreset: options?.preset,
      }),
    });

    const getDiscreteAction = (options?: {
      ptzAction?: PTZAction;
      preset?: string;
    }): Actions => ({
      tap_action: createPTZMultiAction({
        ptzAction: options?.ptzAction,
        ptzPreset: options?.preset,
      }),
    });

    const actions: PTZControllerActions = {};
    if (!hasRealPTZCapability || ptzCapabilities?.up) {
      actions.up = getContinuousActions({
        ptzAction: 'up',
      });
    }
    if (!hasRealPTZCapability || ptzCapabilities?.down) {
      actions.down = getContinuousActions({
        ptzAction: 'down',
      });
    }
    if (!hasRealPTZCapability || ptzCapabilities?.left) {
      actions.left = getContinuousActions({
        ptzAction: 'left',
      });
    }
    if (!hasRealPTZCapability || ptzCapabilities?.right) {
      actions.right = getContinuousActions({
        ptzAction: 'right',
      });
    }
    if (!hasRealPTZCapability || ptzCapabilities?.zoomIn) {
      actions.zoom_in = getContinuousActions({
        ptzAction: 'zoom_in',
      });
    }
    if (!hasRealPTZCapability || ptzCapabilities?.zoomOut) {
      actions.zoom_out = getContinuousActions({
        ptzAction: 'zoom_out',
      });
    }
    if (!hasRealPTZCapability || ptzCapabilities?.presets?.length) {
      actions.home = getDiscreteAction();
    }
    for (const preset of ptzCapabilities?.presets ?? []) {
      actions.presets ??= [];
      actions.presets.push({
        preset: preset,
        actions: getDiscreteAction({
          preset: preset,
          ptzAction: 'preset',
        }),
      });
    }

    return actions;
  }
}
