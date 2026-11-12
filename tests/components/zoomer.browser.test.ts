import { describe, expect, it } from 'vitest';

import { dispatchActionExecutionRequest } from '../../src/card-controller/actions/utils/execution-request';
import { MergeContextViewModifier } from '../../src/card-controller/view/modifiers/merge-context';
import { ZoomRequestViewModifier } from '../../src/card-controller/view/modifiers/zoom-request';
import type { ViewManagerInterface } from '../../src/card-controller/view/types';
import type { ZoomSettingsObserved } from '../../src/components-lib/zoom/types';
import type { MediaLayoutConfig } from '../../src/config/schema/camera/media-layout';
import type { PartialAdvancedCameraCardConfig } from '../../src/config/types';
import { createPTZDigitalAction } from '../../src/utils/action';
import { arefloatsApproximatelyEqual, isHoverableDevice } from '../../src/utils/basic';
// The built card defines the zoomer as it starts, before any media can load.
// Unbundled, the media viewer's own import of it can finish after its media
// has already loaded.
import '../../src/components/zoomer';

import { deepQuery } from '../browser/dom';
import {
  createTestFrigateEvent,
  EVENT_TIME_NEWER,
  mountCardWithFrigate,
} from '../browser/fake-frigate';
import { createFixtureURL, SNAPSHOT_FIXTURE_FILENAME } from '../browser/fixtures';
import { MountedCardFactory, type MountedCard } from '../browser/mounted-card';
import {
  CAMERA_ENTITY,
  clickThumbnail,
  createGenericCameraHASS,
  createStillImageCameraConfig,
  createStillImageCardConfig,
  isZoomSettingsObserved,
  waitForThumbnails,
} from '../browser/test-utils';

const ZOOM_CHANGE_EVENT = 'advanced-camera-card:zoom:change';
const ZOOM_HOME_EVENT = 'advanced-camera-card:zoom:home';

// A zoom with a pan well away from center so that a pan applied at the wrong
// magnitude is unmistakable.
// See: https://github.com/dermotduffy/advanced-camera-card/issues/2223
const CONFIGURED_LAYOUT = { zoom: 2.6, pan: { x: 0, y: 45 } };

const mount = async (
  layout?: MediaLayoutConfig,
  overrides?: PartialAdvancedCameraCardConfig,
): Promise<MountedCard> =>
  await MountedCardFactory.createFromSource(
    createStillImageCardConfig({
      ...(layout && {
        cameras: [{ ...createStillImageCameraConfig(), dimensions: { layout } }],
      }),
      ...overrides,
    }),
    createGenericCameraHASS(),
    { ledgerEvents: [ZOOM_HOME_EVENT] },
  );

// The zoom reports the card has made since the first `after` of them.
const getZoomReports = (card: MountedCard, after: number): ZoomSettingsObserved[] =>
  card.events
    .getEntries(ZOOM_CHANGE_EVENT)
    .slice(after)
    .map((entry) => entry.detail)
    .filter(isZoomSettingsObserved);

const waitForZoomReport = async (
  card: MountedCard,
  after: number,
  matches: (report: ZoomSettingsObserved) => boolean,
  description: string,
): Promise<void> => {
  await card.waitForRender(
    () => getZoomReports(card, after).find(matches) ?? null,
    description,
  );
};

const isConfiguredZoomAndPan = (report: ZoomSettingsObserved): boolean =>
  arefloatsApproximatelyEqual(report.zoom, CONFIGURED_LAYOUT.zoom, 1) &&
  arefloatsApproximatelyEqual(report.pan.x, CONFIGURED_LAYOUT.pan.x, 1) &&
  arefloatsApproximatelyEqual(report.pan.y, CONFIGURED_LAYOUT.pan.y, 1);

const isZoom =
  (zoom: number) =>
  (report: ZoomSettingsObserved): boolean =>
    arefloatsApproximatelyEqual(report.zoom, zoom, 1);

