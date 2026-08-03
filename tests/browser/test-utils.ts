import { userEvent } from 'vitest/browser';

import type { RawAdvancedCameraCardConfig } from '../../src/config/types';
import type { MediaLoadedInfoEventDetail } from '../../src/types';
import { createLogAction } from '../../src/utils/action';
import { FakeHASS, type FakeEntityOptions } from './fake-hass';
import { isTestMediaInUse } from './test-media';

export const STILL_CAMERA_ENTITY = 'camera.office';

const STILL_FIXTURE_FILENAME = 'still-red.png';

// A same-origin still red image, served by the Vite dev server. The same image
// is handed on by the worker in test-media.ts, which can be asked to misbehave
// in useful ways.
const STILL_FIXTURE_URL = `/tests/browser/fixtures/${STILL_FIXTURE_FILENAME}`;

/**
 * A card showing one still image and nothing else: no stream, no transport and
 * no refresh timer, so what is under test is the card rather than the media.
 *
 * The `image` provider requires a `camera_entity` with a state even in
 * `mode: url`, where nothing reads that entity. Without one it renders a
 * configuration error instead of the image.
 */
export const createStillImageCameraConfig = (
  cameraEntity: string = STILL_CAMERA_ENTITY,
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
 * A media URL answered with the given statuses in order. Once they run out
 * every request after them is answered as the last one was, or, if the camera
 * is meant to go quiet, never answered at all.
 *
 * Every URL carries its own counter, since one worker serves every test in a
 * file and a shared counter would make a test depend on what ran before it.
 */
const createMediaURL = (responses: number[], repeat = false): string => {
  if (!isTestMediaInUse()) {
    throw new Error(
      'Media that misbehaves must be served in a file using useTestMedia().',
    );
  }

  return (
    `/test-media/${STILL_FIXTURE_FILENAME}?` +
    new URLSearchParams({
      token: crypto.randomUUID(),
      responses: responses.join(','),
      repeat: String(repeat),
    }).toString()
  );
};

/**
 * A media URL that fails the given number of times and then works from there
 * on, so a test can make a camera recover rather than only fail.
 */
export const createTemporarilyFailingMediaURL = (failures: number): string =>
  createMediaURL([...Array(failures).fill(HTTP_NOT_FOUND), HTTP_OK], true);

/**
 * A media URL that never works, for a camera that is simply broken.
 */
export const createFailingMediaURL = (): string =>
  createMediaURL([HTTP_NOT_FOUND], true);

/**
 * A media URL that is never answered, for a camera that accepts the request and
 * then says nothing. Silence is a different failure from a refusal, and the
 * only one that can run a loading timeout out.
 */
export const createUnansweredMediaURL = (): string => createMediaURL([]);

/**
 * A media URL that answers once and is then never answered again, for a camera
 * that delivers a picture and goes quiet behind it.
 */
export const createStallingMediaURL = (): string => createMediaURL([HTTP_OK]);

export interface StillCameraHASSOptions {
  // Camera entities beyond the default one.
  cameras?: string[];

  // Anything else the card should be able to see, as entity ID to state.
  entities?: Record<string, FakeEntityOptions | string>;
}

/**
 * A Home Assistant holding the cameras a card is about to be given, which is
 * the minimum any browser test needs before it can mount anything.
 */
export const createStillCameraHASS = (options?: StillCameraHASSOptions): FakeHASS => {
  const cameras = [STILL_CAMERA_ENTITY, ...(options?.cameras ?? [])];

  return new FakeHASS({
    entities: {
      ...Object.fromEntries(cameras.map((camera) => [camera, { state: 'idle' }])),
      ...options?.entities,
    },
    registry: Object.fromEntries(cameras.map((camera) => [camera, {}])),
  });
};

export const createStillImageCardConfig = (
  overrides?: Partial<RawAdvancedCameraCardConfig>,
): RawAdvancedCameraCardConfig => ({
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
