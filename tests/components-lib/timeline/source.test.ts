import { add } from 'date-fns';
import { DataSet } from 'vis-data';
import { TimelineWindow } from 'vis-timeline';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
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
import { FoldersManager } from '../../../src/card-controller/folders/manager';
import {
  AdvancedCameraCardTimelineItem,
  TimelineDataSource,
} from '../../../src/components-lib/timeline/source';
import { TimelineKeys } from '../../../src/components-lib/timeline/types';
import { ConditionStateManagerReadonlyInterface } from '../../../src/conditions/types';
import { ViewMediaType } from '../../../src/view/item';
import { FolderViewQuery } from '../../../src/view/query';
import {
  createCameraManager,
  createFolder,
  createStore,
  createView,
  TestViewMedia,
} from '../../test-utils';

const CAMERA_ID = 'camera-1';
const TEST_MEDIA_ID = 'TEST_MEDIA_ID';
const RECORDING_SEGMENT_ID = 'SEGMENT_ID';
const EXPECTED_RECORDING_ID = `recording-${CAMERA_ID}-${RECORDING_SEGMENT_ID}`;

const start = new Date('2025-09-21T19:31:06Z');
const end = new Date('2025-09-21T19:31:15Z');

const testCameraMedia = new TestViewMedia({
  cameraID: CAMERA_ID,
  id: TEST_MEDIA_ID,
  startTime: start,
  endTime: end,
});

