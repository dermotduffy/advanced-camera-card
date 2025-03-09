import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import './components/icon.js';
import './components/key-assigner.js';
import { KeyboardShortcut } from './config/keyboard-shortcuts.js';
import {
  copyConfig,
  deleteConfigValue,
  getArrayConfigPath,
  getConfigValue,
  isConfigUpgradeable,
  setConfigValue,
  upgradeConfig,
} from './config/management.js';
import { setProfiles } from './config/profiles/index.js';
import {
  AdvancedCameraCardConfig,
  BUTTON_SIZE_MIN,
  configDefaults,
  MENU_PRIORITY_MAX,
  profilesSchema,
  RawAdvancedCameraCardConfig,
  RawAdvancedCameraCardConfigArray,
  STATUS_BAR_HEIGHT_MIN,
  STATUS_BAR_PRIORITY_MAX,
  THUMBNAIL_WIDTH_MAX,
  THUMBNAIL_WIDTH_MIN,
  ZOOM_MAX,
  ZOOM_MIN,
} from './config/types.js';
import {
  CONF_CAMERAS,
  CONF_CAMERAS_ARRAY_ALWAYS_ERROR_IF_ENTITY_UNAVAILABLE,
  CONF_CAMERAS_ARRAY_CAMERA_ENTITY,
  CONF_CAMERAS_ARRAY_CAPABILITIES_DISABLE,
  CONF_CAMERAS_ARRAY_CAPABILITIES_DISABLE_EXCEPT,
  CONF_CAMERAS_ARRAY_CAST_DASHBOARD_DASHBOARD_PATH,
  CONF_CAMERAS_ARRAY_CAST_DASHBOARD_VIEW_PATH,
  CONF_CAMERAS_ARRAY_CAST_METHOD,
  CONF_CAMERAS_ARRAY_DEPENDENCIES_ALL_CAMERAS,
  CONF_CAMERAS_ARRAY_DEPENDENCIES_CAMERAS,
  CONF_CAMERAS_ARRAY_DIMENSIONS_ASPECT_RATIO,
  CONF_CAMERAS_ARRAY_DIMENSIONS_LAYOUT_FIT,
  CONF_CAMERAS_ARRAY_DIMENSIONS_LAYOUT_PAN_X,
  CONF_CAMERAS_ARRAY_DIMENSIONS_LAYOUT_PAN_Y,
  CONF_CAMERAS_ARRAY_DIMENSIONS_LAYOUT_POSITION_X,
  CONF_CAMERAS_ARRAY_DIMENSIONS_LAYOUT_POSITION_Y,
  CONF_CAMERAS_ARRAY_DIMENSIONS_LAYOUT_VIEW_BOX_BOTTOM,
  CONF_CAMERAS_ARRAY_DIMENSIONS_LAYOUT_VIEW_BOX_LEFT,
  CONF_CAMERAS_ARRAY_DIMENSIONS_LAYOUT_VIEW_BOX_RIGHT,
  CONF_CAMERAS_ARRAY_DIMENSIONS_LAYOUT_VIEW_BOX_TOP,
  CONF_CAMERAS_ARRAY_DIMENSIONS_LAYOUT_ZOOM_FACTOR,
  CONF_CAMERAS_ARRAY_FRIGATE_CAMERA_NAME,
  CONF_CAMERAS_ARRAY_FRIGATE_CLIENT_ID,
  CONF_CAMERAS_ARRAY_FRIGATE_LABELS,
  CONF_CAMERAS_ARRAY_FRIGATE_URL,
  CONF_CAMERAS_ARRAY_FRIGATE_ZONES,
  CONF_CAMERAS_ARRAY_GO2RTC_MODES,
  CONF_CAMERAS_ARRAY_GO2RTC_STREAM,
  CONF_CAMERAS_ARRAY_GO2RTC_URL,
  CONF_CAMERAS_ARRAY_ICON,
  CONF_CAMERAS_ARRAY_ID,
  CONF_CAMERAS_ARRAY_IMAGE_ENTITY,
  CONF_CAMERAS_ARRAY_IMAGE_ENTITY_PARAMETERS,
  CONF_CAMERAS_ARRAY_IMAGE_MODE,
  CONF_CAMERAS_ARRAY_IMAGE_REFRESH_SECONDS,
  CONF_CAMERAS_ARRAY_IMAGE_URL,
  CONF_CAMERAS_ARRAY_LIVE_PROVIDER,
  CONF_CAMERAS_ARRAY_MOTIONEYE_IMAGES_DIRECTORY_PATTERN,
  CONF_CAMERAS_ARRAY_MOTIONEYE_IMAGES_FILE_PATTERN,
  CONF_CAMERAS_ARRAY_MOTIONEYE_MOVIES_DIRECTORY_PATTERN,
  CONF_CAMERAS_ARRAY_MOTIONEYE_MOVIES_FILE_PATTERN,
  CONF_CAMERAS_ARRAY_MOTIONEYE_URL,
  CONF_CAMERAS_ARRAY_PROXY_DYNAMIC,
  CONF_CAMERAS_ARRAY_PROXY_MEDIA,
  CONF_CAMERAS_ARRAY_PROXY_SSL_CIPHERS,
  CONF_CAMERAS_ARRAY_PROXY_SSL_VERIFICATION,
  CONF_CAMERAS_ARRAY_REOLINK_MEDIA_RESOLUTION,
  CONF_CAMERAS_ARRAY_REOLINK_URL,
  CONF_CAMERAS_ARRAY_TITLE,
  CONF_CAMERAS_ARRAY_TRIGGERS_ENTITIES,
  CONF_CAMERAS_ARRAY_TRIGGERS_EVENTS,
  CONF_CAMERAS_ARRAY_TRIGGERS_MOTION,
  CONF_CAMERAS_ARRAY_TRIGGERS_OCCUPANCY,
  CONF_CAMERAS_ARRAY_WEBRTC_CARD_ENTITY,
  CONF_CAMERAS_ARRAY_WEBRTC_CARD_URL,
  CONF_DIMENSIONS_ASPECT_RATIO,
  CONF_DIMENSIONS_ASPECT_RATIO_MODE,
  CONF_DIMENSIONS_HEIGHT,
  CONF_IMAGE_ENTITY,
  CONF_IMAGE_ENTITY_PARAMETERS,
  CONF_IMAGE_MODE,
  CONF_IMAGE_REFRESH_SECONDS,
  CONF_IMAGE_URL,
  CONF_LIVE_AUTO_MUTE,
  CONF_LIVE_AUTO_PAUSE,
  CONF_LIVE_AUTO_PLAY,
  CONF_LIVE_AUTO_UNMUTE,
  CONF_LIVE_CONTROLS_BUILTIN,
  CONF_LIVE_CONTROLS_NEXT_PREVIOUS_SIZE,
  CONF_LIVE_CONTROLS_NEXT_PREVIOUS_STYLE,
  CONF_LIVE_CONTROLS_PTZ_HIDE_HOME,
  CONF_LIVE_CONTROLS_PTZ_HIDE_PAN_TILT,
  CONF_LIVE_CONTROLS_PTZ_HIDE_ZOOM,
  CONF_LIVE_CONTROLS_PTZ_MODE,
  CONF_LIVE_CONTROLS_PTZ_ORIENTATION,
  CONF_LIVE_CONTROLS_PTZ_POSITION,
  CONF_LIVE_CONTROLS_THUMBNAILS_EVENTS_MEDIA_TYPE,
  CONF_LIVE_CONTROLS_THUMBNAILS_MEDIA_TYPE,
  CONF_LIVE_CONTROLS_THUMBNAILS_MODE,
  CONF_LIVE_CONTROLS_THUMBNAILS_SHOW_DETAILS,
  CONF_LIVE_CONTROLS_THUMBNAILS_SHOW_DOWNLOAD_CONTROL,
  CONF_LIVE_CONTROLS_THUMBNAILS_SHOW_FAVORITE_CONTROL,
  CONF_LIVE_CONTROLS_THUMBNAILS_SHOW_TIMELINE_CONTROL,
  CONF_LIVE_CONTROLS_THUMBNAILS_SIZE,
  CONF_LIVE_CONTROLS_TIMELINE_CLUSTERING_THRESHOLD,
  CONF_LIVE_CONTROLS_TIMELINE_EVENTS_MEDIA_TYPE,
  CONF_LIVE_CONTROLS_TIMELINE_FORMAT_24H,
  CONF_LIVE_CONTROLS_TIMELINE_MODE,
  CONF_LIVE_CONTROLS_TIMELINE_PAN_MODE,
  CONF_LIVE_CONTROLS_TIMELINE_SHOW_RECORDINGS,
  CONF_LIVE_CONTROLS_TIMELINE_STYLE,
  CONF_LIVE_CONTROLS_TIMELINE_WINDOW_SECONDS,
  CONF_LIVE_DISPLAY_GRID_COLUMNS,
  CONF_LIVE_DISPLAY_GRID_MAX_COLUMNS,
  CONF_LIVE_DISPLAY_GRID_SELECTED_WIDTH_FACTOR,
  CONF_LIVE_DISPLAY_MODE,
  CONF_LIVE_DRAGGABLE,
  CONF_LIVE_LAZY_LOAD,
  CONF_LIVE_LAZY_UNLOAD,
  CONF_LIVE_MICROPHONE_ALWAYS_CONNECTED,
  CONF_LIVE_MICROPHONE_DISCONNECT_SECONDS,
  CONF_LIVE_MICROPHONE_MUTE_AFTER_MICROPHONE_MUTE_SECONDS,
  CONF_LIVE_PRELOAD,
  CONF_LIVE_SHOW_IMAGE_DURING_LOAD,
  CONF_LIVE_TRANSITION_EFFECT,
  CONF_LIVE_ZOOMABLE,
  CONF_MEDIA_GALLERY_CONTROLS_FILTER_MODE,
  CONF_MEDIA_GALLERY_CONTROLS_THUMBNAILS_SHOW_DETAILS,
  CONF_MEDIA_GALLERY_CONTROLS_THUMBNAILS_SHOW_DOWNLOAD_CONTROL,
  CONF_MEDIA_GALLERY_CONTROLS_THUMBNAILS_SHOW_FAVORITE_CONTROL,
  CONF_MEDIA_GALLERY_CONTROLS_THUMBNAILS_SHOW_TIMELINE_CONTROL,
  CONF_MEDIA_GALLERY_CONTROLS_THUMBNAILS_SIZE,
  CONF_MEDIA_VIEWER_AUTO_MUTE,
  CONF_MEDIA_VIEWER_AUTO_PAUSE,
  CONF_MEDIA_VIEWER_AUTO_PLAY,
  CONF_MEDIA_VIEWER_AUTO_UNMUTE,
  CONF_MEDIA_VIEWER_CONTROLS_BUILTIN,
  CONF_MEDIA_VIEWER_CONTROLS_NEXT_PREVIOUS_SIZE,
  CONF_MEDIA_VIEWER_CONTROLS_NEXT_PREVIOUS_STYLE,
  CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_MODE,
  CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_SHOW_DETAILS,
  CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_SHOW_DOWNLOAD_CONTROL,
  CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_SHOW_FAVORITE_CONTROL,
  CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_SHOW_TIMELINE_CONTROL,
  CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_SIZE,
  CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_CLUSTERING_THRESHOLD,
  CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_EVENTS_MEDIA_TYPE,
  CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_FORMAT_24H,
  CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_MODE,
  CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_PAN_MODE,
  CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_SHOW_RECORDINGS,
  CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_STYLE,
  CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_WINDOW_SECONDS,
  CONF_MEDIA_VIEWER_DISPLAY_GRID_COLUMNS,
  CONF_MEDIA_VIEWER_DISPLAY_GRID_MAX_COLUMNS,
  CONF_MEDIA_VIEWER_DISPLAY_GRID_SELECTED_WIDTH_FACTOR,
  CONF_MEDIA_VIEWER_DISPLAY_MODE,
  CONF_MEDIA_VIEWER_DRAGGABLE,
  CONF_MEDIA_VIEWER_LAZY_LOAD,
  CONF_MEDIA_VIEWER_SNAPSHOT_CLICK_PLAYS_CLIP,
  CONF_MEDIA_VIEWER_TRANSITION_EFFECT,
  CONF_MEDIA_VIEWER_ZOOMABLE,
  CONF_MENU_ALIGNMENT,
  CONF_MENU_BUTTON_SIZE,
  CONF_MENU_BUTTONS,
  CONF_MENU_POSITION,
  CONF_MENU_STYLE,
  CONF_PERFORMANCE_FEATURES_ANIMATED_PROGRESS_INDICATOR,
  CONF_PERFORMANCE_FEATURES_CARD_LOADING_INDICATOR,
  CONF_PERFORMANCE_FEATURES_MAX_SIMULTANEOUS_ENGINE_REQUESTS,
  CONF_PERFORMANCE_FEATURES_MEDIA_CHUNK_SIZE,
  CONF_PERFORMANCE_PROFILE,
  CONF_PERFORMANCE_STYLE_BORDER_RADIUS,
  CONF_PERFORMANCE_STYLE_BOX_SHADOW,
  CONF_PROFILES,
  CONF_REMOTE_CONTROL_ENTITIES_CAMERA,
  CONF_STATUS_BAR_HEIGHT,
  CONF_STATUS_BAR_ITEMS,
  CONF_STATUS_BAR_POPUP_SECONDS,
  CONF_STATUS_BAR_POSITION,
  CONF_STATUS_BAR_STYLE,
  CONF_TIMELINE_CLUSTERING_THRESHOLD,
  CONF_TIMELINE_CONTROLS_THUMBNAILS_MODE,
  CONF_TIMELINE_CONTROLS_THUMBNAILS_SHOW_DETAILS,
  CONF_TIMELINE_CONTROLS_THUMBNAILS_SHOW_DOWNLOAD_CONTROL,
  CONF_TIMELINE_CONTROLS_THUMBNAILS_SHOW_FAVORITE_CONTROL,
  CONF_TIMELINE_CONTROLS_THUMBNAILS_SHOW_TIMELINE_CONTROL,
  CONF_TIMELINE_CONTROLS_THUMBNAILS_SIZE,
  CONF_TIMELINE_EVENTS_MEDIA_TYPE,
  CONF_TIMELINE_FORMAT_24H,
  CONF_TIMELINE_SHOW_RECORDINGS,
  CONF_TIMELINE_STYLE,
  CONF_TIMELINE_WINDOW_SECONDS,
  CONF_VIEW_CAMERA_SELECT,
  CONF_VIEW_DEFAULT,
  CONF_VIEW_DEFAULT_CYCLE_CAMERA,
  CONF_VIEW_DEFAULT_RESET,
  CONF_VIEW_DEFAULT_RESET_AFTER_INTERACTION,
  CONF_VIEW_DEFAULT_RESET_ENTITIES,
  CONF_VIEW_DEFAULT_RESET_EVERY_SECONDS,
  CONF_VIEW_DEFAULT_RESET_INTERACTION_MODE,
  CONF_VIEW_DIM,
  CONF_VIEW_INTERACTION_SECONDS,
  CONF_VIEW_KEYBOARD_SHORTCUTS,
  CONF_VIEW_KEYBOARD_SHORTCUTS_ENABLED,
  CONF_VIEW_KEYBOARD_SHORTCUTS_PTZ_DOWN,
  CONF_VIEW_KEYBOARD_SHORTCUTS_PTZ_HOME,
  CONF_VIEW_KEYBOARD_SHORTCUTS_PTZ_LEFT,
  CONF_VIEW_KEYBOARD_SHORTCUTS_PTZ_RIGHT,
  CONF_VIEW_KEYBOARD_SHORTCUTS_PTZ_UP,
  CONF_VIEW_KEYBOARD_SHORTCUTS_PTZ_ZOOM_IN,
  CONF_VIEW_KEYBOARD_SHORTCUTS_PTZ_ZOOM_OUT,
  CONF_VIEW_THEME_THEMES,
  CONF_VIEW_TRIGGERS,
  CONF_VIEW_TRIGGERS_ACTIONS,
  CONF_VIEW_TRIGGERS_ACTIONS_INTERACTION_MODE,
  CONF_VIEW_TRIGGERS_ACTIONS_TRIGGER,
  CONF_VIEW_TRIGGERS_ACTIONS_UNTRIGGER,
  CONF_VIEW_TRIGGERS_FILTER_SELECTED_CAMERA,
  CONF_VIEW_TRIGGERS_SHOW_TRIGGER_STATUS,
  CONF_VIEW_TRIGGERS_UNTRIGGER_SECONDS,
  MEDIA_CHUNK_SIZE_MAX,
} from './const.js';
import { fireHASSEvent } from './ha/fire-hass-event.js';
import { HomeAssistant, LovelaceCardEditor } from './ha/types.js';
import { localize } from './localize/localize.js';
import editorStyle from './scss/editor.scss';
import { arrayMove, prettifyTitle } from './utils/basic.js';
import { getCameraID } from './utils/camera.js';
import {
  getEntitiesFromHASS,
  getEntityTitle,
  sideLoadHomeAssistantElements,
} from './utils/ha';