describe('AdvancedCameraCardZoomer', () => {
  it('should respect the configured pan even when activated during an animation frame', async () => {
    const card = await mount(CONFIGURED_LAYOUT);
    await waitForZoomReport(
      card,
      0,
      isConfiguredZoomAndPan,
      'the configured zoom and pan',
    );
    const zoomer = await card.waitForSelector<HTMLElement>(
      'advanced-camera-card-zoomer',
    );
    const reportsBefore = card.events.getEntries(ZOOM_CHANGE_EVENT).length;

    // Re-attaching inside an animation frame runs the new zoomer's first
    // ResizeObserver callback in that same frame, before Panzoom writes its
    // transform on the next one.
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        card.detach();
        card.attach();
        resolve();
      });
    });

    await waitForZoomReport(
      card,
      reportsBefore,
      isConfiguredZoomAndPan,
      'the configured zoom and pan',
    );

    const reattached = await card.waitForSelector<HTMLElement>(
      'advanced-camera-card-zoomer',
    );
    expect(reattached).not.toBe(zoomer);
  });
});

// One tap in the middle of the element, with the events this device's zoom
// controller listens to (pointer events where the device can hover, else
// touch events).
const tap = (element: HTMLElement): void => {
  const rect = element.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;

  if (isHoverableDevice()) {
    const init = {
      bubbles: true,
      clientX: x,
      clientY: y,
      pointerId: 1,
      isPrimary: true,
    };
    element.dispatchEvent(new PointerEvent('pointerdown', init));
    element.dispatchEvent(new PointerEvent('pointerup', init));
    return;
  }

  const touch = new Touch({ identifier: 1, target: element, clientX: x, clientY: y });
  element.dispatchEvent(
    new TouchEvent('touchstart', {
      bubbles: true,
      touches: [touch],
      changedTouches: [touch],
    }),
  );
  element.dispatchEvent(
    new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [touch] }),
  );
};

describe('AdvancedCameraCardZoomer double tap', () => {
  it('should return to the default zoom on a double tap but not a single tap', async () => {
    const card = await mount();
    const zoomer = await card.waitForSelector<HTMLElement>(
      'advanced-camera-card-zoomer',
    );
    await waitForZoomReport(card, 0, isZoom(1), 'zoom 1');

    // Zoom in the way a user's `ptz_digital` button with `absolute` does.
    const beforeZoom = card.events.getEntries(ZOOM_CHANGE_EVENT).length;
    dispatchActionExecutionRequest(zoomer, {
      actions: createPTZDigitalAction({ absolute: { zoom: 3, pan: { x: 20, y: 20 } } }),
    });
    await waitForZoomReport(card, beforeZoom, isZoom(3), 'zoom 3');

    const beforeTap = card.events.getEntries(ZOOM_CHANGE_EVENT).length;
    tap(zoomer);
    expect(card.events.getEntries(ZOOM_HOME_EVENT)).toHaveLength(0);

    tap(zoomer);
    expect(card.events.getEntries(ZOOM_HOME_EVENT)).toHaveLength(1);
    await waitForZoomReport(card, beforeTap, isZoom(1), 'zoom 1');
  });
});

