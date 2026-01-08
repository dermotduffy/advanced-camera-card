import { HassEntities, HassEntity } from 'home-assistant-js-websocket';
import { LitElement } from 'lit';
import screenfull from 'screenfull';
import { expect, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { Camera } from '../src/camera-manager/camera';
import { Capabilities } from '../src/camera-manager/capabilities';
import { CameraManagerEngine } from '../src/camera-manager/engine';
import {
  FrigateEvent,
  FrigateRecording,
  FrigateReview,
} from '../src/camera-manager/frigate/types';
import { GenericCameraManagerEngine } from '../src/camera-manager/generic/engine-generic';
import { CameraManager } from '../src/camera-manager/manager';
import { CameraManagerStore } from '../src/camera-manager/store';
import {
  CameraEventCallback,
  EventQuery,
  QueryType,
  RecordingQuery,
  ReviewQuery,
} from '../src/camera-manager/types';
import { ActionsManager } from '../src/card-controller/actions/actions-manager';
import { AutomationsManager } from '../src/card-controller/automations-manager';
import { CameraURLManager } from '../src/card-controller/camera-url-manager';
import { CardElementManager } from '../src/card-controller/card-element-manager';
import { ConfigManager } from '../src/card-controller/config/config-manager';
import { CardController } from '../src/card-controller/controller';
import { DefaultManager } from '../src/card-controller/default-manager';
import { ExpandManager } from '../src/card-controller/expand-manager';
import { FoldersManager } from '../src/card-controller/folders/manager';
import { FolderQuery } from '../src/card-controller/folders/types';
import { FullscreenManager } from '../src/card-controller/fullscreen/fullscreen-manager';
import { HASSManager } from '../src/card-controller/hass/hass-manager';
import { StateWatcherSubscriptionInterface } from '../src/card-controller/hass/state-watcher';
import { InitializationManager } from '../src/card-controller/initialization-manager';
import { InteractionManager } from '../src/card-controller/interaction-manager';
import { KeyboardStateManager } from '../src/card-controller/keyboard-state-manager';
import { MediaLoadedInfoManager } from '../src/card-controller/media-info-manager';
import { MediaPlayerManager } from '../src/card-controller/media-player-manager';
import { MessageManager } from '../src/card-controller/message-manager';
import { MicrophoneManager } from '../src/card-controller/microphone-manager';
import { QueryStringManager } from '../src/card-controller/query-string-manager';
import { StatusBarItemManager } from '../src/card-controller/status-bar-item-manager';
import { StyleManager } from '../src/card-controller/style-manager';
import { TriggersManager } from '../src/card-controller/triggers-manager';
import { ViewItemManager } from '../src/card-controller/view/item-manager';
import { ViewManager } from '../src/card-controller/view/view-manager';
import { SubmenuInteraction, SubmenuItem } from '../src/components/submenu/types';
import { ConditionStateManager } from '../src/conditions/state-manager';
import { CameraConfig, cameraConfigSchema } from '../src/config/schema/cameras';
import { FolderConfig } from '../src/config/schema/folders';
import {
  PerformanceConfig,
  performanceConfigSchema,
} from '../src/config/schema/performance';
import {
  AdvancedCameraCardConfig,
  advancedCameraCardConfigSchema,
} from '../src/config/schema/types';
import { RawAdvancedCameraCardConfig } from '../src/config/types';
import {
  BrowseMedia,
  BrowseMediaMetadata,
  RichBrowseMedia,
} from '../src/ha/browse-media/types';
import { Device } from '../src/ha/registry/device/types';
import { Entity, EntityRegistryManager } from '../src/ha/registry/entity/types';
import { CurrentUser, HassStateDifference, HomeAssistant } from '../src/ha/types';
import { QuerySource } from '../src/query-source';
import {
  CapabilitiesRaw,
  EffectsControllerAPI,
  Interaction,
  MediaLoadedInfo,
  Severity,
} from '../src/types';
import {
  EventViewMedia,
  ReviewViewMedia,
  ViewMedia,
  ViewMediaType,
} from '../src/view/item';
import { QueryResults } from '../src/view/query-results';
import { ViewItemCapabilities } from '../src/view/types';
import { View, ViewParameters } from '../src/view/view';

export const createCameraConfig = (config?: unknown): CameraConfig => {
  return cameraConfigSchema.parse(config ?? {});
};

export const createRawConfig = (
  config?: Partial<RawAdvancedCameraCardConfig>,
): RawAdvancedCameraCardConfig => {
  return {
    type: 'advanced-camera-card',
    cameras: [{}],
    ...config,
  };
};

export const createConfig = (
  config?: RawAdvancedCameraCardConfig,
): AdvancedCameraCardConfig => {
  return advancedCameraCardConfigSchema.parse(createRawConfig(config));
};

export const createInitializedCamera = async (
  config: CameraConfig,
  engine: CameraManagerEngine,
  capabilities?: Capabilities,
): Promise<Camera> => {
  const camera = new Camera(config, engine);
  await camera.initialize({
    hass: createHASS(),
    stateWatcher: mock<StateWatcherSubscriptionInterface>(),
    ...(capabilities ? { capabilityOptions: { capabilities } } : {}),
  });
  return camera;
};

export const createHASS = (states?: HassEntities, user?: CurrentUser): HomeAssistant => {
  const hass = mock<HomeAssistant>();
  if (states) {
    hass.states = states;
  }
  if (user) {
    hass.user = user;
  }
  hass.connection.subscribeMessage = vi.fn();

  // ha-nunjucks calls sendMessagePromise to fetch label registry; return empty array to prevent crash.
  hass.connection.sendMessagePromise = vi.fn().mockResolvedValue([]);
  return hass;
};

export const createUser = (user?: Partial<CurrentUser>): CurrentUser => ({
  id: 'user',
  is_owner: false,
  is_admin: false,
  name: 'User',
  credentials: [],
  mfa_modules: [],
  ...user,
});

export const createRegistryDevice = (device?: Partial<Device>): Device => {
  return {
    id: device?.id ?? 'id',
    model: device?.model ?? null,
    config_entries: device?.config_entries ?? [],
    manufacturer: device?.manufacturer ?? null,
  };
};

export const createRegistryEntity = (entity?: Partial<Entity>): Entity => {
  return {
    config_entry_id: entity?.config_entry_id ?? null,
    device_id: entity?.device_id ?? null,
    disabled_by: entity?.disabled_by ?? null,
    entity_id: entity?.entity_id ?? 'entity_id',
    hidden_by: entity?.hidden_by ?? null,
    platform: entity?.platform ?? 'platform',
    translation_key: entity?.translation_key ?? null,
    ...(entity?.unique_id && { unique_id: entity?.unique_id }),
  };
};

export const createStateEntity = (entity?: Partial<HassEntity>): HassEntity => {
  return {
    entity_id: entity?.entity_id ?? 'entity_id',
    state: entity?.state ?? 'on',
    last_changed: entity?.last_changed ?? 'never',
    last_updated: entity?.last_updated ?? 'never',
    attributes: entity?.attributes ?? {},
    context: entity?.context ?? {
      id: 'id',
      parent_id: 'parent_id',
      user_id: 'user_id',
    },
  };
};

export const createFrigateEvent = (event?: Partial<FrigateEvent>) => {
  return {
    camera: 'camera',
    end_time: 1683397124,
    false_positive: false,
    has_clip: true,
    has_snapshot: true,
    id: '1683396875.643998-hmzrh5',
    label: 'person',
    sub_label: null,
    start_time: 1683395000,
    top_score: 0.841796875,
    zones: [],
    retain_indefinitely: false,
    ...event,
  };
};

export const createFrigateRecording = (recording?: Partial<FrigateRecording>) => {
  return {
    cameraID: 'cameraID',
    startTime: new Date('2023-04-29T14:00:00'),
    endTime: new Date('2023-04-29T14:59:59'),
    events: 42,
    ...recording,
  };
};

export const createFrigateReview = (review?: Partial<FrigateReview>) => {
  return {
    id: 'review_id',
    camera: 'camera',
    severity: 'alert' as const,
    start_time: 1683395000,
    end_time: 1683397124,
    thumb_path: 'thumb.jpg',
    has_been_reviewed: false,
    data: {
      objects: ['person'],
      zones: [],
      audio: [],
    },
    ...review,
  };
};

export const createView = (options?: Partial<ViewParameters>): View => {
  return new View({
    view: 'live',
    camera: 'camera',
    ...options,
  });
};

export const createViewWithMedia = (options?: Partial<ViewParameters>): View => {
  const media = generateViewMediaArray({ count: 5 });
  return createView({
    queryResults: new QueryResults({
      results: media,
      selectedIndex: 0,
    }),
    ...options,
  });
};

export const createStore = (
  cameras?: {
    cameraID: string;
    engine?: CameraManagerEngine;
    config?: CameraConfig;
    capabilities?: Capabilities | null;
    eventCallback?: CameraEventCallback;
  }[],
): CameraManagerStore => {
  const store = new CameraManagerStore();
  for (const cameraProps of cameras ?? []) {
    const eventCallback = cameraProps.eventCallback ?? vi.fn();
    const capabilities =
      cameraProps.capabilities === undefined
        ? createCapabilities()
        : cameraProps.capabilities ?? undefined;
    const camera = new Camera(
      cameraProps.config ?? createCameraConfig(),
      cameraProps.engine ??
        new GenericCameraManagerEngine(
          mock<StateWatcherSubscriptionInterface>(),
          eventCallback,
        ),
      { eventCallback, capabilities },
    );
    camera.setID(cameraProps.cameraID);
    store.addCamera(camera);
  }
  return store;
};

export const createCameraManager = (store?: CameraManagerStore): CameraManager => {
  const cameraStore = store ?? createStore();
  const cameraManager = mock<CameraManager>();
  vi.mocked(cameraManager.getStore).mockReturnValue(cameraStore);
  vi.mocked(cameraManager.getCameraCapabilities).mockImplementation(
    (cameraID: string): Capabilities | null => {
      return cameraStore.getCamera(cameraID)?.getCapabilities() ?? null;
    },
  );

  return cameraManager;
};

export const createCapabilities = (capabilities?: CapabilitiesRaw): Capabilities => {
  return new Capabilities({
    'favorite-events': false,
    'favorite-recordings': false,
    'remote-control-entity': true,
    clips: false,
    live: false,
    recordings: false,
    seek: false,
    snapshots: false,
    ...capabilities,
  });
};

export const createMediaCapabilities = (
  options?: Partial<ViewItemCapabilities>,
): ViewItemCapabilities => {
  return {
    canFavorite: false,
    canDownload: false,
    ...options,
  };
};

export const createMediaLoadedInfo = (
  options?: Partial<MediaLoadedInfo>,
): MediaLoadedInfo => {
  return {
    width: 100,
    height: 100,
    ...options,
  };
};

export const createMediaLoadedInfoEvent = (
  mediaLoadedInfo?: MediaLoadedInfo,
): CustomEvent<MediaLoadedInfo> => {
  return new CustomEvent('advanced-camera-card:media:loaded', {
    detail: mediaLoadedInfo ?? createMediaLoadedInfo(),
    composed: true,
    bubbles: true,
  });
};

export const createPerformanceConfig = (config: unknown): PerformanceConfig => {
  return performanceConfigSchema.parse(config);
};

export const generateViewMediaArray = (options?: {
  cameraIDs?: string[];
  count?: number;
}): ViewMedia[] => {
  const media: ViewMedia[] = [];
  for (let i = 0; i < (options?.count ?? 100); ++i) {
    for (const cameraID of options?.cameraIDs ?? ['kitchen', 'office']) {
      media.push(
        new TestViewMedia({
          cameraID: cameraID,
          id: `id-${cameraID}-${i}`,
        }),
      );
    }
  }
  return media;
};

// ViewMedia itself has no native way to set startTime and ID that aren't linked
// to an engine.
export class TestViewMedia extends ViewMedia implements EventViewMedia, ReviewViewMedia {
  protected _icon: string | null = null;
  protected _id: string | null;
  protected _startTime: Date | null;
  protected _endTime: Date | null;
  protected _inProgress: boolean | null;
  protected _contentID: string | null;
  protected _title: string | null;
  protected _thumbnail: string | null;
  protected _what: string[] | null = null;
  protected _score: number | null = null;
  protected _tags: string[] | null = null;
  protected _where: string[] | null = null;
  protected _severity: Severity | null = null;
  protected _reviewed: boolean | null = null;

  constructor(options?: {
    id?: string | null;
    startTime?: Date | null;
    mediaType?: ViewMediaType;
    cameraID?: string | null;
    folder?: FolderConfig | null;
    endTime?: Date | null;
    inProgress?: boolean;
    contentID?: string;
    title?: string | null;
    thumbnail?: string | null;
    icon?: string | null;
    what?: string[] | null;
    score?: number | null;
    tags?: string[] | null;
    where?: string[] | null;
    severity?: Severity | null;
    reviewed?: boolean | null;
  }) {
    super(options?.mediaType ?? ViewMediaType.Clip, {
      ...(options?.cameraID !== null &&
        !options?.folder && { cameraID: options?.cameraID ?? 'camera' }),
      ...(options?.folder && { folder: options.folder }),
    });
    this._id = options?.id !== undefined ? options.id : 'id';
    this._startTime = options?.startTime ?? null;
    this._endTime = options?.endTime ?? null;
    this._inProgress = options?.inProgress !== undefined ? options.inProgress : false;
    this._contentID = options?.contentID ?? null;
    this._title = options?.title !== undefined ? options.title : null;
    this._thumbnail = options?.thumbnail !== undefined ? options.thumbnail : null;
    this._icon = options?.icon !== undefined ? options.icon : null;
    this._what = options?.what !== undefined ? options.what : null;
    this._score = options?.score !== undefined ? options.score : null;
    this._tags = options?.tags !== undefined ? options.tags : null;
    this._where = options?.where !== undefined ? options.where : null;
    this._severity = options?.severity !== undefined ? options.severity : null;
    this._reviewed = options?.reviewed !== undefined ? options.reviewed : null;
  }
  public getIcon(): string | null {
    return this._icon;
  }
  public getID(): string | null {
    return this._id;
  }
  public getStartTime(): Date | null {
    return this._startTime;
  }
  public getEndTime(): Date | null {
    return this._endTime;
  }
  public inProgress(): boolean | null {
    return this._inProgress;
  }
  public getContentID(): string | null {
    return this._contentID;
  }
  public getTitle(): string | null {
    return this._title;
  }
  public getThumbnail(): string | null {
    return this._thumbnail;
  }
  public getWhat(): string[] | null {
    return this._what;
  }
  public getScore(): number | null {
    return this._score;
  }
  public getTags(): string[] | null {
    return this._tags;
  }
  public getWhere(): string[] | null {
    return this._where;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public isGroupableWith(_that: EventViewMedia): boolean {
    return false;
  }
  public getSeverity(): Severity | null {
    return this._severity;
  }
  public isReviewed(): boolean | null {
    return this._reviewed;
  }
  public setReviewed(reviewed: boolean): void {
    this._reviewed = reviewed;
  }
}

export const ResizeObserverMock = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
}));

