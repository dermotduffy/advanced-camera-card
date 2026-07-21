// A single namespace shadowing the main config: anything the upgrade cannot
// faithfully convert is recorded here as a failure, intact, at the same path it
// came from (e.g. top-level `automations` -> `__UPGRADE_FAILURE__.automations`)
// for the user to migrate by hand.
export const CONF_UPGRADE_FAILURE = '__UPGRADE_FAILURE__' as const;

// ===========================================================================
// Configuration path constants
// ===========================================================================

export const CONF_AUTOMATIONS = 'automations' as const;

export const CONF_CAMERAS = 'cameras' as const;

const CONF_CAMERAS_GLOBAL = 'cameras_global' as const;
export const CONF_CAMERAS_GLOBAL_LIVE_PROVIDER =
  `${CONF_CAMERAS_GLOBAL}.live_provider` as const;
export const CONF_CAMERAS_GLOBAL_TRIGGERS_DOORBELL =
  `${CONF_CAMERAS_GLOBAL}.triggers.doorbell` as const;
export const CONF_CAMERAS_GLOBAL_IMAGE_REFRESH_SECONDS =
  `${CONF_CAMERAS_GLOBAL}.image.refresh_seconds` as const;
export const CONF_CAMERAS_GLOBAL_DIMENSIONS_LAYOUT =
  `${CONF_CAMERAS_GLOBAL}.dimensions.layout` as const;
export const CONF_CAMERAS_GLOBAL_PTZ = `${CONF_CAMERAS_GLOBAL}.ptz` as const;

export const CONF_ELEMENTS = 'elements' as const;

export const CONF_FOLDERS = 'folders' as const;

const CONF_VIEW = 'view' as const;
export const CONF_VIEW_DIM = `${CONF_VIEW}.dim` as const;
export const CONF_VIEW_INTERACTION_SECONDS = `${CONF_VIEW}.interaction_seconds` as const;
export const CONF_VIEW_DEFAULT_CYCLE_CAMERA =
  `${CONF_VIEW}.default_cycle_camera` as const;
const CONF_VIEW_DEFAULT_RESET = `${CONF_VIEW}.default_reset` as const;
export const CONF_VIEW_DEFAULT_RESET_INTERACTION_MODE =
  `${CONF_VIEW_DEFAULT_RESET}.interaction_mode` as const;
export const CONF_VIEW_DEFAULT_RESET_EVERY_SECONDS =
  `${CONF_VIEW_DEFAULT_RESET}.every_seconds` as const;
export const CONF_VIEW_DEFAULT_RESET_ENTITIES =
  `${CONF_VIEW_DEFAULT_RESET}.entities` as const;
export const CONF_VIEW_KEYBOARD_SHORTCUTS = `${CONF_VIEW}.keyboard_shortcuts` as const;
export const CONF_VIEW_TRIGGERS = `${CONF_VIEW}.triggers` as const;
export const CONF_VIEW_TRIGGERS_SHOW_TRIGGER_STATUS =
  `${CONF_VIEW_TRIGGERS}.show_trigger_status` as const;
export const CONF_VIEW_TRIGGERS_FILTER_SELECTED_CAMERA =
  `${CONF_VIEW_TRIGGERS}.filter_selected_camera` as const;
export const CONF_VIEW_TRIGGERS_UNTRIGGER_DELAY_SECONDS =
  `${CONF_VIEW_TRIGGERS}.untrigger_delay_seconds` as const;
const CONF_VIEW_TRIGGERS_ACTIONS = `${CONF_VIEW_TRIGGERS}.actions` as const;
export const CONF_VIEW_TRIGGERS_ACTIONS_INTERACTION_MODE =
  `${CONF_VIEW_TRIGGERS_ACTIONS}.interaction_mode` as const;
export const CONF_VIEW_TRIGGERS_ACTIONS_TRIGGER =
  `${CONF_VIEW_TRIGGERS_ACTIONS}.trigger` as const;
export const CONF_VIEW_TRIGGERS_ACTIONS_UNTRIGGER =
  `${CONF_VIEW_TRIGGERS_ACTIONS}.untrigger` as const;

