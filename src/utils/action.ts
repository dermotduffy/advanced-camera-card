import { CardActionsAPI } from '../card-controller/types.js';
import { ZoomSettingsBase } from '../components-lib/zoom/types.js';
import { CallAnswerActionConfig } from '../config/schema/actions/custom/call-answer.js';
import { CallEndActionConfig } from '../config/schema/actions/custom/call-end.js';
import { CallStartActionConfig } from '../config/schema/actions/custom/call-start.js';
import { CameraSelectActionConfig } from '../config/schema/actions/custom/camera-select.js';
import { DisplayModeActionConfig } from '../config/schema/actions/custom/display-mode.js';
import {
  EffectAction,
  EffectActionConfig,
} from '../config/schema/actions/custom/effect.js';
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
import { SetReviewActionConfig } from '../config/schema/actions/custom/set-review.js';
import { SubstreamOffActionConfig } from '../config/schema/actions/custom/substream-off.js';
import { SubstreamOnActionConfig } from '../config/schema/actions/custom/substream-on.js';
import { ViewActionConfig } from '../config/schema/actions/custom/view.js';
import { IfActionConfig } from '../config/schema/actions/stock/if.js';
import { PerformActionActionConfig } from '../config/schema/actions/stock/perform-action.js';
import type { Notification } from '../config/schema/actions/types.js';
import {
  ActionConfig,
  Actions,
  AdvancedCameraCardCustomActionConfig,
  NotificationActionConfig,
} from '../config/schema/actions/types.js';
import { AdvancedCameraCardUserSpecifiedView } from '../config/schema/common/const.js';
import { PTZControlType } from '../config/schema/common/controls/ptz.js';
import { ServiceCallRequest } from '../ha/types.js';
import type { EffectName } from '../types.js';
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
    folderID?: string;
  },
): ViewActionConfig {
  return {
    action: 'fire-dom-event',
    advanced_camera_card_action: action,
    ...(options?.cardID && { card_id: options.cardID }),
    ...(options?.folderID && { folder: options.folderID }),
  };
}

export function createCameraAction(
  camera: string,
  options?: {
    cardID?: string;
  },
): CameraSelectActionConfig {
  return {
    action: 'fire-dom-event',
    advanced_camera_card_action: 'camera_select',
    camera: camera,
    ...(options?.cardID && { card_id: options.cardID }),
  };
}

export function createSubstreamOnAction(options?: {
  stream?: string;
  camera?: string;
  cardID?: string;
}): SubstreamOnActionConfig {
  return {
    action: 'fire-dom-event',
    advanced_camera_card_action: 'substream_on',
    ...(options?.stream && { stream: options.stream }),
    ...(options?.camera && { camera: options.camera }),
    ...(options?.cardID && { card_id: options.cardID }),
  };
}

export function createSubstreamOffAction(options?: {
  camera?: string;
  cardID?: string;
}): SubstreamOffActionConfig {
  return {
    action: 'fire-dom-event',
    advanced_camera_card_action: 'substream_off',
    ...(options?.camera && { camera: options.camera }),
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

export function createPTZControlsAction(options?: {
  cardID?: string;
  enabled?: boolean;
  type?: PTZControlType;
}): PTZControlsActionConfig {
  return {
    action: 'fire-dom-event',
    advanced_camera_card_action: 'ptz_controls',
    ...(options?.enabled !== undefined && { enabled: options.enabled }),
    ...(options?.type && { type: options.type }),
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

export function createSelectOptionAction(
  domain: 'select' | 'input_select',
  entityID: string,
  option: string,
  options?: {
    cardID?: string;
  },
): PerformActionActionConfig {
  return createPerformAction(`${domain}.select_option`, {
    ...options,
    target: {
      entity_id: entityID,
    },
    data: {
      option: option,
    },
  });
}

export function createEffectAction(
  effectName: EffectName,
  effectAction: EffectAction,
  options?: {
    cardID?: string;
  },
): EffectActionConfig {
  return {
    action: 'fire-dom-event',
    advanced_camera_card_action: 'effect',
    effect: effectName,
    effect_action: effectAction,
    ...(options?.cardID && { card_id: options.cardID }),
  };
}

export function createSetReviewAction(reviewed?: boolean): SetReviewActionConfig {
  return {
    action: 'fire-dom-event',
    advanced_camera_card_action: 'set_review',
    reviewed,
  };
}

export function createCallStartAction(options?: {
  camera?: string;
  stream?: string;
  cardID?: string;
}): CallStartActionConfig {
  return {
    action: 'fire-dom-event',
    advanced_camera_card_action: 'call_start',
    ...(options?.camera && { camera: options.camera }),
    ...(options?.stream && { stream: options.stream }),
    ...(options?.cardID && { card_id: options.cardID }),
  };
}

export function createCallAnswerAction(options?: {
  cardID?: string;
}): CallAnswerActionConfig {
  return {
    action: 'fire-dom-event',
    advanced_camera_card_action: 'call_answer',
    ...(options?.cardID && { card_id: options.cardID }),
  };
}

export function createCallEndAction(options?: { cardID?: string }): CallEndActionConfig {
  return {
    action: 'fire-dom-event',
    advanced_camera_card_action: 'call_end',
    ...(options?.cardID && { card_id: options.cardID }),
  };
}

export function createNotificationAction(
  notification: Notification,
  options?: {
    cardID?: string;
  },
): NotificationActionConfig {
  return {
    action: 'fire-dom-event',
    advanced_camera_card_action: 'notification',
    notification,
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
  config?: Actions | null,
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
  return arrayify(config).some((item) => isIfAction(item) || item.action !== 'none');
};

export const isIfAction = (action: ActionConfig): action is IfActionConfig => {
  // The `if`/`then`/`else` action is structural: it has no `action:`
  // discriminator and is identified by the presence of an `if` key.
  return !('action' in action) && 'if' in action;
};

export const isStandardAction = (
  action: ActionConfig,
): action is Exclude<ActionConfig, IfActionConfig> => {
  // Every action except the structural `if`/`then`/`else` action carries an
  // `action:` discriminator.
  return 'action' in action;
};

export const isAdvancedCameraCardCustomAction = (
  action: ActionConfig,
): action is AdvancedCameraCardCustomActionConfig => {
  return (
    isStandardAction(action) &&
    action.action === 'fire-dom-event' &&
    'advanced_camera_card_action' in action &&
    typeof action.advanced_camera_card_action === 'string'
  );
};

/**
 * Get a short human-readable name identifying an action (e.g. for confirmation
 * prompts).
 * @param action The action config.
 * @returns The action's identifying name.
 */
export const getActionName = (action: ActionConfig): string => {
  if (isIfAction(action)) {
    return 'if';
  }
  if (isAdvancedCameraCardCustomAction(action)) {
    return action.advanced_camera_card_action;
  }
  return action.action;
};

/**
 * Stop an event from activating card wide actions.
 */
export const stopEventFromActivatingCardWideActions = (ev: Event): void => {
  ev.stopPropagation();
};
