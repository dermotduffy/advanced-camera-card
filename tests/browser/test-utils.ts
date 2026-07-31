import type { RawAdvancedCameraCardConfig } from '../../src/config/types';
import { FakeHASS, type FakeEntityOptions } from './fake-hass';

export const STILL_CAMERA_ENTITY = 'camera.office';

const STILL_FIXTURE_FILENAME = 'still-red.png';

// A same-origin still red image, served by the Vite dev server. The same image
// is also served by the test-media plugin, which can be asked to misbehave in
// useful ways. See test-media-server-plugin.js .
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
 * A media URL answered with the given statuses in order, and never answered at
 * all once they run out.
 *
 * Every URL carries its own counter, since one server serves a whole run and a
 * shared counter would make a test depend on what ran before it.
 */
const createMediaURL = (responses: number[]): string =>
  `/test-media/${STILL_FIXTURE_FILENAME}?` +
  new URLSearchParams({
    token: crypto.randomUUID(),
    responses: responses.join(','),
  }).toString();

/**
 * A media URL that fails the given number of times and then works, so a test
 * can make a camera recover rather than only fail.
 */
export const createTemporarilyFailingMediaURL = (failures: number): string =>
  createMediaURL([...Array(failures).fill(HTTP_NOT_FOUND), HTTP_OK]);

/**
 * A media URL that never works, for a camera that is simply broken.
 */
export const createFailingMediaURL = (): string => createMediaURL([HTTP_NOT_FOUND]);

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

// Everything a provider can draw media on: an image, a video, or a canvas.
const MEDIA_SELECTOR = 'img, video, canvas';

export const isLiveMediaShowing = (root: ParentNode): boolean =>
  deepQueryAll(root, 'advanced-camera-card-live-provider').some(
    (provider) => !!deepQuery(provider, MEDIA_SELECTOR),
  );
