import { DataSet } from 'vis-data';
import { TimelineWindow } from 'vis-timeline';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CameraManager } from '../../../src/camera-manager/manager';
import {
  Engine,
  EventQuery,
  QueryResultsType,
  QueryType,
  RecordingSegment,
  RecordingSegmentsQuery,
  RecordingSegmentsQueryResults,
} from '../../../src/camera-manager/types';
import {
  AdvancedCameraCardTimelineItem,
  TimelineDataSource,
} from '../../../src/components-lib/timeline/source';
import { TimelineKey } from '../../../src/components-lib/timeline/types';
import { ViewMediaType } from '../../../src/view/item';
import { EventMediaQuery } from '../../../src/view/query';
import {
  createCameraManager,
  createFolder,
  createStore,
  createView,
  TestViewMedia,
} from '../../test-utils';

const CAMERA_ID = 'CAMERA_ID';
const TEST_MEDIA_ID = 'TEST_MEDIA_ID';
const RECORDING_SEGMENT_ID = 'SEGMENT_ID';
const EXPECTED_RECORDING_ID = `recording-${CAMERA_ID}-${RECORDING_SEGMENT_ID}`;

const start = new Date('2025-09-21T19:31:06Z');
const end = new Date('2025-09-21T19:31:15Z');

const testMedia = new TestViewMedia({
  cameraID: CAMERA_ID,
  id: TEST_MEDIA_ID,
  startTime: start,
  endTime: end,
});

const createTestCameraManager = (): CameraManager => {
  const cameraManager = createCameraManager(
    createStore([
      {
        cameraID: CAMERA_ID,
      },
    ]),
  );

  vi.mocked(cameraManager.getCameraMetadata).mockReturnValue({
    title: 'Camera Title',
    icon: { icon: 'mdi:camera' },
  });
  const eventQuery: EventQuery = {
    type: QueryType.Event,
    cameraIDs: new Set([CAMERA_ID]),
    start: start,
    end: end,
  };

  vi.mocked(cameraManager.generateDefaultEventQueries).mockReturnValue([eventQuery]);
  vi.mocked(cameraManager.executeMediaQueries).mockResolvedValue([testMedia]);

  const recordingSegmentQuery: RecordingSegmentsQuery = {
    type: QueryType.RecordingSegments,
    cameraIDs: new Set([CAMERA_ID]),
    start,
    end,
  };
  vi.mocked(cameraManager.generateDefaultRecordingSegmentsQueries).mockReturnValue([
    recordingSegmentQuery,
  ]);

  const recordingSegment: RecordingSegment = {
    start_time: 1695307866,
    end_time: 1695307875,
    id: RECORDING_SEGMENT_ID,
  };
  const recordingSegmentsQueryResults: RecordingSegmentsQueryResults = {
    type: QueryResultsType.RecordingSegments,
    engine: Engine.Generic,
    segments: [recordingSegment],
  };

  vi.mocked(cameraManager.getRecordingSegments).mockResolvedValue(
    new Map([[recordingSegmentQuery, recordingSegmentsQueryResults]]),
  );
  return cameraManager;
};