describe('AdvancedCameraCardZoomer default zoom', () => {
  const PTZ_HOME = 'PTZ Home';

  const PTZ_HOME_MENU: PartialAdvancedCameraCardConfig = {
    menu: { style: 'outside', buttons: { ptz_home: { enabled: true } } },
  };

  // `findControl` waits for a control to appear, so absence is checked directly.
  const hasPTZHomeButton = (card: MountedCard): boolean =>
    !!deepQuery(card.card, `[title="${PTZ_HOME}"]`);

  const waitForNoPTZHomeButton = async (card: MountedCard): Promise<void> => {
    await card.waitForRender(
      () => (hasPTZHomeButton(card) ? null : true),
      `no ${PTZ_HOME} button`,
    );
  };

  const zoomTo = async (card: MountedCard, zoom: number): Promise<void> => {
    const zoomer = await card.waitForSelector<HTMLElement>(
      'advanced-camera-card-zoomer',
    );
    const before = card.events.getEntries(ZOOM_CHANGE_EVENT).length;
    dispatchActionExecutionRequest(zoomer, {
      actions: createPTZDigitalAction({ absolute: { zoom, pan: { x: 50, y: 50 } } }),
    });
    await waitForZoomReport(card, before, isZoom(zoom), `zoom ${zoom}`);
  };

  it('should offer PTZ Home while zoomed in with a layout that sets no zoom', async () => {
    const card = await mount({ fit: 'cover' }, PTZ_HOME_MENU);
    await waitForZoomReport(
      card,
      0,
      (report) => isZoom(1)(report) && report.isDefault,
      'a default zoom 1',
    );
    expect(hasPTZHomeButton(card)).toBe(false);

    await zoomTo(card, 3);
    expect(getZoomReports(card, 0).at(-1)?.isDefault).toBe(false);

    const beforeHome = card.events.getEntries(ZOOM_CHANGE_EVENT).length;
    await card.clickControl(PTZ_HOME);
    await waitForZoomReport(
      card,
      beforeHome,
      (report) => isZoom(1)(report) && report.isDefault,
      'a default zoom 1',
    );
    await waitForNoPTZHomeButton(card);
  });

  it('should only offer PTZ Home away from the zoom a layout sets', async () => {
    const card = await mount(CONFIGURED_LAYOUT, PTZ_HOME_MENU);
    await waitForZoomReport(
      card,
      0,
      (report) => isConfiguredZoomAndPan(report) && report.isDefault,
      'the configured zoom and pan as default',
    );
    expect(hasPTZHomeButton(card)).toBe(false);

    await zoomTo(card, 4);
    expect(await card.findControl(PTZ_HOME)).not.toBeNull();
  });
});

