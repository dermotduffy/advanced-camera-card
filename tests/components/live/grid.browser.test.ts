import { assert, describe, expect, it } from 'vitest';

import type { PartialAdvancedCameraCardConfig } from '../../../src/config/types';
import { clickElement, deepQueryAll } from '../../browser/dom';
import { MountedCardFactory, type MountedCard } from '../../browser/mounted-card';
import {
  CAMERA_ENTITY,
  createGenericCameraHASS,
  createStillImageCameraConfig,
  createStillImageCardConfig,
  RESIZE_LOOP_CONSOLE_ERROR,
} from '../../browser/test-utils';

// Enough cameras to fill a 2-column grid beyond a single row.
const CAMERA_ENTITIES = [CAMERA_ENTITY, 'camera.two', 'camera.three'];

// Every camera declares the shape of its media, so a cell's height follows
// from its width alone and never depends on when media happens to load.
const CELL_RATIO_PARTS = [16, 9];
const CELL_RATIO = CELL_RATIO_PARTS[0] / CELL_RATIO_PARTS[1];

// How many frames a wait may take before the grid is called stuck. Frames
// rather than time, so a slow machine gets proportionally more patience.
const STUCK_FRAME_BUDGET = 600;

// How many consecutive frames of unchanged geometry mean the grid has stopped
// moving. Any change restarts the count, so work the cells defer is waited out
// however late it lands.
const QUIET_FRAME_COUNT = 20;

// How many frames to watch a selection transition for intermediate states. The
// regression this guards against parked the selected cell at the wrong height
// for several hundred milliseconds, so it spans comfortably more than that.
const TRANSITION_FRAME_SAMPLES = 40;

const GRID_CONFIG: PartialAdvancedCameraCardConfig = {
  live: {
    display: {
      mode: 'grid',
      grid_columns: 2,
      grid_selected_position: 'first',
      grid_selected_width_factor: 2,
    },
  },
};

const mountGrid = async (): Promise<MountedCard> =>
  await MountedCardFactory.createFromSource(
    createStillImageCardConfig({
      cameras: CAMERA_ENTITIES.map((cameraEntity) => ({
        ...createStillImageCameraConfig(cameraEntity),
        dimensions: { aspect_ratio: CELL_RATIO_PARTS },
      })),
      ...GRID_CONFIG,
    }),
    createGenericCameraHASS({ cameras: CAMERA_ENTITIES.slice(1) }),
    {
      width: '600px',

      // The grid observes both its own size and its cells', so a cell resize
      // can resize the host and vice versa.
      toleratedConsoleErrors: [RESIZE_LOOP_CONSOLE_ERROR],
    },
  );

const nextFrame = async (): Promise<void> =>
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

const getCells = (card: MountedCard): HTMLElement[] =>
  deepQueryAll<HTMLElement>(card.card, 'advanced-camera-card-live-carousel');

const getCell = (card: MountedCard, cameraEntity: string): HTMLElement | null =>
  getCells(card).find((cell) => cell.getAttribute('grid-id') === cameraEntity) ?? null;

// The height a cell at the configured ratio should have at a given width. The
// ratio applies to the content box; the grid draws its border around it.
const getExpectedCellHeight = (cell: HTMLElement, width: number): number => {
  const styles = getComputedStyle(cell);
  const vertical =
    parseFloat(styles.borderTopWidth) + parseFloat(styles.borderBottomWidth);
  const horizontal =
    parseFloat(styles.borderLeftWidth) + parseFloat(styles.borderRightWidth);
  return (width - horizontal) / CELL_RATIO + vertical;
};

const isCellAtRatio = (cell: HTMLElement): boolean => {
  const rect = cell.getBoundingClientRect();
  return (
    rect.width > 0 && Math.abs(rect.height - getExpectedCellHeight(cell, rect.width)) < 2
  );
};

const getGeometry = (card: MountedCard): string =>
  getCells(card)
    .map((cell) => {
      const rect = cell.getBoundingClientRect();
      return `${cell.getAttribute('grid-id')}:${rect.width}x${rect.height}`;
    })
    .join(' ');

// Wait for the cells to stop changing size. Geometry can change with no DOM
// mutation, so this polls frames rather than waiting on the card to render.
const waitForQuietGrid = async (card: MountedCard): Promise<HTMLElement[]> => {
  let previous: string | null = null;
  let quietFrames = 0;

  for (let frame = 0; frame < STUCK_FRAME_BUDGET; frame++) {
    const geometry = getGeometry(card);
    quietFrames = geometry === previous ? quietFrames + 1 : 0;
    previous = geometry;

    if (quietFrames >= QUIET_FRAME_COUNT) {
      return getCells(card);
    }
    await nextFrame();
  }
  throw new Error('The grid cells never stopped changing size');
};

describe('AdvancedCameraCardLiveGrid', () => {
  it('should apply the height of a newly selected cell in the same pass as its width', async () => {
    const card = await mountGrid();
    const cells = await waitForQuietGrid(card);
    expect(cells).toHaveLength(CAMERA_ENTITIES.length);
    expect(cells.every(isCellAtRatio)).toBe(true);

    const selected = getCell(card, CAMERA_ENTITY);
    const target = getCell(card, 'camera.two');
    assert(selected && target);

    // Thresholds derived from the two laid out sizes rather than constants, so
    // a changed gutter or border width does not invalidate the test.
    const selectedWidth = selected.getBoundingClientRect().width;
    const unselectedRect = target.getBoundingClientRect();

    // Every cell spans the full width until the grid controller applies column
    // sizes, so a quiet grid is not necessarily a laid out one.
    expect(unselectedRect.width).toBeLessThan(selectedWidth);
    const wideThreshold = (selectedWidth + unselectedRect.width) / 2;
    const shortThreshold =
      (getExpectedCellHeight(target, selectedWidth) + unselectedRect.height) / 2;

    await clickElement(target);
    await card.waitForRender(
      () => target.hasAttribute('selected') || null,
      'the clicked cell being selected',
    );

    // A cell that is already at its selected width but still at an unselected
    // height is the intermediate state the user sees as a two-step layout.
    const wideButShort: { width: number; height: number }[] = [];
    for (let frame = 0; frame < TRANSITION_FRAME_SAMPLES; frame++) {
      await nextFrame();
      const rect = target.getBoundingClientRect();
      if (rect.width > wideThreshold && rect.height < shortThreshold) {
        wideButShort.push({ width: rect.width, height: rect.height });
      }
    }
    expect(wideButShort).toEqual([]);

    // The transition did complete: the clicked cell holds the selected size.
    const finalRect = target.getBoundingClientRect();
    expect(Math.abs(finalRect.width - selectedWidth)).toBeLessThan(2);
    expect(
      Math.abs(finalRect.height - getExpectedCellHeight(target, finalRect.width)),
    ).toBeLessThan(2);

    // Outside a grid a carousel caps its own height with an inline
    // `max-height`. A grid cell must not carry that cap.
    expect(getCells(card).map((cell) => cell.style.maxHeight)).toEqual(
      CAMERA_ENTITIES.map(() => ''),
    );
  });
});
