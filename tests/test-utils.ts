import {
  STATE_RUNNING,
  type HassEntities,
  type HassEntity,
  type HassEvent,
} from 'home-assistant-js-websocket';
import type { LitElement } from 'lit';
import screenfull from 'screenfull';
import { expect, onTestFinished, vi, type Mock } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type {
  FrigateEvent,
  FrigateRecording,
  FrigateReview,
} from '../src/camera-manager/frigate/types';
import type { CameraManager } from '../src/camera-manager/manager';
import type { ActionsManager } from '../src/card-controller/actions/actions-manager';
import type { AutomationsManager } from '../src/card-controller/automations-manager';
import type { CallManager } from '../src/card-controller/call/manager';
import type { CameraTriggersManager } from '../src/card-controller/camera-triggers-manager';
import type { CameraURLManager } from '../src/card-controller/camera-url-manager';
import type {
  CardElementManager,
  CardHTMLElement,
} from '../src/card-controller/card-element-manager';
import type { ConfigManager } from '../src/card-controller/config/config-manager';
import type { CardController } from '../src/card-controller/controller';
import type { DefaultManager } from '../src/card-controller/default-manager';
import type { EffectsManager } from '../src/card-controller/effects/effects-manager';
import type { ExpandManager } from '../src/card-controller/expand-manager';
import type { FoldersManager } from '../src/card-controller/folders/manager';
import type { FullscreenManager } from '../src/card-controller/fullscreen/fullscreen-manager';
import type { EventWatcherSubscriptionInterface } from '../src/card-controller/hass/event-watcher';
import type { HASSManager } from '../src/card-controller/hass/hass-manager';
import type { StateWatcherSubscriptionInterface } from '../src/card-controller/hass/state-watcher';
import type { HASSManagerReadonlyInterface } from '../src/card-controller/hass/types';
import type { InitializationManager } from '../src/card-controller/initialization/initialization-manager';
import type { SessionManager } from '../src/card-controller/initialization/session-manager';
import type { InteractionManager } from '../src/card-controller/interaction-manager';
import type { IssueManager } from '../src/card-controller/issues/issue-manager';
import type { IssueStateManager } from '../src/card-controller/issues/state-manager';
import type { KeyboardStateManager } from '../src/card-controller/keyboard-state-manager';
import type { LockManager } from '../src/card-controller/lock/manager';
import type { MediaLoadedInfoManager } from '../src/card-controller/media-info-manager';
import type { MediaPlayerManager } from '../src/card-controller/media-player-manager';
import type { MicrophoneManager } from '../src/card-controller/microphone-manager';
import type { NotificationManager } from '../src/card-controller/notification-manager';
import type { PIPManager } from '../src/card-controller/pip-manager';
import type { QueryStringManager } from '../src/card-controller/query-string-manager';
import type { StatusBarItemManager } from '../src/card-controller/status-bar-item-manager';
import type { StyleManager } from '../src/card-controller/style-manager';
import type { TemplateManager } from '../src/card-controller/templates';
import type { ViewItemManager } from '../src/card-controller/view/item-manager';
import type { ViewManager } from '../src/card-controller/view/view-manager';
import type { SubmenuInteraction, SubmenuItem } from '../src/components/submenu/types';
import type { ConditionStateManager } from '../src/condition-trigger/conditions/state-manager';
import type { FolderConfig } from '../src/config/schema/folders';
import type {
  BrowseMedia,
  BrowseMediaMetadata,
  RichBrowseMedia,
} from '../src/ha/browse-media/types';
import type { Device } from '../src/ha/registry/device/types';
import type { Entity, EntityRegistryManager } from '../src/ha/registry/entity/types';
import type { HASSListener, HASSSource } from '../src/ha/source';
import type { CurrentUser, HassStateDifference, HomeAssistant } from '../src/ha/types';
import type {
  Interaction,
  MediaLoadedInfo,
  MediaLoadedInfoEventDetail,
} from '../src/types';
import type { ViewItemCapabilities } from '../src/view/types';

export const createHASS = (states?: HassEntities, user?: CurrentUser): HomeAssistant => {
  const hass = mock<HomeAssistant>();
  if (states) {
    hass.states = states;
  }
  if (user) {
    hass.user = user;
  }
  hass.config.components = [];

  // Default to a fully-started HA so existing tests that don't care about
  // startup state still represent a "ready" instance.
  hass.config.state = STATE_RUNNING;
  hass.connection.subscribeMessage = vi.fn();
  hass.connection.subscribeEvents = vi.fn();

  // ha-nunjucks calls sendMessagePromise to fetch label registry; return empty array to prevent crash.
  hass.connection.sendMessagePromise = vi.fn().mockResolvedValue([]);
  return hass;
};

