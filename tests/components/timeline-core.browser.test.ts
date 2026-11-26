import { format, subDays, subMinutes } from 'date-fns';
import { assert, describe, expect, it } from 'vitest';

// The card imports the timeline component lazily, and `card.waitForSelector`
// cannot see an element that arrives that way. Directly import instead.
import '../../src/components/timeline';

import type { FrigateReview } from '../../src/camera-manager/frigate/types';
import type { AdvancedCameraCardDrawer } from '../../src/components/drawer';
import type { PartialAdvancedCameraCardConfig } from '../../src/config/types';
import { formatDateTime } from '../../src/utils/date/localized';
import { View } from '../../src/view/view';
import {
  createFrontDoorFolderMedia,
  FRONT_DOOR_FOLDER_CONTENT_ID,
  registerFrontDoorFolder,
} from '../browser/browse-media';
import {
  deepQuery,
  deepQueryAll,
  getElementAtPoint,
  hoverElement,
} from '../browser/dom';
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
  createGenericCameraHASS,
  createStillImageCameraConfig,
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

const getRecentTime = (secondsAgo: number): number =>
  Math.floor(new Date().getTime() / 1000) - secondsAgo;

const mountCardWithReviews = async (
  reviews: FrigateReview[],
  config?: PartialAdvancedCameraCardConfig,
): Promise<MountedCard> => {
  const hass = createCameraHASS([createFrigateCameraDescription()]);
  const frigate = new FakeFrigate(hass);
  frigate.setReviews(reviews);

  return await MountedCardFactory.createFromSource(
    createStillImageCardConfig({ view: { default: 'timeline' }, ...config }),
    hass,
    {
      // The timeline resizes itself as it lays itself out.
      toleratedConsoleErrors: [RESIZE_LOOP_CONSOLE_ERROR],
    },
  );
};

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

    for (const [index, title] of PAN_MODE_TITLES.entries()) {
      // The timeline may move the control before a real pointer could reach it.
      await card.clickControlWithoutPointer(title);

      // The last click wraps back to the mode the timeline started in.
      const next = PAN_MODE_TITLES[(index + 1) % PAN_MODE_TITLES.length];

      // The timeline resizes itself as it lays itself out, so an update of its
      // own can be in flight when the control is clicked. Waiting on the title
      // itself waits for the click's own update rather than whichever update
      // completes first.
      await card.waitForRender(
        () => (getPanControlTitle(card) === next ? true : null),
        `the pan control titled ${next}`,
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
    const mountCardWithSeverities = async (
      config?: PartialAdvancedCameraCardConfig,
    ): Promise<MountedCard> =>
      await mountCardWithReviews(
        [
          createTestFrigateReview('alert', getRecentTime(600), { severity: 'alert' }),
          createTestFrigateReview('detection', getRecentTime(1200), {
            severity: 'detection',
          }),
        ],
        config,
      );

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
      const card = await mountCardWithSeverities();

      const severities = await card.waitForRender(() => {
        const items = deepQueryAll(card.card, '.vis-item');
        return items.length === 2
          ? items.map((item) => item.getAttribute('data-severity'))
          : null;
      }, 'the timeline items');

      expect(severities.sort()).toEqual(['high', 'medium']);
    });

    it('should color each item by the severity of its review', async () => {
      const card = await mountCardWithSeverities();

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
      const card = await mountCardWithSeverities({
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

  describe('clustering', () => {
    it('should cluster review items rather than stacking them up', async () => {
      // Ten reviews inside one minute, well past the threshold of three.
      const card = await mountCardWithReviews(
        [...Array(10).keys()].map((n) =>
          createTestFrigateReview(`review-${n}`, getRecentTime(600 + n * 5)),
        ),
        { timeline: { style: 'stack', clustering_threshold: 3 } },
      );

      const drawn = await card.waitForRender(() => {
        const items = deepQueryAll(card.card, '.vis-item:not(.vis-background)');
        return items.length
          ? {
              items: items.length,
              clusters: deepQueryAll(card.card, '.vis-cluster').length,
            }
          : null;
      }, 'the timeline items');

      expect(drawn.clusters).toBeGreaterThan(0);
      expect(drawn.items).toBeLessThan(10);
    });
  });

  describe('thumbnail popup', () => {
    it('should show a full size details panel beside a wide thumbnail', async () => {
      const card = await mountCardWithReviews(
        [createTestFrigateReview('review', getRecentTime(600))],
        {
          timeline: {
            // A clustering timeline replaces its items each time it redraws,
            // which can detach the item before the pointer reaches it.
            clustering_threshold: 0,
            controls: { thumbnails: { size: 100, aspect_ratio: [16, 9] } },
          },
        },
      );

      await hoverElement(
        await card.waitForSelector('.vis-item:not(.vis-background):not(.vis-cluster)'),
      );
      const popup = await card.waitForSelector(
        'advanced-camera-card-timeline-thumbnail',
      );
      const thumbnail = await card.waitForRender(
        () => deepQuery<HTMLElement>(popup, 'advanced-camera-card-thumbnail'),
        'the popup thumbnail',
      );
      const feature = deepQuery(thumbnail, 'advanced-camera-card-thumbnail-feature');
      const panel = deepQuery(thumbnail, 'advanced-camera-card-thumbnail-details-panel');
      const controls = deepQuery(thumbnail, 'advanced-camera-card-thumbnail-controls');
      assert(feature);
      assert(panel);
      assert(controls);

      // The popup is as tall as `size`, beside a 56px tall image.
      const thumbnailRect = thumbnail.getBoundingClientRect();
      expect(Math.abs(thumbnailRect.height - 100)).toBeLessThanOrEqual(1);
      expect(Math.abs(thumbnailRect.width - 250)).toBeLessThanOrEqual(1);
      expect(
        Math.abs(feature.getBoundingClientRect().height - 56.25),
      ).toBeLessThanOrEqual(1);
      expect(panel.getAttribute('tier')).toBe('standard');
      expect(controls.getAttribute('tier')).toBe('compact');
    });
  });

  describe('moving to another time', () => {
    const getClipFileName = (time: Date): string =>
      `${format(time, 'yyyy-MM-dd HH:mm:ss')}.mp4`;

    const waitForClipThumbnail = async (
      card: MountedCard,
      time: Date,
    ): Promise<void> => {
      await card.waitForRender(
        () =>
          deepQuery(
            card.card,
            `advanced-camera-card-thumbnail[aria-label="${formatDateTime(time)}"]`,
          ),
        `the thumbnail of the clip at ${formatDateTime(time)}`,
      );
    };

    // The card logs every view it sets. A logged view with a timeline window
    // that is not marked as loading, means the timeline's first query has
    // loaded.
    const waitForTimelineFirstQuery = async (card: MountedCard): Promise<void> => {
      await card.waitForRender(
        () =>
          card.console.getEntries('debug').some(({ args }) => {
            const view = args[1];
            return (
              view instanceof View &&
              !!view.context?.timeline?.window &&
              !view.context.loading?.query
            );
          }) || null,
        "the timeline's first query to load",
      );
    };

    // The timeline queries a folder only for the timeline window, so moving the
    // timeline days away makes it re-query.
    const mountCardWithFolderClips = async (times: Date[]): Promise<MountedCard> => {
      const hass = createGenericCameraHASS();
      registerFrontDoorFolder(
        hass,
        times.map((time) => createFrontDoorFolderMedia(getClipFileName(time), 'video')),
      );

      return await MountedCardFactory.createFromSource(
        createStillImageCardConfig({
          cameras: [{ ...createStillImageCameraConfig(), media: { type: 'folder' } }],
          folders: [
            {
              type: 'ha',
              ha: {
                path: [
                  { id: FRONT_DOOR_FOLDER_CONTENT_ID },
                  {
                    parsers: [
                      {
                        type: 'startdate',
                        regexp: '^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}',
                        format: 'yyyy-MM-dd HH:mm:ss',
                      },
                    ],
                  },
                ],
              },
            },
          ],
          view: { default: 'timeline' },
          debug: { logging: true },
        }),
        hass,
        { toleratedConsoleErrors: [RESIZE_LOOP_CONSOLE_ERROR] },
      );
    };

    it('should keep drawing the same timeline while new media is being fetched', async () => {
      const now = new Date();
      const recentTime = subMinutes(now, 20);
      const olderTime = subDays(now, 3);
      const card = await mountCardWithFolderClips([recentTime, olderTime]);

      await waitForClipThumbnail(card, recentTime);

      // When the timeline's first query loads, the timeline moves back to the
      // time that query was for, undoing any earlier move.
      await waitForTimelineFirstQuery(card);
      const timeline = deepQuery(card.card, '.vis-timeline');
      assert(timeline);

      const datePicker = deepQuery<HTMLInputElement>(
        card.card,
        'input[type="datetime-local"]',
      );
      assert(datePicker);

      // The date input is hidden behind the calendar icon, which opens the
      // browser's own picker that a test cannot use, so set the value directly.
      datePicker.value = format(olderTime, "yyyy-MM-dd'T'HH:mm");
      datePicker.dispatchEvent(new Event('change'));

      await waitForClipThumbnail(card, olderTime);
      expect(deepQuery(card.card, '.vis-timeline')).toBe(timeline);
    });
  });
});
