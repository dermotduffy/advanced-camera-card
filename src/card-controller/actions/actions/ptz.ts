import { PTZActionConfig } from '../../../config/schema/actions/custom/ptz';
import { PTZMovementType } from '../../../types';
import { getPTZTarget, ptzActionToCapabilityKey } from '../../../utils/ptz';
import { Timer } from '../../../utils/timer';
import { CardActionsAPI } from '../../types';
import {
  setInProgressForThisTarget,
  stopInProgressForThisTarget,
} from '../utils/action-state';
import { AdvancedCameraCardAction } from './base';

interface PTZContext {
  [cameraID: string]: {
    inProgressAction?: PTZAction;
  };
}

declare module 'action' {
  interface ActionContext {
    ptz?: PTZContext;
  }
}

export class PTZAction extends AdvancedCameraCardAction<PTZActionConfig> {
  protected _timer = new Timer();
  protected _stopped = false;

  public async stop(): Promise<void> {
    this._stopped = true;
    this._timer.stop();
  }

  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    const view = api.getViewManager().getView();
    if (!view) {
      return;
    }

    const ptzCameraID =
      this._action.camera ??
      getPTZTarget(view, { type: 'ptz', cameraManager: api.getCameraManager() })
        ?.targetID ??
      null;
    const ptzCapabilities = ptzCameraID
      ? api.getCameraManager().getCameraCapabilities(ptzCameraID)?.getPTZCapabilities()
      : null;
    const ptzConfiguration = ptzCameraID
      ? api.getCameraManager().getStore().getCameraConfig(ptzCameraID)?.ptz
      : null;
    if (!ptzCameraID || !ptzCapabilities || !ptzConfiguration) {
      return;
    }

    if (!this._action.ptz_action) {
      if (ptzCapabilities.presets && ptzCapabilities.presets.length >= 1) {
        await api.getCameraManager().executePTZAction(ptzCameraID, 'preset', {
          phase: this._action.ptz_phase,
          preset: ptzCapabilities.presets[0],
        });
      }
      return;
    }

    const capabilityKey = ptzActionToCapabilityKey(this._action.ptz_action);
    if (
      (capabilityKey &&
        ptzCapabilities[capabilityKey]?.includes(
          this._action.ptz_phase ? PTZMovementType.Continuous : PTZMovementType.Relative,
        )) ||
      this._action.ptz_action === 'preset'
    ) {
      // Scenario: Camera natively supports requested move type.
      return await api
        .getCameraManager()
        .executePTZAction(ptzCameraID, this._action.ptz_action, {
          phase: this._action.ptz_phase,
          preset: this._action.ptz_preset,
        });
    }

    if (this._action.ptz_phase === 'start') {
      // Scenario: Asked to start a continuous move, camera only supports relative moves natively.
      await stopInProgressForThisTarget(ptzCameraID, this._context.ptz);
      setInProgressForThisTarget(ptzCameraID, this._context, 'ptz', this);

      const singleStep = async (): Promise<void> => {
        /* istanbul ignore else: the else path cannot be reached as ptz_action
        being present is checked above -- @preserve */
        if (this._action.ptz_action) {
          await api
            .getCameraManager()
            .executePTZAction(ptzCameraID, this._action.ptz_action, {
              preset: this._action.ptz_preset,
            });
        }

        if (!this._stopped) {
          // Only start the timer for the next step after this step returns, and
          // only if this action has not been stopped.
          // See: https://github.com/dermotduffy/advanced-camera-card/issues/1967
          this._timer.start(
            ptzConfiguration.r2c_delay_between_calls_seconds,
            singleStep,
          );
        }
      };

      this._stopped = false;
      await singleStep();
    } else if (this._action.ptz_phase === 'stop') {
      // Scenario: Asked to stop continuous move, camera only supports relative moves natively.
      await stopInProgressForThisTarget(ptzCameraID, this._context.ptz);
    } else {
      this._stopped = false;

      // Relative move (but camera only supports continuous).
      await api
        .getCameraManager()
        .executePTZAction(ptzCameraID, this._action.ptz_action, {
          preset: this._action.ptz_preset,
          phase: 'start',
        });

      this._timer.start(ptzConfiguration.c2r_delay_between_calls_seconds, async () => {
        /* istanbul ignore else: the else path cannot be reached as ptz_action
        being present is checked above -- @preserve */
        if (this._action.ptz_action) {
          await api
            .getCameraManager()
            .executePTZAction(ptzCameraID, this._action.ptz_action, {
              preset: this._action.ptz_preset,
              phase: 'stop',
            });
        }
      });
    }
  }
}
