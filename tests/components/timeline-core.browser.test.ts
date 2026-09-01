import { describe, expect, it } from 'vitest';

// The card imports the timeline component lazily, and `card.waitForSelector`
// cannot see an element that arrives that way. Directly import instead.
import '../../src/components/timeline';

import type { AdvancedCameraCardDrawer } from '../../src/components/drawer';
import type { AdvancedCameraCardTimelineCore } from '../../src/components/timeline-core';
import type { PartialAdvancedCameraCardConfig } from '../../src/config/types';
import { deepQuery, getElementAtPoint } from '../browser/dom';
import {
  createTestFrigateEvent,
  EVENT_TIME_NEWER,
  mountCardWithFrigate,
} from '../browser/fake-frigate';
import type { MountedCard } from '../browser/mounted-card';
import { clickThumbnail, waitForThumbnails } from '../browser/test-utils';

// Titles the pan control carries (in the order clicking cycles through them).
const PAN_MODE_TITLES = [
  'Pan',
  'Pan seeks across all media',
  'Pan seeks within selected media item only',
  'Pan seeks within selected camera only',
];

// The date picker renders an icon of its own, but inside its own shadow root,
// so only the pan control is a child of the tools.
const getPanControlTitle = (card: MountedCard): string | null =>
  deepQuery(card.card, '.timeline-tools > advanced-camera-card-icon')?.getAttribute(
    'title',
  ) ?? null;

const mountCardWithTimeline = async (
  config: PartialAdvancedCameraCardConfig,
): Promise<MountedCard> =>
  (
    await mountCardWithFrigate(
      [createTestFrigateEvent('event', EVENT_TIME_NEWER)],
      config,
    )
  ).card;

describe('AdvancedCameraCardTimelineCore', () => {
  it('should draw the timeline tools on a background of their own', async () => {
    const card = await mountCardWithTimeline({ view: { default: 'timeline' } });

    const tools = await card.waitForSelector<HTMLElement>('.timeline-tools');

    // The tools are drawn over the time axis labels visjs puts in the bottom
    // corner, and need a surface of their own to stay legible against them. A
    // browser reports an element with no background of its own as fully
    // transparent black.
    expect(getComputedStyle(tools).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  });

  it('should move the mini timeline to the next pan mode each time the pan control is clicked', async () => {
    const card = await mountCardWithTimeline({
      view: { default: 'live' },
      live: { controls: { timeline: { mode: 'below' } } },
    });

    const timeline = await card.waitForSelector<AdvancedCameraCardTimelineCore>(
      'advanced-camera-card-timeline-core',
    );

    for (const [index, title] of PAN_MODE_TITLES.entries()) {
      await card.clickControl(title);
      await timeline.updateComplete;

      // The last click wraps back to the mode the timeline started in.
      expect(getPanControlTitle(card)).toBe(
        PAN_MODE_TITLES[(index + 1) % PAN_MODE_TITLES.length],
      );
    }
  });

  it('should draw the timeline tools under an open thumbnail drawer', async () => {
    const card = await mountCardWithTimeline({
      view: { default: 'clips' },
      media_viewer: { controls: { timeline: { mode: 'below' } } },
    });

    await waitForThumbnails(card, 1);
    await clickThumbnail(card.card, 0);

    await card.events.waitForFirst('advanced-camera-card:media:loaded');

    const tools = await card.waitForSelector<HTMLElement>('.timeline-tools');
    const drawer = await card.waitForSelector<AdvancedCameraCardDrawer>(
      'advanced-camera-card-drawer[location="right"]',
    );

    // While it holds nothing the drawer marks itself `empty`, which hides it,
    // so it would cover nothing here whatever the stacking order.
    await card.waitForRender(
      () => (drawer.hasAttribute('empty') ? null : drawer),
      'the drawer to hold a thumbnail',
    );

    // Check that the tools are visible when the drawer is closed.
    const box = tools.getBoundingClientRect();
    const x = box.left + 1;
    const y = box.top + box.height / 2;
    expect(getElementAtPoint(x, y)).toBe(tools);

    const panel = await card.waitForRender(
      () => deepQuery(drawer, '#d'),
      'the drawer panel',
    );
    const drawerOpenComplete = new Promise((resolve) =>
      panel.addEventListener('transitionend', resolve, { once: true }),
    );
    drawer.open = true;
    await drawerOpenComplete;

    // Verify the tools are now hidden by the drawer.
    expect(getElementAtPoint(x, y)).not.toBe(tools);
  });
});
