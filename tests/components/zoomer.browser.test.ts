import { describe, expect, it } from 'vitest';

import { dispatchActionExecutionRequest } from '../../src/card-controller/actions/utils/execution-request';
import { createPTZDigitalAction } from '../../src/utils/action';
import { arefloatsApproximatelyEqual, isHoverableDevice } from '../../src/utils/basic';
import { MountedCardFactory, type MountedCard } from '../browser/mounted-card';
import {
  createGenericCameraHASS,
  createStillImageCameraConfig,
  createStillImageCardConfig,
  isZoomSettingsObserved,
} from '../browser/test-utils';

const ZOOM_CHANGE_EVENT = 'advanced-camera-card:zoom:change';

// A zoom with a pan well away from center so that a pan applied at the wrong
// magnitude is unmistakable.
// See: https://github.com/dermotduffy/advanced-camera-card/issues/2223
const CONFIGURED_LAYOUT = { zoom: 2.6, pan: { x: 0, y: 45 } };

const mount = async (): Promise<MountedCard> =>
  await MountedCardFactory.createFromSource(
    createStillImageCardConfig({
      cameras: [
        { ...createStillImageCameraConfig(), dimensions: { layout: CONFIGURED_LAYOUT } },
      ],
    }),
    createGenericCameraHASS(),
    { ledgerEvents: [ZOOM_CHANGE_EVENT] },
  );

const isConfiguredZoomAndPan = (detail: unknown): boolean =>
  isZoomSettingsObserved(detail) &&
  arefloatsApproximatelyEqual(detail.zoom, CONFIGURED_LAYOUT.zoom, 1) &&
  arefloatsApproximatelyEqual(detail.pan.x, CONFIGURED_LAYOUT.pan.x, 1) &&
  arefloatsApproximatelyEqual(detail.pan.y, CONFIGURED_LAYOUT.pan.y, 1);

const waitForConfiguredZoomAndPan = async (
  card: MountedCard,
  after: number,
): Promise<void> => {
  await card.waitForRender(
    () =>
      card.events
        .getEntries(ZOOM_CHANGE_EVENT)
        .slice(after)
        .find((entry) => isConfiguredZoomAndPan(entry.detail)) ?? null,
    'the configured zoom and pan',
  );
};

describe('AdvancedCameraCardZoomer', () => {
  it('should respect the configured pan even when activated during an animation frame', async () => {
    const card = await mount();
    await waitForConfiguredZoomAndPan(card, 0);
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

    await waitForConfiguredZoomAndPan(card, reportsBefore);

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
  const ZOOMED = { zoom: 3, pan: { x: 20, y: 20 } };

  const mountUnconfigured = async (): Promise<MountedCard> =>
    await MountedCardFactory.createFromSource(
      createStillImageCardConfig(),
      createGenericCameraHASS(),
      { ledgerEvents: [ZOOM_CHANGE_EVENT] },
    );

  const waitForZoom = async (
    card: MountedCard,
    after: number,
    zoom: number,
  ): Promise<void> => {
    await card.waitForRender(
      () =>
        card.events
          .getEntries(ZOOM_CHANGE_EVENT)
          .slice(after)
          .find(
            (entry) =>
              isZoomSettingsObserved(entry.detail) &&
              arefloatsApproximatelyEqual(entry.detail.zoom, zoom, 1),
          ) ?? null,
      `zoom ${zoom}`,
    );
  };

  // Zoom in the way a user's `ptz_digital` button with `absolute` does: the
  // request is kept in the view.
  const zoomIn = async (card: MountedCard): Promise<HTMLElement> => {
    const zoomer = await card.waitForSelector<HTMLElement>(
      'advanced-camera-card-zoomer',
    );
    await waitForZoom(card, 0, 1);
    const before = card.events.getEntries(ZOOM_CHANGE_EVENT).length;
    dispatchActionExecutionRequest(zoomer, {
      actions: createPTZDigitalAction({ absolute: ZOOMED }),
    });
    await waitForZoom(card, before, ZOOMED.zoom);
    return zoomer;
  };

  it('should return to the default zoom, which a remount keeps', async () => {
    const card = await mountUnconfigured();
    const zoomer = await zoomIn(card);

    const beforeTap = card.events.getEntries(ZOOM_CHANGE_EVENT).length;
    tap(zoomer);
    tap(zoomer);
    await waitForZoom(card, beforeTap, 1);

    // The reset is recorded in the view, so a remount does not bring back the
    // zoom that was requested before.
    const beforeRemount = card.events.getEntries(ZOOM_CHANGE_EVENT).length;
    card.detach();
    card.attach();
    await waitForZoom(card, beforeRemount, 1);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const after = card.events.getEntries(ZOOM_CHANGE_EVENT).slice(beforeRemount);
    expect(
      after.some(
        (entry) =>
          isZoomSettingsObserved(entry.detail) &&
          arefloatsApproximatelyEqual(entry.detail.zoom, ZOOMED.zoom, 1),
      ),
    ).toBe(false);
  });

  it('should stay zoomed in after a single tap', async () => {
    const card = await mountUnconfigured();
    const zoomer = await zoomIn(card);

    const before = card.events.getEntries(ZOOM_CHANGE_EVENT).length;
    tap(zoomer);
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(
      card.events
        .getEntries(ZOOM_CHANGE_EVENT)
        .slice(before)
        .some(
          (entry) =>
            isZoomSettingsObserved(entry.detail) &&
            arefloatsApproximatelyEqual(entry.detail.zoom, 1, 1),
        ),
    ).toBe(false);
  });
});
