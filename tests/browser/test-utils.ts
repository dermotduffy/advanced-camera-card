import { userEvent } from 'vitest/browser';

import type {
  PartialAdvancedCameraCardConfig,
  RawAdvancedCameraCardConfig,
} from '../../src/config/types';
import type { Entity } from '../../src/ha/registry/entity/types';
import type { MediaLoadedInfoEventDetail } from '../../src/types';
import { createLogAction } from '../../src/utils/action';
import { isTruthy } from '../../src/utils/basic';
import { FakeHASS, type FakeEntityOptions } from './fake-hass';
import { createFixtureURL, SNAPSHOT_FIXTURE_FILENAME } from './fixtures';
import type { MountedCard } from './mounted-card';
import { createTestMediaURL } from './test-media';

export const CAMERA_ENTITY = 'camera.office';

// A same-origin still red image, served by the Vite dev server. The same image
// is handed on by the worker in test-media.ts, which can be asked to misbehave
// in useful ways.
const STILL_FIXTURE_URL = createFixtureURL(SNAPSHOT_FIXTURE_FILENAME);

/**
 * A card showing one still image and nothing else: no stream, no transport and
 * no refresh timer, so what is under test is the card rather than the media.
 *
 * The `image` provider requires a `camera_entity` with a state even in
 * `mode: url`, where nothing reads that entity. Without one it renders a
 * configuration error instead of the image.
 */
export const createStillImageCameraConfig = (
  cameraEntity: string = CAMERA_ENTITY,
  url: string = STILL_FIXTURE_URL,
): RawAdvancedCameraCardConfig => ({
  camera_entity: cameraEntity,
  live_provider: 'image',
  image: {
    mode: 'url',
    url,
    refresh_seconds: 0,
  },
});

const HTTP_NOT_FOUND = 404;
const HTTP_OK = 200;

/**
 * A media URL that fails the given number of times and then works from there
 * on, so a test can make a camera recover rather than only fail.
 */
export const createTemporarilyFailingMediaURL = (
  failures: number,
  filename?: string,
): string =>
  createTestMediaURL([...Array(failures).fill(HTTP_NOT_FOUND), HTTP_OK], true, filename);

/**
 * A media URL that never works, for a camera that is simply broken.
 */
export const createFailingMediaURL = (): string =>
  createTestMediaURL([HTTP_NOT_FOUND], true);

/**
 * A media URL that is never answered, for a camera that accepts the request and
 * then says nothing. Silence is a different failure from a refusal, and the
 * only one that can run a loading timeout out.
 */
export const createUnansweredMediaURL = (): string => createTestMediaURL([]);

/**
 * A media URL that answers once and is then never answered again, for a camera
 * that delivers a picture and goes quiet behind it.
 */
export const createStallingMediaURL = (filename?: string): string =>
  createTestMediaURL([HTTP_OK], false, filename);

export interface FakeCameraDescription {
  entityID: string;
  entity: FakeEntityOptions;
  registry: Partial<Entity>;
}

const createGenericCameraDescription = (
  entityID: string = CAMERA_ENTITY,
): FakeCameraDescription => ({
  entityID,
  entity: { state: 'idle' },
  registry: {},
});

export interface CameraHASSOptions {
  // Anything that is not a camera the card should be able to see, such as a
  // motion sensor. These get a state and no entity registry entry.
  entities?: Record<string, FakeEntityOptions | string>;

  // The language Home Assistant is set to for translation tests.
  language?: string;
}

/**
 * A Home Assistant holding the cameras a card is about to be given, which is
 * the minimum any browser test needs before it can mount anything.
 */
export const createCameraHASS = (
  cameras: FakeCameraDescription[],
  options?: CameraHASSOptions,
): FakeHASS =>
  new FakeHASS({
    entities: {
      ...Object.fromEntries(cameras.map((camera) => [camera.entityID, camera.entity])),
      ...options?.entities,
    },
    registry: Object.fromEntries(
      cameras.map((camera) => [camera.entityID, camera.registry]),
    ),
    ...(options?.language && { language: options.language }),
  });

export interface GenericCameraHASSOptions extends CameraHASSOptions {
  // Camera entities beyond `CAMERA_ENTITY`, which is always present. Each gets
  // a state and an entity registry entry, which is what the card reads to
  // resolve a camera and choose its engine.
  cameras?: string[];
}

/**
 * A Home Assistant whose cameras all belong to no named integration, for a test
 * that is about the card rather than about where its media comes from.
 */
export const createGenericCameraHASS = (
  options?: GenericCameraHASSOptions,
): FakeHASS => {
  const { cameras, ...hassOptions } = options ?? {};

  return createCameraHASS(
    [CAMERA_ENTITY, ...(cameras ?? [])].map((camera) =>
      createGenericCameraDescription(camera),
    ),
    hassOptions,
  );
};