const MENU_CAMERAS = 'cameras';
const MENU_CAMERAS_CAPABILITIES = 'cameras.capabilities';
const MENU_CAMERAS_CAST = 'cameras.cast';
const MENU_CAMERAS_DEPENDENCIES = 'cameras.dependencies';
const MENU_CAMERAS_DIMENSIONS = 'cameras.dimensions';
const MENU_CAMERAS_DIMENSIONS_LAYOUT = 'cameras.dimensions.layout';
const MENU_CAMERAS_ENGINE = 'cameras.engine';
const MENU_CAMERAS_FRIGATE = 'cameras.frigate';
const MENU_CAMERAS_GO2RTC = 'cameras.go2rtc';
const MENU_CAMERAS_IMAGE = 'cameras.image';
const MENU_CAMERAS_LIVE_PROVIDER = 'cameras.live_provider';
const MENU_CAMERAS_MOTIONEYE = 'cameras.motioneye';
const MENU_CAMERAS_PROXY = 'cameras.proxy';
const MENU_CAMERAS_REOLINK = 'cameras.reolink';
const MENU_CAMERAS_TRIGGERS = 'cameras.triggers';
const MENU_CAMERAS_WEBRTC_CARD = 'cameras.webrtc_card';
const MENU_LIVE_CONTROLS = 'live.controls';
const MENU_LIVE_CONTROLS_NEXT_PREVIOUS = 'live.controls.next_previous';
const MENU_LIVE_CONTROLS_PTZ = 'live.controls.ptz';
const MENU_LIVE_CONTROLS_THUMBNAILS = 'live.controls.thumbnails';
const MENU_LIVE_CONTROLS_TIMELINE = 'live.controls.timeline';
const MENU_LIVE_DISPLAY = 'live.display';
const MENU_LIVE_MICROPHONE = 'live.microphone';
const MENU_MEDIA_GALLERY_CONTROLS_FILTER = 'media_gallery.controls.filter';
const MENU_MEDIA_GALLERY_CONTROLS_THUMBNAILS = 'media_gallery.controls.thumbnails';
const MENU_MEDIA_VIEWER_CONTROLS = 'media_viewer.controls';
const MENU_MEDIA_VIEWER_CONTROLS_NEXT_PREVIOUS = 'media_viewer.controls.next_previous';
const MENU_MEDIA_VIEWER_CONTROLS_THUMBNAILS = 'media_viewer.controls.thumbnails';
const MENU_MEDIA_VIEWER_CONTROLS_TIMELINE = 'media_viewer.controls.timeline';
const MENU_MEDIA_VIEWER_DISPLAY = 'media_viewer.display';
const MENU_MENU_BUTTONS = 'menu.buttons';
const MENU_OPTIONS = 'options';
const MENU_PERFORMANCE_FEATURES = 'performance.features';
const MENU_PERFORMANCE_STYLE = 'performance.style';
const MENU_REMOTE_CONTROL_ENTITIES = 'remote_control.entities';
const MENU_STATUS_BAR_ITEMS = 'status_bar.items';
const MENU_TIMELINE_FORMAT = 'timeline.format';
const MENU_TIMELINE_CONTROLS_THUMBNAILS = 'timeline.controls.thumbnails';
const MENU_VIEW_DEFAULT_RESET = 'view.default_reset';
const MENU_VIEW_KEYBOARD_SHORTCUTS = 'view.keyboard_shortcuts';
const MENU_VIEW_TRIGGERS = 'view.triggers';
const MENU_VIEW_TRIGGERS_ACTIONS = 'view.triggers.actions';

interface EditorOptionsSet {
  icon: string;
  name: string;
  secondary: string;
}
interface EditorOptions {
  [setName: string]: EditorOptionsSet;
}

interface EditorSelectOption {
  value: unknown;
  label: string;
}

interface EditorMenuTarget {
  domain: string;
  key: string | number;
}

const options: EditorOptions = {
  cameras: {
    icon: 'video',
    name: localize('editor.cameras'),
    secondary: localize('editor.cameras_secondary'),
  },
  view: {
    icon: 'eye',
    name: localize('editor.view'),
    secondary: localize('editor.view_secondary'),
  },
  menu: {
    icon: 'menu',
    name: localize('editor.menu'),
    secondary: localize('editor.menu_secondary'),
  },
  status_bar: {
    icon: 'sign-text',
    name: localize('editor.status_bar'),
    secondary: localize('editor.status_bar_secondary'),
  },
  live: {
    icon: 'cctv',
    name: localize('editor.live'),
    secondary: localize('editor.live_secondary'),
  },
  media_gallery: {
    icon: 'grid',
    name: localize('editor.media_gallery'),
    secondary: localize('editor.media_gallery_secondary'),
  },
  media_viewer: {
    icon: 'filmstrip',
    name: localize('editor.media_viewer'),
    secondary: localize('editor.media_viewer_secondary'),
  },
  image: {
    icon: 'image',
    name: localize('editor.image'),
    secondary: localize('editor.image_secondary'),
  },
  timeline: {
    icon: 'chart-gantt',
    name: localize('editor.timeline'),
    secondary: localize('editor.timeline_secondary'),
  },
  dimensions: {
    icon: 'aspect-ratio',
    name: localize('editor.dimensions'),
    secondary: localize('editor.dimensions_secondary'),
  },
  performance: {
    icon: 'speedometer',
    name: localize('editor.performance'),
    secondary: localize('editor.performance_secondary'),
  },
  profiles: {
    icon: 'folder-wrench-outline',
    name: localize('editor.profiles'),
    secondary: localize('editor.profiles_secondary'),
  },
  remote_control: {
    icon: 'remote',
    name: localize('editor.remote_control'),
    secondary: localize('editor.remote_control_secondary'),
  },
  overrides: {
    icon: 'file-replace',
    name: localize('editor.overrides'),
    secondary: localize('editor.overrides_secondary'),
  },
};

@customElement('advanced-camera-card-editor')
export class AdvancedCameraCardEditor extends LitElement implements LovelaceCardEditor {
  @property({ attribute: false }) public hass?: HomeAssistant;
  @state() protected _config?: RawAdvancedCameraCardConfig;
  @state() protected _defaults = copyConfig(configDefaults);

  protected _initialized = false;
  protected _configUpgradeable = false;

  @state()
  protected _expandedMenus: Record<string, string | number> = {};

  protected _viewModes: EditorSelectOption[] = [
    { value: '', label: '' },
    { value: 'live', label: localize('config.view.views.live') },
    { value: 'clips', label: localize('config.view.views.clips') },
    { value: 'snapshots', label: localize('config.view.views.snapshots') },
    { value: 'recordings', label: localize('config.view.views.recordings') },
    { value: 'clip', label: localize('config.view.views.clip') },
    { value: 'snapshot', label: localize('config.view.views.snapshot') },
    { value: 'recording', label: localize('config.view.views.recording') },
    { value: 'image', label: localize('config.view.views.image') },
    { value: 'timeline', label: localize('config.view.views.timeline') },
  ];

  protected _cameraSelectViewModes: EditorSelectOption[] = [
    ...this._viewModes,
    { value: 'current', label: localize('config.view.views.current') },
  ];

  protected _filterModes: EditorSelectOption[] = [
    { value: '', label: '' },
    {
      value: 'none',
      label: localize('config.common.controls.filter.modes.none'),
    },
    {
      value: 'left',
      label: localize('config.common.controls.filter.modes.left'),
    },
    {
      value: 'right',
      label: localize('config.common.controls.filter.modes.right'),
    },
  ];

  protected _menuStyles: EditorSelectOption[] = [
    { value: '', label: '' },
    { value: 'none', label: localize('config.menu.styles.none') },
    { value: 'hidden', label: localize('config.menu.styles.hidden') },
    { value: 'overlay', label: localize('config.menu.styles.overlay') },
    { value: 'hover', label: localize('config.menu.styles.hover') },
    { value: 'hover-card', label: localize('config.menu.styles.hover-card') },
    { value: 'outside', label: localize('config.menu.styles.outside') },
  ];

  protected _menuPositions: EditorSelectOption[] = [
    { value: '', label: '' },
    { value: 'left', label: localize('config.menu.positions.left') },
    { value: 'right', label: localize('config.menu.positions.right') },
    { value: 'top', label: localize('config.menu.positions.top') },
    { value: 'bottom', label: localize('config.menu.positions.bottom') },
  ];

  protected _menuAlignments: EditorSelectOption[] = [
    { value: '', label: '' },
    { value: 'left', label: localize('config.menu.alignments.left') },
    { value: 'right', label: localize('config.menu.alignments.right') },
    { value: 'top', label: localize('config.menu.alignments.top') },
    { value: 'bottom', label: localize('config.menu.alignments.bottom') },
  ];

  protected _nextPreviousControlStyles: EditorSelectOption[] = [
    { value: '', label: '' },
    {
      value: 'chevrons',
      label: localize('config.common.controls.next_previous.styles.chevrons'),
    },
    {
      value: 'icons',
      label: localize('config.common.controls.next_previous.styles.icons'),
    },
    {
      value: 'none',
      label: localize('config.common.controls.next_previous.styles.none'),
    },
    {
      value: 'thumbnails',
      label: localize('config.common.controls.next_previous.styles.thumbnails'),
    },
  ];

  protected _aspectRatioModes: EditorSelectOption[] = [
    { value: '', label: '' },
    {
      value: 'dynamic',
      label: localize('config.dimensions.aspect_ratio_modes.dynamic'),
    },
    { value: 'static', label: localize('config.dimensions.aspect_ratio_modes.static') },
    {
      value: 'unconstrained',
      label: localize('config.dimensions.aspect_ratio_modes.unconstrained'),
    },
  ];

  protected _thumbnailModes: EditorSelectOption[] = [
    { value: '', label: '' },
    {
      value: 'none',
      label: localize('config.common.controls.thumbnails.modes.none'),
    },
    {
      value: 'above',
      label: localize('config.common.controls.thumbnails.modes.above'),
    },
    {
      value: 'below',
      label: localize('config.common.controls.thumbnails.modes.below'),
    },
    {
      value: 'left',
      label: localize('config.common.controls.thumbnails.modes.left'),
    },
    {
      value: 'right',
      label: localize('config.common.controls.thumbnails.modes.right'),
    },
  ];

  protected _thumbnailMediaTypes: EditorSelectOption[] = [
    { value: '', label: '' },
    {
      value: 'events',
      label: localize('config.common.controls.thumbnails.media_types.events'),
    },
    {
      value: 'recordings',
      label: localize('config.common.controls.thumbnails.media_types.recordings'),
    },
  ];

  protected _thumbnailEventsMediaTypes: EditorSelectOption[] = [
    { value: '', label: '' },
    {
      value: 'clips',
      label: localize('config.common.controls.thumbnails.events_media_types.clips'),
    },
    {
      value: 'snapshots',
      label: localize('config.common.controls.thumbnails.events_media_types.snapshots'),
    },
  ];

  protected _transitionEffects: EditorSelectOption[] = [
    { value: '', label: '' },
    { value: 'none', label: localize('config.media_viewer.transition_effects.none') },
    { value: 'slide', label: localize('config.media_viewer.transition_effects.slide') },
  ];

  protected _imageModes: EditorSelectOption[] = [
    { value: '', label: '' },
    { value: 'camera', label: localize('config.common.image.modes.camera') },
    { value: 'entity', label: localize('config.common.image.modes.entity') },
    { value: 'screensaver', label: localize('config.common.image.modes.screensaver') },
    { value: 'url', label: localize('config.common.image.modes.url') },
  ];

  protected _timelineEventsMediaTypes: EditorSelectOption[] = [
    { value: '', label: '' },
    { value: 'all', label: localize('config.common.timeline.events_media_types.all') },
    {
      value: 'clips',
      label: localize('config.common.timeline.events_media_types.clips'),
    },
    {
      value: 'snapshots',
      label: localize('config.common.timeline.events_media_types.snapshots'),
    },
  ];

  protected _timelineStyleTypes: EditorSelectOption[] = [
    { value: '', label: '' },
    { value: 'ribbon', label: localize('config.common.timeline.styles.ribbon') },
    { value: 'stack', label: localize('config.common.timeline.styles.stack') },
  ];

