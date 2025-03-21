import { CardActionsAPI } from '../card-controller/types.js';
import { ZoomSettingsBase } from '../components-lib/zoom/types.js';
import { CameraSelectActionConfig } from '../config/schema/actions/custom/camera-select.js';
import { DisplayModeActionConfig } from '../config/schema/actions/custom/display-mode.js';
import {
  AdvancedCameraCardGeneralAction,
  GeneralActionConfig,
} from '../config/schema/actions/custom/general.js';
import {
  INTERNAL_CALLBACK_ACTION,
  InternalCallbackActionConfig,
} from '../config/schema/actions/custom/internal.js';
import { LogActionConfig, LogActionLevel } from '../config/schema/actions/custom/log.js';
import { MediaPlayerActionConfig } from '../config/schema/actions/custom/media-player.js';
import { PTZControlsActionConfig } from '../config/schema/actions/custom/ptz-controls.js';
import { PTZDigitialActionConfig } from '../config/schema/actions/custom/ptz-digital.js';
import { PTZMultiActionConfig } from '../config/schema/actions/custom/ptz-multi.js';
import {
  PTZAction,
  PTZActionConfig,
  PTZActionPhase,
} from '../config/schema/actions/custom/ptz.js';
import { SubstreamSelectActionConfig } from '../config/schema/actions/custom/substream-select.js';
import { ViewActionConfig } from '../config/schema/actions/custom/view.js';
import { PerformActionActionConfig } from '../config/schema/actions/stock/perform-action.js';
import {
  ActionConfig,
  ActionsConfig,
  AdvancedCameraCardCustomActionConfig,
} from '../config/schema/actions/types.js';
import { AdvancedCameraCardUserSpecifiedView } from '../config/schema/common/const.js';
import { ServiceCallRequest } from '../ha/types.js';
import { arrayify } from './basic.js';

export function createGeneralAction(
  action: AdvancedCameraCardGeneralAction,
  options?: {
    cardID?: string;
  },
): GeneralActionConfig {
  return {
    action: 'fire-dom-event',
    advanced_camera_card_action: action,
    ...(options?.cardID && { card_id: options.cardID }),
  };
}

export function createViewAction(
  action: AdvancedCameraCardUserSpecifiedView,
  options?: {
    cardID?: string;
  },
): ViewActionConfig {
  return {
    action: 'fire-dom-event',
    advanced_camera_card_action: action,
    ...(options?.cardID && { card_id: options.cardID }),
  };
}

export function createCameraAction(
  action: 'camera_select' | 'live_substream_select',
  camera: string,
  options?: {
    cardID?: string;
  },
): CameraSelectActionConfig | SubstreamSelectActionConfig {
  return {
    action: 'fire-dom-event',
    advanced_camera_card_action: action,
    camera: camera,
    ...(options?.cardID && { card_id: options.cardID }),
  };
}

export function createMediaPlayerAction(
  mediaPlayer: string,
  mediaPlayerAction: 'play' | 'stop',
  options?: {
    cardID?: string;
  },
): MediaPlayerActionConfig {
  return {
    action: 'fire-dom-event',
    advanced_camera_card_action: 'media_player',
    media_player: mediaPlayer,
    media_player_action: mediaPlayerAction,
    ...(options?.cardID && { card_id: options.cardID }),
  };
}

export function createDisplayModeAction(
  displayMode: 'single' | 'grid',
  options?: {
    cardID?: string;
  },
): DisplayModeActionConfig {
  return {
    action: 'fire-dom-event',
    advanced_camera_card_action: 'display_mode_select',
    display_mode: displayMode,
    ...(options?.cardID && { card_id: options.cardID }),
  };
}

export function createPTZControlsAction(
  enabled: boolean,
  options?: {
    cardID?: string;
  },
): PTZControlsActionConfig {
  return {
    action: 'fire-dom-event',
    advanced_camera_card_action: 'ptz_controls',
    enabled: enabled,
    ...(options?.cardID && { card_id: options.cardID }),
  };
}

export function createPTZAction(options?: {
  cardID?: string;
  ptzAction?: PTZAction;
  ptzPhase?: PTZActionPhase;
  ptzPreset?: string;
  cameraID?: string;
}): PTZActionConfig {
  return {
    action: 'fire-dom-event',
    advanced_camera_card_action: 'ptz',
    ...(options?.cardID && { card_id: options.cardID }),
    ...(options?.ptzAction && { ptz_action: options.ptzAction }),
    ...(options?.ptzPhase && { ptz_phase: options.ptzPhase }),
    ...(options?.ptzPreset && { ptz_preset: options.ptzPreset }),
    ...(options?.cameraID && { camera: options.cameraID }),
  };
}

