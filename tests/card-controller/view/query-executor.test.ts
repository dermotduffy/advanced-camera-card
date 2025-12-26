import { add } from 'date-fns';
import { describe, expect, it, vi } from 'vitest';
import { QueryType } from '../../../src/camera-manager/types';
import { FolderQuery } from '../../../src/card-controller/folders/types';
import { QueryExecutor } from '../../../src/card-controller/view/query-executor';
import { ClipsOrSnapshotsOrAll } from '../../../src/types';
import { EventMediaQuery, FolderViewQuery } from '../../../src/view/query';
import {
  TestViewMedia,
  createCameraManager,
  createCardAPI,
  createFolder,
  createStore,
  generateViewMediaArray,
} from '../../test-utils';
import { createPopulatedAPI } from './test-utils';

describe('executeDefaultEventQuery', () => {
  it('should return null without cameras', async () => {
    const api = createCardAPI();
    vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
    vi.mocked(api.getCameraManager().getStore).mockReturnValue(createStore());

    const executor = new QueryExecutor(api);
    expect(
      await executor.executeDefaultEventQuery({
        cameraID: 'camera.office',
      }),
    ).toBeNull();
  });

  it('should return null without queries', async () => {
    const api = createPopulatedAPI();
    vi.mocked(api.getCameraManager().generateDefaultEventQueries).mockReturnValue(null);

    const executor = new QueryExecutor(api);
    expect(
      await executor.executeDefaultEventQuery({
        cameraID: 'camera.office',
      }),
    ).toBeNull();
  });

  describe('should return query results for specified camera', async () => {
    it.each([['all' as const], ['clips' as const], ['snapshots' as const], [undefined]])(
      '%s',
      async (mediaType?: ClipsOrSnapshotsOrAll) => {
        const api = createPopulatedAPI();
        const media = generateViewMediaArray();
        const rawQueries = [
          { type: QueryType.Event as const, cameraIDs: new Set(['camera.office']) },
        ];
        vi.mocked(api.getCameraManager().generateDefaultEventQueries).mockReturnValue(
          rawQueries,
        );
        vi.mocked(api.getCameraManager().executeMediaQueries).mockResolvedValue(media);

        const executor = new QueryExecutor(api);
        const results = await executor.executeDefaultEventQuery({
          cameraID: 'camera.office',
          eventsMediaType: mediaType,
        });

        expect(results?.query.getQuery()).toEqual(rawQueries);
        expect(results?.queryResults.getResults()).toEqual(media);
        expect(api.getCameraManager().generateDefaultEventQueries).toBeCalledWith(
          new Set(['camera.office']),
          {
            limit: 50,
            ...(mediaType === 'clips' && { hasClip: true }),
            ...(mediaType === 'snapshots' && { hasSnapshot: true }),
          },
        );
      },
    );
  });

  it('should return query results for all cameras', async () => {
    const api = createPopulatedAPI();
    const media = generateViewMediaArray();
    const rawQueries = [
      {
        type: QueryType.Event as const,
        cameraIDs: new Set(['camera.office', 'camera.kitchen']),
      },
    ];
    vi.mocked(api.getCameraManager().generateDefaultEventQueries).mockReturnValue(
      rawQueries,
    );
    vi.mocked(api.getCameraManager().executeMediaQueries).mockResolvedValue(media);

    const executor = new QueryExecutor(api);
    const results = await executor.executeDefaultEventQuery();

    expect(results?.query.getQuery()).toEqual(rawQueries);
    expect(results?.queryResults.getResults()).toEqual(media);
    expect(api.getCameraManager().generateDefaultEventQueries).toBeCalledWith(
      new Set(['camera.office', 'camera.kitchen']),
      {
        limit: 50,
      },
    );
  });

  it('should return null when query returns null', async () => {
    const api = createPopulatedAPI();
    const rawQueries = [
      {
        type: QueryType.Event as const,
        cameraIDs: new Set(['camera.office']),
      },
    ];
    vi.mocked(api.getCameraManager().generateDefaultEventQueries).mockReturnValue(
      rawQueries,
    );
    vi.mocked(api.getCameraManager().executeMediaQueries).mockResolvedValue(null);

    const executor = new QueryExecutor(api);
    expect(
      await executor.executeDefaultEventQuery({ cameraID: 'camera.office' }),
    ).toBeNull();
    expect(api.getCameraManager().generateDefaultEventQueries).toBeCalledWith(
      new Set(['camera.office']),
      {
        limit: 50,
      },
    );
  });
});