const CONF_MEDIA_GALLERY = 'media_gallery' as const;
export const CONF_MEDIA_GALLERY_CONTROLS_THUMBNAILS_SHOW_DETAILS =
  `${CONF_MEDIA_GALLERY}.controls.thumbnails.show_details` as const;
export const CONF_MEDIA_GALLERY_CONTROLS_THUMBNAILS_SHOW_FAVORITE_CONTROL =
  `${CONF_MEDIA_GALLERY}.controls.thumbnails.show_favorite_control` as const;

const CONF_MEDIA_VIEWER = 'media_viewer' as const;
export const CONF_MEDIA_VIEWER_AUTO_PLAY = `${CONF_MEDIA_VIEWER}.auto_play` as const;
export const CONF_MEDIA_VIEWER_AUTO_PAUSE = `${CONF_MEDIA_VIEWER}.auto_pause` as const;
export const CONF_MEDIA_VIEWER_AUTO_MUTE = `${CONF_MEDIA_VIEWER}.auto_mute` as const;
export const CONF_MEDIA_VIEWER_DRAGGABLE = `${CONF_MEDIA_VIEWER}.draggable` as const;
export const CONF_MEDIA_VIEWER_SNAPSHOT_CLICK_PLAYS_CLIP =
  `${CONF_MEDIA_VIEWER}.snapshot_click_plays_clip` as const;
export const CONF_MEDIA_VIEWER_TRANSITION_EFFECT =
  `${CONF_MEDIA_VIEWER}.transition_effect` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_BUILTIN =
  `${CONF_MEDIA_VIEWER}.controls.builtin` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_NEXT_PREVIOUS_STYLE =
  `${CONF_MEDIA_VIEWER}.controls.next_previous.style` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_MODE =
  `${CONF_MEDIA_VIEWER}.controls.thumbnails.mode` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_SHOW_DETAILS =
  `${CONF_MEDIA_VIEWER}.controls.thumbnails.show_details` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_SHOW_FAVORITE_CONTROL =
  `${CONF_MEDIA_VIEWER}.controls.thumbnails.show_favorite_control` as const;

export const CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_MODE =
  `${CONF_MEDIA_VIEWER}.controls.timeline.mode` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_PAN_MODE =
  `${CONF_MEDIA_VIEWER}.controls.timeline.pan_mode` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_SHOW_RECORDINGS =
  `${CONF_MEDIA_VIEWER}.controls.timeline.show_recordings` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_STYLE =
  `${CONF_MEDIA_VIEWER}.controls.timeline.style` as const;

const CONF_LIVE = 'live' as const;
export const CONF_LIVE_AUTO_MUTE = `${CONF_LIVE}.auto_mute` as const;
export const CONF_LIVE_AUTO_UNMUTE = `${CONF_LIVE}.auto_unmute` as const;
export const CONF_LIVE_CONTROLS_BUILTIN = `${CONF_LIVE}.controls.builtin` as const;

export const CONF_LIVE_CONTROLS_THUMBNAILS_MODE =
  `${CONF_LIVE}.controls.thumbnails.mode` as const;
export const CONF_LIVE_CONTROLS_THUMBNAILS_SHOW_DETAILS =
  `${CONF_LIVE}.controls.thumbnails.show_details` as const;
export const CONF_LIVE_CONTROLS_THUMBNAILS_SHOW_FAVORITE_CONTROL =
  `${CONF_LIVE}.controls.thumbnails.show_favorite_control` as const;
export const CONF_LIVE_CONTROLS_TIMELINE_MODE =
  `${CONF_LIVE}.controls.timeline.mode` as const;
export const CONF_LIVE_CONTROLS_TIMELINE_PAN_MODE =
  `${CONF_LIVE}.controls.timeline.pan_mode` as const;
export const CONF_LIVE_CONTROLS_TIMELINE_SHOW_RECORDINGS =
  `${CONF_LIVE}.controls.timeline.show_recordings` as const;
export const CONF_LIVE_CONTROLS_TIMELINE_STYLE =
  `${CONF_LIVE}.controls.timeline.style` as const;