const folder = createFolder({ id: 'folder/folder-1', title: 'Folder Title' });
const testFolderMedia = new TestViewMedia({
  folder,
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
  vi.mocked(cameraManager.executeMediaQueries).mockResolvedValue([testCameraMedia]);

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
  const cameraTimelineKeys: TimelineKeys = {
    type: 'camera',
    cameraIDs: new Set(['camera-1', 'camera-2']),
  };
  const folderTimelineKeys: TimelineKeys = {
    type: 'folder',
    folder,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('should get key type', () => {
    it('should get camera key type', () => {
      const source = new TimelineDataSource(
        createTestCameraManager(),
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
        cameraTimelineKeys,
        'all',
        true,
      );

      expect(source.getKeyType()).toBe('camera');
    });

    it('should get folder key type', () => {
      const source = new TimelineDataSource(
        createTestCameraManager(),
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
        folderTimelineKeys,
        'all',
        true,
      );

      expect(source.getKeyType()).toBe('folder');
    });
  });

  describe('should get groups', () => {
    it('should get camera based groups', () => {
      const source = new TimelineDataSource(
        createTestCameraManager(),
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
        cameraTimelineKeys,
        'all',
        true,
      );

      expect(source.groups.length).toBe(2);
      expect(source.groups.get('camera/camera-1')).toEqual({
        content: 'Camera Title',
        id: 'camera/camera-1',
      });
      expect(source.groups.get('camera/camera-2')).toEqual({
        content: 'Camera Title',
        id: 'camera/camera-2',
      });
    });

    it('should get folder based groups', () => {
      const source = new TimelineDataSource(
        createTestCameraManager(),
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
        folderTimelineKeys,
        'all',
        true,
      );

      expect(source.groups.length).toBe(1);
      expect(source.groups.get('folder/folder-1')).toEqual({
        content: 'Folder Title',
        id: 'folder/folder-1',
      });
    });

    it('should use camera id if camera has no title', () => {
      const cameraManager = createTestCameraManager();
      vi.mocked(cameraManager.getCameraMetadata).mockReturnValue(null);

      const source = new TimelineDataSource(
        cameraManager,
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
        cameraTimelineKeys,
        'all',
        true,
      );

      expect(source.groups.get('camera/camera-1')).toEqual({
        content: 'camera-1',
        id: 'camera/camera-1',
      });
    });

    it('should use folder id if folder has no title', () => {
      const folder = createFolder({ id: 'folder/folder-1' });
      const timelineKeys: TimelineKeys = { type: 'folder', folder };

      const source = new TimelineDataSource(
        createTestCameraManager(),
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
        timelineKeys,
        'all',
        true,
      );

      expect(source.groups.length).toBe(1);
      expect(source.groups.get('folder/folder-1')).toEqual({
        content: 'folder/folder-1',
        id: 'folder/folder-1',
      });
    });

    it('should have no groups if a folder key has no folder', () => {
      const folder = createFolder({ id: 'folder/folder-1' });
      const timelineKeys: TimelineKeys = { type: 'folder', folder };

      const source = new TimelineDataSource(
        createTestCameraManager(),
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
        timelineKeys,
        'all',
        true,
      );

      expect(source.groups.length).toBe(1);
      expect(source.groups.get('folder/folder-1')).toEqual({
        content: 'folder/folder-1',
        id: 'folder/folder-1',
      });
    });
  });

  describe('should update events from view', () => {
    it('should add camera events to dataset', () => {
      const startTime = new Date('2025-09-21T15:32:21Z');
      const endTime = new Date('2025-09-21T15:35:28Z');
      const id = 'EVENT_ID';
      const media = new TestViewMedia({
        cameraID: 'camera-1',
        id,
        startTime,
        endTime,
      });

      const source = new TimelineDataSource(
        createTestCameraManager(),
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
        cameraTimelineKeys,
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
        group: 'camera/camera-1',
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
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
        folderTimelineKeys,
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
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
        cameraTimelineKeys,
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
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
        cameraTimelineKeys,
        'all',
        true,
      );

      source.addEventMediaToDataset(null);

      expect(source.dataset.length).toBe(0);
    });

    it('should ignore media without camera or folder ownership', () => {
      const source = new TimelineDataSource(
        createTestCameraManager(),
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
        cameraTimelineKeys,
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

      describe('should refresh events from camera', () => {
        it('should refresh events successfully', async () => {
          const source = new TimelineDataSource(
            createTestCameraManager(),
            mock<FoldersManager>(),
            mock<ConditionStateManagerReadonlyInterface>(),
            cameraTimelineKeys,
            'all',
            false,
          );
          const view = createView();

          await source.refresh(window, { view });

          expect(source.dataset.length).toBe(1);

          expect(source.dataset.get('TEST_MEDIA_ID')).toEqual({
            id: 'TEST_MEDIA_ID',
            content: '',
            start: new Date('2025-09-21T19:31:06Z').getTime(),
            end: new Date('2025-09-21T19:31:15Z').getTime(),
            media: testCameraMedia,
            type: 'range',
            group: 'camera/camera-1',
          });
        });

        it('should refresh events and handle exception', async () => {
          const consoleSpy = vi.spyOn(global.console, 'warn').mockReturnValue(undefined);

          const cameraManager = createTestCameraManager();
          vi.mocked(cameraManager.executeMediaQueries).mockRejectedValue(
            new Error('Error fetching events'),
          );

          const source = new TimelineDataSource(
            cameraManager,
            mock<FoldersManager>(),
            mock<ConditionStateManagerReadonlyInterface>(),
            cameraTimelineKeys,
            'all',
            false,
          );

          expect(source.dataset.length).toBe(0);

          await source.refresh(window);

          expect(source.dataset.length).toBe(0);

          expect(consoleSpy).toHaveBeenCalledWith('Error fetching events');
        });

        it('should not refresh events when window is cached', async () => {
          const cameraManager = createTestCameraManager();
          const source = new TimelineDataSource(
            cameraManager,
            mock<FoldersManager>(),
            mock<ConditionStateManagerReadonlyInterface>(),
            cameraTimelineKeys,
            'all',
            false,
          );
          const view = createView();

          await source.refresh(window, { view });
          expect(source.dataset.length).toBe(1);

          await source.refresh(window, { view });
          expect(source.dataset.length).toBe(1);
          expect(cameraManager.executeMediaQueries).toHaveBeenCalledTimes(1);
        });

        it('should not refresh events when unable to create event queries', async () => {
          const cameraManager = createTestCameraManager();
          vi.mocked(cameraManager.generateDefaultEventQueries).mockReturnValue(null);

          const source = new TimelineDataSource(
            cameraManager,
            mock<FoldersManager>(),
            mock<ConditionStateManagerReadonlyInterface>(),
            cameraTimelineKeys,
            'all',
            false,
          );

          await source.refresh(window);
          expect(source.dataset.length).toBe(0);
        });
      });

      describe('should refresh events from folder', () => {
        it('should refresh events successfully', async () => {
          const foldersManager = mock<FoldersManager>();
          vi.mocked(foldersManager.generateDefaultFolderQuery).mockReturnValue({
            folder,
            path: [{}],
          });
          vi.mocked(foldersManager.expandFolder).mockResolvedValue([testFolderMedia]);

          const source = new TimelineDataSource(
            mock<CameraManager>(),
            foldersManager,
            mock<ConditionStateManagerReadonlyInterface>(),
            folderTimelineKeys,
            'all',
            false,
          );
          const view = createView();

          await source.refresh(window, { view });

          expect(source.dataset.length).toBe(1);

          expect(source.dataset.get('TEST_MEDIA_ID')).toEqual({
            id: 'TEST_MEDIA_ID',
            content: '',
            start: new Date('2025-09-21T19:31:06Z').getTime(),
            end: new Date('2025-09-21T19:31:15Z').getTime(),
            media: testFolderMedia,
            type: 'range',
            group: 'folder/folder-1',
            query: expect.any(FolderViewQuery),
          });
        });

        describe('should refresh events from folder cached', () => {
          beforeAll(() => {
            vi.useFakeTimers();
          });

          afterAll(() => {
            vi.useRealTimers();
          });

          it('should refresh events only when not cached', async () => {
            const foldersManager = mock<FoldersManager>();
            vi.mocked(foldersManager.generateDefaultFolderQuery).mockReturnValue({
              folder,
              path: [{}],
            });
            vi.mocked(foldersManager.expandFolder).mockResolvedValue([testFolderMedia]);

            const source = new TimelineDataSource(
              mock<CameraManager>(),
              foldersManager,
              mock<ConditionStateManagerReadonlyInterface>(),
              folderTimelineKeys,
              'all',
              false,
            );
            const view = createView();

            await source.refresh(window, { view });
            await source.refresh(window, { view });
            await source.refresh(window, { view });

            expect(foldersManager.expandFolder).toHaveBeenCalledTimes(1);
          });

          it('should refresh events when cached expired', async () => {
            const start = new Date();
            vi.setSystemTime(start);
            const foldersManager = mock<FoldersManager>();
            vi.mocked(foldersManager.generateDefaultFolderQuery).mockReturnValue({
              folder,
              path: [{}],
            });
            vi.mocked(foldersManager.expandFolder).mockResolvedValue([testFolderMedia]);

            const source = new TimelineDataSource(
              mock<CameraManager>(),
              foldersManager,
              mock<ConditionStateManagerReadonlyInterface>(),
              folderTimelineKeys,
              'all',
              false,
            );
            const view = createView();

            await source.refresh(window, { view });

            vi.setSystemTime(add(start, { hours: 1 }));

            await source.refresh(window, { view });

            expect(foldersManager.expandFolder).toHaveBeenCalledTimes(2);
          });
        });
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
          mock<FoldersManager>(),
          mock<ConditionStateManagerReadonlyInterface>(),
          cameraTimelineKeys,
          'all',
          true,
        );

        await source.refresh(window);

        // 1 event and 1 recording == 2 total items.
        expect(source.dataset.length).toBe(2);

        expect(source.dataset.get(EXPECTED_RECORDING_ID)).toEqual({
          content: '',
          end: 1695307875000,
          group: 'camera/camera-1',
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

        const source = new TimelineDataSource(
          cameraManager,
          mock<FoldersManager>(),
          mock<ConditionStateManagerReadonlyInterface>(),
          cameraTimelineKeys,
          'all',
          true,
        );

        expect(getRecordings(source.dataset).length).toBe(0);

        await source.refresh(window);

        expect(getRecordings(source.dataset).length).toBe(0);

        expect(consoleSpy).toHaveBeenCalledWith('Error fetching recordings');
      });

      it('should not refresh recordings when window is cached', async () => {
        const cameraManager = createTestCameraManager();
        const source = new TimelineDataSource(
          cameraManager,
          mock<FoldersManager>(),
          mock<ConditionStateManagerReadonlyInterface>(),
          cameraTimelineKeys,
          'all',
          true,
        );

        await source.refresh(window);
        expect(getRecordings(source.dataset).length).toBe(1);

        await source.refresh(window);
        expect(getRecordings(source.dataset).length).toBe(1);

        expect(cameraManager.getRecordingSegments).toHaveBeenCalledTimes(1);
      });

      it('should not refresh recordings when recordings disabled', async () => {
        const source = new TimelineDataSource(
          createTestCameraManager(),
          mock<FoldersManager>(),
          mock<ConditionStateManagerReadonlyInterface>(),
          cameraTimelineKeys,
          'all',

          // Disable recordings.
          false,
        );

        await source.refresh(window);

        expect(source.dataset.get(EXPECTED_RECORDING_ID)).toBeNull();
      });

      it('should not refresh recordings with folders', async () => {
        const source = new TimelineDataSource(
          createTestCameraManager(),
          mock<FoldersManager>(),
          mock<ConditionStateManagerReadonlyInterface>(),
          folderTimelineKeys,
          'all',
          true,
        );

        await source.refresh(window);

        expect(source.dataset.get(EXPECTED_RECORDING_ID)).toBeNull();
      });

      it('should not refresh recordings without cameras', async () => {
        const emptycameraTimelineKeys: TimelineKeys = {
          type: 'camera',
          cameraIDs: new Set(),
        };
        const source = new TimelineDataSource(
          createTestCameraManager(),
          mock<FoldersManager>(),
          mock<ConditionStateManagerReadonlyInterface>(),
          emptycameraTimelineKeys,
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

        const source = new TimelineDataSource(
          cameraManager,
          mock<FoldersManager>(),
          mock<ConditionStateManagerReadonlyInterface>(),
          cameraTimelineKeys,
          'all',
          true,
        );

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

        const source = new TimelineDataSource(
          cameraManager,
          mock<FoldersManager>(),
          mock<ConditionStateManagerReadonlyInterface>(),
          cameraTimelineKeys,
          'all',
          true,
        );

        await source.refresh(window);

        expect(getRecordings(source.dataset)).toEqual([
          {
            content: '',
            end: 1695307885000,
            group: 'camera/camera-1',
            id: 'recording-camera-1-SEGMENT_ID',
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

        const source = new TimelineDataSource(
          cameraManager,
          mock<FoldersManager>(),
          mock<ConditionStateManagerReadonlyInterface>(),
          cameraTimelineKeys,
          'all',
          true,
        );
        source.dataset.add({
          id: 'recording-camera-1-SEGMENT_ID',
          start: 1695307866000,

          // No end time.
          end: undefined,

          group: 'camera/camera-1',
          content: '',
          type: 'background',
        });

        await source.refresh(window);

        expect(getRecordings(source.dataset)).toEqual([
          {
            content: '',
            end: 1695307885000,
            group: 'camera/camera-1',
            id: 'recording-camera-1-SEGMENT_ID',
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

        const source = new TimelineDataSource(
          cameraManager,
          mock<FoldersManager>(),
          mock<ConditionStateManagerReadonlyInterface>(),
          cameraTimelineKeys,
          'all',
          true,
        );

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
      const source = new TimelineDataSource(
        createCameraManager(),
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
        folderTimelineKeys,
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
      const source = new TimelineDataSource(
        cameraManager,
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
        cameraTimelineKeys,
        'clips',
        false,
      );
      source.getTimelineEventQueries(window);

      expect(cameraManager.generateDefaultEventQueries).toBeCalledWith(
        new Set(['camera-1', 'camera-2']),
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
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
        cameraTimelineKeys,
        'snapshots',
        false,
      );
      source.getTimelineEventQueries(window);

      expect(cameraManager.generateDefaultEventQueries).toBeCalledWith(
        new Set(['camera-1', 'camera-2']),
        {
          start,
          end,
          hasSnapshot: true,
        },
      );
    });
  });

  describe('should get timeline folder queries', () => {
    it('should not get folder queries without a folder', () => {
      const source = new TimelineDataSource(
        createCameraManager(),
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
        cameraTimelineKeys,
        'all',
        true,
      );

      expect(source.getTimelineFolderQuery()).toBeNull();
    });

    it('should get folder queries', () => {
      const foldersManager = mock<FoldersManager>();
      vi.mocked(foldersManager.generateDefaultFolderQuery).mockReturnValue({
        folder,
        path: [{}],
      });

      const source = new TimelineDataSource(
        mock<CameraManager>(),
        foldersManager,
        mock<ConditionStateManagerReadonlyInterface>(),
        folderTimelineKeys,
        'clips',
        false,
      );

      source.getTimelineFolderQuery();

      expect(foldersManager.generateDefaultFolderQuery).toBeCalledWith(folder);
    });
  });

  describe('should get timeline recording queries', () => {
    const window: TimelineWindow = { start, end };

    it('should not recording queries without cameras', () => {
      const source = new TimelineDataSource(
        createCameraManager(),
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
        folderTimelineKeys,
        'all',
        true,
      );

      expect(source.getTimelineRecordingQueries(window)).toBeNull();
    });

    it('should get recording queries', () => {
      const cameraManager = createCameraManager(
        createStore([
          {
            cameraID: 'camera-1',
          },
          {
            cameraID: 'camera-2',
          },
        ]),
      );
      const source = new TimelineDataSource(
        cameraManager,
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
        cameraTimelineKeys,
        'all',
        true,
      );
      source.getTimelineRecordingQueries(window);

      expect(cameraManager.generateDefaultRecordingQueries).toBeCalledWith(
        new Set(['camera-1', 'camera-2']),
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
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
        cameraTimelineKeys,
        'all',
        true,
      );
      source.rewriteEvent('UNKNOWN_ID');

      expect(source.dataset.length).toBe(0);
    });

    it('should not rewrite when item is not found', () => {
      const source = new TimelineDataSource(
        createTestCameraManager(),
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
        cameraTimelineKeys,
        'all',
        true,
      );
      const item = {
        id: 'id',
        start: start.getTime(),
        end: end.getTime(),
        media: testCameraMedia,
        group: 'camera/camera-1' as const,
        content: '',
        type: 'range' as const,
      };
      source.dataset.add(item);

      source.rewriteEvent('id');

      expect(source.dataset.get('id')).toBe(item);
    });
  });
});
