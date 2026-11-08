import { describe, expect, it } from 'vitest';

import { arefloatsApproximatelyEqual } from '../../src/utils/basic';
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
