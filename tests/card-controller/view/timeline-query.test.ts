import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { searchTimelineQuery } from '../../../src/card-controller/view/timeline-query';
import type { ViewItem } from '../../../src/view/item';
import { UnifiedQuery } from '../../../src/view/unified-query';
import type { UnifiedQueryBuilder } from '../../../src/view/unified-query-builder';
import type { UnifiedQueryRunner } from '../../../src/view/unified-query-runner';
import {
  createEventQuery,
  createFolderQuery,
  TestViewMedia,
} from '../../view/test-utils';

// Create a builder of queries for a camera with events, and a folder unless
// `withoutFolder` is set.
const createBuilder = (options?: { withoutFolder?: boolean }): UnifiedQueryBuilder => {
  const builder = mock<UnifiedQueryBuilder>();
  builder.buildDefaultCameraQuery.mockImplementation(
    (buildOptions) =>
      new UnifiedQuery([
        createEventQuery('camera.office'),
        ...(options?.withoutFolder
          ? []
          : [{ ...createFolderQuery('folder'), ...buildOptions?.folderTimeRange }]),
      ]),
  );
  return builder;
};

// Create a runner that returns each of `results` in turn, then nothing.
const createRunner = (results: ViewItem[][] = []): UnifiedQueryRunner => {
  const runner = mock<UnifiedQueryRunner>();
  runner.execute.mockResolvedValue([]);
  for (const items of results) {
    runner.execute.mockResolvedValueOnce(items);
  }
  return runner;
};

const getSearchStarts = (builder: UnifiedQueryBuilder): (Date | undefined)[] =>
  vi
    .mocked(builder.buildDefaultCameraQuery)
    .mock.calls.map(([options]) => options?.folderTimeRange?.start);

describe('searchTimelineQuery', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-25T12:00:00'));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it('should search from the start of the timeline window', async () => {
    const media = new TestViewMedia({ startTime: new Date('2026-11-25T11:30:00') });
    const builder = createBuilder();

    const result = await searchTimelineQuery(builder, createRunner([[media]]), 7200);

    expect(getSearchStarts(builder)).toEqual([new Date('2026-11-25T10:00:00')]);
    expect(result?.query.getFolderQueries()).toEqual([
      { ...createFolderQuery('folder'), start: new Date('2026-11-25T10:00:00') },
    ]);
    expect(result?.items).toEqual([media]);
  });

  it('should search further back until there is media', async () => {
    const media = new TestViewMedia({ startTime: new Date('2026-11-19T08:00:00') });
    const builder = createBuilder();

    const result = await searchTimelineQuery(
      builder,
      createRunner([[], [], [media]]),
      7200,
    );

    expect(getSearchStarts(builder)).toEqual([
      new Date('2026-11-25T10:00:00'),
      new Date('2026-11-24T12:00:00'),
      new Date('2026-11-18T12:00:00'),
    ]);
    expect(result?.query.getFolderQueries()).toEqual([
      { ...createFolderQuery('folder'), start: new Date('2026-11-18T12:00:00') },
    ]);
    expect(result?.items).toEqual([media]);
  });

  it('should search further back past media from before the search start', async () => {
    const media = new TestViewMedia({ startTime: new Date('2026-11-25T06:00:00') });
    const builder = createBuilder();
    const runner = mock<UnifiedQueryRunner>();
    runner.execute.mockResolvedValue([media]);

    await searchTimelineQuery(builder, runner, 7200);

    expect(getSearchStarts(builder)).toEqual([
      new Date('2026-11-25T10:00:00'),
      new Date('2026-11-24T12:00:00'),
    ]);
  });

  it('should stop searching after a month', async () => {
    const builder = createBuilder();

    const result = await searchTimelineQuery(builder, createRunner(), 7200);

    expect(getSearchStarts(builder)).toEqual([
      new Date('2026-11-25T10:00:00'),
      new Date('2026-11-24T12:00:00'),
      new Date('2026-11-18T12:00:00'),
      new Date('2026-10-25T12:00:00'),
    ]);
    expect(result?.query.getFolderQueries()).toEqual([
      { ...createFolderQuery('folder'), start: new Date('2026-10-25T12:00:00') },
    ]);
    expect(result?.items).toEqual([]);
  });

  it('should pass the cache setting to every search', async () => {
    const runner = createRunner();

    await searchTimelineQuery(createBuilder(), runner, 7200, false);

    expect(vi.mocked(runner.execute).mock.calls.map(([, options]) => options)).toEqual([
      { allowCached: false },
      { allowCached: false },
      { allowCached: false },
      { allowCached: false },
    ]);
  });

  it('should search only once without folders', async () => {
    const runner = createRunner();

    await searchTimelineQuery(createBuilder({ withoutFolder: true }), runner, 7200);

    expect(runner.execute).toHaveBeenCalledTimes(1);
  });

  it('should return null without a query', async () => {
    const builder = mock<UnifiedQueryBuilder>();
    builder.buildDefaultCameraQuery.mockReturnValue(null);
    const runner = createRunner();

    expect(await searchTimelineQuery(builder, runner, 7200)).toBeNull();
    expect(runner.execute).not.toHaveBeenCalled();
  });
});
