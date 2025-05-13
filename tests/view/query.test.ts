import { describe, expect, it } from 'vitest';
import {
  EventQuery,
  PartialEventQuery,
  PartialRecordingQuery,
  QueryType,
  RecordingQuery,
} from '../../src/camera-manager/types';
import { setify } from '../../src/utils/basic';
import {
  EventMediaQuery,
  FolderViewQuery,
  RecordingMediaQuery,
} from '../../src/view/query';
import { createFolder } from '../test-utils';

describe('EventMediaQuery', () => {
  const createRawEventQueries = (
    cameraIDs: string | Set<string>,
    query?: PartialEventQuery,
  ): EventQuery[] => {
    return [
      {
        type: QueryType.Event,
        cameraIDs: setify(cameraIDs),
        ...query,
      },
    ];
  };

  it('should construct', () => {
    const rawQueries = createRawEventQueries('office');
    const query = new EventMediaQuery(rawQueries);
    expect(query.getQuery()).toBe(rawQueries);
  });

  it('should set', () => {
    const rawQueries = createRawEventQueries('office');
    const query = new EventMediaQuery(rawQueries);

    const newRawQueries = createRawEventQueries('kitchen');
    query.setQuery(newRawQueries);
    expect(query.getQuery()).toBe(newRawQueries);
  });

  it('should determine if queries exist for CameraIDs', () => {
    const rawQueries = createRawEventQueries(new Set(['office', 'kitchen']));
    const query = new EventMediaQuery(rawQueries);

    expect(query.hasQueriesForCameraIDs(new Set(['office']))).toBeTruthy();
    expect(query.hasQueriesForCameraIDs(new Set(['office', 'kitchen']))).toBeTruthy();
    expect(query.hasQueriesForCameraIDs(new Set(['office', 'front_door']))).toBeFalsy();
  });

  it('should convert to clips querys', () => {
    const rawQueries = createRawEventQueries('office', { hasSnapshot: true });
    const query = new EventMediaQuery(rawQueries);

    expect(query.convertToClipsQueries().getQuery()).toEqual([
      {
        type: QueryType.Event,
        cameraIDs: new Set(['office']),
        hasClip: true,
      },
    ]);
  });

  it('should convert when queries are null', () => {
    const query = new EventMediaQuery();
    expect(query.convertToClipsQueries().getQuery()).toBeNull();
  });

  it('should clone', () => {
    const rawQueries = createRawEventQueries('office', { hasSnapshot: true });
    const query = new EventMediaQuery(rawQueries);
    expect(query.clone().getQuery()).toEqual(query.getQuery());
  });

  it('should get camera IDs when queries are null', () => {
    expect(new EventMediaQuery().getQueryCameraIDs()).toBeNull();
  });

  it('should get camera IDs', () => {
    const cameraIDs = ['office', 'kitchen'];
    const query = new EventMediaQuery(createRawEventQueries(new Set(cameraIDs)));
    expect(query.getQueryCameraIDs()).toEqual(new Set(cameraIDs));
  });

  it('should set camera IDs when queries are null', () => {
    expect(
      new EventMediaQuery().setQueryCameraIDs(new Set(['office'])).getQueryCameraIDs(),
    ).toBeNull();
  });

  it('should set camera IDs', () => {
    const query = new EventMediaQuery(createRawEventQueries('sitting_room'));
    const newCameraIDs = new Set(['office', 'kitchen']);
    expect(query.setQueryCameraIDs(newCameraIDs).getQueryCameraIDs()).toEqual(
      newCameraIDs,
    );
  });

  describe('should determine when queries are a superset', () => {
    it('should return true with itself', () => {
      const query_1 = new EventMediaQuery([
        {
          type: QueryType.Event,
          cameraIDs: new Set(['office']),
          start: new Date('2025-03-07T00:00:00.000Z'),
          end: new Date('2025-03-08T00:00:00.000Z'),
        },
      ]);
      expect(query_1.isSupersetOf(query_1)).toBeTruthy();
    });

    it('should return true with an identical but shorter query', () => {
      const query_1 = new EventMediaQuery([
        {
          type: QueryType.Event,
          cameraIDs: new Set(['office']),
          start: new Date('2025-03-07T00:00:00.000Z'),
          end: new Date('2025-03-08T00:00:00.000Z'),
        },
      ]);
      const query_2 = new EventMediaQuery([
        {
          type: QueryType.Event,
          cameraIDs: new Set(['office']),
          start: new Date('2025-03-07T01:00:00.000Z'),
          end: new Date('2025-03-07T23:00:00.000Z'),
        },
      ]);
      expect(query_1.isSupersetOf(query_2)).toBeTruthy();
    });

    it('should return false with an identical but longer query', () => {
      const query_1 = new EventMediaQuery([
        {
          type: QueryType.Event,
          cameraIDs: new Set(['office']),
          start: new Date('2025-03-07T00:00:00.000Z'),
          end: new Date('2025-03-08T00:00:00.000Z'),
        },
      ]);
      const query_2 = new EventMediaQuery([
        {
          type: QueryType.Event,
          cameraIDs: new Set(['office']),
          start: new Date('2025-03-06T00:00:00.000Z'),
          end: new Date('2025-03-08T00:00:00.000Z'),
        },
      ]);
      expect(query_1.isSupersetOf(query_2)).toBeFalsy();
    });

    it('should return false with a non-matching query', () => {
      const query_1 = new EventMediaQuery([
        {
          type: QueryType.Event,
          cameraIDs: new Set(['office']),
          start: new Date('2025-03-07T00:00:00.000Z'),
          end: new Date('2025-03-08T00:00:00.000Z'),
        },
      ]);
      const query_2 = new EventMediaQuery([
        {
          type: QueryType.Event,
          cameraIDs: new Set(['DIFFERENT']),
          start: new Date('2025-03-07T00:00:00.000Z'),
          end: new Date('2025-03-08T00:00:00.000Z'),
        },
      ]);
      expect(query_1.isSupersetOf(query_2)).toBeFalsy();
    });

    it('should return true with a matching query where the source has multiple', () => {
      const query_1 = new EventMediaQuery([
        {
          type: QueryType.Event,
          cameraIDs: new Set(['office']),
          start: new Date('2025-03-07T00:00:00.000Z'),
          end: new Date('2025-03-08T00:00:00.000Z'),
        },
        {
          type: QueryType.Event,
          cameraIDs: new Set(['kitchen']),
          start: new Date('2025-03-07T00:00:00.000Z'),
          end: new Date('2025-03-08T00:00:00.000Z'),
        },
      ]);
      const query_2 = new EventMediaQuery([
        {
          type: QueryType.Event,
          cameraIDs: new Set(['office']),
          start: new Date('2025-03-07T00:00:00.000Z'),
          end: new Date('2025-03-08T00:00:00.000Z'),
        },
      ]);
      expect(query_1.isSupersetOf(query_2)).toBeTruthy();
    });

    it('should return false with a matching query where the target has multiple', () => {
      const query_1 = new EventMediaQuery([
        {
          type: QueryType.Event,
          cameraIDs: new Set(['office']),
          start: new Date('2025-03-07T00:00:00.000Z'),
          end: new Date('2025-03-08T00:00:00.000Z'),
        },
      ]);
      const query_2 = new EventMediaQuery([
        {
          type: QueryType.Event,
          cameraIDs: new Set(['office']),
          start: new Date('2025-03-07T00:00:00.000Z'),
          end: new Date('2025-03-08T00:00:00.000Z'),
        },
        {
          type: QueryType.Event,
          cameraIDs: new Set(['kitchen']),
          start: new Date('2025-03-07T00:00:00.000Z'),
          end: new Date('2025-03-08T00:00:00.000Z'),
        },
      ]);
      expect(query_1.isSupersetOf(query_2)).toBeFalsy();
    });

    it('should return true when queries do not have start or end', () => {
      const query_1 = new EventMediaQuery([
        {
          type: QueryType.Event,
          cameraIDs: new Set(['office']),
        },
      ]);
      const query_2 = new EventMediaQuery([
        {
          type: QueryType.Event,
          cameraIDs: new Set(['office']),
        },
      ]);
      expect(query_1.isSupersetOf(query_2)).toBeTruthy();
    });

    it('should return true when target has no queries', () => {
      const query_1 = new EventMediaQuery([
        {
          type: QueryType.Event,
          cameraIDs: new Set(['office']),
        },
      ]);
      const query_2 = new EventMediaQuery();
      expect(query_1.isSupersetOf(query_2)).toBeTruthy();
    });

    it('should return false when source has no queries', () => {
      const query_1 = new EventMediaQuery();
      const query_2 = new EventMediaQuery([
        {
          type: QueryType.Event,
          cameraIDs: new Set(['office']),
        },
      ]);
      expect(query_1.isSupersetOf(query_2)).toBeFalsy();
    });
  });
});

describe('RecordingMediaQuery', () => {
  const createRawRecordingQueries = (
    cameraIDs: string | Set<string>,
    query?: PartialRecordingQuery,
  ): RecordingQuery[] => {
    return [
      {
        type: QueryType.Recording,
        cameraIDs: setify(cameraIDs),
        ...query,
      },
    ];
  };

  it('should construct', () => {
    const rawQueries = createRawRecordingQueries('office');
    const query = new RecordingMediaQuery(rawQueries);
    expect(query.getQuery()).toBe(rawQueries);
  });
});

describe('FolderViewQuery', () => {
  it('should construct', () => {
    const rawQuery = {
      folder: createFolder(),
      path: 'path',
    };

    const query = new FolderViewQuery(rawQuery);
    expect(query.getQuery()).toBe(rawQuery);
  });
});
