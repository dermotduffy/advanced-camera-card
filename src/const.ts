export const REPO_URL = 'https://github.com/dermotduffy/advanced-camera-card' as const;
const DOCS_URL = 'https://card.camera' as const;
export const TROUBLESHOOTING_URL = `${DOCS_URL}/#/troubleshooting` as const;
export const STREAM_TROUBLESHOOTING_URL =
  `${TROUBLESHOOTING_URL}?id=stream-does-not-load` as const;

export const CONF_AUTOMATIONS = 'automations' as const;

export const CONF_CAMERAS = 'cameras' as const;

export const CONF_CAMERAS_ARRAY_ALWAYS_ERROR_IF_ENTITY_UNAVAILABLE =
  `${CONF_CAMERAS}.#.always_error_if_entity_unavailable` as const;
export const CONF_CAMERAS_ARRAY_CAMERA_ENTITY =
  `${CONF_CAMERAS}.#.camera_entity` as const;
export const CONF_CAMERAS_ARRAY_FRIGATE_CAMERA_NAME =
  `${CONF_CAMERAS}.#.frigate.camera_name` as const;
export const CONF_CAMERAS_ARRAY_CAPABILITIES_DISABLE =
  `${CONF_CAMERAS}.#.capabilities.disable` as const;
export const CONF_CAMERAS_ARRAY_CAPABILITIES_DISABLE_EXCEPT =
  `${CONF_CAMERAS}.#.capabilities.disable_except` as const;
export const CONF_CAMERAS_ARRAY_CAST_METHOD = `${CONF_CAMERAS}.#.cast.method` as const;
export const CONF_CAMERAS_ARRAY_CAST_DASHBOARD_DASHBOARD_PATH =
  `${CONF_CAMERAS}.#.cast.dashboard.dashboard_path` as const;
export const CONF_CAMERAS_ARRAY_CAST_DASHBOARD_VIEW_PATH =
  `${CONF_CAMERAS}.#.cast.dashboard.view_path` as const;
export const CONF_CAMERAS_ARRAY_DIMENSIONS_ASPECT_RATIO =
  `${CONF_CAMERAS}.#.dimensions.aspect_ratio` as const;
export const CONF_CAMERAS_ARRAY_FRIGATE_CLIENT_ID =
  `${CONF_CAMERAS}.#.frigate.client_id` as const;
export const CONF_CAMERAS_ARRAY_FRIGATE_LABELS =
  `${CONF_CAMERAS}.#.frigate.labels` as const;
export const CONF_CAMERAS_ARRAY_FRIGATE_URL = `${CONF_CAMERAS}.#.frigate.url` as const;
export const CONF_CAMERAS_ARRAY_FRIGATE_ZONES =
  `${CONF_CAMERAS}.#.frigate.zones` as const;
export const CONF_CAMERAS_ARRAY_GO2RTC_MODES = `${CONF_CAMERAS}.#.go2rtc.modes` as const;
export const CONF_CAMERAS_ARRAY_GO2RTC_STREAM =
  `${CONF_CAMERAS}.#.go2rtc.stream` as const;
export const CONF_CAMERAS_ARRAY_GO2RTC_URL = `${CONF_CAMERAS}.#.go2rtc.url` as const;
export const CONF_CAMERAS_ARRAY_ICON = `${CONF_CAMERAS}.#.icon` as const;
export const CONF_CAMERAS_ARRAY_ID = `${CONF_CAMERAS}.#.id` as const;
export const CONF_CAMERAS_ARRAY_IMAGE_ENTITY = `${CONF_CAMERAS}.#.image.entity` as const;
export const CONF_CAMERAS_ARRAY_IMAGE_ENTITY_PARAMETERS =
  `${CONF_CAMERAS}.#.image.entity_parameters` as const;
export const CONF_CAMERAS_ARRAY_IMAGE_MODE = `${CONF_CAMERAS}.#.image.mode` as const;
export const CONF_CAMERAS_ARRAY_IMAGE_REFRESH_SECONDS =
  `${CONF_CAMERAS}.#.image.refresh_seconds` as const;
export const CONF_CAMERAS_ARRAY_IMAGE_URL = `${CONF_CAMERAS}.#.image.url` as const;
export const CONF_CAMERAS_ARRAY_MOTIONEYE_IMAGES_DIRECTORY_PATTERN =
  `${CONF_CAMERAS}.#.motioneye.images.directory_pattern` as const;