export const createStillImageCardConfig = (
  overrides?: PartialAdvancedCameraCardConfig,
): PartialAdvancedCameraCardConfig => ({
  type: 'custom:advanced-camera-card',
  cameras: [createStillImageCameraConfig()],

  // The loading screen fades out over a second and a half once the card is
  // ready. Disable it to improve screenshot fidelity.
  performance: { features: { card_loading_indicator: false } },

  ...overrides,
});

// What an initialized card writes, as the pattern the console is searched for.
export const CARD_INITIALIZED_MESSAGE = /card initialized/;

/**
 * An automation that reports every time the card finishes initializing. A card
 * announces nothing else when it is ready to be acted on, and it initializes
 * again each time it returns to the page or Home Assistant comes back, so a
 * test that acts on a card too early sees nothing happen.
 */
export const createInitializedAutomation = (): RawAdvancedCameraCardConfig => ({
  triggers: [{ trigger: 'initialized' }],
  actions: [createLogAction(CARD_INITIALIZED_MESSAGE.source)],
});

// `querySelectorAll` does not look inside a shadow root, so a full search has
// to step through them a level at a time. The node's own root counts because a
// Lit element renders into that, not into its children.
const getImmediateShadowRoots = (root: ParentNode): ShadowRoot[] => {
  const roots = root instanceof Element && root.shadowRoot ? [root.shadowRoot] : [];
  for (const child of root.querySelectorAll('*')) {
    if (child.shadowRoot) {
      roots.push(child.shadowRoot);
    }
  }
  return roots;
};

/**
 * Get every shadow root at or below an element.
 */
export const getAllShadowRoots = (root: ParentNode): ShadowRoot[] =>
  getImmediateShadowRoots(root).flatMap((child) => [child, ...getAllShadowRoots(child)]);

/**
 * Search an element and every shadow root beneath it. The card nests its own
 * components several roots deep, and neither the source tree nor the node
 * suite has a helper for this.
 */
export const deepQuery = <T extends Element = Element>(
  root: ParentNode,
  selector: string,
): T | null => {
  const direct = root.querySelector<T>(selector);
  if (direct) {
    return direct;
  }
  for (const child of getImmediateShadowRoots(root)) {
    const found = deepQuery<T>(child, selector);
    if (found) {
      return found;
    }
  }
  return null;
};

/**
 * Every match for a selector across an element and the shadow roots beneath it,
 * for asking how many of something the card rendered rather than whether it
 * rendered any.
 */
export const deepQueryAll = <T extends Element = Element>(
  root: ParentNode,
  selector: string,
): T[] => [
  ...root.querySelectorAll<T>(selector),
  ...getImmediateShadowRoots(root).flatMap((child) => deepQueryAll<T>(child, selector)),
];

export const isMediaLoadedInfoEventDetail = (
  detail: unknown,
): detail is MediaLoadedInfoEventDetail =>
  !!detail &&
  typeof detail === 'object' &&
  'info' in detail &&
  'signal' in detail &&
  detail.signal instanceof AbortSignal;

/**
 * The text of a block notification rendered in place of content (e.g. full-card
 * issues).
 */
export const getBlockNotificationText = (root: ParentNode): string =>
  deepQuery(root, 'advanced-camera-card-notification-block')?.shadowRoot?.textContent ??
  '';

// Everything a provider can draw media on: an image, a video, or a canvas.
const MEDIA_SELECTOR = 'img, video, canvas';

export const isLiveMediaShowing = (root: ParentNode): boolean =>
  deepQueryAll(root, 'advanced-camera-card-live-provider').some(
    (provider) => !!deepQuery(provider, MEDIA_SELECTOR),
  );

/**
 * Wait until the card has been told an element is on screen.
 *
 * Parts of the card only begin work once an element becomes visible, being
 * notified by an `IntersectionObserver`. A test cannot reach those observers,
 * but it can make one of its own: a document notifies its observers in the
 * order they were created, so one created after the card's is strictly called
 * after them. As such, by the time this function reports the element, the
 * card's intersection observer callback has already run and whatever it started
 * is deterministically under way.
 *
 * Name the element the card is itself watching, e.g.
 * `advanced-camera-card-live-provider` for liveness detection. It is waited for
 * rather than taken as an element, since the card makes its observer when the
 * element connects: observing beforehand would make this the earlier of the two
 * and run the ordering above the other way.
 */
export const waitUntilObservedVisible = async (
  card: MountedCard,
  selector: string,
): Promise<void> => {
  const element = await card.waitForSelector(selector);

  await new Promise<void>((resolve) => {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        resolve();
      }
    });
    observer.observe(element);
  });
};

/**
 * Where a media element is being served from.
 */
const getMediaURL = (media: Element): string | null => {
  if (media instanceof HTMLImageElement || media instanceof HTMLMediaElement) {
    return media.currentSrc || media.getAttribute('src') || null;
  }
  return null;
};

/**
 * Every media the media viewer has loaded, in the order it rendered them. The
 * viewer holds a provider per media item and each loads once it has been on
 * screen, so this is one entry per media a test has visited.
 */