  protected _mediaActionNegativeConditions: EditorSelectOption[] = [
    { value: '', label: '' },
    {
      value: 'unselected',
      label: localize('config.common.media_action_conditions.unselected'),
    },
    { value: 'hidden', label: localize('config.common.media_action_conditions.hidden') },
  ];

  protected _mediaActionPositiveConditions: EditorSelectOption[] = [
    { value: '', label: '' },
    {
      value: 'selected',
      label: localize('config.common.media_action_conditions.selected'),
    },
    {
      value: 'visible',
      label: localize('config.common.media_action_conditions.visible'),
    },
  ];

  protected _mediaLiveUnmuteConditions: EditorSelectOption[] = [
    ...this._mediaActionPositiveConditions,
    {
      value: 'microphone',
      label: localize('config.common.media_action_conditions.microphone_unmute'),
    },
  ];

  protected _mediaLiveMuteConditions: EditorSelectOption[] = [
    ...this._mediaActionNegativeConditions,
    {
      value: 'microphone',
      label: localize('config.common.media_action_conditions.microphone_mute'),
    },
  ];

  protected _layoutFits: EditorSelectOption[] = [
    { value: '', label: '' },
    {
      value: 'contain',
      label: localize('config.cameras.dimensions.layout.fits.contain'),
    },
    { value: 'cover', label: localize('config.cameras.dimensions.layout.fits.cover') },
    { value: 'fill', label: localize('config.cameras.dimensions.layout.fits.fill') },
  ];

  protected _miniTimelineModes: EditorSelectOption[] = [
    { value: '', label: '' },
    { value: 'none', label: localize('config.common.controls.timeline.modes.none') },
    { value: 'above', label: localize('config.common.controls.timeline.modes.above') },
    { value: 'below', label: localize('config.common.controls.timeline.modes.below') },
  ];

  protected _profiles: EditorSelectOption[] = [
    { value: '', label: '' },
    { value: 'casting', label: localize('config.profiles.casting') },
    { value: 'low-performance', label: localize('config.profiles.low-performance') },
    { value: 'scrubbing', label: localize('config.profiles.scrubbing') },
  ];

  protected _go2rtcModes: EditorSelectOption[] = [
    { value: '', label: '' },
    { value: 'mse', label: localize('config.cameras.go2rtc.modes.mse') },
    { value: 'webrtc', label: localize('config.cameras.go2rtc.modes.webrtc') },
    { value: 'mp4', label: localize('config.cameras.go2rtc.modes.mp4') },
    { value: 'mjpeg', label: localize('config.cameras.go2rtc.modes.mjpeg') },
  ];

  protected _microphoneButtonTypes: EditorSelectOption[] = [
    { value: '', label: '' },
    { value: 'momentary', label: localize('config.menu.buttons.types.momentary') },
    { value: 'toggle', label: localize('config.menu.buttons.types.toggle') },
  ];

  protected _displayModes: EditorSelectOption[] = [
    { value: '', label: '' },
    { value: 'single', label: localize('display_modes.single') },
    { value: 'grid', label: localize('display_modes.grid') },
  ];

  protected _castMethods: EditorSelectOption[] = [
    { value: '', label: '' },
    { value: 'standard', label: localize('config.cameras.cast.methods.standard') },
    { value: 'dashboard', label: localize('config.cameras.cast.methods.dashboard') },
  ];

  protected _ptzModes: EditorSelectOption[] = [
    { value: '', label: '' },
    { value: 'on', label: localize('config.live.controls.ptz.modes.on') },
    { value: 'off', label: localize('config.live.controls.ptz.modes.off') },
  ];

  protected _ptzOrientations: EditorSelectOption[] = [
    { value: '', label: '' },
    {
      value: 'vertical',
      label: localize('config.live.controls.ptz.orientations.vertical'),
    },
    {
      value: 'horizontal',
      label: localize('config.live.controls.ptz.orientations.horizontal'),
    },
  ];

  protected _ptzPositions: EditorSelectOption[] = [
    { value: '', label: '' },
    {
      value: 'top-left',
      label: localize('config.live.controls.ptz.positions.top-left'),
    },
    {
      value: 'top-right',
      label: localize('config.live.controls.ptz.positions.top-right'),
    },
    {
      value: 'bottom-left',
      label: localize('config.live.controls.ptz.positions.bottom-left'),
    },
    {
      value: 'bottom-right',
      label: localize('config.live.controls.ptz.positions.bottom-right'),
    },
  ];

  protected _triggersActionsInteractionModes: EditorSelectOption[] = [
    { value: '', label: '' },
    {
      value: 'all',
      label: localize('config.view.triggers.actions.interaction_modes.all'),
    },
    {
      value: 'inactive',
      label: localize('config.view.triggers.actions.interaction_modes.inactive'),
    },
    {
      value: 'active',
      label: localize('config.view.triggers.actions.interaction_modes.active'),
    },
  ];

  protected _triggersActionsTrigger: EditorSelectOption[] = [
    { value: '', label: '' },
    {
      value: 'default',
      label: localize('config.view.triggers.actions.triggers.default'),
    },
    {
      value: 'live',
      label: localize('config.view.triggers.actions.triggers.live'),
    },
    {
      value: 'media',
      label: localize('config.view.triggers.actions.triggers.media'),
    },
    {
      value: 'none',
      label: localize('config.view.triggers.actions.triggers.none'),
    },
  ];

  protected _triggersActionsUntrigger: EditorSelectOption[] = [
    { value: '', label: '' },
    {
      value: 'default',
      label: localize('config.view.triggers.actions.untriggers.default'),
    },
    {
      value: 'none',
      label: localize('config.view.triggers.actions.untriggers.none'),
    },
  ];

  protected _triggersEvents: EditorSelectOption[] = [
    { value: '', label: '' },
    {
      value: 'events',
      label: localize('config.cameras.triggers.events.events'),
    },
    {
      value: 'clips',
      label: localize('config.cameras.triggers.events.clips'),
    },
    {
      value: 'snapshots',
      label: localize('config.cameras.triggers.events.snapshots'),
    },
  ];

  protected _timelinePanModes: EditorSelectOption[] = [
    { value: '', label: '' },
    {
      value: 'pan',
      label: localize('config.common.controls.timeline.pan_modes.pan'),
    },
    {
      value: 'seek',
      label: localize('config.common.controls.timeline.pan_modes.seek'),
    },
    {
      value: 'seek-in-media',
      label: localize('config.common.controls.timeline.pan_modes.seek-in-media'),
    },
    {
      value: 'seek-in-camera',
      label: localize('config.common.controls.timeline.pan_modes.seek-in-camera'),
    },
  ];

  protected _capabilities: EditorSelectOption[] = [
    { value: '', label: '' },
    {
      value: 'live',
      label: localize('config.cameras.capabilities.capabilities.live'),
    },
    {
      value: 'substream',
      label: localize('config.cameras.capabilities.capabilities.substream'),
    },
    {
      value: 'clips',
      label: localize('config.cameras.capabilities.capabilities.clips'),
    },
    {
      value: 'recordings',
      label: localize('config.cameras.capabilities.capabilities.recordings'),
    },
    {
      value: 'snapshots',
      label: localize('config.cameras.capabilities.capabilities.snapshots'),
    },
    {
      value: 'favorite-events',
      label: localize('config.cameras.capabilities.capabilities.favorite-events'),
    },
    {
      value: 'favorite-recordings',
      label: localize('config.cameras.capabilities.capabilities.favorite-recordings'),
    },
    {
      value: 'seek',
      label: localize('config.cameras.capabilities.capabilities.seek'),
    },
    {
      value: 'ptz',
      label: localize('config.cameras.capabilities.capabilities.ptz'),
    },
    {
      value: 'menu',
      label: localize('config.cameras.capabilities.capabilities.menu'),
    },
  ];

  protected _defaultResetInteractionModes: EditorSelectOption[] = [
    { value: '', label: '' },
    {
      value: 'all',
      label: localize('config.view.default_reset.interaction_modes.all'),
    },
    {
      value: 'inactive',
      label: localize('config.view.default_reset.interaction_modes.inactive'),
    },
    {
      value: 'active',
      label: localize('config.view.default_reset.interaction_modes.active'),
    },
  ];

  protected _proxyMedia: EditorSelectOption[] = [
    { value: '', label: '' },
    {
      value: 'auto',
      label: localize('config.cameras.proxy.media.auto'),
    },
    {
      value: true,
      label: localize('config.cameras.proxy.media.true'),
    },
    {
      value: false,
      label: localize('config.cameras.proxy.media.false'),
    },
  ];

  protected _proxySSLCiphers: EditorSelectOption[] = [
    { value: '', label: '' },
    {
      value: 'auto',
      label: localize('config.cameras.proxy.ssl_ciphers.auto'),
    },
    {
      value: 'default',
      label: localize('config.cameras.proxy.ssl_ciphers.default'),
    },
    {
      value: 'insecure',
      label: localize('config.cameras.proxy.ssl_ciphers.insecure'),
    },
    {
      value: 'intermediate',
      label: localize('config.cameras.proxy.ssl_ciphers.intermediate'),
    },
    {
      value: 'modern',
      label: localize('config.cameras.proxy.ssl_ciphers.modern'),
    },
  ];

  protected _proxySSLVerification: EditorSelectOption[] = [
    { value: '', label: '' },
    {
      value: 'auto',
      label: localize('config.cameras.proxy.ssl_verification.auto'),
    },
    {
      value: true,
      label: localize('config.cameras.proxy.ssl_verification.true'),
    },
    {
      value: false,
      label: localize('config.cameras.proxy.ssl_verification.false'),
    },
  ];

  protected _reolinkMediaResolution: EditorSelectOption[] = [
    { value: '', label: '' },
    {
      value: 'high',
      label: localize('config.cameras.reolink.media_resolution.high'),
    },
    {
      value: 'low',
      label: localize('config.cameras.reolink.media_resolution.low'),
    },
  ];

  protected _statusBarStyles: EditorSelectOption[] = [
    { value: '', label: '' },
    { value: 'hover', label: localize('config.status_bar.styles.hover') },
    { value: 'hover-card', label: localize('config.status_bar.styles.hover-card') },
    { value: 'none', label: localize('config.status_bar.styles.none') },
    { value: 'outside', label: localize('config.status_bar.styles.outside') },
    { value: 'overlay', label: localize('config.status_bar.styles.overlay') },
    { value: 'popup', label: localize('config.status_bar.styles.popup') },
  ];

  protected _statusBarPositions: EditorSelectOption[] = [
    { value: '', label: '' },
    { value: 'top', label: localize('config.status_bar.positions.top') },
    { value: 'bottom', label: localize('config.status_bar.positions.bottom') },
  ];

  protected _themes: EditorSelectOption[] = [
    { value: '', label: '' },
    { value: 'ha', label: localize('config.view.theme.themes.ha') },
    { value: 'dark', label: localize('config.view.theme.themes.dark') },
    { value: 'light', label: localize('config.view.theme.themes.light') },
    { value: 'traditional', label: localize('config.view.theme.themes.traditional') },
  ];

  public setConfig(config: RawAdvancedCameraCardConfig): void {
    // Note: This does not use Zod to parse the full configuration, so it may be
    // partially or completely invalid. It's more useful to have a partially
    // valid configuration here, to allow the user to fix the broken parts. As
    // such, RawAdvancedCameraCardConfig is used as the type.
    this._config = config;
    this._configUpgradeable = isConfigUpgradeable(config);

    const profiles = profilesSchema.safeParse(
      (this._config as AdvancedCameraCardConfig).profiles,
    );

    if (profiles.success) {
      const defaults = copyConfig(configDefaults);
      setProfiles(this._config, defaults, profiles.data);
      this._defaults = defaults;
    }
  }

  protected willUpdate(): void {
    if (!this._initialized) {
      sideLoadHomeAssistantElements().then((success) => {
        if (success) {
          this._initialized = true;
        }
      });
    }
  }

  /**
   * Render an option set header
   * @param optionSetName The name of the EditorOptionsSet.
   * @returns A rendered template.
   */
  protected _renderOptionSetHeader(
    optionSetName: string,
    titleClass?: string,
  ): TemplateResult {
    const optionSet = options[optionSetName];

    return html`
      <div
        class="option option-${optionSetName}"
        @click=${this._toggleMenu}
        .domain=${'options'}
        .key=${optionSetName}
      >
        <div class="row">
          <advanced-camera-card-icon
            .icon=${{ icon: `mdi:${optionSet.icon}` }}
          ></advanced-camera-card-icon>
          <div class="title ${titleClass ?? ''}">${optionSet.name}</div>
        </div>
        <div class="secondary">${optionSet.secondary}</div>
      </div>
    `;
  }

  /**
   * Get a localized help label for a given config path.
   * @param configPath The config path.
   * @returns A localized label.
   */
  protected _getLabel(configPath: string): string {
    // Strip out array indices from the path.
    const path = configPath
      .split('.')
      .filter((e) => !e.match(/^\[[0-9]+\]$/))
      .join('.');
    return localize(`config.${path}`);
  }

  /**
   * Render an entity selector.
   * @param configPath The configuration path to set/read.
   * @param domain Only entities from this domain will be shown.
   * @returns A rendered template.
   */
  protected _renderEntitySelector(
    configPath: string,
    domain: string,
  ): TemplateResult | void {
    if (!this._config) {
      return;
    }

    return html`
      <ha-selector
        .hass=${this.hass}
        .selector=${{ entity: { domain: domain } }}
        .label=${this._getLabel(configPath)}
        .value=${getConfigValue(this._config, configPath, '')}
        .required=${false}
        @value-changed=${(ev) => this._valueChangedHandler(configPath, ev)}
      >
      </ha-selector>
    `;
  }

  /**
   * Render an option/"select" selector.
   * @param configPath The configuration path to set/read.
   * @param options The options to show in the selector.
   * @param params Option parameters to control the selector.
   * @returns A rendered template.
   */
  protected _renderOptionSelector(
    configPath: string,
    options: string[] | { value: unknown; label: string }[] = [],
    params?: {
      multiple?: boolean;
      label?: string;
    },
  ): TemplateResult | void {
    if (!this._config) {
      return;
    }

    return html`
      <ha-selector
        .hass=${this.hass}
        .selector=${{
          select: {
            mode: 'dropdown',
            multiple: !!params?.multiple,
            custom_value: !options.length,
            options: options,
          },
        }}
        .label=${params?.label || this._getLabel(configPath)}
        .value=${getConfigValue(this._config, configPath, '')}
        .required=${false}
        @value-changed=${(ev) => this._valueChangedHandler(configPath, ev)}
      >
      </ha-selector>
    `;
  }

