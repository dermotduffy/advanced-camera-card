import { describe, expect, it } from 'vitest';

import type { IssueTriggerEventData } from '../../../src/card-controller/issues/types';
import { fireAdvancedCameraCardEvent } from '../../../src/utils/fire-advanced-camera-card-event';
import { getShadowRootHost } from '../../../src/utils/shadow-root';
import { deepQueryAll, getFocusedElement, tabUntil } from '../../browser/dom';
import { MountedCardFactory, type MountedCard } from '../../browser/mounted-card';
import {
  createGenericCameraHASS,
  createStillImageCardConfig,
} from '../../browser/test-utils';

const BLOCK_ELEMENT = 'advanced-camera-card-notification-block';
const MAXIMUM_TAB_PRESSES = 15;

const TRANSPARENT = 'rgba(0, 0, 0, 0)';

const waitForControlsRow = async (card: MountedCard): Promise<Element> =>
  await card.waitForRender(
    () =>
      deepQueryAll(card.card, '.controls').find(
        (element) => getShadowRootHost(element)?.localName === BLOCK_ELEMENT,
      ) ?? null,
    'the controls row on the issue block',
  );

describe('AdvancedCameraCardNotificationBlock', () => {
  it('should let the keyboard reach the retry control on an issue', async () => {
    const card = await MountedCardFactory.createFromSource(
      createStillImageCardConfig(),
      createGenericCameraHASS(),
    );
    const views = await card.waitForSelector('advanced-camera-card-views');

    fireAdvancedCameraCardEvent<IssueTriggerEventData>(views, 'issue:trigger', {
      key: 'initialization',
      error: new Error('Initialization failed'),
    });

    const control = await card.waitForRender(
      () =>
        deepQueryAll(card.card, '.control').find(
          (element) => getShadowRootHost(element)?.localName === BLOCK_ELEMENT,
        ) ?? null,
      'a control on the issue block',
    );

    expect(
      await tabUntil(() => getFocusedElement() === control, MAXIMUM_TAB_PRESSES),
    ).toBe(true);
  });

  it('should drop the pill from a controls row holding only a spinner', async () => {
    const card = await MountedCardFactory.createFromSource(
      createStillImageCardConfig(),
      createGenericCameraHASS(),
    );
    await card.waitForSelector('advanced-camera-card-views');

    // A lost connection is reported with a spinner and no controls.
    card.setConnected(false);

    const style = getComputedStyle(await waitForControlsRow(card));
    expect(style.padding).toBe('0px');
    expect(style.backgroundColor).toBe(TRANSPARENT);
  });

  it('should keep the pill on a controls row when there is a control', async () => {
    const card = await MountedCardFactory.createFromSource(
      createStillImageCardConfig(),
      createGenericCameraHASS(),
    );
    const views = await card.waitForSelector('advanced-camera-card-views');

    // An initialization failure is reported with a retry control.
    fireAdvancedCameraCardEvent<IssueTriggerEventData>(views, 'issue:trigger', {
      key: 'initialization',
      error: new Error('Initialization failed'),
    });

    const style = getComputedStyle(await waitForControlsRow(card));
    expect(style.padding).not.toBe('0px');
    expect(style.backgroundColor).not.toBe(TRANSPARENT);
  });
});