/**
 * Build a driveable HASSSource backed by a single `hass` value. The
 * returned `push(hass)` synchronously updates the source's current hass and
 * fans out to every registered listener with `(hass, oldHass)`.
 */
export const createHASSSource = (
  initial?: HomeAssistant | null,
): {
  source: HASSSource;
  push: (hass: HomeAssistant) => void;
  getListenerCount: () => number;
} => {
  let current: HomeAssistant | null = initial ?? null;
  const listeners = new Set<HASSListener>();
  const source: HASSSource = {
    getHASS: () => current,
    addListener: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return {
    source,
    push: (hass) => {
      const prev = current;
      current = hass;
      for (const l of listeners) {
        l(hass, prev);
      }
    },
    getListenerCount: () => listeners.size,
  };
};

export const createHASSManager = (options?: {
  hass?: HomeAssistant | null;
  stateWatcher?: StateWatcherSubscriptionInterface;
  eventWatcher?: EventWatcherSubscriptionInterface;
}): HASSManagerReadonlyInterface => {
  const hassManager = mock<HASSManagerReadonlyInterface>();
  hassManager.getHASS.mockReturnValue(
    options?.hass === undefined ? createHASS() : options.hass,
  );
  hassManager.getStateWatcher.mockReturnValue(
    options?.stateWatcher ?? mock<StateWatcherSubscriptionInterface>(),
  );
  hassManager.getEventWatcher.mockReturnValue(
    options?.eventWatcher ?? mock<EventWatcherSubscriptionInterface>(),
  );
  return hassManager;
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
    targetID: 'target-1',
    ...options,
  };
};

export const createMediaLoadedInfoEvent = (options?: {
  info?: MediaLoadedInfo;
  signal?: AbortSignal;
  // When set, overrides `composedPath()` to return `[source]`. Use this for
  // tests that hand the event directly to a handler (e.g. `handleLoadEvent`)
  // instead of dispatching it; jsdom only populates `composedPath` on real
  // dispatch.
  source?: HTMLElement;
}): CustomEvent<MediaLoadedInfoEventDetail> => {
  const ev = new CustomEvent<MediaLoadedInfoEventDetail>(
    'advanced-camera-card:media:loaded',
    {
      bubbles: true,
      composed: true,
      detail: {
        info: options?.info ?? createMediaLoadedInfo(),
        signal: options?.signal ?? new AbortController().signal,
      },
    },
  );
  if (options?.source) {
    Object.defineProperty(ev, 'composedPath', { value: () => [options.source] });
  }
  return ev;
};

export const stubMatchMedia = (): Mock => {
  const matchMedia = vi.fn();
  vi.stubGlobal('matchMedia', matchMedia);
  onTestFinished(() => {
    // There is no singular unstubGlobal.
    Reflect.deleteProperty(globalThis, 'matchMedia');
  });
  return matchMedia;
};

// A mock implementation must be callable with `new`, so it cannot be an arrow
// function.
const createObserverMock = () =>
  vi.fn(function () {
    return {
      disconnect: vi.fn(),
      observe: vi.fn(),
      unobserve: vi.fn(),
    };
  });

export const ResizeObserverMock = createObserverMock();

export const IntersectionObserverMock = createObserverMock();

export const MutationObserverMock = createObserverMock();

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
    configurable: true,
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