describe('AdvancedCameraCardZoomer picture limits', () => {
  // A portrait card around a 16:9 picture, so the picture has bars above and
  // below it, as a camera does in fullscreen on a phone held upright.
  const createPortraitConfig = (
    layout: MediaLayoutConfig,
  ): PartialAdvancedCameraCardConfig => ({
    cameras: [{ ...createStillImageCameraConfig(), dimensions: { layout } }],
    dimensions: { aspect_ratio_mode: 'static', aspect_ratio: [9, 16] },
  });

  const mountLiveView = async (layout: MediaLayoutConfig): Promise<MountedCard> =>
    await MountedCardFactory.createFromSource(
      createStillImageCardConfig(createPortraitConfig(layout)),
      createGenericCameraHASS(),
    );

  // The `ha` provider's player never loads in the harness, so the loading image
  // stays in its place.
  const mountLiveViewWhileStreamLoads = async (
    layout: MediaLayoutConfig,
  ): Promise<MountedCard> =>
    await MountedCardFactory.createFromSource(
      createStillImageCardConfig({
        ...createPortraitConfig(layout),
        cameras: [
          {
            ...createStillImageCameraConfig(),
            live_provider: 'ha',
            dimensions: { layout },
          },
        ],
        live: { show_image_during_load: true },
      }),
      createGenericCameraHASS(),
    );

  const mountImageView = async (layout: MediaLayoutConfig): Promise<MountedCard> =>
    await MountedCardFactory.createFromSource(
      createStillImageCardConfig({
        ...createPortraitConfig(layout),
        view: { default: 'image' },
        image: { mode: 'camera' },
      }),
      createGenericCameraHASS({
        entities: {
          [CAMERA_ENTITY]: {
            state: 'idle',
            attributes: { entity_picture: createFixtureURL(SNAPSHOT_FIXTURE_FILENAME) },
          },
        },
      }),
    );

  // The still snapshot is 16:9 and the clip 4:3: both have bars above and below
  // in the portrait card.
  const createMediaViewerMount =
    (gallery: 'clips' | 'snapshots') =>
    async (layout: MediaLayoutConfig): Promise<MountedCard> => {
      const { card } = await mountCardWithFrigate(
        [createTestFrigateEvent('event', EVENT_TIME_NEWER)],
        { ...createPortraitConfig(layout), view: { default: gallery } },
      );
      await waitForThumbnails(card, 1);
      await clickThumbnail(card.card, 0);
      return card;
    };

  const VIEWS = [
    ['live view', mountLiveView],
    ['live view while its stream loads', mountLiveViewWhileStreamLoads],
    ['image view', mountImageView],
    ['media viewer showing a snapshot', createMediaViewerMount('snapshots')],
    ['media viewer playing a clip', createMediaViewerMount('clips')],
  ] satisfies [string, (layout: MediaLayoutConfig) => Promise<MountedCard>][];

  const isZoomAndPan =
    (zoom: number, x: number, y: number) =>
    (report: ZoomSettingsObserved): boolean =>
      arefloatsApproximatelyEqual(report.zoom, zoom, 1) &&
      arefloatsApproximatelyEqual(report.pan.x, x, 1) &&
      arefloatsApproximatelyEqual(report.pan.y, y, 1);

  // The vertical translation Panzoom applied to the zoomer, in its unscaled
  // pixels (its transform is `scale(s) translate(x, y)`).
  const getTranslateY = (zoomer: HTMLElement): number | null => {
    if (!zoomer.style.transform) {
      return null;
    }
    const matrix = new DOMMatrix(zoomer.style.transform);
    return matrix.f / matrix.a;
  };

  const waitForTranslateY = async (
    card: MountedCard,
    zoomer: HTMLElement,
    y: number,
  ): Promise<void> => {
    await card.waitForRender(() => {
      const translateY = getTranslateY(zoomer);
      return translateY !== null && Math.abs(translateY - y) < 0.5 ? true : null;
    }, `a zoomer translated by ${y}px vertically`);
  };

  it.each(VIEWS)(
    'should keep the picture centered on an axis it does not fill in the %s',
    async (_view, mountView) => {
      const card = await mountView({ zoom: 2, pan: { x: 0, y: 0 } });
      const zoomer = await card.waitForSelector<HTMLElement>(
        'advanced-camera-card-zoomer',
      );

      // Only reported once the picture's shape is known: until then the element
      // bounds the pan, and the configured top is reported.
      await waitForZoomReport(
        card,
        0,
        isZoomAndPan(2, 0, 50),
        'zoom 2 centered vertically',
      );
      await waitForTranslateY(card, zoomer, 0);
    },
  );

  it.each(VIEWS)(
    'should keep the element limits when the picture covers it in the %s',
    async (_view, mountView) => {
      const card = await mountView({ fit: 'cover', zoom: 2, pan: { x: 0, y: 0 } });
      const zoomer = await card.waitForSelector<HTMLElement>(
        'advanced-camera-card-zoomer',
      );

      await waitForZoomReport(card, 0, isZoomAndPan(2, 0, 0), 'zoom 2 at the top left');

      // At the element's top edge: a quarter of its height, in unscaled pixels.
      await waitForTranslateY(card, zoomer, zoomer.offsetHeight / 4);
    },
  );
});