describe('TimelineDataSource', () => {
  const folder = createFolder({ id: 'folder/FOLDER_ID', title: 'Folder Title' });
  const timelineKeys: TimelineKey[] = [
    { type: 'camera', cameraID: 'CAMERA_ID' },
    { type: 'folder', folder: folder },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('should get groups', () => {
    it('should get mixed groups', () => {
      const source = new TimelineDataSource(
        createTestCameraManager(),
        timelineKeys,
        'all',
        true,
      );

      expect(source.groups.length).toBe(2);
      expect(source.groups.get('camera/CAMERA_ID')).toEqual({
        content: 'Camera Title',
        id: 'camera/CAMERA_ID',
      });
      expect(source.groups.get('folder/FOLDER_ID')).toEqual({
        content: 'Folder Title',
        id: 'folder/FOLDER_ID',
      });
    });

    it('should use camera id if camera has no title', () => {
      const cameraManager = createTestCameraManager();
      vi.mocked(cameraManager.getCameraMetadata).mockReturnValue(null);

      const source = new TimelineDataSource(cameraManager, timelineKeys, 'all', true);

      expect(source.groups.get('camera/CAMERA_ID')).toEqual({
        content: 'CAMERA_ID',
        id: 'camera/CAMERA_ID',
      });
    });

    it('should use folder id if folder has no title', () => {
      const folder = createFolder({ id: 'folder/FOLDER_ID' });
      const timelineKeys: TimelineKey[] = [{ type: 'folder', folder: folder }];

      const source = new TimelineDataSource(
        createTestCameraManager(),
        timelineKeys,
        'all',
        true,
      );

      expect(source.groups.get('folder/FOLDER_ID')).toEqual({
        content: 'folder/FOLDER_ID',
        id: 'folder/FOLDER_ID',
      });
    });
  });

  describe('should update events from view', () => {
    it('should add camera events to dataset', () => {
      const startTime = new Date('2025-09-21T15:32:21Z');
      const endTime = new Date('2025-09-21T15:35:28Z');
      const id = 'EVENT_ID';
      const media = new TestViewMedia({
        cameraID: 'CAMERA_ID',
        id,
        startTime,
        endTime,
      });

      const source = new TimelineDataSource(
        createTestCameraManager(),
        timelineKeys,
        'all',
        true,
      );
      source.addEventMediaToDataset([media]);

      expect(source.dataset.length).toBe(1);
      expect(source.dataset.get(id)).toEqual({
        id,
        start: startTime.getTime(),
        end: endTime.getTime(),
        media,
        group: 'camera/CAMERA_ID',
        content: '',
        type: 'range',
      });
    });

    it('should add folder events to dataset', () => {
      const startTime = new Date('2025-09-21T15:32:21Z');
      const endTime = new Date('2025-09-21T15:35:28Z');
      const id = 'EVENT_ID';
      const folderID = 'folder/FOLDER_ID';
      const folder = createFolder({ id: folderID });
      const media = new TestViewMedia({
        cameraID: null,
        id,
        startTime,
        endTime,
        folder,
      });

      const source = new TimelineDataSource(
        createTestCameraManager(),
        timelineKeys,
        'all',
        true,
      );
      source.addEventMediaToDataset([media]);

      expect(source.dataset.length).toBe(1);
      expect(source.dataset.get(id)).toEqual({
        id,
        start: startTime.getTime(),
        end: endTime.getTime(),
        media,
        group: folderID,
        content: '',
        type: 'range',
      });
    });

    it('should ignore non-events media', () => {
      const source = new TimelineDataSource(
        createTestCameraManager(),
        timelineKeys,
        'all',
        true,
      );

      source.addEventMediaToDataset([
        new TestViewMedia({
          mediaType: ViewMediaType.Recording,
        }),
      ]);

      expect(source.dataset.length).toBe(0);
    });

    it('should ignore null results', () => {
      const source = new TimelineDataSource(
        createTestCameraManager(),
        timelineKeys,
        'all',
        true,
      );

      source.addEventMediaToDataset(null);

      expect(source.dataset.length).toBe(0);
    });

    it('should ignore media without camera or folder ownership', () => {
      const source = new TimelineDataSource(
        createTestCameraManager(),
        timelineKeys,
        'all',
        true,
      );

      source.addEventMediaToDataset([
        new TestViewMedia({
          cameraID: null,
          folder: null,
          mediaType: ViewMediaType.Snapshot,
        }),
      ]);

      expect(source.dataset.length).toBe(0);
    });
  });

  describe('should refresh', () => {
    const window: TimelineWindow = {
      start: new Date('2025-09-21T19:31:06Z'),
      end: new Date('2025-09-21T19:31:15Z'),
    };

    describe('should refresh events', () => {
      beforeEach(() => {
        vi.restoreAllMocks();
      });

      it('should refresh events successfully', async () => {
        const source = new TimelineDataSource(
          createTestCameraManager(),
          timelineKeys,
          'all',
          false,
        );
        const view = createView();

        await source.refresh(window, view);

        expect(source.dataset.length).toBe(1);

        expect(source.dataset.get('TEST_MEDIA_ID')).toEqual({
          id: 'TEST_MEDIA_ID',
          content: '',
          start: new Date('2025-09-21T19:31:06Z').getTime(),
          end: new Date('2025-09-21T19:31:15Z').getTime(),
          media: testMedia,
          type: 'range',
          group: 'camera/CAMERA_ID',
        });
      });

      it('should refresh events and handle exception', async () => {
        const consoleSpy = vi.spyOn(global.console, 'warn').mockReturnValue(undefined);

        const cameraManager = createTestCameraManager();
        vi.mocked(cameraManager.executeMediaQueries).mockRejectedValue(
          new Error('Error fetching events'),
        );

        const source = new TimelineDataSource(cameraManager, timelineKeys, 'all', false);

        expect(source.dataset.length).toBe(0);

        await source.refresh(window);

        expect(source.dataset.length).toBe(0);

        expect(consoleSpy).toHaveBeenCalledWith('Error fetching events');
      });

      it('should not refresh events when window is cached', async () => {
        const cameraManager = createTestCameraManager();
        const source = new TimelineDataSource(cameraManager, timelineKeys, 'all', false);
        const view = createView();

        await source.refresh(window, view);
        expect(source.dataset.length).toBe(1);

        await source.refresh(window, view);
        expect(source.dataset.length).toBe(1);
        expect(cameraManager.executeMediaQueries).toHaveBeenCalledTimes(1);
      });

      it('should not refresh events when events in view', async () => {
        const source = new TimelineDataSource(
          createTestCameraManager(),
          timelineKeys,
          'all',
          false,
        );

        await source.refresh(window, createView({ query: new EventMediaQuery() }));

        expect(source.dataset.length).toBe(0);
      });

      it('should not refresh events when unable to create event queries', async () => {
        const cameraManager = createTestCameraManager();
        vi.mocked(cameraManager.generateDefaultEventQueries).mockReturnValue(null);

        const source = new TimelineDataSource(cameraManager, timelineKeys, 'all', false);

        await source.refresh(window);
        expect(source.dataset.length).toBe(0);
      });
    });

    describe('should refresh recordings', () => {
      const getRecordings = (
        dataset: DataSet<AdvancedCameraCardTimelineItem>,
      ): AdvancedCameraCardTimelineItem[] => {
        return dataset.get({ filter: (item) => item.type === 'background' });
      };

      it('should refresh recordings successfully', async () => {
        const source = new TimelineDataSource(
          createTestCameraManager(),
          timelineKeys,
          'all',
          true,
        );

        await source.refresh(window);

        // 1 event and 1 recording == 2 total items.
        expect(source.dataset.length).toBe(2);

        expect(source.dataset.get(EXPECTED_RECORDING_ID)).toEqual({
          content: '',
          end: 1695307875000,
          group: 'camera/CAMERA_ID',
          id: EXPECTED_RECORDING_ID,
          start: 1695307866000,
          type: 'background',
        });
      });

      it('should refresh recordings and handle exception', async () => {
        const consoleSpy = vi.spyOn(global.console, 'warn').mockReturnValue(undefined);

        const cameraManager = createTestCameraManager();
        vi.mocked(cameraManager.getRecordingSegments).mockRejectedValue(
          new Error('Error fetching recordings'),
        );

        const source = new TimelineDataSource(cameraManager, timelineKeys, 'all', true);

        expect(getRecordings(source.dataset).length).toBe(0);

        await source.refresh(window);

        expect(getRecordings(source.dataset).length).toBe(0);

        expect(consoleSpy).toHaveBeenCalledWith('Error fetching recordings');
      });

      it('should not refresh recordings when window is cached', async () => {
        const cameraManager = createTestCameraManager();
        const source = new TimelineDataSource(cameraManager, timelineKeys, 'all', true);

        await source.refresh(window);
        expect(getRecordings(source.dataset).length).toBe(1);

        await source.refresh(window);
        expect(getRecordings(source.dataset).length).toBe(1);

        expect(cameraManager.getRecordingSegments).toHaveBeenCalledTimes(1);
      });

      it('should not refresh recordings when recordings disabled', async () => {
        const source = new TimelineDataSource(
          createTestCameraManager(),
          timelineKeys,
          'all',

          // Disable recordings.
          false,
        );

        await source.refresh(window);

        expect(source.dataset.get(EXPECTED_RECORDING_ID)).toBeNull();
      });

      it('should not refresh recordings without any cameras', async () => {
        const timelineKeys: TimelineKey[] = [{ type: 'folder', folder: folder }];

        const source = new TimelineDataSource(
          createTestCameraManager(),
          timelineKeys,
          'all',
          true,
        );

        await source.refresh(window);

        expect(source.dataset.get(EXPECTED_RECORDING_ID)).toBeNull();
      });

      it('should not refresh recordings without recording queries', async () => {
        const cameraManager = createTestCameraManager();
        vi.mocked(cameraManager.generateDefaultRecordingSegmentsQueries).mockReturnValue(
          null,
        );

        const source = new TimelineDataSource(cameraManager, timelineKeys, 'all', true);

        await source.refresh(window);

        expect(getRecordings(source.dataset).length).toBe(0);
        expect(cameraManager.getRecordingSegments).toHaveBeenCalledTimes(0);
      });

      it('should compress recording segments', async () => {
        const cameraManager = createTestCameraManager();

        const recordingSegmentQuery: RecordingSegmentsQuery = {
          type: QueryType.RecordingSegments,
          cameraIDs: new Set([CAMERA_ID]),
          start: new Date('2025-09-21T19:31:06Z'),
          end: new Date('2025-09-21T19:31:15Z'),
        };

        const recordingSegmentsQueryResults: RecordingSegmentsQueryResults = {
          type: QueryResultsType.RecordingSegments,
          engine: Engine.Generic,
          segments: [
            {
              start_time: 1695307866,
              end_time: 1695307875,
              id: RECORDING_SEGMENT_ID,
            },
            {
              start_time: 1695307875,
              end_time: 1695307885,
              id: `${RECORDING_SEGMENT_ID}-2`,
            },
          ],
        };

        vi.mocked(cameraManager.getRecordingSegments).mockResolvedValue(
          new Map([
            [recordingSegmentQuery, recordingSegmentsQueryResults],
            [{ ...recordingSegmentQuery }, recordingSegmentsQueryResults],
          ]),
        );

        const source = new TimelineDataSource(cameraManager, timelineKeys, 'all', true);

        await source.refresh(window);

        expect(getRecordings(source.dataset)).toEqual([
          {
            content: '',
            end: 1695307885000,
            group: 'camera/CAMERA_ID',
            id: 'recording-CAMERA_ID-SEGMENT_ID',
            start: 1695307866000,
            type: 'background',
          },
        ]);
        expect(cameraManager.getRecordingSegments).toHaveBeenCalledTimes(1);
      });

      it('should compress recording segments without an end', async () => {
        const cameraManager = createTestCameraManager();

        const recordingSegmentQuery: RecordingSegmentsQuery = {
          type: QueryType.RecordingSegments,
          cameraIDs: new Set([CAMERA_ID]),
          start: new Date('2025-09-21T19:31:06Z'),
          end: new Date('2025-09-21T19:31:15Z'),
        };

        const recordingSegmentsQueryResults: RecordingSegmentsQueryResults = {
          type: QueryResultsType.RecordingSegments,
          engine: Engine.Generic,
          segments: [
            {
              start_time: 1695307866,
              end_time: 1695307876,
              id: RECORDING_SEGMENT_ID,
            },
            {
              start_time: 1695307875,
              end_time: 1695307885,
              id: `${RECORDING_SEGMENT_ID}-2`,
            },
          ],
        };

        vi.mocked(cameraManager.getRecordingSegments).mockResolvedValue(
          new Map([[recordingSegmentQuery, recordingSegmentsQueryResults]]),
        );

        const source = new TimelineDataSource(cameraManager, timelineKeys, 'all', true);
        source.dataset.add({
          id: 'recording-CAMERA_ID-SEGMENT_ID',
          start: 1695307866000,

          // No end time.
          end: undefined,

          group: 'camera/CAMERA_ID',
          content: '',
          type: 'background',
        });

        await source.refresh(window);

        expect(getRecordings(source.dataset)).toEqual([
          {
            content: '',
            end: 1695307885000,
            group: 'camera/CAMERA_ID',
            id: 'recording-CAMERA_ID-SEGMENT_ID',
            start: 1695307866000,
            type: 'background',
          },
        ]);
        expect(cameraManager.getRecordingSegments).toHaveBeenCalledTimes(1);
      });

      it('should compress recording segments without mixing up cameras', async () => {
        const cameraManager = createTestCameraManager();

        vi.mocked(cameraManager.getRecordingSegments).mockResolvedValue(
          new Map([
            [
              {
                type: QueryType.RecordingSegments,
                cameraIDs: new Set(['camera-1']),
                start: new Date('2025-09-21T19:31:06Z'),
                end: new Date('2025-09-21T19:31:15Z'),
              },
              {
                type: QueryResultsType.RecordingSegments,
                engine: Engine.Generic,
                segments: [
                  {
                    start_time: 1695307866,
                    end_time: 1695307875,
                    id: 'segment-1',
                  },
                ],
              },
            ],

            [
              {
                type: QueryType.RecordingSegments,
                cameraIDs: new Set(['camera-2']),
                start: new Date('2025-09-21T19:31:06Z'),
                end: new Date('2025-09-21T19:31:15Z'),
              },
              {
                type: QueryResultsType.RecordingSegments,
                engine: Engine.Generic,
                segments: [
                  {
                    start_time: 1695307866,
                    end_time: 1695307875,
                    id: 'segment-2',
                  },
                ],
              },
            ],
          ]),
        );

        const source = new TimelineDataSource(cameraManager, timelineKeys, 'all', true);

        await source.refresh(window);

        expect(getRecordings(source.dataset)).toEqual([
          {
            content: '',
            end: 1695307875000,
            group: 'camera/camera-1',
            id: 'recording-camera-1-segment-1',
            start: 1695307866000,
            type: 'background',
          },
          {
            content: '',
            end: 1695307875000,
            group: 'camera/camera-2',
            id: 'recording-camera-2-segment-2',
            start: 1695307866000,
            type: 'background',
          },
        ]);
        expect(cameraManager.getRecordingSegments).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('should get timeline event queries', () => {
    const window: TimelineWindow = { start, end };

    it('should not event queries without cameras', () => {
      const timelineKeys: TimelineKey[] = [{ type: 'folder', folder: folder }];
      const source = new TimelineDataSource(
        createCameraManager(),
        timelineKeys,
        'all',
        true,
      );

      expect(source.getTimelineEventQueries(window)).toBeNull();
    });

    it('should get event queries for clips', () => {
      const cameraManager = createCameraManager(
        createStore([
          {
            cameraID: CAMERA_ID,
          },
        ]),
      );
      const source = new TimelineDataSource(cameraManager, timelineKeys, 'clips', false);
      source.getTimelineEventQueries(window);

      expect(cameraManager.generateDefaultEventQueries).toBeCalledWith(
        new Set([CAMERA_ID]),
        {
          start,
          end,
          hasClip: true,
        },
      );
    });

    it('should get event queries for snapshots', () => {
      const cameraManager = createCameraManager(
        createStore([
          {
            cameraID: CAMERA_ID,
          },
        ]),
      );
      const source = new TimelineDataSource(
        cameraManager,
        timelineKeys,
        'snapshots',
        false,
      );
      source.getTimelineEventQueries(window);

      expect(cameraManager.generateDefaultEventQueries).toBeCalledWith(
        new Set([CAMERA_ID]),
        {
          start,
          end,
          hasSnapshot: true,
        },
      );
    });
  });

  describe('should get timeline recording queries', () => {
    const window: TimelineWindow = { start, end };

    it('should not recording queries without cameras', () => {
      const timelineKeys: TimelineKey[] = [{ type: 'folder', folder: folder }];
      const source = new TimelineDataSource(
        createCameraManager(),
        timelineKeys,
        'all',
        true,
      );

      expect(source.getTimelineRecordingQueries(window)).toBeNull();
    });

    it('should get recording queries', () => {
      const cameraManager = createCameraManager(
        createStore([
          {
            cameraID: CAMERA_ID,
          },
        ]),
      );
      const source = new TimelineDataSource(cameraManager, timelineKeys, 'all', true);
      source.getTimelineRecordingQueries(window);

      expect(cameraManager.generateDefaultRecordingQueries).toBeCalledWith(
        new Set([CAMERA_ID]),
        {
          start,
          end,
        },
      );
    });
  });

  describe('should rewrite event', () => {
    it('should not rewrite when item is not found', () => {
      const source = new TimelineDataSource(
        createTestCameraManager(),
        timelineKeys,
        'all',
        true,
      );
      source.rewriteEvent('UNKNOWN_ID');

      expect(source.dataset.length).toBe(0);
    });

    it('should not rewrite when item is not found', () => {
      const source = new TimelineDataSource(
        createTestCameraManager(),
        timelineKeys,
        'all',
        true,
      );
      const item = {
        id: 'id',
        start: start.getTime(),
        end: end.getTime(),
        media: testMedia,
        group: 'camera/CAMERA_ID' as const,
        content: '',
        type: 'range' as const,
      };
      source.dataset.add(item);

      source.rewriteEvent('id');

      expect(source.dataset.get('id')).toBe(item);
    });
  });
});