  /**
   * Render an icon selector.
   * @param configPath The configuration path to set/read.
   * @param params Optional parameters to control the selector.
   * @returns A rendered template.
   */
  protected _renderIconSelector(
    configPath: string,
    params?: {
      label?: string;
    },
  ): TemplateResult | void {
    if (!this._config) {
      return;
    }

    return html`
      <ha-selector
        .hass=${this.hass}
        .selector=${{
          icon: {},
        }}
        .label=${params?.label || this._getLabel(configPath)}
        .value=${getConfigValue(this._config, configPath, '')}
        .required=${false}
        @value-changed=${(ev) => this._valueChangedHandler(configPath, ev)}
      >
      </ha-selector>
    `;
  }

  /**
   * Render a number slider.
   * @param configPath Configuration path of the variable.
   * @param params Optional parameters to control the selector.
   * @returns A rendered template.
   */
  protected _renderNumberInput(
    configPath: string,
    params?: {
      min?: number;
      max?: number;
      label?: string;
      default?: number;
      step?: number;
    },
  ): TemplateResult | void {
    if (!this._config) {
      return;
    }
    const value = getConfigValue(this._config, configPath);
    const mode = params?.max === undefined ? 'box' : 'slider';

    return html`
      <ha-selector
        .hass=${this.hass}
        .selector=${{
          number: {
            min: params?.min || 0,
            max: params?.max,
            mode: mode,
            step: params?.step,
          },
        }}
        .label=${params?.label || this._getLabel(configPath)}
        .value=${value ?? params?.default}
        .required=${false}
        @value-changed=${(ev) => this._valueChangedHandler(configPath, ev)}
      >
      </ha-selector>
    `;
  }

  /**
   * Render a simple text info box.
   * @param info The string to display.
   * @returns A rendered template.
   */
  protected _renderInfo(info: string): TemplateResult {
    return html` <span class="info">${info}</span>`;
  }

  /**
   * Get an editor title for the camera.
   * @param cameraIndex The index of the camera in the cameras array.
   * @param cameraConfig The raw camera configuration object.
   * @returns A string title.
   */
  protected _getEditorCameraTitle(
    cameraIndex: number,
    cameraConfig: RawAdvancedCameraCardConfig,
  ): string {
    // Attempt to render a recognizable name for the camera, starting with the
    // most likely to be useful and working our ways towards the least useful.
    // This is only used for the editor since the card itself can use the
    // cameraManager.
    return (
      (typeof cameraConfig?.title === 'string' && cameraConfig.title) ||
      (typeof cameraConfig?.camera_entity === 'string'
        ? getEntityTitle(this.hass, cameraConfig.camera_entity)
        : '') ||
      (typeof cameraConfig?.webrtc_card === 'object' &&
        cameraConfig.webrtc_card &&
        typeof cameraConfig.webrtc_card['entity'] === 'string' &&
        cameraConfig.webrtc_card['entity']) ||
      // Usage of engine specific logic here is allowed as an exception, since
      // the camera manager cannot be started with an unparsed and unloaded
      // config.
      (typeof cameraConfig?.frigate === 'object' &&
      cameraConfig.frigate &&
      typeof cameraConfig?.frigate['camera_name'] === 'string' &&
      cameraConfig.frigate['camera_name']
        ? prettifyTitle(cameraConfig.frigate['camera_name'])
        : '') ||
      (typeof cameraConfig?.id === 'string' && cameraConfig.id) ||
      localize('editor.camera') + ' #' + cameraIndex
    );
  }

  protected _renderViewDefaultResetMenu(): TemplateResult {
    return this._putInSubmenu(
      MENU_VIEW_DEFAULT_RESET,
      true,
      `config.${CONF_VIEW_DEFAULT_RESET}.editor_label`,
      'mdi:restart',
      html`
        ${this._renderSwitch(
          CONF_VIEW_DEFAULT_RESET_AFTER_INTERACTION,
          this._defaults.view.default_reset.after_interaction,
        )}
        ${this._renderNumberInput(CONF_VIEW_DEFAULT_RESET_EVERY_SECONDS)}
        ${this._renderOptionSelector(
          CONF_VIEW_DEFAULT_RESET_INTERACTION_MODE,
          this._defaultResetInteractionModes,
          {
            label: localize('config.view.default_reset.interaction_mode'),
          },
        )},
        ${this._renderOptionSelector(
          CONF_VIEW_DEFAULT_RESET_ENTITIES,
          this.hass ? getEntitiesFromHASS(this.hass) : [],
          {
            multiple: true,
          },
        )}
      `,
    );
  }

  protected _renderViewTriggersMenu(): TemplateResult {
    return this._putInSubmenu(
      MENU_VIEW_TRIGGERS,
      true,
      `config.${CONF_VIEW_TRIGGERS}.editor_label`,
      'mdi:target-account',
      html`
        ${this._renderSwitch(
          CONF_VIEW_TRIGGERS_FILTER_SELECTED_CAMERA,
          this._defaults.view.triggers.filter_selected_camera,
          {
            label: localize(`config.${CONF_VIEW_TRIGGERS_FILTER_SELECTED_CAMERA}`),
          },
        )}
        ${this._renderSwitch(
          CONF_VIEW_TRIGGERS_SHOW_TRIGGER_STATUS,
          this._defaults.view.triggers.show_trigger_status,
          {
            label: localize(`config.${CONF_VIEW_TRIGGERS_SHOW_TRIGGER_STATUS}`),
          },
        )}
        ${this._renderNumberInput(CONF_VIEW_TRIGGERS_UNTRIGGER_SECONDS, {
          default: this._defaults.view.triggers.untrigger_seconds,
        })}
        ${this._putInSubmenu(
          MENU_VIEW_TRIGGERS_ACTIONS,
          true,
          `config.${CONF_VIEW_TRIGGERS_ACTIONS}.editor_label`,
          'mdi:cogs',
          html` ${this._renderOptionSelector(
            CONF_VIEW_TRIGGERS_ACTIONS_TRIGGER,
            this._triggersActionsTrigger,
            {
              label: localize('config.view.triggers.actions.trigger'),
            },
          )}
          ${this._renderOptionSelector(
            CONF_VIEW_TRIGGERS_ACTIONS_UNTRIGGER,
            this._triggersActionsUntrigger,
            {
              label: localize('config.view.triggers.actions.untrigger'),
            },
          )}
          ${this._renderOptionSelector(
            CONF_VIEW_TRIGGERS_ACTIONS_INTERACTION_MODE,
            this._triggersActionsInteractionModes,
            {
              label: localize('config.view.triggers.actions.interaction_mode'),
            },
          )}`,
        )}
      `,
    );
  }

  protected _renderKeyAssigner(
    configPath: string,
    defaultValue: KeyboardShortcut,
  ): TemplateResult {
    return html` <advanced-camera-card-key-assigner
      .label=${localize(`config.${configPath}`)}
      .value=${this._config
        ? getConfigValue(this._config, configPath, defaultValue)
        : null}
      @value-changed=${(ev) => this._valueChangedHandler(configPath, ev)}
    ></advanced-camera-card-key-assigner>`;
  }

  protected _renderViewKeyboardShortcutMenu(): TemplateResult {
    return this._putInSubmenu(
      MENU_VIEW_KEYBOARD_SHORTCUTS,
      true,
      `config.${CONF_VIEW_KEYBOARD_SHORTCUTS}.editor_label`,
      'mdi:keyboard',
      html`
        ${this._renderSwitch(
          CONF_VIEW_KEYBOARD_SHORTCUTS_ENABLED,
          this._defaults.view.keyboard_shortcuts.enabled,
          {
            label: localize(`config.${CONF_VIEW_KEYBOARD_SHORTCUTS_ENABLED}`),
          },
        )}
        ${this._renderKeyAssigner(
          CONF_VIEW_KEYBOARD_SHORTCUTS_PTZ_LEFT,
          this._defaults.view.keyboard_shortcuts.ptz_left,
        )}
        ${this._renderKeyAssigner(
          CONF_VIEW_KEYBOARD_SHORTCUTS_PTZ_RIGHT,
          this._defaults.view.keyboard_shortcuts.ptz_right,
        )}
        ${this._renderKeyAssigner(
          CONF_VIEW_KEYBOARD_SHORTCUTS_PTZ_UP,
          this._defaults.view.keyboard_shortcuts.ptz_up,
        )}
        ${this._renderKeyAssigner(
          CONF_VIEW_KEYBOARD_SHORTCUTS_PTZ_DOWN,
          this._defaults.view.keyboard_shortcuts.ptz_down,
        )}
        ${this._renderKeyAssigner(
          CONF_VIEW_KEYBOARD_SHORTCUTS_PTZ_ZOOM_IN,
          this._defaults.view.keyboard_shortcuts.ptz_zoom_in,
        )}
        ${this._renderKeyAssigner(
          CONF_VIEW_KEYBOARD_SHORTCUTS_PTZ_ZOOM_OUT,
          this._defaults.view.keyboard_shortcuts.ptz_zoom_out,
        )}
        ${this._renderKeyAssigner(
          CONF_VIEW_KEYBOARD_SHORTCUTS_PTZ_HOME,
          this._defaults.view.keyboard_shortcuts.ptz_home,
        )}
      `,
    );
  }

  protected _renderStatusBarItem(item: string): TemplateResult {
    return html` ${this._putInSubmenu(
      MENU_STATUS_BAR_ITEMS,
      item,
      `config.status_bar.items.${item}`,
      'mdi:feature-search',
      html`
        ${this._renderSwitch(
          `${CONF_STATUS_BAR_ITEMS}.${item}.enabled`,
          this._defaults.status_bar.items[item]?.enabled ?? true,
          {
            label: localize('config.status_bar.items.enabled'),
          },
        )}
        ${this._renderNumberInput(`${CONF_STATUS_BAR_ITEMS}.${item}.priority`, {
          max: STATUS_BAR_PRIORITY_MAX,
          default: this._defaults.status_bar.items[item]?.priority,
          label: localize('config.status_bar.items.priority'),
        })}
      `,
    )}`;
  }

  protected _renderMenuButton(
    button: string,
    additionalOptions?: TemplateResult,
  ): TemplateResult {
    const menuButtonAlignments: EditorSelectOption[] = [
      { value: '', label: '' },
      { value: 'matching', label: localize('config.menu.buttons.alignments.matching') },
      { value: 'opposing', label: localize('config.menu.buttons.alignments.opposing') },
    ];

    return html` ${this._putInSubmenu(
      MENU_MENU_BUTTONS,
      button,
      `config.menu.buttons.${button}`,
      'mdi:gesture-tap-button',
      html`
        ${this._renderSwitch(
          `${CONF_MENU_BUTTONS}.${button}.enabled`,
          this._defaults.menu.buttons[button]?.enabled ?? true,
          {
            label: localize('config.menu.buttons.enabled'),
          },
        )}
        ${this._renderOptionSelector(
          `${CONF_MENU_BUTTONS}.${button}.alignment`,
          menuButtonAlignments,
          {
            label: localize('config.menu.buttons.alignment'),
          },
        )}
        ${this._renderSwitch(
          `${CONF_MENU_BUTTONS}.${button}.permanent`,
          this._defaults.menu.buttons[button]?.permanent ?? false,
          {
            label: localize('config.menu.buttons.permanent'),
          },
        )}
        ${this._renderNumberInput(`${CONF_MENU_BUTTONS}.${button}.priority`, {
          max: MENU_PRIORITY_MAX,
          default: this._defaults.menu.buttons[button]?.priority,
          label: localize('config.menu.buttons.priority'),
        })}
        ${this._renderIconSelector(`${CONF_MENU_BUTTONS}.${button}.icon`, {
          label: localize('config.menu.buttons.icon'),
        })}
        ${additionalOptions}
      `,
    )}`;
  }

  /**
   * Put a given rendered template into a submenu.
   * @param domain The submenu domain.
   * @param key The submenu key.
   * @param icon The icon for the submenu.
   * @param labelPath The path to the label to localize.
   * @param template The template to put in the submenu.
   * @returns
   */
  protected _putInSubmenu(
    domain: string,
    key: unknown,
    labelPath: string,
    icon: string,
    template: TemplateResult,
  ): TemplateResult {
    const selected = this._expandedMenus[domain] === key;
    const submenuClasses = {
      submenu: true,
      selected: selected,
    };

    return html` <div class="${classMap(submenuClasses)}">
      <div
        class="submenu-header"
        @click=${this._toggleMenu}
        .domain=${domain}
        .key=${key}
      >
        <advanced-camera-card-icon .icon=${{ icon: icon }}></advanced-camera-card-icon>
        <span>${localize(labelPath)}</span>
      </div>
      ${selected ? html`<div class="values">${template}</div>` : ''}
    </div>`;
  }

  /**
   * Render a media layout section.
   * @param domain The submenu domain.
   * @param labelPath The path to the label.
   * @param configPathFit The path to the fit config.
   * @param configPathPositionX The path to the position.x config.
   * @param configPathPositionY The path to the position.y config.
   * @returns A rendered template.
   */
  protected _renderMediaLayout(
    domain: string,
    labelPath: string,
    configPathFit: string,
    configPathPositionX: string,
    configPathPositionY: string,
    configPathViewBoxTop: string,
    configPathViewBoxBottom: string,
    configPathViewBoxLeft: string,
    configPathViewBoxRight: string,
    configPathZoom: string,
    configPathPanX: string,
    configPathPanY: string,
  ): TemplateResult | void {
    return this._putInSubmenu(
      domain,
      true,
      labelPath,
      'mdi:page-layout-body',
      html`
        ${this._renderNumberInput(configPathZoom, {
          min: ZOOM_MIN,
          max: ZOOM_MAX,
          label: localize('config.cameras.dimensions.layout.zoom'),
          step: 0.1,
        })}
        ${this._renderNumberInput(configPathPanX, {
          min: 0,
          max: 100,
          label: localize('config.cameras.dimensions.layout.pan.x'),
        })}
        ${this._renderNumberInput(configPathPanY, {
          min: 0,
          max: 100,
          label: localize('config.cameras.dimensions.layout.pan.y'),
        })}
        ${this._renderOptionSelector(configPathFit, this._layoutFits, {
          label: localize('config.cameras.dimensions.layout.fit'),
        })}
        ${this._putInSubmenu(
          `${domain}.position`,
          true,
          'config.cameras.dimensions.layout.position.editor_label',
          'mdi:aspect-ratio',
          html` ${this._renderNumberInput(configPathPositionX, {
            min: 0,
            max: 100,
            label: localize('config.cameras.dimensions.layout.position.x'),
          })}
          ${this._renderNumberInput(configPathPositionY, {
            min: 0,
            max: 100,
            label: localize('config.cameras.dimensions.layout.position.y'),
          })}`,
        )}
        ${this._putInSubmenu(
          `${domain}.view_box`,
          true,
          'config.cameras.dimensions.layout.view_box.editor_label',
          'mdi:crop',
          html`
            ${this._renderNumberInput(configPathViewBoxTop, {
              min: 0,
              max: 100,
              label: localize('config.cameras.dimensions.layout.view_box.top'),
            })}
            ${this._renderNumberInput(configPathViewBoxBottom, {
              min: 0,
              max: 100,
              label: localize('config.cameras.dimensions.layout.view_box.bottom'),
            })}
            ${this._renderNumberInput(configPathViewBoxLeft, {
              min: 0,
              max: 100,
              label: localize('config.cameras.dimensions.layout.view_box.left'),
            })}
            ${this._renderNumberInput(configPathViewBoxRight, {
              min: 0,
              max: 100,
              label: localize('config.cameras.dimensions.layout.view_box.right'),
            })}
          `,
        )}
      `,
    );
  }