export const IntersectionObserverMock = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
}));

export const MutationObserverMock = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
}));

export const requestAnimationFrameMock = (callback: FrameRequestCallback) => {
  callback(new Date().getTime());
  return 1;
};

export const getMockIntersectionObserver = (n = 0): IntersectionObserver | null => {
  const mockResult = vi.mocked(IntersectionObserver).mock.results[n];
  if (mockResult.type !== 'return') {
    return null;
  }
  return mockResult.value;
};

export const callIntersectionHandler = async (
  intersecting = true,
  n = 0,
): Promise<void> => {
  const observer = getMockIntersectionObserver(n);
  if (!observer) {
    return;
  }
  await (
    vi.mocked(IntersectionObserver).mock.calls[n][0] as
      | IntersectionObserverCallback
      | ((_: unknown) => Promise<void>)
  )(
    // Note this is a very incomplete / invalid IntersectionObserverEntry that
    // just provides the bare basics current implementation uses.
    intersecting ? [{ isIntersecting: true } as IntersectionObserverEntry] : [],
    observer,
  );
};

export const callMutationHandler = async (n = 0): Promise<void> => {
  const mockResult = vi.mocked(MutationObserver).mock.results[n];
  if (mockResult.type !== 'return') {
    return;
  }
  const observer = mockResult.value;
  await (
    vi.mocked(MutationObserver).mock.calls[n][0] as
      | MutationCallback
      | ((_: unknown) => Promise<void>)
  )(
    // Note this is a very incomplete / invalid IntersectionObserverEntry that
    // just provides the bare basics current implementation uses.
    [],
    observer,
  );
};