export const CONF_CAMERAS_ARRAY_MOTIONEYE_IMAGES_FILE_PATTERN =
  `${CONF_CAMERAS}.#.motioneye.images.file_pattern` as const;
export const CONF_CAMERAS_ARRAY_MOTIONEYE_MOVIES_DIRECTORY_PATTERN =
  `${CONF_CAMERAS}.#.motioneye.movies.directory_pattern` as const;
export const CONF_CAMERAS_ARRAY_MOTIONEYE_MOVIES_FILE_PATTERN =
  `${CONF_CAMERAS}.#.motioneye.movies.file_pattern` as const;
export const CONF_CAMERAS_ARRAY_MOTIONEYE_URL =
  `${CONF_CAMERAS}.#.motioneye.url` as const;
export const CONF_CAMERAS_ARRAY_TITLE = `${CONF_CAMERAS}.#.title` as const;
export const CONF_CAMERAS_ARRAY_WEBRTC_CARD_ENTITY =
  `${CONF_CAMERAS}.#.webrtc_card.entity` as const;
export const CONF_CAMERAS_ARRAY_WEBRTC_CARD_URL =
  `${CONF_CAMERAS}.#.webrtc_card.url` as const;
export const CONF_CAMERAS_ARRAY_LIVE_PROVIDER =
  `${CONF_CAMERAS}.#.live_provider` as const;
export const CONF_CAMERAS_ARRAY_DEPENDENCIES_CAMERAS =
  `${CONF_CAMERAS}.#.dependencies.cameras` as const;
export const CONF_CAMERAS_ARRAY_DEPENDENCIES_ALL_CAMERAS =
  `${CONF_CAMERAS}.#.dependencies.all_cameras` as const;
export const CONF_CAMERAS_ARRAY_DIMENSIONS_LAYOUT_FIT =
  `${CONF_CAMERAS}.#.dimensions.layout.fit` as const;
export const CONF_CAMERAS_ARRAY_DIMENSIONS_LAYOUT_PAN_X =
  `${CONF_CAMERAS}.#.dimensions.layout.pan.x` as const;
export const CONF_CAMERAS_ARRAY_DIMENSIONS_LAYOUT_PAN_Y =
  `${CONF_CAMERAS}.#.dimensions.layout.pan.y` as const;
export const CONF_CAMERAS_ARRAY_DIMENSIONS_LAYOUT_POSITION_X =
  `${CONF_CAMERAS}.#.dimensions.layout.position.x` as const;
export const CONF_CAMERAS_ARRAY_DIMENSIONS_LAYOUT_POSITION_Y =
  `${CONF_CAMERAS}.#.dimensions.layout.position.y` as const;
export const CONF_CAMERAS_ARRAY_DIMENSIONS_LAYOUT_VIEW_BOX_TOP =
  `${CONF_CAMERAS}.#.dimensions.layout.view_box.top` as const;
export const CONF_CAMERAS_ARRAY_DIMENSIONS_LAYOUT_VIEW_BOX_BOTTOM =
  `${CONF_CAMERAS}.#.dimensions.layout.view_box.bottom` as const;
export const CONF_CAMERAS_ARRAY_DIMENSIONS_LAYOUT_VIEW_BOX_LEFT =
  `${CONF_CAMERAS}.#.dimensions.layout.view_box.left` as const;
export const CONF_CAMERAS_ARRAY_DIMENSIONS_LAYOUT_VIEW_BOX_RIGHT =
  `${CONF_CAMERAS}.#.dimensions.layout.view_box.right` as const;
export const CONF_CAMERAS_ARRAY_DIMENSIONS_LAYOUT_ZOOM_FACTOR =
  `${CONF_CAMERAS}.#.dimensions.layout.zoom` as const;
export const CONF_CAMERAS_ARRAY_PROXY_DYNAMIC =
  `${CONF_CAMERAS}.#.proxy.dynamic` as const;
export const CONF_CAMERAS_ARRAY_PROXY_MEDIA = `${CONF_CAMERAS}.#.proxy.media` as const;
export const CONF_CAMERAS_ARRAY_PROXY_SSL_CIPHERS =
  `${CONF_CAMERAS}.#.proxy.ssl_ciphers` as const;
export const CONF_CAMERAS_ARRAY_PROXY_SSL_VERIFICATION =
  `${CONF_CAMERAS}.#.proxy.ssl_verification` as const;
export const CONF_CAMERAS_ARRAY_REOLINK_MEDIA_RESOLUTION =
  `${CONF_CAMERAS}.#.reolink.media_resolution` as const;
