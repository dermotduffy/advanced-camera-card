import {
  CONF_CAMERAS_GLOBAL_TRIGGERS_DOORBELL,
  CONF_VIEW_TRIGGERS_ACTIONS_INTERACTION_MODE,
  CONF_VIEW_TRIGGERS_ACTIONS_TRIGGER,
  CONF_VIEW_TRIGGERS_ACTIONS_UNTRIGGER,
  CONF_VIEW_TRIGGERS_SHOW_TRIGGER_STATUS,
} from '../../const.js';

export const DOORBELL_PROFILE = {
  // Auto-discover HA `event.*` entities with `device_class: doorbell` on each
  // camera's device (Ring, UniFi Protect, Nest, DoorBird, Reolink, ...).
  [CONF_CAMERAS_GLOBAL_TRIGGERS_DOORBELL]: true,

  // Pulse the camera border while the doorbell is ringing.
  [CONF_VIEW_TRIGGERS_SHOW_TRIGGER_STATUS]: true,

  // Triggers cause calls to start and end.
  [CONF_VIEW_TRIGGERS_ACTIONS_TRIGGER]: 'call' as const,
  [CONF_VIEW_TRIGGERS_ACTIONS_UNTRIGGER]: 'call' as const,

  // Ring even while the user is actively touching the dashboard.
  [CONF_VIEW_TRIGGERS_ACTIONS_INTERACTION_MODE]: 'all' as const,
};
