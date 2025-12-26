import { describe, expect, it } from 'vitest';
import { QueryType } from '../../src/camera-manager/types';
import {
  EventMediaQuery,
  FolderViewQuery,
  RecordingMediaQuery,
  ReviewMediaQuery,
} from '../../src/view/query';
import { QueryClassifier } from '../../src/view/query-classifier';
import { createFolder } from '../test-utils';

describe('QueryClassifier', () => {
  it('isEventQuery', () => {
    expect(QueryClassifier.isEventQuery(new EventMediaQuery())).toBeTruthy();
    expect(QueryClassifier.isEventQuery(new RecordingMediaQuery())).toBeFalsy();
  });

  it('isRecordingQuery', () => {
    expect(QueryClassifier.isRecordingQuery(new RecordingMediaQuery())).toBeTruthy();
    expect(QueryClassifier.isRecordingQuery(new EventMediaQuery())).toBeFalsy();
  });

  it('isReviewQuery', () => {
    expect(QueryClassifier.isReviewQuery(new ReviewMediaQuery())).toBeTruthy();
    expect(QueryClassifier.isReviewQuery(new EventMediaQuery())).toBeFalsy();
  });

  it('getQueryType', () => {
    expect(QueryClassifier.getQueryType(new EventMediaQuery())).toBe('event');
    expect(QueryClassifier.getQueryType(new FolderViewQuery())).toBe('folder');
    expect(QueryClassifier.getQueryType(new RecordingMediaQuery())).toBe('recording');
    expect(QueryClassifier.getQueryType(new ReviewMediaQuery())).toBe('review');
    expect(QueryClassifier.getQueryType()).toBeNull();
  });

  it('isClipsQuery', () => {
    expect(
      QueryClassifier.isClipsQuery(
        new EventMediaQuery([
          { type: QueryType.Event, cameraIDs: new Set(['camera']), hasClip: true },
        ]),
      ),
    ).toBeTruthy();
    expect(
      QueryClassifier.isClipsQuery(
        new EventMediaQuery([
          { type: QueryType.Event, cameraIDs: new Set(['camera']), hasClip: true },
          { type: QueryType.Event, cameraIDs: new Set(['camera']), hasClip: false },
        ]),
      ),
    ).toBeFalsy();
    expect(
      QueryClassifier.isClipsQuery(
        new EventMediaQuery([
          { type: QueryType.Event, cameraIDs: new Set(['camera']), hasClip: true },
          { type: QueryType.Event, cameraIDs: new Set(['camera']) },
        ]),
      ),
    ).toBeFalsy();
  });

  it('isSnapshotQuery', () => {
    expect(
      QueryClassifier.isSnapshotQuery(
        new EventMediaQuery([
          { type: QueryType.Event, cameraIDs: new Set(['camera']), hasSnapshot: true },
        ]),
      ),
    ).toBeTruthy();
    expect(
      QueryClassifier.isSnapshotQuery(
        new EventMediaQuery([
          { type: QueryType.Event, cameraIDs: new Set(['camera']), hasSnapshot: true },
          { type: QueryType.Event, cameraIDs: new Set(['camera']), hasSnapshot: false },
        ]),
      ),
    ).toBeFalsy();
    expect(
      QueryClassifier.isSnapshotQuery(
        new EventMediaQuery([
          { type: QueryType.Event, cameraIDs: new Set(['camera']), hasSnapshot: true },
          { type: QueryType.Event, cameraIDs: new Set(['camera']) },
        ]),
      ),
    ).toBeFalsy();
  });

  it('isFolderQuery', () => {
    expect(
      QueryClassifier.isFolderQuery(
        new EventMediaQuery([
          { type: QueryType.Event, cameraIDs: new Set(['camera']), hasSnapshot: true },
        ]),
      ),
    ).toBeFalsy();
    expect(
      QueryClassifier.isFolderQuery(
        new RecordingMediaQuery([
          { type: QueryType.Recording, cameraIDs: new Set(['camera']) },
        ]),
      ),
    ).toBeFalsy();
    expect(
      QueryClassifier.isFolderQuery(
        new FolderViewQuery({ folder: createFolder(), path: [{}] }),
      ),
    ).toBeTruthy();
  });

  it('getMediaType', () => {
    expect(
      QueryClassifier.getMediaType(
        new EventMediaQuery([
          { type: QueryType.Event, cameraIDs: new Set(['camera']), hasSnapshot: true },
          { type: QueryType.Event, cameraIDs: new Set(['camera']), hasSnapshot: true },
        ]),
      ),
    ).toBe('snapshots');

    expect(
      QueryClassifier.getMediaType(
        new EventMediaQuery([
          { type: QueryType.Event, cameraIDs: new Set(['camera']), hasClip: true },
          { type: QueryType.Event, cameraIDs: new Set(['camera']), hasClip: true },
        ]),
      ),
    ).toBe('clips');

    expect(
      QueryClassifier.getMediaType(
        new RecordingMediaQuery([
          { type: QueryType.Recording, cameraIDs: new Set(['camera']) },
          { type: QueryType.Recording, cameraIDs: new Set(['camera']) },
        ]),
      ),
    ).toBe('recordings');

    expect(
      QueryClassifier.getMediaType(
        new EventMediaQuery([
          { type: QueryType.Event, cameraIDs: new Set(['camera']), hasSnapshot: true },
          { type: QueryType.Event, cameraIDs: new Set(['camera']), hasSnapshot: false },
        ]),
      ),
    ).toBeNull();

    expect(
      QueryClassifier.getMediaType(
        new ReviewMediaQuery([
          { type: QueryType.Review, cameraIDs: new Set(['camera']) },
        ]),
      ),
    ).toBe('reviews');
  });
});