export const callVisibilityHandler = async (visible: boolean): Promise<void> => {
  Object.defineProperty(document, 'visibilityState', {
    value: visible ? 'visible' : 'hidden',
    writable: true,
  });

  const mock = vi.mocked(global.document.addEventListener).mock;
  for (const [evt, cb] of mock.calls) {
    if (evt === 'visibilitychange' && typeof cb === 'function') {
      await (cb as EventListener | ((_: unknown) => Promise<void>))(new Event('foo'));
    }
  }
};

export const getResizeObserver = (n = 0): ResizeObserver | null => {
  const mockResult = vi.mocked(ResizeObserver).mock.results[n];
  if (mockResult.type !== 'return') {
    return null;
  }
  return mockResult.value;
};

export const callResizeHandler = (
  entries: {
    target: HTMLElement;
    width: number;
    height: number;
  }[] = [],
  n = 0,
): void => {
  const observer = getResizeObserver(n);
  if (!observer) {
    return;
  }
  vi.mocked(ResizeObserver).mock.calls[n][0](
    // Note this is a very incomplete / invalid ResizeObserverEntry that
    // just provides the bare basics current implementation uses.
    entries.map(
      (entry) =>
        ({
          target: entry.target,
          contentRect: {
            height: entry.height,
            width: entry.width,
          },
        }) as unknown as ResizeObserverEntry,
    ),
    observer,
  );
};