export const CONF_LIVE_DRAGGABLE = `${CONF_LIVE}.draggable` as const;
export const CONF_LIVE_LAZY_UNLOAD = `${CONF_LIVE}.lazy_unload` as const;
export const CONF_LIVE_TRANSITION_EFFECT = `${CONF_LIVE}.transition_effect` as const;
export const CONF_LIVE_SHOW_IMAGE_DURING_LOAD =
  `${CONF_LIVE}.show_image_during_load` as const;

const CONF_TIMELINE = 'timeline' as const;
export const CONF_TIMELINE_SHOW_RECORDINGS = `${CONF_TIMELINE}.show_recordings` as const;
export const CONF_TIMELINE_CONTROLS_THUMBNAILS_MODE =
  `${CONF_TIMELINE}.controls.thumbnails.mode` as const;
export const CONF_TIMELINE_CONTROLS_THUMBNAILS_SHOW_DETAILS =
  `${CONF_TIMELINE}.controls.thumbnails.show_details` as const;
export const CONF_TIMELINE_CONTROLS_THUMBNAILS_SHOW_FAVORITE_CONTROL =
  `${CONF_TIMELINE}.controls.thumbnails.show_favorite_control` as const;

const CONF_MENU = 'menu' as const;
export const CONF_MENU_STYLE = `${CONF_MENU}.style` as const;
const CONF_MENU_BUTTONS = `${CONF_MENU}.buttons` as const;

export const CONF_MENU_BUTTONS_FULLSCREEN = `${CONF_MENU_BUTTONS}.fullscreen` as const;
export const CONF_MENU_BUTTONS_IRIS = `${CONF_MENU_BUTTONS}.iris` as const;
export const CONF_MENU_BUTTONS_PLAY = `${CONF_MENU_BUTTONS}.play` as const;
export const CONF_MENU_BUTTONS_MUTE = `${CONF_MENU_BUTTONS}.mute` as const;
export const CONF_MENU_BUTTONS_MEDIA_PLAYER =
  `${CONF_MENU_BUTTONS}.media_player` as const;
export const CONF_MENU_BUTTONS_TIMELINE = `${CONF_MENU_BUTTONS}.timeline` as const;

export const CONF_STATUS_BAR = 'status_bar' as const;
export const CONF_STATUS_BAR_STYLE = `${CONF_STATUS_BAR}.style` as const;

const CONF_DIMENSIONS = 'dimensions' as const;
export const CONF_DIMENSIONS_ASPECT_RATIO = `${CONF_DIMENSIONS}.aspect_ratio` as const;
export const CONF_DIMENSIONS_ASPECT_RATIO_MODE =
  `${CONF_DIMENSIONS}.aspect_ratio_mode` as const;
export const CONF_DIMENSIONS_HEIGHT = `${CONF_DIMENSIONS}.height` as const;

export const CONF_OVERRIDES = 'overrides' as const;

const CONF_PERFORMANCE = 'performance' as const;
export const CONF_PERFORMANCE_FEATURES_ANIMATED_PROGRESS_INDICATOR = `${CONF_PERFORMANCE}.features.animated_progress_indicator`;
export const CONF_PERFORMANCE_FEATURES_CARD_LOADING_EFFECTS = `${CONF_PERFORMANCE}.features.card_loading_effects`;
export const CONF_PERFORMANCE_FEATURES_CARD_LOADING_INDICATOR = `${CONF_PERFORMANCE}.features.card_loading_indicator`;
export const CONF_PERFORMANCE_FEATURES_MEDIA_CHUNK_SIZE = `${CONF_PERFORMANCE}.features.media_chunk_size`;
export const CONF_PERFORMANCE_FEATURES_MAX_SIMULTANEOUS_ENGINE_REQUESTS = `${CONF_PERFORMANCE}.features.max_simultaneous_engine_requests`;
export const CONF_PERFORMANCE_STYLE_BOX_SHADOW = `${CONF_PERFORMANCE}.style.box_shadow`;
export const CONF_PERFORMANCE_STYLE_BORDER_RADIUS = `${CONF_PERFORMANCE}.style.border_radius`;

export const CONF_PROFILES = 'profiles' as const;