describe('AdvancedCameraCardZoomer after a remount', () => {
  const ZOOMED = { zoom: 3, pan: { x: 20, y: 20 } };

  const isZoomed = (report: ZoomSettingsObserved): boolean =>
    arefloatsApproximatelyEqual(report.zoom, ZOOMED.zoom, 1) &&
    arefloatsApproximatelyEqual(report.pan.x, ZOOMED.pan.x, 1) &&
    arefloatsApproximatelyEqual(report.pan.y, ZOOMED.pan.y, 1);

  // Zoom in the way a user's `ptz_digital` button with `absolute` does. The
  // request is only in the view context until the first zoom report, which
  // replaces it, so a remount afterwards relies on the observed zoom.
  const zoomIn = async (card: MountedCard): Promise<HTMLElement> => {
    const zoomer = await card.waitForSelector<HTMLElement>(
      'advanced-camera-card-zoomer',
    );
    await waitForZoomReport(card, 0, isZoom(1), 'zoom 1');
    const before = card.events.getEntries(ZOOM_CHANGE_EVENT).length;
    dispatchActionExecutionRequest(zoomer, {
      actions: createPTZDigitalAction({ absolute: ZOOMED }),
    });
    await waitForZoomReport(card, before, isZoomed, 'the zoom in');
    return zoomer;
  };

  const getViewManager = (card: MountedCard): ViewManagerInterface =>
    (
      card.card as unknown as { _controller: { getViewManager(): ViewManagerInterface } }
    )._controller.getViewManager();

  it('should keep the zoom and pan through a stream reload', async () => {
    const card = await mount();
    const zoomer = await zoomIn(card);
    const before = card.events.getEntries(ZOOM_CHANGE_EVENT).length;

    // As the card's own auto-retry does: a new epoch remounts the provider.
    const viewManager = getViewManager(card);
    const cameraID = viewManager.getView()?.camera ?? '';
    viewManager.setViewWithMergedContext({
      mediaRetry: { [cameraID]: { epoch: 1, retrying: true } },
    });

    await waitForZoomReport(card, before, isZoomed, 'the zoom after the reload');
    const reloaded = await card.waitForSelector<HTMLElement>(
      'advanced-camera-card-zoomer',
    );
    expect(reloaded).not.toBe(zoomer);
  });

  it('should stay at the default when a return to it is pending at a reload', async () => {
    const card = await mount();
    await zoomIn(card);
    const before = card.events.getEntries(ZOOM_CHANGE_EVENT).length;

    // A double tap's request and a stream reload in one view change, so the new
    // zoomer mounts before the old one could report the default.
    const viewManager = getViewManager(card);
    const cameraID = viewManager.getView()?.camera ?? '';
    viewManager.setViewByParameters({
      modifiers: [
        new ZoomRequestViewModifier(cameraID, {}),
        new MergeContextViewModifier({
          mediaRetry: { [cameraID]: { epoch: 1, retrying: true } },
        }),
      ],
    });

    await waitForZoomReport(card, before, isZoom(1), 'zoom 1 after the reload');
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(getZoomReports(card, before).some(isZoomed)).toBe(false);
  });

  it('should keep the zoom and pan when the card is shown again', async () => {
    const card = await mount();
    const zoomer = await zoomIn(card);
    const before = card.events.getEntries(ZOOM_CHANGE_EVENT).length;

    card.detach();
    card.attach();

    await waitForZoomReport(card, before, isZoomed, 'the zoom after re-attaching');
    const reattached = await card.waitForSelector<HTMLElement>(
      'advanced-camera-card-zoomer',
    );
    expect(reattached).not.toBe(zoomer);
  });

  it('should stay at the default after a double tap home and a remount', async () => {
    const card = await mount();
    const zoomer = await zoomIn(card);
    const beforeTap = card.events.getEntries(ZOOM_CHANGE_EVENT).length;
    tap(zoomer);
    tap(zoomer);
    await waitForZoomReport(card, beforeTap, isZoom(1), 'zoom 1 after the double tap');

    const before = card.events.getEntries(ZOOM_CHANGE_EVENT).length;
    card.detach();
    card.attach();
    await waitForZoomReport(card, before, isZoom(1), 'zoom 1 after re-attaching');
    expect(
      card.events
        .getEntries(ZOOM_CHANGE_EVENT)
        .slice(before)
        .map((entry) => entry.detail)
        .filter(isZoomSettingsObserved)
        .some((report) => report.zoom > 1.01),
    ).toBe(false);
  });
});