  /**
   * Render the core timeline controls (mini or full timeline),
   * @param configPathStyle Timeline style config path.
   * @param configPathWindowSeconds Timeline window config path.
   * @param configPathClusteringThreshold Clustering threshold config path.
   * @param configPathTimelineEventsMediaType Timeline media config path.
   * @param configPathShowRecordings Show recordings config path.
   * @param defaultShowRecordings Default value of show_recordings.
   * @returns A rendered template.
   */
  protected _renderTimelineCoreControls(
    domain: string,
    configPathStyle: string,
    configPathWindowSeconds: string,
    configPathClusteringThreshold: string,
    configPathTimelineEventsMediaType: string,
    configPathShowRecordings: string,
    configPathFormat24h: string,
    defaultShowRecordings: boolean,
    defaultFormat24h: boolean,
    configPathPanMode?: string,
  ): TemplateResult {
    return html`
      ${this._renderOptionSelector(configPathStyle, this._timelineStyleTypes, {
        label: localize(`config.common.${CONF_TIMELINE_STYLE}`),
      })}
      ${configPathPanMode
        ? this._renderOptionSelector(configPathPanMode, this._timelinePanModes, {
            label: localize(`config.common.controls.timeline.pan_mode`),
          })
        : ``}
      ${this._renderNumberInput(configPathWindowSeconds, {
        label: localize(`config.common.${CONF_TIMELINE_WINDOW_SECONDS}`),
      })}
      ${this._renderNumberInput(configPathClusteringThreshold, {
        label: localize(`config.common.${CONF_TIMELINE_CLUSTERING_THRESHOLD}`),
      })}
      ${this._renderOptionSelector(
        configPathTimelineEventsMediaType,
        this._timelineEventsMediaTypes,
        {
          label: localize(`config.common.${CONF_TIMELINE_EVENTS_MEDIA_TYPE}`),
        },
      )}
      ${this._renderSwitch(configPathShowRecordings, defaultShowRecordings, {
        label: localize(`config.common.${CONF_TIMELINE_SHOW_RECORDINGS}`),
      })}
      ${this._putInSubmenu(
        `${domain}.format`,
        true,
        'config.common.controls.timeline.format.editor_label',
        'mdi:clock-edit',
        html`
          ${this._renderSwitch(configPathFormat24h, defaultFormat24h, {
            label: localize('config.common.controls.timeline.format.24h'),
          })}
        `,
      )}
    `;
  }

  /**
   * Render the mini timeline controls.
   * @param domain The submenu domain.
   * @param configPathWindowSeconds Timeline window config path.
   * @param configPathClusteringThreshold Clustering threshold config path.
   * @param configPathTimelineEventsMediaType Timeline media config path.
   * @param configPathShowRecordings Show recordings config path.
   * @returns A rendered template.
   */
  protected _renderMiniTimeline(
    domain: string,
    configPathMode: string,
    configPathStyle: string,
    configPathWindowSeconds: string,
    configPathClusteringThreshold: string,
    configPathTimelineEventsMediaType: string,
    configPathShowRecordings: string,
    configPathFormat24h: string,
    defaultShowRecordings: boolean,
    defaultFormat24h: boolean,
    configPathPanMode: string,
  ): TemplateResult | void {
    return this._putInSubmenu(
      domain,
      true,
      'config.common.controls.timeline.editor_label',
      'mdi:chart-gantt',
      html` ${this._renderOptionSelector(configPathMode, this._miniTimelineModes, {
        label: localize('config.common.controls.timeline.mode'),
      })}
      ${this._renderTimelineCoreControls(
        domain,
        configPathStyle,
        configPathWindowSeconds,
        configPathClusteringThreshold,
        configPathTimelineEventsMediaType,
        configPathShowRecordings,
        configPathFormat24h,
        defaultShowRecordings,
        defaultFormat24h,
        configPathPanMode,
      )}`,
    );
  }

  /**
   * Render the next & previous controls.
   * @param domain The submenu domain.
   * @param configPathStyle Next previous style config path.
   * @param configPathSize Next previous size config path.
   * @returns A rendered template.
   */
  protected _renderViewDisplay(
    domain: string,
    configPathMode: string,
    configPathSelectedWidthFactor: string,
    configPathColumns: string,
    configPathMaxColumns: string,
  ): TemplateResult | void {
    // grid_select_width_factor: z.number().min(0).optional(),
    // grid_max_columns: z.number().min(0).optional(),
    // grid_columns: z.number().min(0).optional(),

    return this._putInSubmenu(
      domain,
      true,
      'config.common.display.editor_label',
      'mdi:palette-swatch',
      html`
        ${this._renderOptionSelector(configPathMode, this._displayModes, {
          label: localize('config.common.display.mode'),
        })}
        ${this._renderNumberInput(configPathSelectedWidthFactor, {
          min: 0,
          label: localize('config.common.display.grid_selected_width_factor'),
        })}
        ${this._renderNumberInput(configPathColumns, {
          min: 0,
          label: localize('config.common.display.grid_columns'),
        })}
        ${this._renderNumberInput(configPathMaxColumns, {
          min: 0,
          label: localize('config.common.display.grid_max_columns'),
        })}
      `,
    );
  }

  /**
   * Render the next & previous controls.
   * @param domain The submenu domain.
   * @param configPathStyle Next previous style config path.
   * @param configPathSize Next previous size config path.
   * @returns A rendered template.
   */
  protected _renderNextPreviousControls(
    domain: string,
    configPathStyle: string,
    configPathSize: string,
    options?: {
      allowIcons?: boolean;
      allowThumbnails?: boolean;
    },
  ): TemplateResult | void {
    return this._putInSubmenu(
      domain,
      true,
      'config.common.controls.next_previous.editor_label',
      'mdi:arrow-right-bold-circle',
      html`
        ${this._renderOptionSelector(
          configPathStyle,
          this._nextPreviousControlStyles.filter(
            (item) =>
              (!!options?.allowThumbnails || item.value !== 'thumbnails') &&
              (!!options?.allowIcons || item.value !== 'icons'),
          ),
          {
            label: localize('config.common.controls.next_previous.style'),
          },
        )}
        ${this._renderNumberInput(configPathSize, {
          min: BUTTON_SIZE_MIN,
          label: localize('config.common.controls.next_previous.size'),
        })}
      `,
    );
  }

  /**
   * Render the thumbnails controls.
   * @param domain The submenu domain.
   * @param configPathMode Thumbnails mode config path.
   * @param configPathSize Thumbnails size config path.
   * @param configPathShowDetails Thumbnails show details config path.
   * @param configPathShowFavoriteControl Thumbnails show favorite control config path.
   * @param configPathShowTimelineControl Thumbnails show timeline control config path,
   * @param options An optional config path to media selection and mini-timeline mode.
   * @returns A rendered template.
   */
  protected _renderThumbnailsControls(
    domain: string,
    configPathSize: string,
    configPathShowDetails: string,
    configPathShowFavoriteControl: string,
    configPathShowTimelineControl: string,
    configPathShowDownloadControl: string,
    defaults: {
      show_details: boolean;
      show_favorite_control: boolean;
      show_timeline_control: boolean;
      show_download_control: boolean;
    },
    options?: {
      configPathMediaType?: string;
      configPathEventsMediaType?: string;
      configPathMode?: string;
    },
  ): TemplateResult | void {
    return this._putInSubmenu(
      domain,
      true,
      'config.common.controls.thumbnails.editor_label',
      'mdi:image-text',
      html`
        ${options?.configPathMode
          ? html`${this._renderOptionSelector(
              options.configPathMode,
              this._thumbnailModes,
              {
                label: localize('config.common.controls.thumbnails.mode'),
              },
            )}`
          : html``}
        ${options?.configPathMediaType
          ? html`${this._renderOptionSelector(
              options.configPathMediaType,
              this._thumbnailMediaTypes,
              {
                label: localize('config.common.controls.thumbnails.media_type'),
              },
            )}`
          : html``}
        ${options?.configPathEventsMediaType
          ? html`${this._renderOptionSelector(
              options.configPathEventsMediaType,
              this._thumbnailEventsMediaTypes,
              {
                label: localize('config.common.controls.thumbnails.events_media_type'),
              },
            )}`
          : html``}
        ${this._renderNumberInput(configPathSize, {
          min: THUMBNAIL_WIDTH_MIN,
          max: THUMBNAIL_WIDTH_MAX,
          label: localize('config.common.controls.thumbnails.size'),
        })}
        ${this._renderSwitch(configPathShowDetails, defaults.show_details, {
          label: localize('config.common.controls.thumbnails.show_details'),
        })}
        ${this._renderSwitch(
          configPathShowFavoriteControl,
          defaults.show_favorite_control,
          {
            label: localize('config.common.controls.thumbnails.show_favorite_control'),
          },
        )}
        ${this._renderSwitch(
          configPathShowTimelineControl,
          defaults.show_timeline_control,
          {
            label: localize('config.common.controls.thumbnails.show_timeline_control'),
          },
        )}
        ${this._renderSwitch(
          configPathShowDownloadControl,
          defaults.show_download_control,
          {
            label: localize('config.common.controls.thumbnails.show_download_control'),
          },
        )}
      `,
    );
  }

  /**
   * Render the thumbnails controls.
   * @param domain The submenu domain.
   * @param configPathMode Filter mode config path.
   * @returns A rendered template.
   */
  protected _renderFilterControls(
    domain: string,
    configPathMode: string,
  ): TemplateResult | void {
    return this._putInSubmenu(
      domain,
      true,
      'config.common.controls.filter.editor_label',
      'mdi:filter-cog',
      html`
        ${configPathMode
          ? html`${this._renderOptionSelector(configPathMode, this._filterModes, {
              label: localize('config.common.controls.filter.mode'),
            })}`
          : html``}
      `,
    );
  }

  protected _renderImageOptions(
    configPathMode: string,
    configPathUrl: string,
    configPathEntity: string,
    configPathEntityParameters: string,
    configPathRefreshSeconds: string,
  ): TemplateResult {
    return html`
      ${this._renderOptionSelector(configPathMode, this._imageModes, {
        label: localize('config.common.image.mode'),
      })}
      ${this._renderStringInput(configPathUrl, {
        label: localize('config.common.image.url'),
      })}
      ${this._renderOptionSelector(
        configPathEntity,
        this.hass ? getEntitiesFromHASS(this.hass) : [],
        {
          label: localize('config.common.image.entity'),
        },
      )}
      ${this._renderStringInput(configPathEntityParameters, {
        label: localize('config.common.image.entity_parameters'),
      })}
      ${this._renderNumberInput(configPathRefreshSeconds, {
        label: localize('config.common.image.refresh_seconds'),
      })}
    `;
  }