export const createSlotHost = (options?: {
  slot?: HTMLSlotElement;
  children?: HTMLElement[];
  parent?: LitElement;
}): LitElement => {
  const parent = options?.parent ?? createLitElement();
  parent.attachShadow({ mode: 'open' });

  if (options?.slot) {
    parent.shadowRoot?.append(options.slot);
  }
  if (options?.children) {
    // Children will automatically be slotted into the default slot when it is
    // created.
    parent.append(...options.children);
  }
  return parent;
};

export const createSlot = (): HTMLSlotElement => {
  return document.createElement('slot');
};

export const createParent = (options?: { children?: HTMLElement[] }): HTMLElement => {
  const parent = document.createElement('div');
  parent.append(...(options?.children ?? []));
  return parent;
};

export const createLitElement = (): LitElement => {
  const element = document.createElement('div') as unknown as LitElement;
  element.addController = vi.fn();
  element.removeController = vi.fn();
  element.requestUpdate = vi.fn();

  const promise: Promise<boolean> = new Promise((resolve) => {
    resolve(false);
  });

  // Need to overwrite a read-only property.
  Object.defineProperty(element, 'updateComplete', {
    value: promise,
  });
  return element;
};

export const createCardAPI = (): CardController => {
  const api = mock<CardController>();

  api.getActionsManager.mockReturnValue(mock<ActionsManager>());
  api.getAutomationsManager.mockReturnValue(mock<AutomationsManager>());
  api.getDefaultManager.mockReturnValue(mock<DefaultManager>());
  api.getCameraManager.mockReturnValue(mock<CameraManager>());
  api.getCameraURLManager.mockReturnValue(mock<CameraURLManager>());
  api.getCardElementManager.mockReturnValue(mock<CardElementManager>());
  api.getConditionStateManager.mockReturnValue(mock<ConditionStateManager>());
  api.getConfigManager.mockReturnValue(mock<ConfigManager>());
  api.getEffectsControllerAPI.mockReturnValue(mock<EffectsControllerAPI>());
  api.getEntityRegistryManager.mockReturnValue(mock<EntityRegistryManager>());
  api.getExpandManager.mockReturnValue(mock<ExpandManager>());
  api.getFoldersManager.mockReturnValue(mock<FoldersManager>());
  api.getFullscreenManager.mockReturnValue(mock<FullscreenManager>());
  api.getHASSManager.mockReturnValue(mock<HASSManager>());
  api.getInitializationManager.mockReturnValue(mock<InitializationManager>());
  api.getInteractionManager.mockReturnValue(mock<InteractionManager>());
  api.getKeyboardStateManager.mockReturnValue(mock<KeyboardStateManager>());
  api.getMediaLoadedInfoManager.mockReturnValue(mock<MediaLoadedInfoManager>());
  api.getMediaPlayerManager.mockReturnValue(mock<MediaPlayerManager>());
  api.getMessageManager.mockReturnValue(mock<MessageManager>());
  api.getMicrophoneManager.mockReturnValue(mock<MicrophoneManager>());
  api.getQueryStringManager.mockReturnValue(mock<QueryStringManager>());
  api.getStatusBarItemManager.mockReturnValue(mock<StatusBarItemManager>());
  api.getStyleManager.mockReturnValue(mock<StyleManager>());
  api.getTriggersManager.mockReturnValue(mock<TriggersManager>());
  api.getViewItemManager.mockReturnValue(mock<ViewItemManager>());
  api.getViewManager.mockReturnValue(mock<ViewManager>());

  return api;
};

