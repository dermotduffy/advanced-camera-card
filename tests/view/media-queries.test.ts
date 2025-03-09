import { describe, expect, it } from 'vitest';
import {
  EventQuery,
  PartialEventQuery,
  PartialRecordingQuery,
  QueryType,
  RecordingQuery,
} from '../../src/camera-manager/types';
import { setify } from '../../src/utils/basic';
import { EventMediaQueries, RecordingMediaQueries } from '../../src/view/media-queries';

describe('EventMediaQueries', () => {
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
    const queries = new EventMediaQueries(rawQueries);
    expect(queries.getQueries()).toBe(rawQueries);
  });

  it('should set', () => {
    const rawQueries = createRawEventQueries('office');
    const queries = new EventMediaQueries(rawQueries);

    const newRawQueries = createRawEventQueries('kitchen');
    queries.setQueries(newRawQueries);
    expect(queries.getQueries()).toBe(newRawQueries);
  });

  it('should determine if queries exist for CameraIDs', () => {
    const rawQueries = createRawEventQueries(new Set(['office', 'kitchen']));
    const queries = new EventMediaQueries(rawQueries);

    expect(queries.hasQueriesForCameraIDs(new Set(['office']))).toBeTruthy();
    expect(queries.hasQueriesForCameraIDs(new Set(['office', 'kitchen']))).toBeTruthy();
    expect(
      queries.hasQueriesForCameraIDs(new Set(['office', 'front_door'])),
    ).toBeFalsy();
  });

  it('should convert to clips querys', () => {
    const rawQueries = createRawEventQueries('office', { hasSnapshot: true });
    const queries = new EventMediaQueries(rawQueries);

    expect(queries.convertToClipsQueries().getQueries()).toEqual([
      {
        type: QueryType.Event,
        cameraIDs: new Set(['office']),
        hasClip: true,
      },
    ]);
  });

  it('should convert when queries are null', () => {
    const queries = new EventMediaQueries();
    expect(queries.convertToClipsQueries().getQueries()).toBeNull();
  });

  it('should clone', () => {
    const rawQueries = createRawEventQueries('office', { hasSnapshot: true });
    const queries = new EventMediaQueries(rawQueries);
    expect(queries.clone().getQueries()).toEqual(queries.getQueries());
  });

  it('should get camera IDs when queries are null', () => {
    expect(new EventMediaQueries().getQueryCameraIDs()).toBeNull();
  });

  it('should get camera IDs', () => {
    const cameraIDs = ['office', 'kitchen'];
    const queries = new EventMediaQueries(createRawEventQueries(new Set(cameraIDs)));
    expect(queries.getQueryCameraIDs()).toEqual(new Set(cameraIDs));
  });

  it('should set camera IDs when queries are null', () => {
    expect(
      new EventMediaQueries().setQueryCameraIDs(new Set(['office'])).getQueryCameraIDs(),
    ).toBeNull();
  });

  it('should set camera IDs', () => {
    const queries = new EventMediaQueries(createRawEventQueries('sitting_room'));
    const newCameraIDs = new Set(['office', 'kitchen']);
    expect(queries.setQueryCameraIDs(newCameraIDs).getQueryCameraIDs()).toEqual(
      newCameraIDs,
    );
  });

  describe('should determine when queries are a superset', () => {
    it('should return true with itself', () => {
      const queries_1 = new EventMediaQueries([
        {
          type: QueryType.Event,
          cameraIDs: new Set(['office']),
          start: new Date('2025-03-07T00:00:00.000Z'),
          end: new Date('2025-03-08T00:00:00.000Z'),
        },
      ]);
      expect(queries_1.isSupersetOf(queries_1)).toBeTruthy();
    });

    it('should return true with an identical but shorter query', () => {
      const queries_1 = new EventMediaQueries([
        {
          type: QueryType.Event,
          cameraIDs: new Set(['office']),
          start: new Date('2025-03-07T00:00:00.000Z'),
          end: new Date('2025-03-08T00:00:00.000Z'),
        },
      ]);
      const queries_2 = new EventMediaQueries([
        {
          type: QueryType.Event,
          cameraIDs: new Set(['office']),
          start: new Date('2025-03-07T01:00:00.000Z'),
          end: new Date('2025-03-07T23:00:00.000Z'),
        },
      ]);
      expect(queries_1.isSupersetOf(queries_2)).toBeTruthy();
    });

    it('should return false with an identical but longer query', () => {
      const queries_1 = new EventMediaQueries([
        {
          type: QueryType.Event,
          cameraIDs: new Set(['office']),
          start: new Date('2025-03-07T00:00:00.000Z'),
          end: new Date('2025-03-08T00:00:00.000Z'),
        },
      ]);
      const queries_2 = new EventMediaQueries([
        {
          type: QueryType.Event,
          cameraIDs: new Set(['office']),
          start: new Date('2025-03-06T00:00:00.000Z'),
          end: new Date('2025-03-08T00:00:00.000Z'),
        },
      ]);
      expect(queries_1.isSupersetOf(queries_2)).toBeFalsy();
    });

    it('should return false with a non-matching query', () => {
      const queries_1 = new EventMediaQueries([
        {
          type: QueryType.Event,
          cameraIDs: new Set(['office']),
          start: new Date('2025-03-07T00:00:00.000Z'),
          end: new Date('2025-03-08T00:00:00.000Z'),
        },
      ]);
      const queries_2 = new EventMediaQueries([
        {
          type: QueryType.Event,
          cameraIDs: new Set(['DIFFERENT']),
          start: new Date('2025-03-07T00:00:00.000Z'),
          end: new Date('2025-03-08T00:00:00.000Z'),
        },
      ]);
      expect(queries_1.isSupersetOf(queries_2)).toBeFalsy();
    });

    it('should return true with a matching query where the source has multiple', () => {
      const queries_1 = new EventMediaQueries([
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
      const queries_2 = new EventMediaQueries([
        {
          type: QueryType.Event,
          cameraIDs: new Set(['office']),
          start: new Date('2025-03-07T00:00:00.000Z'),
          end: new Date('2025-03-08T00:00:00.000Z'),
        },
      ]);
      expect(queries_1.isSupersetOf(queries_2)).toBeTruthy();
    });

    it('should return false with a matching query where the target has multiple', () => {
      const queries_1 = new EventMediaQueries([
        {
          type: QueryType.Event,
          cameraIDs: new Set(['office']),
          start: new Date('2025-03-07T00:00:00.000Z'),
          end: new Date('2025-03-08T00:00:00.000Z'),
        },
      ]);
      const queries_2 = new EventMediaQueries([
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
      expect(queries_1.isSupersetOf(queries_2)).toBeFalsy();
    });

    it('should return true when queries do not have start or end', () => {
      const queries_1 = new EventMediaQueries([
        {
          type: QueryType.Event,
          cameraIDs: new Set(['office']),
        },
      ]);
      const queries_2 = new EventMediaQueries([
        {
          type: QueryType.Event,
          cameraIDs: new Set(['office']),
        },
      ]);
      expect(queries_1.isSupersetOf(queries_2)).toBeTruthy();
    });

    it('should return true when target has no queries', () => {
      const queries_1 = new EventMediaQueries([
        {
          type: QueryType.Event,
          cameraIDs: new Set(['office']),
        },
      ]);
      const queries_2 = new EventMediaQueries();
      expect(queries_1.isSupersetOf(queries_2)).toBeTruthy();
    });

    it('should return false when source has no queries', () => {
      const queries_1 = new EventMediaQueries();
      const queries_2 = new EventMediaQueries([
        {
          type: QueryType.Event,
          cameraIDs: new Set(['office']),
        },
      ]);
      expect(queries_1.isSupersetOf(queries_2)).toBeFalsy();
    });
  });
});

describe('RecordingMediaQueries', () => {
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
    const queries = new RecordingMediaQueries(rawQueries);
    expect(queries.getQueries()).toBe(rawQueries);
  });
});