  /**
   * Render a camera section.
   * @param cameras The full array of cameras.
   * @param cameraIndex The index (in the array) to render.
   * @param addNewCamera Whether or not this is a section to add a new non-existent camera.
   * @returns A rendered template.
   */
  protected _renderCamera(
    cameras: RawAdvancedCameraCardConfigArray,
    cameraIndex: number,
    entities: string[],
    addNewCamera?: boolean,
  ): TemplateResult | void {
    const liveProviders: EditorSelectOption[] = [
      { value: '', label: '' },
      { value: 'auto', label: localize('config.cameras.live_providers.auto') },
      { value: 'ha', label: localize('config.cameras.live_providers.ha') },
      {
        value: 'image',
        label: localize('config.cameras.live_providers.image'),
      },
      {
        value: 'jsmpeg',
        label: localize('config.cameras.live_providers.jsmpeg'),
      },
      {
        value: 'go2rtc',
        label: localize('config.cameras.live_providers.go2rtc'),
      },
      {
        value: 'webrtc-card',
        label: localize('config.cameras.live_providers.webrtc-card'),
      },
    ];

    const dependentCameras: EditorSelectOption[] = [];
    cameras.forEach((camera, index) => {
      if (index !== cameraIndex) {
        dependentCameras.push({
          value: getCameraID(camera),
          label: this._getEditorCameraTitle(index, camera),
        });
      }
    });

    // Make a new config and update the editor with changes on it,
    const modifyConfig = (
      func: (config: RawAdvancedCameraCardConfig) => boolean,
    ): void => {
      if (this._config) {
        const newConfig = copyConfig(this._config);
        if (func(newConfig)) {
          this._updateConfig(newConfig);
        }
      }
    };

    const submenuClasses = {
      submenu: true,
      selected: this._expandedMenus[MENU_CAMERAS] === cameraIndex,
    };

    return html`
      <div class="${classMap(submenuClasses)}">
        <div
          class="submenu-header"
          @click=${this._toggleMenu}
          .domain=${MENU_CAMERAS}
          .key=${cameraIndex}
        >
          <advanced-camera-card-icon
            .icon=${{ icon: addNewCamera ? 'mdi:video-plus' : 'mdi:video' }}
          ></advanced-camera-card-icon>
          <span>
            ${addNewCamera
              ? html` <span class="new-camera">
                  [${localize('editor.add_new_camera')}...]
                </span>`
              : html`<span
                  >${this._getEditorCameraTitle(
                    cameraIndex,
                    cameras[cameraIndex] || {},
                  )}</span
                >`}
          </span>
        </div>
        ${this._expandedMenus[MENU_CAMERAS] === cameraIndex
          ? html` <div class="values">
              <div class="controls">
                <ha-icon-button
                  .label=${localize('editor.move_up')}
                  .disabled=${addNewCamera ||
                  !this._config ||
                  !Array.isArray(this._config.cameras) ||
                  cameraIndex <= 0}
                  @click=${() =>
                    !addNewCamera &&
                    modifyConfig((config: RawAdvancedCameraCardConfig): boolean => {
                      if (Array.isArray(config.cameras) && cameraIndex > 0) {
                        arrayMove(config.cameras, cameraIndex, cameraIndex - 1);
                        this._openMenu(MENU_CAMERAS, cameraIndex - 1);
                        return true;
                      }
                      return false;
                    })}
                >
                  <advanced-camera-card-icon
                    .icon=${{ icon: 'mdi:arrow-up' }}
                  ></advanced-camera-card-icon>
                </ha-icon-button>
                <ha-icon-button
                  .label=${localize('editor.move_down')}
                  .disabled=${addNewCamera ||
                  !this._config ||
                  !Array.isArray(this._config.cameras) ||
                  cameraIndex >= this._config.cameras.length - 1}
                  @click=${() =>
                    !addNewCamera &&
                    modifyConfig((config: RawAdvancedCameraCardConfig): boolean => {
                      if (
                        Array.isArray(config.cameras) &&
                        cameraIndex < config.cameras.length - 1
                      ) {
                        arrayMove(config.cameras, cameraIndex, cameraIndex + 1);
                        this._openMenu(MENU_CAMERAS, cameraIndex + 1);
                        return true;
                      }
                      return false;
                    })}
                >
                  <advanced-camera-card-icon
                    .icon=${{ icon: 'mdi:arrow-down' }}
                  ></advanced-camera-card-icon>
                </ha-icon-button>
                <ha-icon-button
                  .label=${localize('editor.delete')}
                  .disabled=${addNewCamera}
                  @click=${() => {
                    modifyConfig((config: RawAdvancedCameraCardConfig): boolean => {
                      if (Array.isArray(config.cameras)) {
                        config.cameras.splice(cameraIndex, 1);
                        this._closeMenu(MENU_CAMERAS);
                        return true;
                      }
                      return false;
                    });
                  }}
                >
                  <advanced-camera-card-icon
                    .icon=${{ icon: 'mdi:delete' }}
                  ></advanced-camera-card-icon>
                </ha-icon-button>
              </div>
              ${this._renderEntitySelector(
                getArrayConfigPath(CONF_CAMERAS_ARRAY_CAMERA_ENTITY, cameraIndex),
                'camera',
              )}
              ${this._renderOptionSelector(
                getArrayConfigPath(CONF_CAMERAS_ARRAY_LIVE_PROVIDER, cameraIndex),
                liveProviders,
              )}
              ${this._renderStringInput(
                getArrayConfigPath(CONF_CAMERAS_ARRAY_TITLE, cameraIndex),
              )}
              ${this._renderIconSelector(
                getArrayConfigPath(CONF_CAMERAS_ARRAY_ICON, cameraIndex),
                {
                  label: localize('config.cameras.icon'),
                },
              )}
              ${this._renderStringInput(
                getArrayConfigPath(CONF_CAMERAS_ARRAY_ID, cameraIndex),
              )}
              ${this._renderSwitch(
                getArrayConfigPath(
                  CONF_CAMERAS_ARRAY_ALWAYS_ERROR_IF_ENTITY_UNAVAILABLE,
                  cameraIndex,
                ),
                this._defaults.cameras.always_error_if_entity_unavailable,
              )}
              ${this._putInSubmenu(
                MENU_CAMERAS_ENGINE,
                true,
                'config.cameras.engines.editor_label',
                'mdi:engine',
                html`${this._putInSubmenu(
                  MENU_CAMERAS_FRIGATE,
                  cameraIndex,
                  'config.cameras.frigate.editor_label',
                  'frigate',
                  html`
                    ${this._renderStringInput(
                      getArrayConfigPath(
                        CONF_CAMERAS_ARRAY_FRIGATE_CAMERA_NAME,
                        cameraIndex,
                      ),
                    )}
                    ${this._renderStringInput(
                      getArrayConfigPath(CONF_CAMERAS_ARRAY_FRIGATE_URL, cameraIndex),
                    )}
                    ${this._renderOptionSelector(
                      getArrayConfigPath(CONF_CAMERAS_ARRAY_FRIGATE_LABELS, cameraIndex),
                      [],
                      {
                        multiple: true,
                        label: localize('config.cameras.frigate.labels'),
                      },
                    )}
                    ${this._renderOptionSelector(
                      getArrayConfigPath(CONF_CAMERAS_ARRAY_FRIGATE_ZONES, cameraIndex),
                      [],
                      {
                        multiple: true,
                        label: localize('config.cameras.frigate.zones'),
                      },
                    )}
                    ${this._renderStringInput(
                      getArrayConfigPath(
                        CONF_CAMERAS_ARRAY_FRIGATE_CLIENT_ID,
                        cameraIndex,
                      ),
                    )}
                  `,
                )}
                ${this._putInSubmenu(
                  MENU_CAMERAS_MOTIONEYE,
                  cameraIndex,
                  'config.cameras.motioneye.editor_label',
                  'motioneye',
                  html` ${this._renderStringInput(
                    getArrayConfigPath(CONF_CAMERAS_ARRAY_MOTIONEYE_URL, cameraIndex),
                  )}
                  ${this._renderStringInput(
                    getArrayConfigPath(
                      CONF_CAMERAS_ARRAY_MOTIONEYE_IMAGES_DIRECTORY_PATTERN,
                      cameraIndex,
                    ),
                  )}
                  ${this._renderStringInput(
                    getArrayConfigPath(
                      CONF_CAMERAS_ARRAY_MOTIONEYE_IMAGES_FILE_PATTERN,
                      cameraIndex,
                    ),
                  )}
                  ${this._renderStringInput(
                    getArrayConfigPath(
                      CONF_CAMERAS_ARRAY_MOTIONEYE_MOVIES_DIRECTORY_PATTERN,
                      cameraIndex,
                    ),
                  )}
                  ${this._renderStringInput(
                    getArrayConfigPath(
                      CONF_CAMERAS_ARRAY_MOTIONEYE_MOVIES_FILE_PATTERN,
                      cameraIndex,
                    ),
                  )}`,
                )}
                ${this._putInSubmenu(
                  MENU_CAMERAS_REOLINK,
                  cameraIndex,
                  'config.cameras.reolink.editor_label',
                  'reolink',
                  html` ${this._renderStringInput(
                    getArrayConfigPath(CONF_CAMERAS_ARRAY_REOLINK_URL, cameraIndex),
                  )}
                  ${this._renderOptionSelector(
                    getArrayConfigPath(
                      CONF_CAMERAS_ARRAY_REOLINK_MEDIA_RESOLUTION,
                      cameraIndex,
                    ),
                    this._reolinkMediaResolution,
                    {
                      label: localize(
                        'config.cameras.reolink.media_resolution.editor_label',
                      ),
                    },
                  )}`,
                )}`,
              )}
              ${this._putInSubmenu(
                MENU_CAMERAS_LIVE_PROVIDER,
                true,
                'config.cameras.live_provider_options.editor_label',
                'mdi:cctv',
                html` ${this._putInSubmenu(
                  MENU_CAMERAS_GO2RTC,
                  cameraIndex,
                  'config.cameras.go2rtc.editor_label',
                  'mdi:alpha-g-circle',
                  html`${this._renderOptionSelector(
                    getArrayConfigPath(CONF_CAMERAS_ARRAY_GO2RTC_MODES, cameraIndex),
                    this._go2rtcModes,
                    {
                      multiple: true,
                      label: localize('config.cameras.go2rtc.modes.editor_label'),
                    },
                  )}
                  ${this._renderStringInput(
                    getArrayConfigPath(CONF_CAMERAS_ARRAY_GO2RTC_STREAM, cameraIndex),
                  )}
                  ${this._renderStringInput(
                    getArrayConfigPath(CONF_CAMERAS_ARRAY_GO2RTC_URL, cameraIndex),
                  )} `,
                )}
                ${this._putInSubmenu(
                  MENU_CAMERAS_IMAGE,
                  true,
                  'config.cameras.image.editor_label',
                  'mdi:image',
                  this._renderImageOptions(
                    getArrayConfigPath(CONF_CAMERAS_ARRAY_IMAGE_MODE, cameraIndex),
                    getArrayConfigPath(CONF_CAMERAS_ARRAY_IMAGE_URL, cameraIndex),
                    getArrayConfigPath(CONF_CAMERAS_ARRAY_IMAGE_ENTITY, cameraIndex),
                    getArrayConfigPath(
                      CONF_CAMERAS_ARRAY_IMAGE_ENTITY_PARAMETERS,
                      cameraIndex,
                    ),
                    getArrayConfigPath(
                      CONF_CAMERAS_ARRAY_IMAGE_REFRESH_SECONDS,
                      cameraIndex,
                    ),
                  ),
                )}
                ${this._putInSubmenu(
                  MENU_CAMERAS_WEBRTC_CARD,
                  cameraIndex,
                  'config.cameras.webrtc_card.editor_label',
                  'mdi:webrtc',
                  html`${this._renderEntitySelector(
                    getArrayConfigPath(
                      CONF_CAMERAS_ARRAY_WEBRTC_CARD_ENTITY,
                      cameraIndex,
                    ),
                    'camera',
                  )}
                  ${this._renderStringInput(
                    getArrayConfigPath(CONF_CAMERAS_ARRAY_WEBRTC_CARD_URL, cameraIndex),
                  )}`,
                )}`,
              )}
              ${this._putInSubmenu(
                MENU_CAMERAS_DEPENDENCIES,
                cameraIndex,
                'config.cameras.dependencies.editor_label',
                'mdi:graph',
                html` ${this._renderSwitch(
                  getArrayConfigPath(
                    CONF_CAMERAS_ARRAY_DEPENDENCIES_ALL_CAMERAS,
                    cameraIndex,
                  ),
                  this._defaults.cameras.dependencies.all_cameras,
                )}
                ${this._renderOptionSelector(
                  getArrayConfigPath(
                    CONF_CAMERAS_ARRAY_DEPENDENCIES_CAMERAS,
                    cameraIndex,
                  ),
                  dependentCameras,
                  {
                    multiple: true,
                  },
                )}`,
              )}
              ${this._putInSubmenu(
                MENU_CAMERAS_TRIGGERS,
                cameraIndex,
                'config.cameras.triggers.editor_label',
                'mdi:magnify-scan',
                html`
                  ${this._renderSwitch(
                    getArrayConfigPath(
                      CONF_CAMERAS_ARRAY_TRIGGERS_OCCUPANCY,
                      cameraIndex,
                    ),
                    this._defaults.cameras.triggers.occupancy,
                  )}
                  ${this._renderSwitch(
                    getArrayConfigPath(CONF_CAMERAS_ARRAY_TRIGGERS_MOTION, cameraIndex),
                    this._defaults.cameras.triggers.motion,
                  )}
                  ${this._renderOptionSelector(
                    getArrayConfigPath(
                      CONF_CAMERAS_ARRAY_TRIGGERS_ENTITIES,
                      cameraIndex,
                    ),
                    entities,
                    {
                      multiple: true,
                    },
                  )}
                  ${this._renderOptionSelector(
                    getArrayConfigPath(CONF_CAMERAS_ARRAY_TRIGGERS_EVENTS, cameraIndex),
                    this._triggersEvents,
                    {
                      multiple: true,
                      label: localize('config.cameras.triggers.events.editor_label'),
                    },
                  )}
                `,
              )}
              ${this._putInSubmenu(
                MENU_CAMERAS_CAST,
                cameraIndex,
                'config.cameras.cast.editor_label',
                'mdi:cast',
                html`
                  ${this._renderOptionSelector(
                    getArrayConfigPath(CONF_CAMERAS_ARRAY_CAST_METHOD, cameraIndex),
                    this._castMethods,
                  )}
                  ${this._renderStringInput(
                    getArrayConfigPath(
                      CONF_CAMERAS_ARRAY_CAST_DASHBOARD_DASHBOARD_PATH,
                      cameraIndex,
                    ),
                  )}
                  ${this._renderStringInput(
                    getArrayConfigPath(
                      CONF_CAMERAS_ARRAY_CAST_DASHBOARD_VIEW_PATH,
                      cameraIndex,
                    ),
                  )}
                `,
              )}
              ${this._putInSubmenu(
                MENU_CAMERAS_DIMENSIONS,
                cameraIndex,
                'config.cameras.dimensions.editor_label',
                'mdi:aspect-ratio',
                html`
                  ${this._renderStringInput(
                    getArrayConfigPath(
                      CONF_CAMERAS_ARRAY_DIMENSIONS_ASPECT_RATIO,
                      cameraIndex,
                    ),
                  )}
                  ${this._renderMediaLayout(
                    MENU_CAMERAS_DIMENSIONS_LAYOUT,
                    'config.cameras.dimensions.layout.editor_label',
                    getArrayConfigPath(
                      CONF_CAMERAS_ARRAY_DIMENSIONS_LAYOUT_FIT,
                      cameraIndex,
                    ),
                    getArrayConfigPath(
                      CONF_CAMERAS_ARRAY_DIMENSIONS_LAYOUT_POSITION_X,
                      cameraIndex,
                    ),
                    getArrayConfigPath(
                      CONF_CAMERAS_ARRAY_DIMENSIONS_LAYOUT_POSITION_Y,
                      cameraIndex,
                    ),
                    getArrayConfigPath(
                      CONF_CAMERAS_ARRAY_DIMENSIONS_LAYOUT_VIEW_BOX_TOP,
                      cameraIndex,
                    ),
                    getArrayConfigPath(
                      CONF_CAMERAS_ARRAY_DIMENSIONS_LAYOUT_VIEW_BOX_BOTTOM,
                      cameraIndex,
                    ),
                    getArrayConfigPath(
                      CONF_CAMERAS_ARRAY_DIMENSIONS_LAYOUT_VIEW_BOX_LEFT,
                      cameraIndex,
                    ),
                    getArrayConfigPath(
                      CONF_CAMERAS_ARRAY_DIMENSIONS_LAYOUT_VIEW_BOX_RIGHT,
                      cameraIndex,
                    ),
                    getArrayConfigPath(
                      CONF_CAMERAS_ARRAY_DIMENSIONS_LAYOUT_ZOOM_FACTOR,
                      cameraIndex,
                    ),
                    getArrayConfigPath(
                      CONF_CAMERAS_ARRAY_DIMENSIONS_LAYOUT_PAN_X,
                      cameraIndex,
                    ),
                    getArrayConfigPath(
                      CONF_CAMERAS_ARRAY_DIMENSIONS_LAYOUT_PAN_Y,
                      cameraIndex,
                    ),
                  )}
                `,
              )}
              ${this._putInSubmenu(
                MENU_CAMERAS_CAPABILITIES,
                cameraIndex,
                'config.cameras.capabilities.editor_label',
                'mdi:cog-stop',
                html`
                  ${this._renderOptionSelector(
                    getArrayConfigPath(
                      CONF_CAMERAS_ARRAY_CAPABILITIES_DISABLE,
                      cameraIndex,
                    ),
                    this._capabilities,
                    {
                      multiple: true,
                    },
                  )}
                  ${this._renderOptionSelector(
                    getArrayConfigPath(
                      CONF_CAMERAS_ARRAY_CAPABILITIES_DISABLE_EXCEPT,
                      cameraIndex,
                    ),
                    this._capabilities,
                    {
                      multiple: true,
                    },
                  )}
                `,
              )}
              ${this._putInSubmenu(
                MENU_CAMERAS_PROXY,
                cameraIndex,
                'config.cameras.proxy.editor_label',
                'mdi:arrow-decision',
                html`
                  ${this._renderOptionSelector(
                    getArrayConfigPath(CONF_CAMERAS_ARRAY_PROXY_MEDIA, cameraIndex),
                    this._proxyMedia,
                    {
                      label: localize('config.cameras.proxy.media.editor_label'),
                    },
                  )}
                  ${this._renderSwitch(
                    getArrayConfigPath(CONF_CAMERAS_ARRAY_PROXY_DYNAMIC, cameraIndex),
                    this._defaults.cameras.proxy.dynamic,
                  )}
                  ${this._renderOptionSelector(
                    getArrayConfigPath(
                      CONF_CAMERAS_ARRAY_PROXY_SSL_VERIFICATION,
                      cameraIndex,
                    ),
                    this._proxySSLVerification,
                    {
                      label: localize(
                        'config.cameras.proxy.ssl_verification.editor_label',
                      ),
                    },
                  )}
                  ${this._renderOptionSelector(
                    getArrayConfigPath(
                      CONF_CAMERAS_ARRAY_PROXY_SSL_CIPHERS,
                      cameraIndex,
                    ),
                    this._proxySSLCiphers,
                    {
                      label: localize('config.cameras.proxy.ssl_ciphers.editor_label'),
                    },
                  )}
                `,
              )}
            </div>`
          : ``}
      </div>
    `;
  }

