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

  it('does not invent the other occurrence of a repeated hour', async () => {
    const hass = createHASS();
    vi.mocked(hass.callWS)
      .mockResolvedValueOnce({
        timezone: 'America/New_York',
        days: [{ day: '2024-11-03', hours: [{ hour: 1, duration: 1800 }] }],
      })
      .mockResolvedValueOnce([
        { start_time: Date.parse('2024-11-03T06:00:00Z') / 1000, end_time: Date.parse('2024-11-03T06:30:00Z') / 1000, type: 'continuous' },
      ]);
    const engine = createEngine();
    const query = { type: QueryType.Recording as const, source: QuerySource.Camera as const, cameraIDs: new Set(['front']) };
    const results = await engine.getRecordings(hass, store, query);
    assert(results);
    const [resultQuery, result] = [...results.entries()][0];
    const media = engine.generateMediaFromRecordings(hass, store, resultQuery, result);
    expect(media?.map((item) => item.getStartTime()?.toISOString())).toEqual(['2024-11-03T06:00:00.000Z']);
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

  it('coalesces concurrent summaries while preserving camera identities and refreshing afterward', async () => {
    const hass = createHASS();
    const sharedStore = createStore([
      { cameraID: 'front', config },
      { cameraID: 'alias', config },
      { cameraID: 'back', config: createCameraConfig({ camera_entity: 'camera.back' }) },
    ]);
    vi.mocked(hass.callWS)
      .mockResolvedValueOnce({ timezone: 'UTC', days: [{ day: '2024-01-15', hours: [{ hour: 6, duration: 60 }] }] })
      .mockResolvedValueOnce({ timezone: 'UTC', days: [{ day: '2024-01-15', hours: [{ hour: 7, duration: 60 }] }] })
      .mockResolvedValueOnce({ timezone: 'UTC', days: [{ day: '2024-01-15', hours: [{ hour: 8, duration: 60 }] }] });
    const engine = createEngine();
    const query = { type: QueryType.Recording as const, source: QuerySource.Camera as const, cameraIDs: new Set(['front', 'alias', 'back']) };
    const [first, second] = await Promise.all([
      engine.getRecordings(hass, sharedStore, query),
      engine.getRecordings(hass, sharedStore, query),
    ]);
    expect(hass.callWS).toHaveBeenCalledTimes(2);
    for (const results of [first, second]) {
      assert(results);
      const media = [...results.entries()].flatMap(([resultQuery, result]) =>
        engine.generateMediaFromRecordings(hass, sharedStore, resultQuery, result) ?? []);
      expect(media.map((item) => [item.getCameraID(), item.getStartTime()?.toISOString()]).sort()).toEqual([
        ['alias', '2024-01-15T06:00:00.000Z'],
        ['back', '2024-01-15T07:00:00.000Z'],
        ['front', '2024-01-15T06:00:00.000Z'],
      ]);
      expect([...results.keys()].map((item) => [...item.cameraIDs][0]).sort()).toEqual(['alias', 'back', 'front']);
    }
    const refreshed = await engine.getRecordings(hass, sharedStore, { ...query, cameraIDs: new Set(['front']) });
    assert(refreshed);
    const [resultQuery, result] = [...refreshed.entries()][0];
    expect(engine.generateMediaFromRecordings(hass, sharedStore, resultQuery, result)?.[0].getStartTime())
      .toEqual(new Date('2024-01-15T08:00:00Z'));
    expect(hass.callWS).toHaveBeenCalledTimes(3);
  });

  it('retries a rejected summary instead of retaining the failure', async () => {
    const hass = createHASS();
    vi.mocked(hass.callWS)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ timezone: 'UTC', days: [{ day: '2024-01-15', hours: [{ hour: 6, duration: 60 }] }] });
    const engine = createEngine();
    const query = { type: QueryType.Recording as const, source: QuerySource.Camera as const, cameraIDs: new Set(['front']) };
    const first = engine.getRecordings(hass, store, query);
    const second = engine.getRecordings(hass, store, query);
    const failures = await Promise.allSettled([first, second]);
    expect(failures.map((failure) => failure.status)).toEqual(['rejected', 'rejected']);
    expect(hass.callWS).toHaveBeenCalledTimes(1);
    const results = await engine.getRecordings(hass, store, query);
    assert(results);
    const [resultQuery, result] = [...results.entries()][0];
    expect(engine.generateMediaFromRecordings(hass, store, resultQuery, result)?.[0].getStartTime())
      .toEqual(new Date('2024-01-15T06:00:00Z'));
    expect(hass.callWS).toHaveBeenCalledTimes(2);
  });

  it('coalesces only identical intervals, preserves segment IDs, and retries failures', async () => {
    const hass = createHASS();
    const sharedStore = createStore([
      { cameraID: 'front', config },
      { cameraID: 'alias', config },
      { cameraID: 'back', config: createCameraConfig({ camera_entity: 'camera.back' }) },
    ]);
    vi.mocked(hass.callWS)
      .mockResolvedValueOnce([{ start_time: 100, end_time: 200, type: 'continuous' }])
      .mockResolvedValueOnce([{ start_time: 300, end_time: 400, type: 'continuous' }])
      .mockResolvedValueOnce([{ start_time: 500, end_time: 600, type: 'continuous' }])
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([{ start_time: 700, end_time: 800, type: 'continuous' }]);
    const engine = createEngine();
    const query = { type: QueryType.RecordingSegments as const, cameraIDs: new Set(['front', 'alias', 'back']), start, end };
    const [first, second, differentBounds] = await Promise.all([
      engine.getRecordingSegments(hass, sharedStore, query),
      engine.getRecordingSegments(hass, sharedStore, query),
      engine.getRecordingSegments(hass, sharedStore, { ...query, cameraIDs: new Set(['front']), end: new Date(end.getTime() + 1000) }),
    ]);
    expect(hass.callWS).toHaveBeenCalledTimes(3);
    for (const results of [first, second]) {
      assert(results);
      const segments = [...results.values()].flatMap((result) => result.segments).sort((a, b) => a.id.localeCompare(b.id));
      expect(segments).toEqual([
        { id: 'alias/100/200', start_time: 100, end_time: 200 },
        { id: 'back/300/400', start_time: 300, end_time: 400 },
        { id: 'front/100/200', start_time: 100, end_time: 200 },
      ]);
    }
    assert(differentBounds);
    expect([...differentBounds.values()][0].segments[0].id).toBe('front/500/600');
    const single = { ...query, cameraIDs: new Set(['front']) };
    const failures = await Promise.allSettled([
      engine.getRecordingSegments(hass, sharedStore, single),
      engine.getRecordingSegments(hass, sharedStore, single),
    ]);
    expect(failures.map((failure) => failure.status)).toEqual(['rejected', 'rejected']);
    expect(hass.callWS).toHaveBeenCalledTimes(4);
    const refreshed = await engine.getRecordingSegments(hass, sharedStore, single);
    assert(refreshed);
    expect([...refreshed.values()][0].segments[0].id).toBe('front/700/800');
    expect(hass.callWS).toHaveBeenCalledTimes(5);
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
