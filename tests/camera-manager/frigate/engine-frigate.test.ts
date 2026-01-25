import { afterEach, assert, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { RecordingSegmentsCache } from '../../../src/camera-manager/cache';
import {
  FrigateCameraManagerEngine,
  FrigateQueryResultsClassifier,
} from '../../../src/camera-manager/frigate/engine-frigate';
import {
  FrigateEventViewMedia,
  FrigateRecordingViewMedia,
} from '../../../src/camera-manager/frigate/media';
import { getReviews } from '../../../src/camera-manager/frigate/requests';
import {
  FrigateEvent,
  FrigateReview,
  eventSchema,
} from '../../../src/camera-manager/frigate/types.js';
import { CameraManagerStore } from '../../../src/camera-manager/store';
import { CameraManagerRequestCache, QueryType } from '../../../src/camera-manager/types';
import { StateWatcher } from '../../../src/card-controller/hass/state-watcher';
import { CameraConfig } from '../../../src/config/schema/cameras';
import { RawAdvancedCameraCardConfig } from '../../../src/config/types';
import { QuerySource } from '../../../src/query-source';
import { Severity } from '../../../src/severity';
import { ViewMedia, ViewMediaType } from '../../../src/view/item';
import { EntityRegistryManagerMock } from '../../ha/registry/entity/mock';
import { createCameraConfig, createHASS } from '../../test-utils';

vi.mock('../../../src/camera-manager/frigate/requests');

const createEngine = (): FrigateCameraManagerEngine => {
  return new FrigateCameraManagerEngine(
    new EntityRegistryManagerMock(),
    new StateWatcher(),
    new RecordingSegmentsCache(),
    new CameraManagerRequestCache(),
  );
};

const createRecordingMedia = (): FrigateRecordingViewMedia => {
  return new FrigateRecordingViewMedia(
    ViewMediaType.Recording,
    'camera-1',
    {
      cameraID: 'camera-1',
      startTime: new Date('2023-06-16T20:00:00Z'),
      endTime: new Date('2023-06-16T20:59:59Z'),
      events: 1,
    },
    'recording-id',
    'recording-content-id',
    'recording-title',
  );
};

const createEvent = (): FrigateEvent => {
  return eventSchema.parse({
    camera: 'camera-1',
    end_time: 1686974399,
    false_positive: false,
    has_clip: true,
    has_snapshot: true,
    id: 'event-id',
    label: 'person',
    sub_label: null,
    start_time: 1686970800,
    top_score: 0.8,
    zones: [],
    retain_indefinitely: true,
  });
};

const createFrigateReview = (id: string): FrigateReview => ({
  id,
  camera: 'camera-1',
  start_time: 100,
  end_time: 200,
  severity: 'alert',
  thumb_path: 'thumb.jpg',
  data: { objects: [], zones: [] },
  has_been_reviewed: false,
});

const createClipMedia = (): FrigateEventViewMedia => {
  return new FrigateEventViewMedia(
    ViewMediaType.Clip,
    'camera-1',
    createEvent(),
    'event-clip-content-id',
    'event-clip-thumbnail',
  );
};

const createSnapshotMedia = (): FrigateEventViewMedia => {
  return new FrigateEventViewMedia(
    ViewMediaType.Snapshot,
    'camera-1',
    createEvent(),
    'event-snapshot-content-id',
    'event-snapshot-thumbnail',
  );
};

const createFrigateCameraConfig = (
  config?: RawAdvancedCameraCardConfig,
): CameraConfig => {
  return createCameraConfig({
    frigate: {
      camera_name: 'camera-1',
    },
    camera_entity: 'camera.office',
    ...config,
  });
};

describe('getMediaDownloadPath', () => {
  it('should get event with clip download path', async () => {
    const endpoint = await createEngine().getMediaDownloadPath(
      createHASS(),
      createFrigateCameraConfig(),
      createClipMedia(),
    );

    expect(endpoint).toEqual({
      endpoint: '/api/frigate/frigate/notifications/event-id/clip.mp4?download=true',
      sign: true,
    });
  });

  it('should get event with snapshot download path', async () => {
    const endpoint = await createEngine().getMediaDownloadPath(
      createHASS(),
      createFrigateCameraConfig(),
      createSnapshotMedia(),
    );

    expect(endpoint).toEqual({
      endpoint: '/api/frigate/frigate/notifications/event-id/snapshot.jpg?download=true',
      sign: true,
    });
  });

  it('should get recording download path', async () => {
    const endpoint = await createEngine().getMediaDownloadPath(
      createHASS(),
      createFrigateCameraConfig(),
      createRecordingMedia(),
    );

    expect(endpoint).toEqual({
      endpoint:
        '/api/frigate/frigate/recording/camera-1/start/1686945600/end/1686949199?download=true',
      sign: true,
    });
  });

  it('should get no path for unknown type', async () => {
    const endpoint = await createEngine().getMediaDownloadPath(
      createHASS(),
      createFrigateCameraConfig(),
      new ViewMedia(ViewMediaType.Clip, {
        cameraID: 'camera-1',
      }),
    );
    expect(endpoint).toBeNull();
  });
});

describe('getReviews', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should fan out requests for multiple severities', async () => {
    const engine = createEngine();
    const hass = createHASS();
    const cameraConfig = createCameraConfig({
      frigate: { camera_name: 'camera-1', client_id: 'client-1' },
    });
    const store = mock<CameraManagerStore>();
    store.getCameraIDs.mockReturnValue(new Set(['camera-1']));
    store.getCameraIDsWithCapability.mockReturnValue(new Set(['camera-1']));
    store.getCameraConfig.mockReturnValue(cameraConfig);
    store.getCameraConfigs.mockImplementation(function* () {
      yield cameraConfig;
    });
    store.getCameraConfigEntries.mockImplementation(function* () {
      yield ['camera-1', cameraConfig];
    });
    store.hasCameraID.mockReturnValue(true);

    const reviewHigh = createFrigateReview('review-high');
    const reviewMedium = createFrigateReview('review-medium');

    vi.mocked(getReviews)
      .mockResolvedValueOnce([reviewHigh])
      .mockResolvedValueOnce([reviewMedium]);

    const resultsMap = await engine.getReviews(hass, store, {
      type: QueryType.Review,
      source: QuerySource.Camera,
      cameraIDs: new Set(['camera-1']),
      severity: new Set(['high', 'medium']),
    });

    expect(getReviews).toHaveBeenCalledTimes(2);
    expect(getReviews).toHaveBeenCalledWith(
      hass,
      expect.objectContaining({
        severity: 'alert',
      }),
    );
    expect(getReviews).toHaveBeenCalledWith(
      hass,
      expect.objectContaining({
        severity: 'detection',
      }),
    );

    const result = resultsMap?.values().next().value;

    assert(result);
    assert(FrigateQueryResultsClassifier.isFrigateReviewQueryResults(result));

    expect(result.reviews).toHaveLength(2);
    expect(result.reviews).toContainEqual(reviewHigh);
    expect(result.reviews).toContainEqual(reviewMedium);
  });

  it('should handle single severity', async () => {
    const engine = createEngine();
    const hass = createHASS();
    const cameraConfig = createCameraConfig({
      frigate: { camera_name: 'camera-1', client_id: 'client-1' },
    });
    const store = mock<CameraManagerStore>();
    store.getCameraIDs.mockReturnValue(new Set(['camera-1']));
    store.getCameraIDsWithCapability.mockReturnValue(new Set(['camera-1']));
    store.getCameraConfig.mockReturnValue(cameraConfig);
    store.getCameraConfigs.mockImplementation(function* () {
      yield cameraConfig;
    });
    store.getCameraConfigEntries.mockImplementation(function* () {
      yield ['camera-1', cameraConfig];
    });
    store.hasCameraID.mockReturnValue(true);

    const review = createFrigateReview('review-low');

    vi.mocked(getReviews).mockResolvedValue([review]);

    await engine.getReviews(hass, store, {
      type: QueryType.Review,
      source: QuerySource.Camera,
      cameraIDs: new Set(['camera-1']),
      severity: new Set<Severity>(['high']),
    });

    expect(getReviews).toHaveBeenCalledTimes(1);
    expect(getReviews).toHaveBeenCalledWith(
      hass,
      expect.objectContaining({
        severity: 'alert',
      }),
    );
  });

  it('should ignore low severity', async () => {
    const engine = createEngine();
    const hass = createHASS();
    const cameraConfig = createCameraConfig({
      frigate: { camera_name: 'camera-1', client_id: 'client-1' },
    });
    const store = mock<CameraManagerStore>();
    store.getCameraIDs.mockReturnValue(new Set(['camera-1']));
    store.getCameraIDsWithCapability.mockReturnValue(new Set(['camera-1']));
    store.getCameraConfig.mockReturnValue(cameraConfig);
    store.getCameraConfigs.mockImplementation(function* () {
      yield cameraConfig;
    });
    store.getCameraConfigEntries.mockImplementation(function* () {
      yield ['camera-1', cameraConfig];
    });
    store.hasCameraID.mockReturnValue(true);

    vi.mocked(getReviews).mockResolvedValue([]);

    await engine.getReviews(hass, store, {
      type: QueryType.Review,
      source: QuerySource.Camera,
      cameraIDs: new Set(['camera-1']),
      severity: new Set<Severity>(['low']),
    });

    expect(getReviews).not.toHaveBeenCalled();
  });

  it('should query all valid severities when severity is undefined', async () => {
    const engine = createEngine();
    const hass = createHASS();
    const cameraConfig = createCameraConfig({
      frigate: { camera_name: 'camera-1', client_id: 'client-1' },
    });
    const store = mock<CameraManagerStore>();
    store.getCameraIDs.mockReturnValue(new Set(['camera-1']));
    store.getCameraIDsWithCapability.mockReturnValue(new Set(['camera-1']));
    store.getCameraConfig.mockReturnValue(cameraConfig);
    store.getCameraConfigs.mockImplementation(function* () {
      yield cameraConfig;
    });
    store.getCameraConfigEntries.mockImplementation(function* () {
      yield ['camera-1', cameraConfig];
    });
    store.hasCameraID.mockReturnValue(true);

    vi.mocked(getReviews).mockResolvedValue([]);

    await engine.getReviews(hass, store, {
      type: QueryType.Review,
      source: QuerySource.Camera,
      cameraIDs: new Set(['camera-1']),
      severity: undefined,
    });

    expect(getReviews).toHaveBeenCalledTimes(1);
    expect(getReviews).toHaveBeenCalledWith(
      hass,
      expect.objectContaining({
        severity: undefined,
      }),
    );
  });
});