export const CONF_CAMERAS_ARRAY_REOLINK_URL = `${CONF_CAMERAS}.#.reolink.url` as const;
export const CONF_CAMERAS_ARRAY_TRIGGERS_MOTION =
  `${CONF_CAMERAS}.#.triggers.motion` as const;
export const CONF_CAMERAS_ARRAY_TRIGGERS_OCCUPANCY =
  `${CONF_CAMERAS}.#.triggers.occupancy` as const;
export const CONF_CAMERAS_ARRAY_TRIGGERS_ENTITIES =
  `${CONF_CAMERAS}.#.triggers.entities` as const;
export const CONF_CAMERAS_ARRAY_TRIGGERS_EVENTS =
  `${CONF_CAMERAS}.#.triggers.events` as const;

const CONF_CAMERAS_GLOBAL = 'cameras_global' as const;
export const CONF_CAMERAS_GLOBAL_LIVE_PROVIDER =
  `${CONF_CAMERAS_GLOBAL}.live_provider` as const;
export const CONF_CAMERAS_GLOBAL_TRIGGERS_OCCUPANCY =
  `${CONF_CAMERAS_GLOBAL}.triggers.occupancy` as const;
export const CONF_CAMERAS_GLOBAL_IMAGE_REFRESH_SECONDS =
  `${CONF_CAMERAS_GLOBAL}.image.refresh_seconds` as const;
export const CONF_CAMERAS_GLOBAL_DIMENSIONS_LAYOUT =
  `${CONF_CAMERAS_GLOBAL}.dimensions.layout` as const;
export const CONF_CAMERAS_GLOBAL_PTZ = `${CONF_CAMERAS_GLOBAL}.ptz` as const;

export const CONF_ELEMENTS = 'elements' as const;

const CONF_FOLDER_GALLERY = 'folder_gallery' as const;
export const CONF_FOLDER_GALLERY_CONTROLS_THUMBNAILS_SHOW_DETAILS =
  `${CONF_FOLDER_GALLERY}.controls.thumbnails.show_details` as const;
export const CONF_FOLDER_GALLERY_CONTROLS_THUMBNAILS_SHOW_DOWNLOAD_CONTROL =
  `${CONF_FOLDER_GALLERY}.controls.thumbnails.show_download_control` as const;
export const CONF_FOLDER_GALLERY_CONTROLS_THUMBNAILS_SHOW_FAVORITE_CONTROL =
  `${CONF_FOLDER_GALLERY}.controls.thumbnails.show_favorite_control` as const;
export const CONF_FOLDER_GALLERY_CONTROLS_THUMBNAILS_SHOW_TIMELINE_CONTROL =
  `${CONF_FOLDER_GALLERY}.controls.thumbnails.show_timeline_control` as const;
export const CONF_FOLDER_GALLERY_CONTROLS_THUMBNAILS_SIZE =
  `${CONF_FOLDER_GALLERY}.controls.thumbnails.size` as const;

const CONF_VIEW = 'view' as const;
export const CONF_VIEW_CAMERA_SELECT = `${CONF_VIEW}.camera_select` as const;
export const CONF_VIEW_DEFAULT = `${CONF_VIEW}.default` as const;
export const CONF_VIEW_DIM = `${CONF_VIEW}.dim` as const;
export const CONF_VIEW_INTERACTION_SECONDS = `${CONF_VIEW}.interaction_seconds` as const;
export const CONF_VIEW_KEYBOARD_SHORTCUTS = `${CONF_VIEW}.keyboard_shortcuts` as const;
export const CONF_VIEW_KEYBOARD_SHORTCUTS_ENABLED =
  `${CONF_VIEW}.keyboard_shortcuts.enabled` as const;
export const CONF_VIEW_KEYBOARD_SHORTCUTS_PTZ_LEFT =
  `${CONF_VIEW_KEYBOARD_SHORTCUTS}.ptz_left` as const;
export const CONF_VIEW_KEYBOARD_SHORTCUTS_PTZ_RIGHT =
  `${CONF_VIEW_KEYBOARD_SHORTCUTS}.ptz_right` as const;
export const CONF_VIEW_KEYBOARD_SHORTCUTS_PTZ_UP =
  `${CONF_VIEW_KEYBOARD_SHORTCUTS}.ptz_up` as const;
export const CONF_VIEW_KEYBOARD_SHORTCUTS_PTZ_DOWN =
  `${CONF_VIEW_KEYBOARD_SHORTCUTS}.ptz_down` as const;
