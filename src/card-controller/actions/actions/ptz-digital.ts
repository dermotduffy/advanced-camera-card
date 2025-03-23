import clamp from 'lodash-es/clamp';
import {
  PartialZoomSettings,
  ZOOM_DEFAULT_PAN_X,
  ZOOM_DEFAULT_PAN_Y,
  ZOOM_DEFAULT_SCALE,
} from '../../../components-lib/zoom/types';
import { generateViewContextForZoom } from '../../../components-lib/zoom/zoom-view-context';
import { PTZDigitialActionConfig } from '../../../config/schema/actions/custom/ptz-digital';
import { ZOOM_MAX, ZOOM_MIN } from '../../../config/schema/common/zoom';
import { getPTZTarget } from '../../../utils/ptz';
import { Timer } from '../../../utils/timer';
import { CardActionsAPI } from '../../types';
import { TargetedActionContext } from '../types';
import {
  setInProgressForThisTarget,
  stopInProgressForThisTarget,
} from '../utils/action-state';
import { AdvancedCameraCardAction } from './base';

const STEP_DELAY_SECONDS = 0.1;
const STEP_ZOOM = 0.1;
const STEP_PAN = 5;

declare module 'action' {
  interface ActionContext {
    ptzDigital?: TargetedActionContext;
  }
}

export class PTZDigitalAction extends AdvancedCameraCardAction<PTZDigitialActionConfig> {
  protected _timer = new Timer();

  protected async _stepChange(api: CardActionsAPI, targetID: string): Promise<void> {
    api.getViewManager().setViewWithMergedContext(
      generateViewContextForZoom(targetID, {
        requested: this._convertActionToZoomSettings(
          api.getViewManager().getView()?.context?.zoom?.[targetID]?.observed,
        ),
      }),
    );
  }

  public async stop(): Promise<void> {
    this._timer.stop();
  }

  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    const view = api.getViewManager().getView();
    if (!view) {
      return;
    }

    const targetID =
      this._action.target_id ??
      getPTZTarget(view, { type: 'digital', cameraManager: api.getCameraManager() })
        ?.targetID;
    if (!targetID) {
      return;
    }

    if (!!this._action.absolute || !this._action.ptz_phase) {
      return await this._stepChange(api, targetID);
    }

    /* istanbul ignore else: the else path cannot be reached -- @preserve */
    if (this._action.ptz_phase === 'start') {
      await stopInProgressForThisTarget(targetID, this._context.ptzDigital);
      setInProgressForThisTarget(targetID, this._context, 'ptzDigital', this);

      await this._stepChange(api, targetID);
      this._timer.startRepeated(STEP_DELAY_SECONDS, () =>
        this._stepChange(api, targetID),
      );
    } else if (this._action.ptz_phase === 'stop') {
      await stopInProgressForThisTarget(targetID, this._context.ptzDigital);
      delete this._context.ptzDigital?.[targetID];
    }
  }

  protected _convertActionToZoomSettings(
    base?: PartialZoomSettings,
  ): PartialZoomSettings {
    if (!this._action.absolute && !this._action.ptz_action) {
      // If neither an absolute position nor an action are specified, the request
      // is assumed to be to return to default.
      return {};
    }

    if (this._action.absolute) {
      return this._action.absolute;
    }

    const zoom = base?.zoom ?? ZOOM_DEFAULT_SCALE;
    const pan = {
      x: base?.pan?.x ?? ZOOM_DEFAULT_PAN_X,
      y: base?.pan?.y ?? ZOOM_DEFAULT_PAN_Y,
    };

    const zoomDelta =
      this._action.ptz_action === 'zoom_in'
        ? STEP_ZOOM
        : this._action.ptz_action === 'zoom_out'
          ? -STEP_ZOOM
          : 0;
    const xDelta =
      this._action.ptz_action === 'left'
        ? -STEP_PAN
        : this._action.ptz_action === 'right'
          ? STEP_PAN
          : 0;
    const yDelta =
      this._action.ptz_action === 'up'
        ? -STEP_PAN
        : this._action.ptz_action === 'down'
          ? STEP_PAN
          : 0;

    return {
      zoom: clamp(zoom + zoomDelta, ZOOM_MIN, ZOOM_MAX),
      pan: {
        x: clamp(pan.x + xDelta, 0, 100),
        y: clamp(pan.y + yDelta, 0, 100),
      },
    };
  }
}