describe('executeDefaultRecordingQuery', () => {
  it('should return null without cameras', async () => {
    const api = createCardAPI();
    vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
    vi.mocked(api.getCameraManager().getStore).mockReturnValue(createStore());

    const executor = new QueryExecutor(api);
    expect(
      await executor.executeDefaultRecordingQuery({
        cameraID: 'camera.office',
      }),
    ).toBeNull();
  });

  it('should return null without queries', async () => {
    const api = createPopulatedAPI();
    vi.mocked(api.getCameraManager().generateDefaultRecordingQueries).mockReturnValue(
      null,
    );

    const executor = new QueryExecutor(api);
    expect(
      await executor.executeDefaultRecordingQuery({
        cameraID: 'camera.office',
      }),
    ).toBeNull();
  });

  it('should return query results for specified camera', async () => {
    const api = createPopulatedAPI();
    const media = generateViewMediaArray();
    const rawQueries = [
      { type: QueryType.Recording as const, cameraIDs: new Set(['camera.office']) },
    ];
    vi.mocked(api.getCameraManager().generateDefaultRecordingQueries).mockReturnValue(
      rawQueries,
    );
    vi.mocked(api.getCameraManager().executeMediaQueries).mockResolvedValue(media);

    const executor = new QueryExecutor(api);
    const results = await executor.executeDefaultRecordingQuery({
      cameraID: 'camera.office',
    });

    expect(results?.query.getQuery()).toEqual(rawQueries);
    expect(results?.queryResults.getResults()).toEqual(media);
    expect(api.getCameraManager().generateDefaultRecordingQueries).toBeCalledWith(
      new Set(['camera.office']),
      {
        limit: 50,
      },
    );
  });

  it('should return query results for all cameras', async () => {
    const api = createPopulatedAPI();
    const media = generateViewMediaArray();
    const rawQueries = [
      {
        type: QueryType.Recording as const,
        cameraIDs: new Set(['camera.office', 'camera.kitchen']),
      },
    ];
    vi.mocked(api.getCameraManager().generateDefaultRecordingQueries).mockReturnValue(
      rawQueries,
    );
    vi.mocked(api.getCameraManager().executeMediaQueries).mockResolvedValue(media);

    const executor = new QueryExecutor(api);
    const results = await executor.executeDefaultRecordingQuery();

    expect(results?.query.getQuery()).toEqual(rawQueries);
    expect(results?.queryResults.getResults()).toEqual(media);
    expect(api.getCameraManager().generateDefaultRecordingQueries).toBeCalledWith(
      new Set(['camera.office', 'camera.kitchen']),
      {
        limit: 50,
      },
    );
  });

  it('should return null when query returns null', async () => {
    const api = createPopulatedAPI();
    const rawQueries = [
      {
        type: QueryType.Recording as const,
        cameraIDs: new Set(['camera.office']),
      },
    ];
    vi.mocked(api.getCameraManager().generateDefaultRecordingQueries).mockReturnValue(
      rawQueries,
    );
    vi.mocked(api.getCameraManager().executeMediaQueries).mockResolvedValue(null);

    const executor = new QueryExecutor(api);
    expect(
      await executor.executeDefaultRecordingQuery({ cameraID: 'camera.office' }),
    ).toBeNull();
    expect(api.getCameraManager().generateDefaultRecordingQueries).toBeCalledWith(
      new Set(['camera.office']),
      {
        limit: 50,
      },
    );
  });
});