export const CONF_VIEW_KEYBOARD_SHORTCUTS_PTZ_ZOOM_IN =
  `${CONF_VIEW_KEYBOARD_SHORTCUTS}.ptz_zoom_in` as const;
export const CONF_VIEW_KEYBOARD_SHORTCUTS_PTZ_ZOOM_OUT =
  `${CONF_VIEW_KEYBOARD_SHORTCUTS}.ptz_zoom_out` as const;
export const CONF_VIEW_KEYBOARD_SHORTCUTS_PTZ_HOME =
  `${CONF_VIEW_KEYBOARD_SHORTCUTS}.ptz_home` as const;
export const CONF_VIEW_DEFAULT_CYCLE_CAMERA =
  `${CONF_VIEW}.default_cycle_camera` as const;
export const CONF_VIEW_DEFAULT_RESET = `${CONF_VIEW}.default_reset` as const;
export const CONF_VIEW_DEFAULT_RESET_INTERACTION_MODE =
  `${CONF_VIEW_DEFAULT_RESET}.interaction_mode` as const;
export const CONF_VIEW_DEFAULT_RESET_EVERY_SECONDS =
  `${CONF_VIEW_DEFAULT_RESET}.every_seconds` as const;
export const CONF_VIEW_DEFAULT_RESET_ENTITIES =
  `${CONF_VIEW_DEFAULT_RESET}.entities` as const;
export const CONF_VIEW_DEFAULT_RESET_AFTER_INTERACTION =
  `${CONF_VIEW_DEFAULT_RESET}.after_interaction` as const;
export const CONF_VIEW_THEME_THEMES = `${CONF_VIEW}.theme.themes` as const;
export const CONF_VIEW_TRIGGERS = `${CONF_VIEW}.triggers` as const;
export const CONF_VIEW_TRIGGERS_SHOW_TRIGGER_STATUS =
  `${CONF_VIEW_TRIGGERS}.show_trigger_status` as const;
export const CONF_VIEW_TRIGGERS_FILTER_SELECTED_CAMERA =
  `${CONF_VIEW_TRIGGERS}.filter_selected_camera` as const;
export const CONF_VIEW_TRIGGERS_UNTRIGGER_SECONDS =
  `${CONF_VIEW_TRIGGERS}.untrigger_seconds` as const;
export const CONF_VIEW_TRIGGERS_ACTIONS = `${CONF_VIEW_TRIGGERS}.actions` as const;
export const CONF_VIEW_TRIGGERS_ACTIONS_TRIGGER =
  `${CONF_VIEW_TRIGGERS_ACTIONS}.trigger` as const;
export const CONF_VIEW_TRIGGERS_ACTIONS_UNTRIGGER =
  `${CONF_VIEW_TRIGGERS_ACTIONS}.untrigger` as const;
export const CONF_VIEW_TRIGGERS_ACTIONS_INTERACTION_MODE =
  `${CONF_VIEW_TRIGGERS_ACTIONS}.interaction_mode` as const;

const CONF_MEDIA_GALLERY = 'media_gallery' as const;
export const CONF_MEDIA_GALLERY_CONTROLS_FILTER_MODE =
  `${CONF_MEDIA_GALLERY}.controls.filter.mode` as const;
export const CONF_MEDIA_GALLERY_CONTROLS_THUMBNAILS_SHOW_DETAILS =
  `${CONF_MEDIA_GALLERY}.controls.thumbnails.show_details` as const;
export const CONF_MEDIA_GALLERY_CONTROLS_THUMBNAILS_SHOW_DOWNLOAD_CONTROL =
  `${CONF_MEDIA_GALLERY}.controls.thumbnails.show_download_control` as const;
export const CONF_MEDIA_GALLERY_CONTROLS_THUMBNAILS_SHOW_FAVORITE_CONTROL =
  `${CONF_MEDIA_GALLERY}.controls.thumbnails.show_favorite_control` as const;
export const CONF_MEDIA_GALLERY_CONTROLS_THUMBNAILS_SHOW_TIMELINE_CONTROL =
  `${CONF_MEDIA_GALLERY}.controls.thumbnails.show_timeline_control` as const;
export const CONF_MEDIA_GALLERY_CONTROLS_THUMBNAILS_SIZE =
  `${CONF_MEDIA_GALLERY}.controls.thumbnails.size` as const;

