import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { Camera } from '../../../src/camera-manager/camera';
import type { CameraManagerEngine } from '../../../src/camera-manager/engine';
import { GenericCameraManagerEngine } from '../../../src/camera-manager/generic/engine-generic';
import { Engine, QueryResultsType, QueryType } from '../../../src/camera-manager/types';
import type { CameraConfig } from '../../../src/config/schema/cameras';
import type { RawAdvancedCameraCardConfig } from '../../../src/config/types';
import { QuerySource } from '../../../src/query-source';
import { createCameraConfig } from '../../config/test-utils';
import { createHASS, createHASSManager, createStateEntity } from '../../test-utils';
import { TestViewMedia } from '../../view/test-utils';
import { createStore } from '../test-utils';

const createEngine = (): GenericCameraManagerEngine => {
  return new GenericCameraManagerEngine(createHASSManager());
};

const createGenericCameraConfig = (
  config?: RawAdvancedCameraCardConfig,
): CameraConfig => {
  return createCameraConfig(config);
};

const createGenericCamera = (config?: RawAdvancedCameraCardConfig): Camera => {
  const camera = new Camera(
    createGenericCameraConfig(config),
    mock<CameraManagerEngine>(),
    { hassManager: createHASSManager() },
  );
  camera.setID('camera-1');
  return camera;
};