describe('executeDefaultReviewQuery', () => {
  it('should return null without cameras', async () => {
    const api = createCardAPI();
    vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
    vi.mocked(api.getCameraManager().getStore).mockReturnValue(createStore());

    const executor = new QueryExecutor(api);
    expect(
      await executor.executeDefaultReviewQuery({
        cameraID: 'camera.office',
      }),
    ).toBeNull();
  });

  it('should return null without queries', async () => {
    const api = createPopulatedAPI();
    vi.mocked(api.getCameraManager().generateDefaultReviewQueries).mockReturnValue(null);

    const executor = new QueryExecutor(api);
    expect(
      await executor.executeDefaultReviewQuery({
        cameraID: 'camera.office',
      }),
    ).toBeNull();
  });

  it('should return query results for specified camera', async () => {
    const api = createPopulatedAPI();
    const media = generateViewMediaArray();
    const rawQueries = [
      { type: QueryType.Review as const, cameraIDs: new Set(['camera.office']) },
    ];
    vi.mocked(api.getCameraManager().generateDefaultReviewQueries).mockReturnValue(
      rawQueries,
    );
    vi.mocked(api.getCameraManager().executeMediaQueries).mockResolvedValue(media);

    const executor = new QueryExecutor(api);
    const results = await executor.executeDefaultReviewQuery({
      cameraID: 'camera.office',
    });

    expect(results?.query.getQuery()).toEqual(rawQueries);
    expect(results?.queryResults.getResults()).toEqual(media);
    expect(api.getCameraManager().generateDefaultReviewQueries).toBeCalledWith(
      new Set(['camera.office']),
      {
        limit: 50,
      },
    );
  });

  it('should return query results for all cameras', async () => {
    const api = createPopulatedAPI();
    const media = generateViewMediaArray();
    const rawQueries = [
      {
        type: QueryType.Review as const,
        cameraIDs: new Set(['camera.office', 'camera.kitchen']),
      },
    ];
    vi.mocked(api.getCameraManager().generateDefaultReviewQueries).mockReturnValue(
      rawQueries,
    );
    vi.mocked(api.getCameraManager().executeMediaQueries).mockResolvedValue(media);

    const executor = new QueryExecutor(api);
    const results = await executor.executeDefaultReviewQuery();

    expect(results?.query.getQuery()).toEqual(rawQueries);
    expect(results?.queryResults.getResults()).toEqual(media);
    expect(api.getCameraManager().generateDefaultReviewQueries).toBeCalledWith(
      new Set(['camera.office', 'camera.kitchen']),
      {
        limit: 50,
      },
    );
  });

  it('should return null when query returns null', async () => {
    const api = createPopulatedAPI();
    const rawQueries = [
      {
        type: QueryType.Review as const,
        cameraIDs: new Set(['camera.office']),
      },
    ];
    vi.mocked(api.getCameraManager().generateDefaultReviewQueries).mockReturnValue(
      rawQueries,
    );
    vi.mocked(api.getCameraManager().executeMediaQueries).mockResolvedValue(null);

    const executor = new QueryExecutor(api);
    expect(
      await executor.executeDefaultReviewQuery({ cameraID: 'camera.office' }),
    ).toBeNull();
    expect(api.getCameraManager().generateDefaultReviewQueries).toBeCalledWith(
      new Set(['camera.office']),
      {
        limit: 50,
      },
    );
  });
});