export function createPTZDigitalAction(options?: {
  cardID?: string;
  ptzPhase?: PTZActionPhase;
  ptzAction?: PTZAction;
  absolute?: ZoomSettingsBase;
  targetID?: string;
}): PTZDigitialActionConfig {
  return {
    action: 'fire-dom-event',
    advanced_camera_card_action: 'ptz_digital',
    ...(options?.cardID && { card_id: options.cardID }),
    ...(options?.ptzAction && { ptz_action: options.ptzAction }),
    ...(options?.ptzPhase && { ptz_phase: options.ptzPhase }),
    ...(options?.absolute && { absolute: options.absolute }),
    ...(options?.targetID && { target_id: options.targetID }),
  };
}

export function createPTZMultiAction(options?: {
  cardID?: string;
  ptzAction?: PTZAction;
  ptzPhase?: PTZActionPhase;
  ptzPreset?: string;
  targetID?: string;
}): PTZMultiActionConfig {
  return {
    action: 'fire-dom-event',
    advanced_camera_card_action: 'ptz_multi',
    ...(options?.cardID && { card_id: options.cardID }),
    ...(options?.ptzAction && { ptz_action: options.ptzAction }),
    ...(options?.ptzPhase && { ptz_phase: options.ptzPhase }),
    ...(options?.ptzPreset && { ptz_preset: options.ptzPreset }),
    ...(options?.targetID && { target_id: options.targetID }),
  };
}

export function createLogAction(
  message: string,
  options?: {
    cardID?: string;
    level?: LogActionLevel;
  },
): LogActionConfig {
  return {
    action: 'fire-dom-event',
    advanced_camera_card_action: 'log',
    message: message,
    level: options?.level ?? 'info',
    ...(options?.cardID && { card_id: options.cardID }),
  };
}

export function createInternalCallbackAction(
  callback: (api: CardActionsAPI) => Promise<void>,
  options?: {
    cardID?: string;
  },
): InternalCallbackActionConfig {
  return {
    action: 'fire-dom-event',
    advanced_camera_card_action: INTERNAL_CALLBACK_ACTION,
    callback: callback,
    ...(options?.cardID && { card_id: options.cardID }),
  };
}

export function createPerformAction(
  perform_action: string,
  options?: {
    cardID?: string;
    data?: ServiceCallRequest['serviceData'];
    target?: ServiceCallRequest['target'];
  },
): PerformActionActionConfig {
  return {
    action: 'perform-action' as const,
    perform_action: perform_action,
    ...(options?.target && { target: options.target }),
    ...(options?.data && { data: options.data }),
    ...(options?.cardID && { card_id: options.cardID }),
  };
}

/**
 * Get an action configuration given a config and an interaction (e.g. 'tap').
 * @param interaction The interaction: `tap`, `hold` or `double_tap`
 * @param config The configuration containing multiple actions.
 * @returns The relevant action configuration or null if none found.
 */
export function getActionConfigGivenAction(
  interaction?: string,
  config?: ActionsConfig | null,
): ActionConfig | ActionConfig[] | null {
  if (!interaction || !config) {
    return null;
  }
  if (interaction === 'tap' && config.tap_action) {
    return config.tap_action;
  } else if (interaction === 'tap' && config.entity) {
    // As a special case, if there is an entity specified, but no action, a
    // more-info action is assumed (e.g. a menu-state-icon).
    return {
      action: 'more-info',
    };
  } else if (interaction === 'hold' && config.hold_action) {
    return config.hold_action;
  } else if (interaction === 'double_tap' && config.double_tap_action) {
    return config.double_tap_action;
  } else if (interaction === 'end_tap' && config.end_tap_action) {
    return config.end_tap_action;
  } else if (interaction === 'start_tap' && config.start_tap_action) {
    return config.start_tap_action;
  }
  return null;
}

/**
 * Determine if an action config has a real action. A modified version of
 * custom-card-helpers hasAction to also work with arrays of action configs.
 * @param config The action config in question.
 * @returns `true` if there's a real action defined, `false` otherwise.
 */
export const hasAction = (config?: ActionConfig | ActionConfig[]): boolean => {
  return arrayify(config).some((item) => item.action !== 'none');
};

export const isAdvancedCameraCardCustomAction = (
  action: ActionConfig,
): action is AdvancedCameraCardCustomActionConfig => {
  return (
    action.action === 'fire-dom-event' &&
    'advanced_camera_card_action' in action &&
    typeof action.advanced_camera_card_action === 'string'
  );
};

/**
 * Stop an event from activating card wide actions.
 */
export const stopEventFromActivatingCardWideActions = (ev: Event): void => {
  ev.stopPropagation();
};