export const callStateWatcherCallback = (
  stateWatcher: StateWatcherSubscriptionInterface,
  diff: HassStateDifference,
  n = 0,
): void => {
  const mock = vi.mocked(stateWatcher.subscribe).mock;
  expect(mock.calls.length).greaterThan(n);
  mock.calls[n][0](diff);
};

/**
 * Flush resolved promises.
 */
export const flushPromises = async (): Promise<void> => {
  await new Promise(process.nextTick);
};

export const createInteractionActionEvent = (
  action: string,
): CustomEvent<Interaction> => {
  return new CustomEvent<Interaction>('@action', {
    detail: {
      action: action,
    },
  });
};

export const createSubmenuInteractionActionEvent = (
  action: string,
  item: SubmenuItem,
): CustomEvent<SubmenuInteraction> => {
  return new CustomEvent<SubmenuInteraction>('@action', {
    detail: {
      action,
      item,
    },
  });
};

export const setScreenfulEnabled = (enabled: boolean): void => {
  Object.defineProperty(screenfull, 'isEnabled', { value: enabled, writable: true });
};

export const createTouch = (touch?: Partial<Touch>): Touch => ({
  clientX: touch?.clientX ?? 0,
  clientY: touch?.clientY ?? 0,
  force: touch?.force ?? 0,
  identifier: touch?.identifier ?? 0,
  pageX: touch?.pageX ?? 0,
  pageY: touch?.pageY ?? 0,
  radiusX: touch?.radiusX ?? 0,
  radiusY: touch?.radiusY ?? 0,
  rotationAngle: touch?.rotationAngle ?? 0,
  screenX: touch?.screenX ?? 0,
  screenY: touch?.screenY ?? 0,
  target: touch?.target ?? document.createElement('div'),
});