export const createCardHTMLElement = (): CardHTMLElement => {
  const element = createLitElement() as CardHTMLElement;
  element.getCardSize = vi.fn();
  element.setConfig = vi.fn();
  return element;
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

export const createMockTemplateRenderer = (): TemplateManager => {
  const renderer = mock<TemplateManager>();
  renderer.isLoaded.mockReturnValue(true);
  renderer.renderRecursively.mockImplementation((_hass, value) => value);
  renderer.renderRecursivelyAsType.mockImplementation((_hass, value) => value);
  return renderer;
};

// At import the real ha-nunjucks engine waits for a connected `home-assistant`
// element before finishing initialization, retrying on a timer that can outlive
// the test (and throw `document is not defined` once the environment is torn
// down). Test suites that load the real engine call this first, in a jsdom
// environment, so it initializes immediately as it does in a real Home
// Assistant frontend. Idempotent.
//
// Workaround for an upstream bug; remove once it is fixed:
// https://github.com/Nerwyn/ha-nunjucks/issues/11
export const stubConnectedHomeAssistant = (): void => {
  if (document.querySelector('home-assistant')) {
    return;
  }
  const ha = document.createElement('home-assistant');
  Object.assign(ha, {
    hass: {
      // The readiness gate the engine polls for.
      connected: true,
      connection: {
        connected: true,
        // Awaited by the engine's label-registry fetch during init.
        sendMessagePromise: () => Promise.resolve([]),
      },
      language: 'en',
      states: {},
    },
  });
  document.body.appendChild(ha);
};

export const createCardAPI = (): CardController => {
  const api = mock<CardController>();

  api.getActionsManager.mockReturnValue(mock<ActionsManager>());
  api.getAutomationsManager.mockReturnValue(mock<AutomationsManager>());
  api.getCallManager.mockReturnValue(mock<CallManager>());
  api.getDefaultManager.mockReturnValue(mock<DefaultManager>());
  api.getCameraManager.mockReturnValue(mock<CameraManager>());
  api.getCameraURLManager.mockReturnValue(mock<CameraURLManager>());
  api.getCardElementManager.mockReturnValue(mock<CardElementManager>());
  api.getConditionStateManager.mockReturnValue(mock<ConditionStateManager>());
  api.getConfigManager.mockReturnValue(mock<ConfigManager>());
  api.getEffectsManager.mockReturnValue(mock<EffectsManager>());
  api.getEntityRegistryManager.mockReturnValue(mock<EntityRegistryManager>());
  api.getExpandManager.mockReturnValue(mock<ExpandManager>());
  api.getFoldersManager.mockReturnValue(mock<FoldersManager>());
  api.getFullscreenManager.mockReturnValue(mock<FullscreenManager>());
  api.getHASSManager.mockReturnValue(mock<HASSManager>());

  const initializationManager = mock<InitializationManager>();
  initializationManager.getSessionManager.mockReturnValue(mock<SessionManager>());

  api.getInitializationManager.mockReturnValue(initializationManager);
  api.getInteractionManager.mockReturnValue(mock<InteractionManager>());
  api.getKeyboardStateManager.mockReturnValue(mock<KeyboardStateManager>());
  api.getLockManager.mockReturnValue(mock<LockManager>());
  api.getMediaLoadedInfoManager.mockReturnValue(mock<MediaLoadedInfoManager>());
  api.getMediaPlayerManager.mockReturnValue(mock<MediaPlayerManager>());
  api.getMicrophoneManager.mockReturnValue(mock<MicrophoneManager>());
  api.getNotificationManager.mockReturnValue(mock<NotificationManager>());
  api.getPIPManager.mockReturnValue(mock<PIPManager>());

  const issueManager = mock<IssueManager>();
  issueManager.getStateManager.mockReturnValue(mock<IssueStateManager>());
  api.getIssueManager.mockReturnValue(issueManager);

  api.getQueryStringManager.mockReturnValue(mock<QueryStringManager>());
  api.getStatusBarItemManager.mockReturnValue(mock<StatusBarItemManager>());
  api.getStyleManager.mockReturnValue(mock<StyleManager>());
  api.getTemplateManager.mockReturnValue(mock<TemplateManager>());
  api.getCameraTriggersManager.mockReturnValue(mock<CameraTriggersManager>());
  api.getViewItemManager.mockReturnValue(mock<ViewItemManager>());
  const viewManager = mock<ViewManager>();
  vi.mocked(viewManager.handleCameraLifecycleChange).mockResolvedValue();
  api.getViewManager.mockReturnValue(viewManager);

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

export const callEventWatcherCallback = (
  eventWatcher: EventWatcherSubscriptionInterface,
  event: HassEvent,
  n = 0,
): void => {
  const mock = vi.mocked(eventWatcher.subscribe).mock;
  expect(mock.calls.length).greaterThan(n);
  mock.calls[n][0].callback(event);
};

export const createHASSEvent = (
  event_type: string,
  data: Record<string, unknown> = {},
  context: HassEvent['context'] = { id: 'ctx', user_id: null, parent_id: null },
): HassEvent => ({
  event_type,
  data,
  origin: 'LOCAL',
  time_fired: '2026-06-19T21:12:18Z',
  context,
});

/**
 * Flush resolved promises.
 */
export const flushPromises = async (): Promise<void> => {
  await new Promise(process.nextTick);
};

/**
 * Install fake timers and pin Math.random to 1 (max jitter), so exponential
 * backoff retry delays advance by exact, predictable durations.
 */
export const useDeterministicTimers = (): void => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(1);
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