  /**
   * Render a string input field.
   * @param configPath The configuration path to set/read.
   * @param type The allowable input
   * @returns A rendered template.
   */
  protected _renderStringInput(
    configPath: string,
    params?: {
      label?: string;
      type?:
        | 'number'
        | 'text'
        | 'search'
        | 'tel'
        | 'url'
        | 'email'
        | 'password'
        | 'date'
        | 'month'
        | 'week'
        | 'time'
        | 'datetime-local'
        | 'color';
    },
  ): TemplateResult | void {
    if (!this._config) {
      return;
    }

    return html`
      <ha-selector
        .hass=${this.hass}
        .selector=${{ text: { type: params?.type || 'text' } }}
        .label=${params?.label ?? this._getLabel(configPath)}
        .value=${getConfigValue(this._config, configPath, '')}
        .required=${false}
        @value-changed=${(ev) => this._valueChangedHandler(configPath, ev)}
      >
      </ha-selector>
    `;
  }

  /**
   * Render a boolean selector.
   * @param configPath The configuration path to set/read.
   * @param valueDefault The default switch value if unset.
   * @param params Optional parameters to control the selector.
   * @returns A rendered template.
   */
  protected _renderSwitch(
    configPath: string,
    valueDefault: boolean,
    params?: {
      label?: string;
    },
  ): TemplateResult | void {
    if (!this._config) {
      return;
    }

    return html`
      <ha-selector
        .hass=${this.hass}
        .selector=${{ boolean: {} }}
        .label=${params?.label || this._getLabel(configPath)}
        .value=${getConfigValue(this._config, configPath, valueDefault)}
        .required=${false}
        @value-changed=${(ev) => this._valueChangedHandler(configPath, ev)}
      >
      </ha-selector>
    `;
  }

  protected _updateConfig(config: RawAdvancedCameraCardConfig): void {
    this._config = config;
    fireHASSEvent(this, 'config-changed', { config: this._config });
  }