export const createTouchEvent = (
  type: string,
  options?: { touches?: Touch[]; changedTouches?: Touch[] },
): TouchEvent => {
  return new TouchEvent(type, {
    bubbles: false,
    touches: options?.touches,
    changedTouches: options?.changedTouches,
  });
};

export const createFolder = (config?: Partial<FolderConfig>): FolderConfig => {
  return {
    type: 'ha',
    id: crypto.randomUUID(),
    ha: {
      path: [{ id: 'media-source://' }],
    },
    ...config,
  };
};

export const createBrowseMedia = (media?: Partial<BrowseMedia>): BrowseMedia => {
  return {
    title: 'Test Media',
    media_class: 'video',
    media_content_type: 'video/mp4',
    media_content_id: 'content_id',
    can_play: true,
    can_expand: false,
    thumbnail: null,
    children: null,
    ...media,
  };
};

export const createRichBrowseMedia = (
  media?: Partial<RichBrowseMedia<BrowseMediaMetadata>>,
): RichBrowseMedia<BrowseMediaMetadata> => {
  return {
    ...createBrowseMedia(media),
    _metadata: media?._metadata ?? {
      cameraID: 'camera.test',
      startDate: new Date('2024-11-19T07:23:00'),
      endDate: new Date('2025-11-19T07:24:00'),
    },
  };
};

export const createEventQuery = (
  cameraID: string,
  options?: Partial<EventQuery>,
): EventQuery => ({
  source: QuerySource.Camera,
  type: QueryType.Event,
  cameraIDs: new Set([cameraID]),
  ...options,
});

export const createReviewQuery = (
  cameraID: string,
  options?: Partial<ReviewQuery>,
): ReviewQuery => ({
  source: QuerySource.Camera,
  type: QueryType.Review,
  cameraIDs: new Set([cameraID]),
  ...options,
});

export const createRecordingQuery = (
  cameraID: string,
  options?: Partial<RecordingQuery>,
): RecordingQuery => ({
  source: QuerySource.Camera,
  type: QueryType.Recording,
  cameraIDs: new Set([cameraID]),
  ...options,
});

export const createFolderQuery = (folderId: string): FolderQuery => ({
  source: QuerySource.Folder,
  folder: { id: folderId, type: 'ha', title: folderId },
  path: [{ ha: { id: 'Root' } }],
});

export const isEventQuery = (node: {
  source: QuerySource;
  type?: QueryType;
}): node is EventQuery =>
  node.source === QuerySource.Camera && node.type === QueryType.Event;

export const isRecordingQuery = (node: {
  source: QuerySource;
  type?: QueryType;
}): node is RecordingQuery =>
  node.source === QuerySource.Camera && node.type === QueryType.Recording;

export const isReviewQuery = (node: {
  source: QuerySource;
  type?: QueryType;
}): node is ReviewQuery =>
  node.source === QuerySource.Camera && node.type === QueryType.Review;

export const isFolderQuery = (node: { source: QuerySource }): node is FolderQuery =>
  node.source === QuerySource.Folder;