const CONF_MEDIA_VIEWER = 'media_viewer' as const;
export const CONF_MEDIA_VIEWER_AUTO_PLAY = `${CONF_MEDIA_VIEWER}.auto_play` as const;
export const CONF_MEDIA_VIEWER_AUTO_PAUSE = `${CONF_MEDIA_VIEWER}.auto_pause` as const;
export const CONF_MEDIA_VIEWER_AUTO_MUTE = `${CONF_MEDIA_VIEWER}.auto_mute` as const;
export const CONF_MEDIA_VIEWER_AUTO_UNMUTE = `${CONF_MEDIA_VIEWER}.auto_unmute` as const;
export const CONF_MEDIA_VIEWER_DISPLAY_MODE =
  `${CONF_MEDIA_VIEWER}.display.mode` as const;
export const CONF_MEDIA_VIEWER_DISPLAY_GRID_COLUMNS =
  `${CONF_MEDIA_VIEWER}.display.grid_columns` as const;
export const CONF_MEDIA_VIEWER_DISPLAY_GRID_MAX_COLUMNS =
  `${CONF_MEDIA_VIEWER}.display.grid_max_columns` as const;
export const CONF_MEDIA_VIEWER_DISPLAY_GRID_SELECTED_POSITION =
  `${CONF_MEDIA_VIEWER}.display.grid_selected_position` as const;
export const CONF_MEDIA_VIEWER_DISPLAY_GRID_SELECTED_WIDTH_FACTOR =
  `${CONF_MEDIA_VIEWER}.display.grid_selected_width_factor` as const;
export const CONF_MEDIA_VIEWER_DRAGGABLE = `${CONF_MEDIA_VIEWER}.draggable` as const;
export const CONF_MEDIA_VIEWER_LAZY_LOAD = `${CONF_MEDIA_VIEWER}.lazy_load` as const;
export const CONF_MEDIA_VIEWER_SNAPSHOT_CLICK_PLAYS_CLIP =
  `${CONF_MEDIA_VIEWER}.snapshot_click_plays_clip` as const;
export const CONF_MEDIA_VIEWER_TRANSITION_EFFECT =
  `${CONF_MEDIA_VIEWER}.transition_effect` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_BUILTIN =
  `${CONF_MEDIA_VIEWER}.controls.builtin` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_NEXT_PREVIOUS_STYLE =
  `${CONF_MEDIA_VIEWER}.controls.next_previous.style` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_NEXT_PREVIOUS_SIZE =
  `${CONF_MEDIA_VIEWER}.controls.next_previous.size` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_MODE =
  `${CONF_MEDIA_VIEWER}.controls.thumbnails.mode` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_SHOW_DETAILS =
  `${CONF_MEDIA_VIEWER}.controls.thumbnails.show_details` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_SHOW_DOWNLOAD_CONTROL =
  `${CONF_MEDIA_VIEWER}.controls.thumbnails.show_download_control` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_SHOW_FAVORITE_CONTROL =
  `${CONF_MEDIA_VIEWER}.controls.thumbnails.show_favorite_control` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_SHOW_TIMELINE_CONTROL =
  `${CONF_MEDIA_VIEWER}.controls.thumbnails.show_timeline_control` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_SIZE =
  `${CONF_MEDIA_VIEWER}.controls.thumbnails.size` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_CLUSTERING_THRESHOLD =
  `${CONF_MEDIA_VIEWER}.controls.timeline.clustering_threshold` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_EVENTS_MEDIA_TYPE =
  `${CONF_MEDIA_VIEWER}.controls.timeline.events_media_type` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_FORMAT_24H =
  `${CONF_MEDIA_VIEWER}.controls.timeline.format.24h` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_MODE =
  `${CONF_MEDIA_VIEWER}.controls.timeline.mode` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_PAN_MODE =
  `${CONF_MEDIA_VIEWER}.controls.timeline.pan_mode` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_SHOW_RECORDINGS =
  `${CONF_MEDIA_VIEWER}.controls.timeline.show_recordings` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_STYLE =
  `${CONF_MEDIA_VIEWER}.controls.timeline.style` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_WINDOW_SECONDS =
  `${CONF_MEDIA_VIEWER}.controls.timeline.window_seconds` as const;
export const CONF_MEDIA_VIEWER_ZOOMABLE = `${CONF_MEDIA_VIEWER}.zoomable` as const;

