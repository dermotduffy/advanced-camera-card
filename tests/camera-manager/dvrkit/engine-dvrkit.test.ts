import { assert, describe, expect, it, vi } from 'vitest';

import { DvrkitCamera } from '../../../src/camera-manager/dvrkit/camera';
import { DvrkitCameraManagerEngine } from '../../../src/camera-manager/dvrkit/engine-dvrkit';
import { Engine, QueryResultsType, QueryType } from '../../../src/camera-manager/types';
import { QuerySource } from '../../../src/query-source';
import { ViewMediaType } from '../../../src/view/item';
import { createCameraConfig } from '../../config/test-utils';
import { createHASS, createHASSManager } from '../../test-utils';
import { createStore } from '../test-utils';

const config = createCameraConfig({ camera_entity: 'camera.front' });
const store = createStore([{ cameraID: 'front', config }]);
const start = new Date('2024-01-15T05:00:00Z');
const end = new Date('2024-01-15T08:00:00Z');

const createEngine = () => new DvrkitCameraManagerEngine(createHASSManager());

describe('DvrkitCameraManagerEngine', () => {
  it('initializes camera information and recording capabilities through HA', async () => {
    const hass = createHASS();
    const info = { entry_id: 'entry', channel: 2, name: 'Front', timezone: 'America/New_York' };
    vi.mocked(hass.callWS).mockResolvedValue(info);
    const engine = new DvrkitCameraManagerEngine(createHASSManager({ hass }));
    const camera = await engine.createCamera(config);

    expect(engine.getEngineType()).toBe(Engine.Dvrkit);
    expect(camera).toBeInstanceOf(DvrkitCamera);
    expect((camera as DvrkitCamera).getInfo()).toEqual(info);
    expect(hass.callWS).toHaveBeenCalledWith({ type: 'dvrkit/camera/info', entity_id: 'camera.front' });
    expect(camera.getCapabilities()?.has('recordings')).toBe(true);
    expect(camera.getCapabilities()?.has('seek')).toBe(true);
  });

  it('requires bounds when generating segment queries', () => {
    const engine = createEngine();
    expect(engine.generateDefaultRecordingSegmentsQuery(store, new Set(['front']), { start })).toBeNull();
    expect(engine.generateDefaultRecordingSegmentsQuery(store, new Set(['front']), { start, end })).toEqual([
      { type: QueryType.RecordingSegments, cameraIDs: new Set(['front']), start, end },
    ]);
  });

  it('converts summary hours in the recorder timezone to recording media', async () => {
    const hass = createHASS();
    vi.mocked(hass.callWS).mockResolvedValueOnce({
      timezone: 'America/New_York',
      days: [{ day: '2024-01-15', hours: [{ hour: 1, duration: 1200 }, { hour: 2, duration: 0 }] }],
    });
    const engine = createEngine();
    const query = { type: QueryType.Recording as const, source: QuerySource.Camera as const, cameraIDs: new Set(['front']), start, end };
    const results = await engine.getRecordings(hass, store, query);
    expect(hass.callWS).toHaveBeenCalledWith({ type: 'dvrkit/recordings/summary', entity_id: 'camera.front' });
    assert(results);
    const [resultQuery, result] = [...results.entries()][0];
    expect(result.type).toBe(QueryResultsType.Recording);
    expect(result.engine).toBe(Engine.Dvrkit);
    const media = engine.generateMediaFromRecordings(hass, store, resultQuery, result);
    assert(media);
    expect(media).toHaveLength(1);
    expect(media[0].getMediaType()).toBe(ViewMediaType.Recording);
    expect(media[0].getCameraID()).toBe('front');
    expect(media[0].getStartTime()).toEqual(new Date('2024-01-15T06:00:00Z'));
    expect(media[0].getEndTime()).toEqual(new Date('2024-01-15T07:00:00Z'));
    expect(media[0].getContentID()).toBe('dvrkit://camera.front/1705298400/1705302000');
    expect(hass.callWS).toHaveBeenCalledTimes(1);
    expect(await engine.getMediaSeekTime(hass, store, media[0], new Date('2024-01-15T06:30:00Z'))).toBe(1800);
    expect(await engine.getMediaSeekTime(hass, store, media[0], new Date('2024-01-15T07:01:00Z'))).toBeNull();
  });

  it('preserves both real hours when a local hour repeats at daylight saving time', async () => {
    const hass = createHASS();
    vi.mocked(hass.callWS)
      .mockResolvedValueOnce({
        timezone: 'America/New_York',
        days: [{ day: '2024-11-03', hours: [{ hour: 1, duration: 3600 }] }],
      })
      .mockResolvedValueOnce([
        { start_time: Date.parse('2024-11-03T05:00:00Z') / 1000, end_time: Date.parse('2024-11-03T05:30:00Z') / 1000, type: 'continuous' },
        { start_time: Date.parse('2024-11-03T06:00:00Z') / 1000, end_time: Date.parse('2024-11-03T06:30:00Z') / 1000, type: 'continuous' },
      ]);
    const engine = createEngine();
    const query = { type: QueryType.Recording as const, source: QuerySource.Camera as const, cameraIDs: new Set(['front']) };
    const results = await engine.getRecordings(hass, store, query);
    assert(results);
    const [resultQuery, result] = [...results.entries()][0];
    const media = engine.generateMediaFromRecordings(hass, store, resultQuery, result);
    assert(media);
    expect(media.map((item) => item.getStartTime()?.toISOString())).toEqual([
      '2024-11-03T06:00:00.000Z',
      '2024-11-03T05:00:00.000Z',
    ]);
  });

  it('requests and converts recording segments using epoch seconds', async () => {
    const hass = createHASS();
    vi.mocked(hass.callWS).mockResolvedValue([
      { start_time: 1705300000, end_time: 1705300100, type: 'motion' },
      { start_time: 1705299900, end_time: 1705299950, type: 'continuous' },
    ]);
    const query = { type: QueryType.RecordingSegments as const, cameraIDs: new Set(['front']), start, end };
    const results = await createEngine().getRecordingSegments(hass, store, query);
    expect(hass.callWS).toHaveBeenCalledWith({
      type: 'dvrkit/recordings/get', entity_id: 'camera.front',
      after: start.getTime() / 1000, before: end.getTime() / 1000,
    });
    assert(results);
    expect([...results.values()][0]).toMatchObject({
      type: QueryResultsType.RecordingSegments,
      engine: Engine.Dvrkit,
      segments: [
        { start_time: 1705299900, end_time: 1705299950 },
        { start_time: 1705300000, end_time: 1705300100 },
      ],
    });
  });

  it('does not request recordings for a camera without an entity', async () => {
    const hass = createHASS();
    const noEntityStore = createStore([{ cameraID: 'missing', config: createCameraConfig() }]);
    const result = await createEngine().getRecordingSegments(hass, noEntityStore, {
      type: QueryType.RecordingSegments, cameraIDs: new Set(['missing']), start, end,
    });
    expect(result).toBeNull();
    expect(hass.callWS).not.toHaveBeenCalled();
  });
});