  protected render(): TemplateResult | void {
    if (!this.hass || !this._config) {
      return html``;
    }

    const entities = getEntitiesFromHASS(this.hass);
    const cameras = (getConfigValue(this._config, CONF_CAMERAS) ||
      []) as RawAdvancedCameraCardConfigArray;

    return html`
      ${this._configUpgradeable
        ? html` <div class="upgrade">
              <span>${localize('editor.upgrade_available')}</span>
              <span>
                <mwc-button
                  raised
                  label="${localize('editor.upgrade')}"
                  @click=${() => {
                    if (this._config) {
                      const upgradedConfig = copyConfig(this._config);
                      upgradeConfig(upgradedConfig);
                      this._updateConfig(upgradedConfig);
                    }
                  }}
                >
                </mwc-button>
              </span>
            </div>
            <br />`
        : html``}
      <div class="card-config">
        ${this._renderOptionSetHeader('cameras')}
        ${this._expandedMenus[MENU_OPTIONS] === 'cameras'
          ? html`
              <div class="values">
                ${cameras.map((_, index) =>
                  this._renderCamera(cameras, index, entities),
                )}
                ${this._renderCamera(cameras, cameras.length, entities, true)}
              </div>
            `
          : ''}
        ${this._renderOptionSetHeader('profiles')}
        ${this._expandedMenus[MENU_OPTIONS] === 'profiles'
          ? html` <div class="values">
              ${this._renderOptionSelector(CONF_PROFILES, this._profiles, {
                multiple: true,
                label: localize('config.profiles.editor_label'),
              })}
            </div>`
          : ''}
        ${this._renderOptionSetHeader('view')}
        ${this._expandedMenus[MENU_OPTIONS] === 'view'
          ? html`
              <div class="values">
                ${this._renderOptionSelector(CONF_VIEW_DEFAULT, this._viewModes)}
                ${this._renderOptionSelector(
                  CONF_VIEW_CAMERA_SELECT,
                  this._cameraSelectViewModes,
                )}
                ${this._renderSwitch(CONF_VIEW_DIM, this._defaults.view.dim)}
                ${this._renderNumberInput(CONF_VIEW_INTERACTION_SECONDS)}
                ${this._renderSwitch(
                  CONF_VIEW_DEFAULT_CYCLE_CAMERA,
                  this._defaults.view.default_cycle_camera,
                )}
                ${this._renderViewDefaultResetMenu()} ${this._renderViewTriggersMenu()}
                ${this._renderViewKeyboardShortcutMenu()}
                ${this._renderOptionSelector(CONF_VIEW_THEME_THEMES, this._themes, {
                  label: localize('config.view.theme.themes.editor_label'),
                  multiple: true,
                })}
              </div>
            `
          : ''}
        ${this._renderOptionSetHeader('menu')}
        ${this._expandedMenus[MENU_OPTIONS] === 'menu'
          ? html`
              <div class="values">
                ${this._renderOptionSelector(CONF_MENU_STYLE, this._menuStyles)}
                ${this._renderOptionSelector(CONF_MENU_POSITION, this._menuPositions)}
                ${this._renderOptionSelector(CONF_MENU_ALIGNMENT, this._menuAlignments)}
                ${this._renderNumberInput(CONF_MENU_BUTTON_SIZE, {
                  min: BUTTON_SIZE_MIN,
                })}
                ${this._renderMenuButton('iris') /* */}
                ${this._renderMenuButton('cameras') /* */}
                ${this._renderMenuButton('substreams') /* */}
                ${this._renderMenuButton('live') /* */}
                ${this._renderMenuButton('clips') /* */}
                ${this._renderMenuButton('snapshots')}
                ${this._renderMenuButton('recordings')}
                ${this._renderMenuButton('image') /* */}
                ${this._renderMenuButton('download')}
                ${this._renderMenuButton('camera_ui')}
                ${this._renderMenuButton('fullscreen')}
                ${this._renderMenuButton('expand') /* */}
                ${this._renderMenuButton('timeline')}
                ${this._renderMenuButton('media_player')}
                ${this._renderMenuButton(
                  'microphone',
                  html`${this._renderOptionSelector(
                    `${CONF_MENU_BUTTONS}.microphone.type`,
                    this._microphoneButtonTypes,
                    { label: localize('config.menu.buttons.type') },
                  )}`,
                )}
                ${this._renderMenuButton('play') /*  */}
                ${this._renderMenuButton('mute') /*  */}
                ${this._renderMenuButton('screenshot')}
                ${this._renderMenuButton('display_mode')}
                ${this._renderMenuButton('ptz_controls')}
                ${this._renderMenuButton('ptz_home')}
              </div>
            `
          : ''}
        ${this._renderOptionSetHeader('status_bar')}
        ${this._expandedMenus[MENU_OPTIONS] === 'status_bar'
          ? html`
              <div class="values">
                ${this._renderOptionSelector(
                  CONF_STATUS_BAR_STYLE,
                  this._statusBarStyles,
                )}
                ${this._renderOptionSelector(
                  CONF_STATUS_BAR_POSITION,
                  this._statusBarPositions,
                )}
                ${this._renderNumberInput(CONF_STATUS_BAR_HEIGHT, {
                  min: STATUS_BAR_HEIGHT_MIN,
                  label: localize('config.status_bar.height'),
                })}
                ${this._renderNumberInput(CONF_STATUS_BAR_POPUP_SECONDS, {
                  min: 0,
                  max: 60,
                  default: this._defaults.status_bar.popup_seconds,
                  label: localize('config.status_bar.popup_seconds'),
                })}
                ${this._renderStatusBarItem('title') /* */}
                ${this._renderStatusBarItem('resolution') /* */}
                ${this._renderStatusBarItem('technology') /* */}
                ${this._renderStatusBarItem('engine') /* */}
              </div>
            `
          : ''}
        ${this._renderOptionSetHeader('live')}
        ${this._expandedMenus[MENU_OPTIONS] === 'live'
          ? html`
              <div class="values">
                ${this._renderSwitch(CONF_LIVE_PRELOAD, this._defaults.live.preload)}
                ${this._renderSwitch(CONF_LIVE_DRAGGABLE, this._defaults.live.draggable)}
                ${this._renderSwitch(CONF_LIVE_ZOOMABLE, this._defaults.live.zoomable)}
                ${this._renderSwitch(CONF_LIVE_LAZY_LOAD, this._defaults.live.lazy_load)}
                ${this._renderOptionSelector(
                  CONF_LIVE_LAZY_UNLOAD,
                  this._mediaActionNegativeConditions,
                  {
                    multiple: true,
                  },
                )}
                ${this._renderOptionSelector(
                  CONF_LIVE_AUTO_PLAY,
                  this._mediaActionPositiveConditions,
                  {
                    multiple: true,
                  },
                )}
                ${this._renderOptionSelector(
                  CONF_LIVE_AUTO_PAUSE,
                  this._mediaActionNegativeConditions,
                  {
                    multiple: true,
                  },
                )}
                ${this._renderOptionSelector(
                  CONF_LIVE_AUTO_MUTE,
                  this._mediaLiveMuteConditions,
                  {
                    multiple: true,
                  },
                )}
                ${this._renderOptionSelector(
                  CONF_LIVE_AUTO_UNMUTE,
                  this._mediaLiveUnmuteConditions,
                  {
                    multiple: true,
                  },
                )}
                ${this._renderOptionSelector(
                  CONF_LIVE_TRANSITION_EFFECT,
                  this._transitionEffects,
                )}
                ${this._renderSwitch(
                  CONF_LIVE_SHOW_IMAGE_DURING_LOAD,
                  this._defaults.live.show_image_during_load,
                )}
                ${this._renderViewDisplay(
                  MENU_LIVE_DISPLAY,
                  CONF_LIVE_DISPLAY_MODE,
                  CONF_LIVE_DISPLAY_GRID_SELECTED_WIDTH_FACTOR,
                  CONF_LIVE_DISPLAY_GRID_COLUMNS,
                  CONF_LIVE_DISPLAY_GRID_MAX_COLUMNS,
                )}
                ${this._putInSubmenu(
                  MENU_LIVE_CONTROLS,
                  true,
                  'config.live.controls.editor_label',
                  'mdi:gamepad',
                  html`
                    ${this._renderSwitch(
                      CONF_LIVE_CONTROLS_BUILTIN,
                      this._defaults.live.controls.builtin,
                      {
                        label: localize('config.common.controls.builtin'),
                      },
                    )}
                    ${this._renderNextPreviousControls(
                      MENU_LIVE_CONTROLS_NEXT_PREVIOUS,
                      CONF_LIVE_CONTROLS_NEXT_PREVIOUS_STYLE,
                      CONF_LIVE_CONTROLS_NEXT_PREVIOUS_SIZE,
                      {
                        allowIcons: true,
                      },
                    )}
                    ${this._renderThumbnailsControls(
                      MENU_LIVE_CONTROLS_THUMBNAILS,
                      CONF_LIVE_CONTROLS_THUMBNAILS_SIZE,
                      CONF_LIVE_CONTROLS_THUMBNAILS_SHOW_DETAILS,
                      CONF_LIVE_CONTROLS_THUMBNAILS_SHOW_FAVORITE_CONTROL,
                      CONF_LIVE_CONTROLS_THUMBNAILS_SHOW_TIMELINE_CONTROL,
                      CONF_LIVE_CONTROLS_THUMBNAILS_SHOW_DOWNLOAD_CONTROL,
                      this._defaults.live.controls.thumbnails,
                      {
                        configPathMediaType: CONF_LIVE_CONTROLS_THUMBNAILS_MEDIA_TYPE,
                        configPathEventsMediaType:
                          CONF_LIVE_CONTROLS_THUMBNAILS_EVENTS_MEDIA_TYPE,
                        configPathMode: CONF_LIVE_CONTROLS_THUMBNAILS_MODE,
                      },
                    )}
                    ${this._renderMiniTimeline(
                      MENU_LIVE_CONTROLS_TIMELINE,
                      CONF_LIVE_CONTROLS_TIMELINE_MODE,
                      CONF_LIVE_CONTROLS_TIMELINE_STYLE,
                      CONF_LIVE_CONTROLS_TIMELINE_WINDOW_SECONDS,
                      CONF_LIVE_CONTROLS_TIMELINE_CLUSTERING_THRESHOLD,
                      CONF_LIVE_CONTROLS_TIMELINE_EVENTS_MEDIA_TYPE,
                      CONF_LIVE_CONTROLS_TIMELINE_SHOW_RECORDINGS,
                      CONF_LIVE_CONTROLS_TIMELINE_FORMAT_24H,
                      this._defaults.live.controls.timeline.show_recordings,
                      this._defaults.live.controls.timeline.format['24h'],
                      CONF_LIVE_CONTROLS_TIMELINE_PAN_MODE,
                    )}
                    ${this._putInSubmenu(
                      MENU_LIVE_CONTROLS_PTZ,
                      true,
                      'config.live.controls.ptz.editor_label',
                      'mdi:pan',
                      html`
                        ${this._renderOptionSelector(
                          CONF_LIVE_CONTROLS_PTZ_MODE,
                          this._ptzModes,
                        )}
                        ${this._renderOptionSelector(
                          CONF_LIVE_CONTROLS_PTZ_POSITION,
                          this._ptzPositions,
                        )}
                        ${this._renderOptionSelector(
                          CONF_LIVE_CONTROLS_PTZ_ORIENTATION,
                          this._ptzOrientations,
                        )}
                        ${this._renderSwitch(
                          CONF_LIVE_CONTROLS_PTZ_HIDE_PAN_TILT,
                          this._defaults.live.controls.ptz.hide_pan_tilt,
                          {
                            label: localize('config.live.controls.ptz.hide_pan_tilt'),
                          },
                        )}
                        ${this._renderSwitch(
                          CONF_LIVE_CONTROLS_PTZ_HIDE_ZOOM,
                          this._defaults.live.controls.ptz.hide_pan_tilt,
                          {
                            label: localize('config.live.controls.ptz.hide_zoom'),
                          },
                        )}
                        ${this._renderSwitch(
                          CONF_LIVE_CONTROLS_PTZ_HIDE_HOME,
                          this._defaults.live.controls.ptz.hide_home,
                          {
                            label: localize('config.live.controls.ptz.hide_home'),
                          },
                        )}
                      `,
                    )}
                  `,
                )}
                ${this._putInSubmenu(
                  MENU_LIVE_MICROPHONE,
                  true,
                  'config.live.microphone.editor_label',
                  'mdi:microphone',
                  html`
                    ${this._renderNumberInput(CONF_LIVE_MICROPHONE_DISCONNECT_SECONDS)}
                    ${this._renderSwitch(
                      CONF_LIVE_MICROPHONE_ALWAYS_CONNECTED,
                      this._defaults.live.microphone.always_connected,
                    )}
                    ${this._renderNumberInput(
                      CONF_LIVE_MICROPHONE_MUTE_AFTER_MICROPHONE_MUTE_SECONDS,
                    )}
                  `,
                )}
              </div>
            `
          : ''}
        ${this._renderOptionSetHeader('media_gallery')}
        ${this._expandedMenus[MENU_OPTIONS] === 'media_gallery'
          ? html` <div class="values">
              ${this._renderThumbnailsControls(
                MENU_MEDIA_GALLERY_CONTROLS_THUMBNAILS,
                CONF_MEDIA_GALLERY_CONTROLS_THUMBNAILS_SIZE,
                CONF_MEDIA_GALLERY_CONTROLS_THUMBNAILS_SHOW_DETAILS,
                CONF_MEDIA_GALLERY_CONTROLS_THUMBNAILS_SHOW_FAVORITE_CONTROL,
                CONF_MEDIA_GALLERY_CONTROLS_THUMBNAILS_SHOW_TIMELINE_CONTROL,
                CONF_MEDIA_GALLERY_CONTROLS_THUMBNAILS_SHOW_DOWNLOAD_CONTROL,
                this._defaults.media_gallery.controls.thumbnails,
              )}
              ${this._renderFilterControls(
                MENU_MEDIA_GALLERY_CONTROLS_FILTER,
                CONF_MEDIA_GALLERY_CONTROLS_FILTER_MODE,
              )}
            </div>`
          : ''}
        ${this._renderOptionSetHeader('media_viewer')}
        ${this._expandedMenus[MENU_OPTIONS] === 'media_viewer'
          ? html` <div class="values">
              ${this._renderOptionSelector(
                CONF_MEDIA_VIEWER_AUTO_PLAY,
                this._mediaActionPositiveConditions,
                {
                  multiple: true,
                },
              )}
              ${this._renderOptionSelector(
                CONF_MEDIA_VIEWER_AUTO_PAUSE,
                this._mediaActionNegativeConditions,
                {
                  multiple: true,
                },
              )}
              ${this._renderOptionSelector(
                CONF_MEDIA_VIEWER_AUTO_MUTE,
                this._mediaActionNegativeConditions,
                {
                  multiple: true,
                },
              )}
              ${this._renderOptionSelector(
                CONF_MEDIA_VIEWER_AUTO_UNMUTE,
                this._mediaActionPositiveConditions,
                {
                  multiple: true,
                },
              )}
              ${this._renderSwitch(
                CONF_MEDIA_VIEWER_DRAGGABLE,
                this._defaults.media_viewer.draggable,
              )}
              ${this._renderSwitch(
                CONF_MEDIA_VIEWER_ZOOMABLE,
                this._defaults.media_viewer.zoomable,
              )}
              ${this._renderSwitch(
                CONF_MEDIA_VIEWER_LAZY_LOAD,
                this._defaults.media_viewer.lazy_load,
              )}
              ${this._renderOptionSelector(
                CONF_MEDIA_VIEWER_TRANSITION_EFFECT,
                this._transitionEffects,
              )}
              ${this._renderSwitch(
                CONF_MEDIA_VIEWER_SNAPSHOT_CLICK_PLAYS_CLIP,
                this._defaults.media_viewer.snapshot_click_plays_clip,
              )}
              ${this._renderViewDisplay(
                MENU_MEDIA_VIEWER_DISPLAY,
                CONF_MEDIA_VIEWER_DISPLAY_MODE,
                CONF_MEDIA_VIEWER_DISPLAY_GRID_SELECTED_WIDTH_FACTOR,
                CONF_MEDIA_VIEWER_DISPLAY_GRID_COLUMNS,
                CONF_MEDIA_VIEWER_DISPLAY_GRID_MAX_COLUMNS,
              )}
              ${this._putInSubmenu(
                MENU_MEDIA_VIEWER_CONTROLS,
                true,
                'config.media_viewer.controls.editor_label',
                'mdi:gamepad',
                html`
                  ${this._renderSwitch(
                    CONF_MEDIA_VIEWER_CONTROLS_BUILTIN,
                    this._defaults.media_viewer.controls.builtin,
                    {
                      label: localize('config.common.controls.builtin'),
                    },
                  )}
                  ${this._renderNextPreviousControls(
                    MENU_MEDIA_VIEWER_CONTROLS_NEXT_PREVIOUS,
                    CONF_MEDIA_VIEWER_CONTROLS_NEXT_PREVIOUS_STYLE,
                    CONF_MEDIA_VIEWER_CONTROLS_NEXT_PREVIOUS_SIZE,
                    {
                      allowThumbnails: true,
                    },
                  )}
                  ${this._renderThumbnailsControls(
                    MENU_MEDIA_VIEWER_CONTROLS_THUMBNAILS,
                    CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_SIZE,
                    CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_SHOW_DETAILS,
                    CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_SHOW_FAVORITE_CONTROL,
                    CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_SHOW_TIMELINE_CONTROL,
                    CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_SHOW_DOWNLOAD_CONTROL,
                    this._defaults.media_viewer.controls.thumbnails,
                    {
                      configPathMode: CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_MODE,
                    },
                  )}
                  ${this._renderMiniTimeline(
                    MENU_MEDIA_VIEWER_CONTROLS_TIMELINE,
                    CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_MODE,
                    CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_STYLE,
                    CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_WINDOW_SECONDS,
                    CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_CLUSTERING_THRESHOLD,
                    CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_EVENTS_MEDIA_TYPE,
                    CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_SHOW_RECORDINGS,
                    CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_FORMAT_24H,
                    this._defaults.media_viewer.controls.timeline.show_recordings,
                    this._defaults.media_viewer.controls.timeline.format['24h'],
                    CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_PAN_MODE,
                  )}
                `,
              )}
            </div>`
          : ''}
        ${this._renderOptionSetHeader('image')}
        ${this._expandedMenus[MENU_OPTIONS] === 'image'
          ? html` <div class="values">
              ${this._renderImageOptions(
                CONF_IMAGE_MODE,
                CONF_IMAGE_URL,
                CONF_IMAGE_ENTITY,
                CONF_IMAGE_ENTITY_PARAMETERS,
                CONF_IMAGE_REFRESH_SECONDS,
              )}
            </div>`
          : ''}
        ${this._renderOptionSetHeader('timeline')}
        ${this._expandedMenus[MENU_OPTIONS] === 'timeline'
          ? html` <div class="values">
              ${this._renderTimelineCoreControls(
                MENU_TIMELINE_FORMAT,
                CONF_TIMELINE_STYLE,
                CONF_TIMELINE_WINDOW_SECONDS,
                CONF_TIMELINE_CLUSTERING_THRESHOLD,
                CONF_TIMELINE_EVENTS_MEDIA_TYPE,
                CONF_TIMELINE_SHOW_RECORDINGS,
                CONF_TIMELINE_FORMAT_24H,
                this._defaults.timeline.show_recordings,
                this._defaults.timeline.format['24h'],
              )}
              ${this._renderThumbnailsControls(
                MENU_TIMELINE_CONTROLS_THUMBNAILS,
                CONF_TIMELINE_CONTROLS_THUMBNAILS_SIZE,
                CONF_TIMELINE_CONTROLS_THUMBNAILS_SHOW_DETAILS,
                CONF_TIMELINE_CONTROLS_THUMBNAILS_SHOW_FAVORITE_CONTROL,
                CONF_TIMELINE_CONTROLS_THUMBNAILS_SHOW_TIMELINE_CONTROL,
                CONF_TIMELINE_CONTROLS_THUMBNAILS_SHOW_DOWNLOAD_CONTROL,
                this._defaults.timeline.controls.thumbnails,
                {
                  configPathMode: CONF_TIMELINE_CONTROLS_THUMBNAILS_MODE,
                },
              )}
            </div>`
          : ''}
        ${this._renderOptionSetHeader('dimensions')}
        ${this._expandedMenus[MENU_OPTIONS] === 'dimensions'
          ? html` <div class="values">
              ${this._renderOptionSelector(
                CONF_DIMENSIONS_ASPECT_RATIO_MODE,
                this._aspectRatioModes,
              )}
              ${this._renderStringInput(CONF_DIMENSIONS_ASPECT_RATIO)}
              ${this._renderStringInput(CONF_DIMENSIONS_HEIGHT)}
            </div>`
          : ''}
        ${this._renderOptionSetHeader(
          'performance',
          getConfigValue(this._config, CONF_PERFORMANCE_PROFILE) === 'low'
            ? 'warning'
            : undefined,
        )}
        ${this._expandedMenus[MENU_OPTIONS] === 'performance'
          ? html` <div class="values">
              ${getConfigValue(this._config, CONF_PERFORMANCE_PROFILE) === 'low'
                ? this._renderInfo(localize('config.performance.warning'))
                : html``}
              ${this._putInSubmenu(
                MENU_PERFORMANCE_FEATURES,
                true,
                'config.performance.features.editor_label',
                'mdi:feature-search',
                html`
                  ${this._renderSwitch(
                    CONF_PERFORMANCE_FEATURES_CARD_LOADING_INDICATOR,
                    this._defaults.performance.features.card_loading_indicator,
                  )}
                  ${this._renderSwitch(
                    CONF_PERFORMANCE_FEATURES_ANIMATED_PROGRESS_INDICATOR,
                    this._defaults.performance.features.animated_progress_indicator,
                  )}
                  ${this._renderNumberInput(CONF_PERFORMANCE_FEATURES_MEDIA_CHUNK_SIZE, {
                    max: MEDIA_CHUNK_SIZE_MAX,
                  })}
                  ${this._renderNumberInput(
                    CONF_PERFORMANCE_FEATURES_MAX_SIMULTANEOUS_ENGINE_REQUESTS,
                    {
                      min: 1,
                    },
                  )}
                `,
              )}
              ${this._putInSubmenu(
                MENU_PERFORMANCE_STYLE,
                true,
                'config.performance.style.editor_label',
                'mdi:palette-swatch-variant',
                html`
                  ${this._renderSwitch(
                    CONF_PERFORMANCE_STYLE_BORDER_RADIUS,
                    this._defaults.performance.style.border_radius,
                  )}
                  ${this._renderSwitch(
                    CONF_PERFORMANCE_STYLE_BOX_SHADOW,
                    this._defaults.performance.style.box_shadow,
                  )}
                `,
              )}
            </div>`
          : ''}
        ${this._renderOptionSetHeader('remote_control')}
        ${this._expandedMenus[MENU_OPTIONS] === 'remote_control'
          ? html` <div class="values">
              ${this._putInSubmenu(
                MENU_REMOTE_CONTROL_ENTITIES,
                true,
                'config.remote_control.entities.editor_label',
                'mdi:devices',
                html`
                  ${this._renderEntitySelector(
                    CONF_REMOTE_CONTROL_ENTITIES_CAMERA,
                    'input_select',
                  )}
                `,
              )}
            </div>`
          : ''}
        ${this._config['overrides'] !== undefined
          ? html` ${this._renderOptionSetHeader('overrides')}
            ${this._expandedMenus[MENU_OPTIONS] === 'overrides'
              ? html` <div class="values">
                  ${this._renderInfo(localize('config.overrides.info'))}
                </div>`
              : ''}`
          : html``}
      </div>
    `;
  }

  /**
   * Close the editor menu with the given domain.
   * @param targetDomain The menu domain to close.
   */
  protected _closeMenu(targetDomain: string) {
    delete this._expandedMenus[targetDomain];
    this.requestUpdate();
  }

  /**
   * Open an editor menu.
   * @param targetDomain The menu domain to open.
   * @param key The menu object key to open.
   */
  protected _openMenu(targetDomain: string, key: number | string) {
    this._expandedMenus[targetDomain] = key;
    this.requestUpdate();
  }

  /**
   * Toggle an editor menu.
   * @param ev An event.
   */
  protected _toggleMenu(ev: { target: EditorMenuTarget | null }): void {
    if (ev && ev.target) {
      const domain = ev.target.domain;
      const key = ev.target.key;

      if (this._expandedMenus[domain] === key) {
        this._closeMenu(domain);
      } else {
        this._openMenu(domain, key);
      }
    }
  }

  /**
   * Handle a changed option value.
   * @param ev Event triggering the change.
   */
  protected _valueChangedHandler(
    key: string,
    ev: CustomEvent<{ value: unknown }>,
  ): void {
    if (!this._config || !this.hass) {
      return;
    }

    let value;
    if (ev.detail && ev.detail.value !== undefined) {
      value = ev.detail.value;
      if (typeof value === 'string') {
        value = value.trim();
      }
    }
    if (getConfigValue(this._config, key) === value) {
      return;
    }

    const newConfig = copyConfig(this._config);
    if (value === '' || value === undefined) {
      deleteConfigValue(newConfig, key);
    } else {
      setConfigValue(newConfig, key, value);
    }
    this._updateConfig(newConfig);
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(editorStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-editor': AdvancedCameraCardEditor;
  }
}