const CONF_LIVE = 'live' as const;
export const CONF_LIVE_AUTO_PLAY = `${CONF_LIVE}.auto_play` as const;
export const CONF_LIVE_AUTO_PAUSE = `${CONF_LIVE}.auto_pause` as const;
export const CONF_LIVE_AUTO_MUTE = `${CONF_LIVE}.auto_mute` as const;
export const CONF_LIVE_AUTO_UNMUTE = `${CONF_LIVE}.auto_unmute` as const;
export const CONF_LIVE_CONTROLS_BUILTIN = `${CONF_LIVE}.controls.builtin` as const;
export const CONF_LIVE_CONTROLS_NEXT_PREVIOUS_STYLE =
  `${CONF_LIVE}.controls.next_previous.style` as const;
export const CONF_LIVE_CONTROLS_NEXT_PREVIOUS_SIZE =
  `${CONF_LIVE}.controls.next_previous.size` as const;
export const CONF_LIVE_CONTROLS_PTZ_HIDE_HOME =
  `${CONF_LIVE}.controls.ptz.hide_home` as const;
export const CONF_LIVE_CONTROLS_PTZ_HIDE_PAN_TILT =
  `${CONF_LIVE}.controls.ptz.hide_pan_tilt` as const;
export const CONF_LIVE_CONTROLS_PTZ_HIDE_ZOOM =
  `${CONF_LIVE}.controls.ptz.hide_zoom` as const;
export const CONF_LIVE_CONTROLS_PTZ_MODE = `${CONF_LIVE}.controls.ptz.mode` as const;
export const CONF_LIVE_CONTROLS_PTZ_ORIENTATION =
  `${CONF_LIVE}.controls.ptz.orientation` as const;
export const CONF_LIVE_CONTROLS_PTZ_POSITION =
  `${CONF_LIVE}.controls.ptz.position` as const;
export const CONF_LIVE_CONTROLS_THUMBNAILS_MEDIA_TYPE =
  `${CONF_LIVE}.controls.thumbnails.media_type` as const;
export const CONF_LIVE_CONTROLS_THUMBNAILS_EVENTS_MEDIA_TYPE =
  `${CONF_LIVE}.controls.thumbnails.events_media_type` as const;
export const CONF_LIVE_CONTROLS_THUMBNAILS_MODE =
  `${CONF_LIVE}.controls.thumbnails.mode` as const;
export const CONF_LIVE_CONTROLS_THUMBNAILS_SIZE =
  `${CONF_LIVE}.controls.thumbnails.size` as const;
export const CONF_LIVE_CONTROLS_THUMBNAILS_SHOW_DETAILS =
  `${CONF_LIVE}.controls.thumbnails.show_details` as const;
export const CONF_LIVE_CONTROLS_THUMBNAILS_SHOW_DOWNLOAD_CONTROL =
  `${CONF_LIVE}.controls.thumbnails.show_download_control` as const;
export const CONF_LIVE_CONTROLS_THUMBNAILS_SHOW_FAVORITE_CONTROL =
  `${CONF_LIVE}.controls.thumbnails.show_favorite_control` as const;
export const CONF_LIVE_CONTROLS_THUMBNAILS_SHOW_TIMELINE_CONTROL =
  `${CONF_LIVE}.controls.thumbnails.show_timeline_control` as const;
export const CONF_LIVE_CONTROLS_TIMELINE_CLUSTERING_THRESHOLD =
  `${CONF_LIVE}.controls.timeline.clustering_threshold` as const;
export const CONF_LIVE_CONTROLS_TIMELINE_EVENTS_MEDIA_TYPE =
  `${CONF_LIVE}.controls.timeline.events_media_type` as const;
export const CONF_LIVE_CONTROLS_TIMELINE_FORMAT_24H =
  `${CONF_LIVE}.controls.timeline.format.24h` as const;
export const CONF_LIVE_CONTROLS_TIMELINE_MODE =
  `${CONF_LIVE}.controls.timeline.mode` as const;
export const CONF_LIVE_CONTROLS_TIMELINE_PAN_MODE =
  `${CONF_LIVE}.controls.timeline.pan_mode` as const;
export const CONF_LIVE_CONTROLS_TIMELINE_SHOW_RECORDINGS =
  `${CONF_LIVE}.controls.timeline.show_recordings` as const;
export const CONF_LIVE_CONTROLS_TIMELINE_STYLE =
  `${CONF_LIVE}.controls.timeline.style` as const;
export const CONF_LIVE_CONTROLS_TIMELINE_WINDOW_SECONDS =
  `${CONF_LIVE}.controls.timeline.window_seconds` as const;
export const CONF_LIVE_DISPLAY_MODE = `${CONF_LIVE}.display.mode` as const;
export const CONF_LIVE_DISPLAY_GRID_COLUMNS =
  `${CONF_LIVE}.display.grid_columns` as const;
