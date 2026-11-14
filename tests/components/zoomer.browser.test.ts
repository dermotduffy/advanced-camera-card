import { describe, expect, it } from 'vitest';

import { dispatchActionExecutionRequest } from '../../src/card-controller/actions/utils/execution-request';
import type { ZoomSettingsObserved } from '../../src/components-lib/zoom/types';
import type { MediaLayoutConfig } from '../../src/config/schema/camera/media-layout';
import type { PartialAdvancedCameraCardConfig } from '../../src/config/types';
import { createPTZDigitalAction } from '../../src/utils/action';
import { arefloatsApproximatelyEqual, isHoverableDevice } from '../../src/utils/basic';
import { deepQuery } from '../browser/dom';
import { MountedCardFactory, type MountedCard } from '../browser/mounted-card';
import {
  createGenericCameraHASS,
  createStillImageCameraConfig,
  createStillImageCardConfig,
  isZoomSettingsObserved,
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