describe('executeQuery', () => {
  it('should return null when query is empty', async () => {
    const executor = new QueryExecutor(createCardAPI());
    expect(await executor.executeQuery(new EventMediaQuery())).toBeNull();
  });

  describe('should handle result rejections', () => {
    it('rejected', async () => {
      const api = createPopulatedAPI();
      const media = generateViewMediaArray();
      vi.mocked(api.getCameraManager().executeMediaQueries).mockResolvedValue(media);

      const query = new EventMediaQuery([
        {
          type: QueryType.Event as const,
          cameraIDs: new Set(['camera.office']),
        },
      ]);
      const executor = new QueryExecutor(api);

      expect(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        await executor.executeQuery(query, { rejectResults: (_) => true }),
      ).toBeNull();
    });

    it('not rejected', async () => {
      const api = createPopulatedAPI();
      const media = generateViewMediaArray();
      vi.mocked(api.getCameraManager().executeMediaQueries).mockResolvedValue(media);

      const query = new EventMediaQuery([
        {
          type: QueryType.Event as const,
          cameraIDs: new Set(['camera.office']),
        },
      ]);
      const executor = new QueryExecutor(api);

      expect(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        await executor.executeQuery(query, { rejectResults: (_) => false }),
      ).not.toBeNull();
    });
  });

  describe('should select', () => {
    it('by id', async () => {
      const api = createPopulatedAPI();
      const media = generateViewMediaArray({
        cameraIDs: ['camera.office'],
        count: 100,
      });
      vi.mocked(api.getCameraManager().executeMediaQueries).mockResolvedValue(media);

      const query = new EventMediaQuery([
        {
          type: QueryType.Event as const,
          cameraIDs: new Set(['camera.office']),
        },
      ]);
      const executor = new QueryExecutor(api);

      const results = await executor.executeMediaQuery(query, {
        selectResult: { id: 'id-camera.office-42' },
      });
      expect(results?.queryResults.getSelectedResult()?.getID()).toBe(
        'id-camera.office-42',
      );
    });
  });

  it('by func', async () => {
    const api = createPopulatedAPI();
    const media = generateViewMediaArray({
      cameraIDs: ['camera.office'],
      count: 100,
    });
    vi.mocked(api.getCameraManager().executeMediaQueries).mockResolvedValue(media);

    const query = new EventMediaQuery([
      {
        type: QueryType.Event as const,
        cameraIDs: new Set(['camera.office']),
      },
    ]);
    const executor = new QueryExecutor(api);

    const results = await executor.executeMediaQuery(query, {
      selectResult: { func: (media) => media.getID() === 'id-camera.office-43' },
    });
    expect(results?.queryResults.getSelectedResult()?.getID()).toBe(
      'id-camera.office-43',
    );
  });

  it('by time', async () => {
    const now = new Date('2024-07-21T19:09:37Z');

    const api = createPopulatedAPI();
    const media = [
      new TestViewMedia({
        cameraID: 'camera.office',
        id: 'id-camera.office-0',
        startTime: now,
      }),
      new TestViewMedia({
        cameraID: 'camera.office',
        id: 'id-camera.office-1',
        startTime: add(now, { seconds: 1 }),
      }),
      new TestViewMedia({
        cameraID: 'camera.office',
        id: 'id-camera.office-2',
        startTime: add(now, { seconds: 2 }),
      }),
    ];
    vi.mocked(api.getCameraManager().executeMediaQueries).mockResolvedValue(media);

    const query = new EventMediaQuery([
      {
        type: QueryType.Event as const,
        cameraIDs: new Set(['camera.office']),
      },
    ]);
    const executor = new QueryExecutor(api);

    const results = await executor.executeMediaQuery(query, {
      selectResult: { time: { time: add(now, { seconds: 1 }) } },
    });
    expect(results?.queryResults.getSelectedResult()?.getID()).toBe(
      'id-camera.office-1',
    );
  });

  describe('should handle folder query', () => {
    it('should return null without raw query', async () => {
      const executor = new QueryExecutor(createCardAPI());
      expect(await executor.executeQuery(new FolderViewQuery())).toBeNull();
    });

    it('should return null when query expansion fails', async () => {
      const api = createCardAPI();
      vi.mocked(api.getFoldersManager().getFolder).mockReturnValue(createFolder());
      vi.mocked(api.getFoldersManager().expandFolder).mockResolvedValue(null);

      const executor = new QueryExecutor(api);
      expect(await executor.executeFolderQuery()).toBeNull();
    });
  });
});

describe('executeFolderQuery', () => {
  it('should return null without folders', async () => {
    const executor = new QueryExecutor(createCardAPI());
    expect(await executor.executeFolderQuery()).toBeNull();
  });

  it('should execute query against first folder', async () => {
    const api = createCardAPI();
    const items = [new TestViewMedia()];
    const folder = createFolder();
    const query: FolderQuery = {
      folder,
      path: [{ ha: { id: 'path' } }],
    };
    vi.mocked(api.getFoldersManager().getFolder).mockReturnValue(folder);
    vi.mocked(api.getFoldersManager().generateDefaultFolderQuery).mockReturnValue(query);
    vi.mocked(api.getFoldersManager().expandFolder).mockResolvedValue(items);

    const executor = new QueryExecutor(api);
    const result = await executor.executeFolderQuery();

    expect(result?.query.getQuery()).toEqual(query);
    expect(result?.queryResults.getResults()).toEqual(items);
  });

  it('should return null without folder results', async () => {
    const api = createCardAPI();
    const folder = createFolder();
    const query: FolderQuery = {
      folder,
      path: [{ ha: { id: 'path' } }],
    };
    vi.mocked(api.getFoldersManager().getFolder).mockReturnValue(folder);
    vi.mocked(api.getFoldersManager().generateDefaultFolderQuery).mockReturnValue(query);
    vi.mocked(api.getFoldersManager().expandFolder).mockResolvedValue(null);

    const executor = new QueryExecutor(api);
    expect(await executor.executeFolderQuery()).toBeNull();
  });
});