export const CONF_LIVE_DISPLAY_GRID_MAX_COLUMNS =
  `${CONF_LIVE}.display.grid_max_columns` as const;
export const CONF_LIVE_DISPLAY_GRID_SELECTED_POSITION =
  `${CONF_LIVE}.display.grid_selected_position` as const;
export const CONF_LIVE_DISPLAY_GRID_SELECTED_WIDTH_FACTOR =
  `${CONF_LIVE}.display.grid_selected_width_factor` as const;
export const CONF_LIVE_DRAGGABLE = `${CONF_LIVE}.draggable` as const;
export const CONF_LIVE_LAZY_LOAD = `${CONF_LIVE}.lazy_load` as const;
export const CONF_LIVE_LAZY_UNLOAD = `${CONF_LIVE}.lazy_unload` as const;
export const CONF_LIVE_PRELOAD = `${CONF_LIVE}.preload` as const;
export const CONF_LIVE_TRANSITION_EFFECT = `${CONF_LIVE}.transition_effect` as const;
export const CONF_LIVE_SHOW_IMAGE_DURING_LOAD =
  `${CONF_LIVE}.show_image_during_load` as const;
export const CONF_LIVE_MICROPHONE_DISCONNECT_SECONDS =
  `${CONF_LIVE}.microphone.disconnect_seconds` as const;
export const CONF_LIVE_MICROPHONE_MUTE_AFTER_MICROPHONE_MUTE_SECONDS =
  `${CONF_LIVE}.microphone.mute_after_microphone_mute_seconds` as const;
export const CONF_LIVE_MICROPHONE_ALWAYS_CONNECTED =
  `${CONF_LIVE}.microphone.always_connected` as const;
export const CONF_LIVE_ZOOMABLE = `${CONF_LIVE}.zoomable` as const;

const CONF_IMAGE = 'image' as const;
export const CONF_IMAGE_ENTITY = `${CONF_IMAGE}.entity` as const;
export const CONF_IMAGE_ENTITY_PARAMETERS = `${CONF_IMAGE}.entity_parameters` as const;
export const CONF_IMAGE_MODE = `${CONF_IMAGE}.mode` as const;
export const CONF_IMAGE_REFRESH_SECONDS = `${CONF_IMAGE}.refresh_seconds` as const;
export const CONF_IMAGE_URL = `${CONF_IMAGE}.url` as const;

const CONF_TIMELINE = 'timeline' as const;
export const CONF_TIMELINE_WINDOW_SECONDS = `${CONF_TIMELINE}.window_seconds` as const;
export const CONF_TIMELINE_CLUSTERING_THRESHOLD =
  `${CONF_TIMELINE}.clustering_threshold` as const;
export const CONF_TIMELINE_EVENTS_MEDIA_TYPE =
  `${CONF_TIMELINE}.events_media_type` as const;
export const CONF_TIMELINE_FORMAT_24H = `${CONF_TIMELINE}.format.24h` as const;
export const CONF_TIMELINE_SHOW_RECORDINGS = `${CONF_TIMELINE}.show_recordings` as const;
export const CONF_TIMELINE_STYLE = `${CONF_TIMELINE}.style` as const;
export const CONF_TIMELINE_CONTROLS_THUMBNAILS_MODE =
  `${CONF_TIMELINE}.controls.thumbnails.mode` as const;
export const CONF_TIMELINE_CONTROLS_THUMBNAILS_SIZE =
  `${CONF_TIMELINE}.controls.thumbnails.size` as const;
export const CONF_TIMELINE_CONTROLS_THUMBNAILS_SHOW_DETAILS =
  `${CONF_TIMELINE}.controls.thumbnails.show_details` as const;
export const CONF_TIMELINE_CONTROLS_THUMBNAILS_SHOW_DOWNLOAD_CONTROL =
  `${CONF_TIMELINE}.controls.thumbnails.show_download_control` as const;
export const CONF_TIMELINE_CONTROLS_THUMBNAILS_SHOW_FAVORITE_CONTROL =
  `${CONF_TIMELINE}.controls.thumbnails.show_favorite_control` as const;
export const CONF_TIMELINE_CONTROLS_THUMBNAILS_SHOW_TIMELINE_CONTROL =
  `${CONF_TIMELINE}.controls.thumbnails.show_timeline_control` as const;

