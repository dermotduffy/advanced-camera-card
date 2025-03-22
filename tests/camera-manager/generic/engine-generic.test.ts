import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { GenericCameraManagerEngine } from '../../../src/camera-manager/generic/engine-generic';
import { Engine, QueryResultsType, QueryType } from '../../../src/camera-manager/types';
import { StateWatcherSubscriptionInterface } from '../../../src/card-controller/hass/state-watcher';
import { CameraConfig } from '../../../src/config/schema/cameras';
import { RawAdvancedCameraCardConfig } from '../../../src/config/types';
import {
  TestViewMedia,
  createCameraConfig,
  createHASS,
  createStateEntity,
  createStore,
} from '../../test-utils';

const createEngine = (): GenericCameraManagerEngine => {
  return new GenericCameraManagerEngine(mock<StateWatcherSubscriptionInterface>());
};

const createGenericCameraConfig = (
  config?: RawAdvancedCameraCardConfig,
): CameraConfig => {
  return createCameraConfig(config);
};

describe('GenericCameraManagerEngine', () => {
  it('should get engine type', () => {
    expect(createEngine().getEngineType()).toBe(Engine.Generic);
  });

  it('should initialize camera', async () => {
    const config = createGenericCameraConfig();
    const camera = await createEngine().createCamera(createHASS(), config);

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
        { type: QueryType.Event, cameraIDs: new Set(['camera-1']) },
      ),
    ).toBeNull();
  });

  it('should get recordings', async () => {
    const engine = createEngine();
    expect(
      await engine.getRecordings(
        createHASS(),
        createStore([{ cameraID: 'camera-1', engine: engine }]),
        { type: QueryType.Recording, cameraIDs: new Set(['camera-1']) },
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

  it('should generate media from events', async () => {
    const engine = createEngine();
    expect(
      engine.generateMediaFromEvents(
        createHASS(),
        createStore([{ cameraID: 'camera-1', engine: engine }]),
        {
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

  it('should get media download path', async () => {
    expect(
      await createEngine().getMediaDownloadPath(
        createHASS(),
        createGenericCameraConfig(),
        new TestViewMedia(),
      ),
    ).toBeNull();
  });

  it('should favorite media', async () => {
    expect(
      await createEngine().favoriteMedia(
        createHASS(),
        createGenericCameraConfig(),
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
    it('with empty config', async () => {
      expect(
        createEngine().getCameraMetadata(createHASS(), createGenericCameraConfig()),
      ).toEqual({
        icon: {
          entity: undefined,
          icon: undefined,
          fallback: 'mdi:video',
        },
        title: '',
      });
    });

    it('with id', async () => {
      expect(
        createEngine().getCameraMetadata(
          createHASS(),
          createGenericCameraConfig({ id: 'https://go2rtc#stream' }),
        ),
      ).toEqual(
        expect.objectContaining({
          title: 'https://go2rtc#stream',
        }),
      );
    });

    it('with configured title', async () => {
      expect(
        createEngine().getCameraMetadata(
          createHASS(),
          createGenericCameraConfig({
            title: 'My Camera',
          }),
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
            createGenericCameraConfig({
              camera_entity: 'camera.test',
            }),
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
            createGenericCameraConfig({
              webrtc_card: {
                entity: 'camera.test',
              },
            }),
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
    it('default', () => {
      expect(createEngine().getCameraEndpoints(createGenericCameraConfig())).toBeNull();
    });

    it('for go2rtc', () => {
      expect(
        createEngine().getCameraEndpoints(
          createGenericCameraConfig({
            go2rtc: {
              stream: 'stream',
              url: '/local/path',
            },
          }),
        ),
      ).toEqual({
        go2rtc: {
          endpoint: '/local/path/api/ws?src=stream',
          sign: true,
        },
      });
    });

    it('for webrtc-card', () => {
      expect(
        createEngine().getCameraEndpoints(
          createGenericCameraConfig({
            camera_entity: 'camera.office',
          }),
        ),
      ).toEqual({
        webrtcCard: {
          endpoint: 'camera.office',
        },
      });
    });
  });

  it('should execute PTZ action', () => {
    const hass = createHASS();
    createEngine().executePTZAction(hass, createCameraConfig(), 'left');
    expect(hass.callService).not.toBeCalled();
  });
});
