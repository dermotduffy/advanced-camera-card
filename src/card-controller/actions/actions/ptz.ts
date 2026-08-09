import { getConfiguredPTZPresetAction } from '../../../camera-manager/utils/ptz';
import type { PTZActionConfig } from '../../../config/schema/actions/custom/ptz';
import { PTZMovementType } from '../../../types';
import { getPTZTarget, ptzActionToCapabilityKey } from '../../../utils/ptz';
import { Timer } from '../../../utils/timer';
import type { CardActionsAPI } from '../../types';
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
  private _timer = new Timer();
  private _stopped = false;

  public async stop(): Promise<void> {
    this._stopped = true;
    this._timer.stop();
  }

  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    const action = this._getAction();

    const view = api.getViewManager().getView();
    if (!view) {
      return;
    }

    const ptzCameraID =
      action.camera ??
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

    if (!action.ptz_action) {
      // A configured `home` preset takes precedence over the first
      // auto-detected preset. Without this, engines that auto-detect presets
      // (e.g. Reolink) populate `capabilities.presets` from a `select` entity
      // and the home button always targets `presets[0]`, ignoring the
      // configured action. See:
      // https://github.com/dermotduffy/advanced-camera-card/issues/2525
      if (getConfiguredPTZPresetAction(ptzConfiguration, 'home')) {
        await api.getCameraManager().executePTZAction(ptzCameraID, 'preset', {
          phase: action.ptz_phase,
          preset: 'home',
        });
      } else if (ptzCapabilities.presets && ptzCapabilities.presets.length >= 1) {
        await api.getCameraManager().executePTZAction(ptzCameraID, 'preset', {
          phase: action.ptz_phase,
          preset: ptzCapabilities.presets[0],
        });
      }
      return;
    }

    const capabilityKey = ptzActionToCapabilityKey(action.ptz_action);
    if (
      (capabilityKey &&
        ptzCapabilities[capabilityKey]?.includes(
          action.ptz_phase ? PTZMovementType.Continuous : PTZMovementType.Relative,
        )) ||
      action.ptz_action === 'preset'
    ) {
      // Scenario: Camera natively supports requested move type.
      return await api
        .getCameraManager()
        .executePTZAction(ptzCameraID, action.ptz_action, {
          phase: action.ptz_phase,
          preset: action.ptz_preset,
        });
    }

    if (action.ptz_phase === 'start') {
      // Scenario: Asked to start a continuous move, camera only supports relative moves natively.
      await stopInProgressForThisTarget(ptzCameraID, this._context.ptz);
      setInProgressForThisTarget(ptzCameraID, this._context, 'ptz', this);

      const singleStep = async (): Promise<void> => {
        /* v8 ignore else: the else path cannot be reached as ptz_action
        being present is checked above -- @preserve */
        if (action.ptz_action) {
          await api.getCameraManager().executePTZAction(ptzCameraID, action.ptz_action, {
            preset: action.ptz_preset,
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
    } else if (action.ptz_phase === 'stop') {
      // Scenario: Asked to stop continuous move, camera only supports relative moves natively.
      await stopInProgressForThisTarget(ptzCameraID, this._context.ptz);
    } else {
      this._stopped = false;

      // Relative move (but camera only supports continuous).
      await api.getCameraManager().executePTZAction(ptzCameraID, action.ptz_action, {
        preset: action.ptz_preset,
        phase: 'start',
      });

      this._timer.start(ptzConfiguration.c2r_delay_between_calls_seconds, async () => {
        /* v8 ignore else: the else path cannot be reached as ptz_action
        being present is checked above -- @preserve */
        if (action.ptz_action) {
          await api.getCameraManager().executePTZAction(ptzCameraID, action.ptz_action, {
            preset: action.ptz_preset,
            phase: 'stop',
          });
        }
      });
    }
  }
}