const CONF_MENU = 'menu' as const;
export const CONF_MENU_ALIGNMENT = `${CONF_MENU}.alignment` as const;
export const CONF_MENU_POSITION = `${CONF_MENU}.position` as const;
export const CONF_MENU_STYLE = `${CONF_MENU}.style` as const;
export const CONF_MENU_BUTTON_SIZE = `${CONF_MENU}.button_size` as const;
export const CONF_MENU_BUTTONS = `${CONF_MENU}.buttons` as const;

export const CONF_MENU_BUTTONS_FULLSCREEN = `${CONF_MENU_BUTTONS}.fullscreen` as const;
export const CONF_MENU_BUTTONS_IRIS = `${CONF_MENU_BUTTONS}.iris` as const;
export const CONF_MENU_BUTTONS_PLAY = `${CONF_MENU_BUTTONS}.play` as const;
export const CONF_MENU_BUTTONS_MUTE = `${CONF_MENU_BUTTONS}.mute` as const;
export const CONF_MENU_BUTTONS_MEDIA_PLAYER =
  `${CONF_MENU_BUTTONS}.media_player` as const;
export const CONF_MENU_BUTTONS_TIMELINE = `${CONF_MENU_BUTTONS}.timeline` as const;

export const CONF_STATUS_BAR = 'status_bar' as const;
export const CONF_STATUS_BAR_POSITION = `${CONF_STATUS_BAR}.position` as const;
export const CONF_STATUS_BAR_STYLE = `${CONF_STATUS_BAR}.style` as const;
export const CONF_STATUS_BAR_POPUP_SECONDS = `${CONF_STATUS_BAR}.popup_seconds` as const;
export const CONF_STATUS_BAR_HEIGHT = `${CONF_STATUS_BAR}.height` as const;

export const CONF_STATUS_BAR_ITEMS = `${CONF_STATUS_BAR}.items` as const;

const CONF_DIMENSIONS = 'dimensions' as const;
export const CONF_DIMENSIONS_ASPECT_RATIO = `${CONF_DIMENSIONS}.aspect_ratio` as const;
export const CONF_DIMENSIONS_ASPECT_RATIO_MODE =
  `${CONF_DIMENSIONS}.aspect_ratio_mode` as const;
export const CONF_DIMENSIONS_HEIGHT = `${CONF_DIMENSIONS}.height` as const;

export const CONF_OVERRIDES = 'overrides' as const;

const CONF_PERFORMANCE = 'performance' as const;
export const CONF_PERFORMANCE_FEATURES_ANIMATED_PROGRESS_INDICATOR = `${CONF_PERFORMANCE}.features.animated_progress_indicator`;
export const CONF_PERFORMANCE_FEATURES_CARD_LOADING_INDICATOR = `${CONF_PERFORMANCE}.features.card_loading_indicator`;
export const CONF_PERFORMANCE_FEATURES_MEDIA_CHUNK_SIZE = `${CONF_PERFORMANCE}.features.media_chunk_size`;
export const CONF_PERFORMANCE_FEATURES_MAX_SIMULTANEOUS_ENGINE_REQUESTS = `${CONF_PERFORMANCE}.features.max_simultaneous_engine_requests`;
export const CONF_PERFORMANCE_PROFILE = `${CONF_PERFORMANCE}.profile`;
export const CONF_PERFORMANCE_STYLE_BOX_SHADOW = `${CONF_PERFORMANCE}.style.box_shadow`;
export const CONF_PERFORMANCE_STYLE_BORDER_RADIUS = `${CONF_PERFORMANCE}.style.border_radius`;

export const CONF_PROFILES = 'profiles' as const;

const CONF_REMOTE_CONTROL = 'remote_control' as const;
export const CONF_REMOTE_CONTROL_ENTITIES_CAMERA =
  `${CONF_REMOTE_CONTROL}.entities.camera` as const;

// Taken from https://github.com/home-assistant/frontend/blob/a759767d794f02527d127802831e68d3caf0cb7a/src/data/media-player.ts#L82
export const MEDIA_PLAYER_SUPPORT_TURN_OFF = 256;
export const MEDIA_PLAYER_SUPPORT_STOP = 4096;
export const MEDIA_PLAYER_SUPPORT_BROWSE_MEDIA = 131072;

// The number of media items to fetch at a time (for clips/snapshot views, and
// gallery chunks). Smaller values will cause more frequent smaller fetches, but
// improved rendering performance.
export const MEDIA_CHUNK_SIZE_DEFAULT = 50;
export const MEDIA_CHUNK_SIZE_MAX = 1000;

export const IMAGE_VIEW_ZOOM_TARGET_SENTINEL = '__IMAGE_VIEW_ZOOM__';