export const getMediaViewerMediaURLs = (root: ParentNode): string[] =>
  deepQueryAll(root, 'advanced-camera-card-viewer-provider')
    .map((provider) => deepQuery(provider, MEDIA_SELECTOR))
    .map((media) => (media ? getMediaURL(media) : null))
    .filter((url) => url !== null);

/**
 * The thumbnails on screen.
 */
export const getThumbnails = (root: ParentNode): HTMLElement[] =>
  deepQueryAll<HTMLElement>(root, 'advanced-camera-card-thumbnail');

export const getSelectedThumbnail = (root: ParentNode): HTMLElement | null =>
  deepQuery<HTMLElement>(root, 'advanced-camera-card-thumbnail.slide-selected');

export const clickThumbnail = async (root: ParentNode, index: number): Promise<void> => {
  const thumbnail = getThumbnails(root)[index];
  if (!thumbnail) {
    throw new Error(`There is no thumbnail at index ${index} to click`);
  }
  await clickElement(thumbnail);
};

export const waitForThumbnails = async (
  card: MountedCard,
  count: number,
): Promise<void> => {
  await card.waitForRender(
    () => (getThumbnails(card.card).length >= count ? true : null),
    `${count} thumbnail(s)`,
  );
};

/**
 * Wait until the media viewer has loaded a media whose URL contains the given
 * text, which is how a test waits for the media it asked for to arrive.
 */
export const waitForMediaViewerMedia = async (
  card: MountedCard,
  url: string,
): Promise<void> => {
  await card.waitForRender(
    () =>
      getMediaViewerMediaURLs(card.card).some((shown) => shown.includes(url)) || null,
    `the media viewer showing ${url}`,
  );
};

/**
 * Move the media viewer to the next or previous media.
 *
 * A next/previous control has no size of its own: what is drawn and positioned
 * is within it, so that is what a real pointer can reach.
 */
export const clickNextPreviousMedia = async (
  root: ParentNode,
  side: 'left' | 'right',
): Promise<void> => {
  const control = deepQuery(
    root,
    `advanced-camera-card-next-previous-control[slot="${side}"]`,
  );
  const clickable = control ? deepQuery(control, '.controls') : null;
  if (!clickable) {
    throw new Error(`The media viewer is showing no ${side} control`);
  }
  await clickElement(clickable);
};

// Everything the status bar is displaying gets this class, whether it is a
// string, an icon or an image.
const STATUS_BAR_ITEM_SELECTOR = '.item';

const getStatusBarItems = (root: ParentNode): Element[] => [
  ...(deepQuery(root, 'advanced-camera-card-status-bar')?.shadowRoot?.querySelectorAll(
    STATUS_BAR_ITEM_SELECTOR,
  ) ?? []),
];

/**
 * What the status bar is displaying, one entry per item, in the order shown.
 * Items with no text of their own (an icon, an image) are omitted.
 */
export const getStatusBarStrings = (root: ParentNode): string[] =>
  getStatusBarItems(root)
    .map((item) => (item.textContent ?? '').trim())
    .filter(isTruthy);

/**
 * Get a status bar item by the title it carries.
 */
export const getStatusBarItem = (root: ParentNode, title: string): Element | null =>
  getStatusBarItems(root).find((item) => item.getAttribute('title') === title) ?? null;

// `userEvent.keyboard` is given one string naming every key to press, in which
// a name of more than one character is wrapped in braces (`{Escape}`) and a
// single character stands for itself.
// See: https://vitest.dev/guide/browser/interactivity-api.html#userevent-keyboard
const asKeyboardInput = (key: string): string => (key.length === 1 ? key : `{${key}}`);

export const pressKey = async (key: string): Promise<void> =>
  await userEvent.keyboard(asKeyboardInput(key));

export const holdKey = async (key: string): Promise<void> =>
  await userEvent.keyboard(`{${key}>}`);

export const releaseKey = async (key: string): Promise<void> =>
  await userEvent.keyboard(`{/${key}}`);

export const pressTab = async (): Promise<void> => await userEvent.tab();

/**
 * Click an element with a real pointer, which is the only kind that carries the
 * browser's own behaviour: the press moves focus, and an element that stops the
 * press doing so leaves it where it was.
 */
export const clickElement = async (element: Element): Promise<void> =>
  await userEvent.click(element);

/**
 * Send a `pointerdown` to an element without moving a real pointer, so the page
 * stays scrolled where the test left it: `clickElement` scrolls its target into
 * view before pressing it.
 *
 * The browser does nothing of its own with a press it did not itself deliver,
 * so what follows is only what the card's own listener does.
 */
export const dispatchPointerDown = (element: Element): void => {
  element.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, composed: true }),
  );
};

/**
 * The element that actually has focus. `document.activeElement` names the
 * outermost shadow host in the way, since focus is reported per tree.
 */
export const getFocusedElement = (): Element | null => {
  let focused = document.activeElement;
  while (focused?.shadowRoot?.activeElement) {
    focused = focused.shadowRoot.activeElement;
  }
  return focused;
};
