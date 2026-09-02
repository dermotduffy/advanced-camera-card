import { assert, describe, expect, it } from 'vitest';

// The card imports the timeline component lazily, and `card.waitForSelector`
// cannot see an element that arrives that way. Directly import instead.
import '../../src/components/timeline';

import type { AdvancedCameraCardDrawer } from '../../src/components/drawer';
import type { AdvancedCameraCardTimelineCore } from '../../src/components/timeline-core';
import type { PartialAdvancedCameraCardConfig } from '../../src/config/types';
import { deepQuery, deepQueryAll, getElementAtPoint } from '../browser/dom';
import {
  createFrigateCameraDescription,
  createTestFrigateEvent,
  createTestFrigateReview,
  EVENT_TIME_NEWER,
  FakeFrigate,
  mountCardWithFrigate,
} from '../browser/fake-frigate';
import { MountedCardFactory, type MountedCard } from '../browser/mounted-card';
import {
  clickThumbnail,
  createCameraHASS,
  createStillImageCardConfig,
  RESIZE_LOOP_CONSOLE_ERROR,
  waitForThumbnails,
} from '../browser/test-utils';

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

  describe('review severity', () => {
    const getRecentTime = (secondsAgo: number): number =>
      Math.floor(new Date().getTime() / 1000) - secondsAgo;

    const mountCardWithReviews = async (
      config?: PartialAdvancedCameraCardConfig,
    ): Promise<MountedCard> => {
      const hass = createCameraHASS([createFrigateCameraDescription()]);
      const frigate = new FakeFrigate(hass);

      frigate.setReviews([
        createTestFrigateReview('alert', getRecentTime(600), { severity: 'alert' }),
        createTestFrigateReview('detection', getRecentTime(1200), {
          severity: 'detection',
        }),
      ]);

      return await MountedCardFactory.createFromSource(
        createStillImageCardConfig({ view: { default: 'timeline' }, ...config }),
        hass,
        {
          // The timeline resizes itself as it lays itself out.
          toleratedConsoleErrors: [RESIZE_LOOP_CONSOLE_ERROR],
        },
      );
    };

    const HIGH_SEVERITY_ITEM = ".vis-item[data-severity='high']";

    interface PaintedItem {
      severity: string | null;
      color: string;
    }

    const resolveBackgroundColors = (root: Element, values: string[]): string[] => {
      const probe = document.createElement('div');
      root.append(probe);

      const colors = values.map((value) => {
        probe.style.backgroundColor = value;
        return getComputedStyle(probe).backgroundColor;
      });
      probe.remove();

      return colors;
    };

    it('should mark each item with the severity of its review', async () => {
      const card = await mountCardWithReviews();

      const severities = await card.waitForRender(() => {
        const items = deepQueryAll(card.card, '.vis-item');
        return items.length === 2
          ? items.map((item) => item.getAttribute('data-severity'))
          : null;
      }, 'the timeline items');

      expect(severities.sort()).toEqual(['high', 'medium']);
    });

    it('should color each item by the severity of its review', async () => {
      const card = await mountCardWithReviews();

      // Measuring one item forces layout, which makes the timeline redraw and
      // replace its items, so measuring the next one can land on an element
      // that has already left the page and reports no color. Measure them all
      // again until every one of them answers.
      const painted = await card.waitForRender<PaintedItem[]>(() => {
        const measured = deepQueryAll(card.card, '.vis-item[data-severity]').map(
          (item) => ({
            severity: item.getAttribute('data-severity'),
            color: getComputedStyle(item).backgroundColor,
          }),
        );
        return measured.length === 2 && measured.every((item) => item.color)
          ? measured
          : null;
      }, 'the colored timeline items');

      const timeline = deepQuery(card.card, '.vis-timeline');
      assert(timeline);

      expect(painted.map((item) => item.color)).toEqual(
        resolveBackgroundColors(
          timeline,
          painted.map(
            (item) =>
              `var(--advanced-camera-card-timeline-item-severity-${item.severity}-color)`,
          ),
        ),
      );
    });

    it('should draw a selected review in its severity color with a ring', async () => {
      const card = await mountCardWithReviews({
        view: { default: 'reviews' },
        media_viewer: { controls: { timeline: { mode: 'below' } } },
      });

      // Frigate hands back its newest review first, which is the alert one.
      await waitForThumbnails(card, 2);
      await clickThumbnail(card.card, 0);

      const item = await card.waitForRender(
        () => deepQuery<HTMLElement>(card.card, `${HIGH_SEVERITY_ITEM}.vis-selected`),
        'the selected timeline item',
      );

      const timeline = deepQuery(card.card, '.vis-timeline');
      assert(timeline);
      const highColor = 'var(--advanced-camera-card-timeline-item-severity-high-color)';
      const [severityColor, ringColor] = resolveBackgroundColors(timeline, [
        highColor,
        `color-mix(in oklab, ${highColor}, black 20%)`,
      ]);

      // Ensure "glows" are instant for testing purposes.
      item.style.transition = 'none';
      const style = getComputedStyle(item);

      expect(style.backgroundColor).toEqual(severityColor);
      expect(style.borderColor).toEqual(severityColor);
      expect(style.boxShadow).toContain(severityColor);

      expect(style.outlineWidth).toEqual('1px');
      expect(style.outlineColor).toEqual(ringColor);

      // The ring marking it as selected is a darker shade of the item's own
      // color, so it never reads as one of the severity colors.
      expect(ringColor).not.toEqual(severityColor);
    });
  });
});
