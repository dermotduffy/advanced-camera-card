import { describe, expect, it } from 'vitest';

import type { IssueTriggerEventData } from '../../../src/card-controller/issues/types';
import { fireAdvancedCameraCardEvent } from '../../../src/utils/fire-advanced-camera-card-event';
import { getShadowRootHost } from '../../../src/utils/shadow-root';
import { deepQueryAll, getFocusedElement, tabUntil } from '../../browser/dom';
import { MountedCardFactory } from '../../browser/mounted-card';
import {
  createGenericCameraHASS,
  createStillImageCardConfig,
} from '../../browser/test-utils';

const BLOCK_ELEMENT = 'advanced-camera-card-notification-block';
const MAXIMUM_TAB_PRESSES = 15;

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
});