describe('GenericCameraManagerEngine', () => {
  it('should get engine type', () => {
    expect(createEngine().getEngineType()).toBe(Engine.Generic);
  });

  it('should initialize camera', async () => {
    const config = createGenericCameraConfig();
    const camera = createEngine().createCamera(config);
    await camera.initialize();

    expect(camera.getConfig()).toEqual(config);
    expect(camera.getCapabilities()).toBeTruthy();
    expect(camera.getCapabilities()?.has('favorite-events')).toBeFalsy();
    expect(camera.getCapabilities()?.has('favorite-recordings')).toBeFalsy();
    expect(camera.getCapabilities()?.has('seek')).toBeFalsy();
    expect(camera.getCapabilities()?.has('clips')).toBeFalsy();
    expect(camera.getCapabilities()?.has('recordings')).toBeFalsy();
    expect(camera.getCapabilities()?.has('snapshots')).toBeFalsy();
    expect(camera.getCapabilities()?.has('trigger')).toBeTruthy();
  });

  it('should get default query parameters', async () => {
    const config = createGenericCameraConfig();
    const camera = createEngine().createCamera(config);
    expect(createEngine().getDefaultQueryParameters(camera, QueryType.Event)).toEqual(
      {},
    );
  });

  it('should generate default event query', () => {
    const engine = createEngine();
    expect(
      engine.generateDefaultEventQuery(
        createStore([{ cameraID: 'camera-1', engine: engine }]),
        new Set(['camera-1']),
        {},
      ),
    ).toBeNull();
  });

  it('should generate default recording query', () => {
    const engine = createEngine();
    expect(
      engine.generateDefaultRecordingQuery(
        createStore([{ cameraID: 'camera-1', engine: engine }]),
        new Set(['camera-1']),
        {},
      ),
    ).toBeNull();
  });

  it('should generate default recording segments query', () => {
    const engine = createEngine();
    expect(
      engine.generateDefaultRecordingSegmentsQuery(
        createStore([{ cameraID: 'camera-1', engine: engine }]),
        new Set(['camera-1']),
        {},
      ),
    ).toBeNull();
  });

  it('should get events', async () => {
    const engine = createEngine();
    expect(
      await engine.getEvents(
        createHASS(),
        createStore([{ cameraID: 'camera-1', engine: engine }]),
        {
          source: QuerySource.Camera,
          type: QueryType.Event,
          cameraIDs: new Set(['camera-1']),
        },
      ),
    ).toBeNull();
  });

  it('should get recordings', async () => {
    const engine = createEngine();
    expect(
      await engine.getRecordings(
        createHASS(),
        createStore([{ cameraID: 'camera-1', engine: engine }]),
        {
          source: QuerySource.Camera,
          type: QueryType.Recording,
          cameraIDs: new Set(['camera-1']),
        },
      ),
    ).toBeNull();
  });

  it('should get recording segments', async () => {
    const engine = createEngine();
    expect(
      await engine.getRecordingSegments(
        createHASS(),
        createStore([{ cameraID: 'camera-1', engine: engine }]),
        {
          type: QueryType.RecordingSegments,
          cameraIDs: new Set(['camera-1']),
          start: new Date(),
          end: new Date(),
        },
      ),
    ).toBeNull();
  });

  it('should generate default review query', () => {
    const engine = createEngine();
    expect(
      engine.generateDefaultReviewQuery(
        createStore([{ cameraID: 'camera-1', engine: engine }]),
        new Set(['camera-1']),
        {},
      ),
    ).toBeNull();
  });

  it('should get reviews', async () => {
    const engine = createEngine();
    expect(
      await engine.getReviews(
        createHASS(),
        createStore([{ cameraID: 'camera-1', engine: engine }]),
        {
          source: QuerySource.Camera,
          type: QueryType.Review,
          cameraIDs: new Set(['camera-1']),
        },
      ),
    ).toBeNull();
  });

  it('should generate media from events', async () => {
    const engine = createEngine();
    expect(
      engine.generateMediaFromEvents(
        createHASS(),
        createStore([{ cameraID: 'camera-1', engine: engine }]),
        {
          source: QuerySource.Camera,
          type: QueryType.Event,
          cameraIDs: new Set(['camera-1']),
        },
        {
          type: QueryResultsType.Event,
          engine: Engine.Generic,
        },
      ),
    ).toBeNull();
  });

  it('should generate media from recordings', async () => {
    const engine = createEngine();
    expect(
      engine.generateMediaFromRecordings(
        createHASS(),
        createStore([{ cameraID: 'camera-1', engine: engine }]),
        {
          source: QuerySource.Camera,
          type: QueryType.Recording,
          cameraIDs: new Set(['camera-1']),
          start: new Date(),
          end: new Date(),
        },
        {
          type: QueryResultsType.Recording,
          engine: Engine.Generic,
        },
      ),
    ).toBeNull();
  });

  it('should generate media from reviews', async () => {
    const engine = createEngine();
    expect(
      engine.generateMediaFromReviews(
        createHASS(),
        createStore([{ cameraID: 'camera-1', engine: engine }]),
        {
          source: QuerySource.Camera,
          type: QueryType.Review,
          cameraIDs: new Set(['camera-1']),
        },
        {
          type: QueryResultsType.Review,
          engine: Engine.Generic,
        },
      ),
    ).toBeNull();
  });

  it('should get media download path', async () => {
    expect(
      await createEngine().getMediaDownloadPath(
        createHASS(),
        createGenericCamera(),
        new TestViewMedia(),
      ),
    ).toBeNull();
  });

  it('should favorite media', async () => {
    expect(
      await createEngine().favoriteMedia(
        createHASS(),
        createGenericCamera(),
        new TestViewMedia(),
        true,
      ),
    ).toBeUndefined();
  });

  it('should review media', async () => {
    expect(
      await createEngine().reviewMedia(
        createHASS(),
        createGenericCamera(),
        new TestViewMedia(),
        true,
      ),
    ).toBeUndefined();
  });

  it('should get query result max age', () => {
    expect(
      createEngine().getQueryResultMaxAge({
        type: QueryType.Event,
        cameraIDs: new Set(['camera-1']),
      }),
    ).toBeNull();
  });

  it('should get media seek time', async () => {
    const engine = createEngine();
    expect(
      await engine.getMediaSeekTime(
        createHASS(),
        createStore([{ cameraID: 'camera-1', engine: engine }]),
        new TestViewMedia(),
        new Date(),
      ),
    ).toBeNull();
  });

  it('should get media metadata', async () => {
    const engine = createEngine();
    expect(
      await engine.getMediaMetadata(
        createHASS(),
        createStore([{ cameraID: 'camera-1', engine: engine }]),
        { type: QueryType.MediaMetadata, cameraIDs: new Set(['camera-1']) },
      ),
    ).toBeNull();
  });

  describe('should get camera metadata', () => {
    it('with nothing but an identifier', async () => {
      expect(
        createEngine().getCameraMetadata(createHASS(), createGenericCamera()),
      ).toEqual({
        icon: {
          entity: undefined,
          icon: undefined,
          fallback: 'mdi:video',
        },
        title: 'camera-1',
      });
    });

    it('with configured title', async () => {
      expect(
        createEngine().getCameraMetadata(
          createHASS(),
          createGenericCamera({ title: 'My Camera' }),
        ),
      ).toEqual(
        expect.objectContaining({
          title: 'My Camera',
        }),
      );
    });

    describe('with entity title', () => {
      it('camera_entity', async () => {
        expect(
          createEngine().getCameraMetadata(
            createHASS({
              'camera.test': createStateEntity({
                attributes: { friendly_name: 'My Entity Camera' },
              }),
            }),
            createGenericCamera({ camera_entity: 'camera.test' }),
          ),
        ).toEqual(
          expect.objectContaining({
            title: 'My Entity Camera',
          }),
        );
      });

      it('webrtc_card.entity', async () => {
        expect(
          createEngine().getCameraMetadata(
            createHASS({
              'camera.test': createStateEntity({
                attributes: { friendly_name: 'My Entity Camera' },
              }),
            }),
            createGenericCamera({ webrtc_card: { entity: 'camera.test' } }),
          ),
        ).toEqual(
          expect.objectContaining({
            title: 'My Entity Camera',
          }),
        );
      });
    });
  });

  it('should get media capabilities', () => {
    expect(createEngine().getMediaCapabilities(new TestViewMedia())).toBeNull();
  });

  describe('should get camera endpoints', () => {
    it('default', async () => {
      const camera = createEngine().createCamera(createGenericCameraConfig());
      expect(camera.getEndpoints()).toBeNull();
    });

    it('for go2rtc', async () => {
      const camera = createEngine().createCamera(
        createGenericCameraConfig({
          go2rtc: {
            stream: 'stream',
            url: '/local/path',
          },
        }),
      );

      expect(camera.getEndpoints()).toEqual({
        go2rtc: {
          endpoint: '/local/path/api/ws?src=stream',
          sign: true,
        },
      });
    });

    it('for webrtc-card', async () => {
      const camera = createEngine().createCamera(
        createGenericCameraConfig({
          camera_entity: 'camera.office',
        }),
      );

      expect(camera.getEndpoints()).toEqual({
        webrtcCard: {
          endpoint: 'camera.office',
        },
      });
    });
  });
});
