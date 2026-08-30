import { describe, expect, it } from 'vitest';

import { deepQuery } from '../browser/dom';
import {
  createTestFrigateEvent,
  EVENT_TIME_NEWER,
  mountCardWithFrigate,
} from '../browser/fake-frigate';
import { waitForThumbnails } from '../browser/test-utils';

describe('AdvancedCameraCardIcon', () => {
  it('should be block level so it does not sit on a line of text', async () => {
    const events = [createTestFrigateEvent('newer', EVENT_TIME_NEWER)];
    const { card } = await mountCardWithFrigate(events, { view: { default: 'clips' } });
    await waitForThumbnails(card, events.length);

    // The drawer control is an icon alone in a block container that declares no
    // display of its own, so what it computes to is the component's own
    // default.
    const icon = deepQuery(card.card, 'advanced-camera-card-icon.control');
    expect(icon).not.toBeNull();

    expect(icon && getComputedStyle(icon).display).toBe('block');
  });
});
