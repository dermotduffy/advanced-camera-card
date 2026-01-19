import { add } from 'date-fns';
import { NonEmptyTuple } from 'type-fest';
import { DataSet } from 'vis-data';
import { TimelineWindow } from 'vis-timeline';
import {
  afterAll,
  assert,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
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
  ReviewQuery,
} from '../../../src/camera-manager/types';
import { FoldersManager } from '../../../src/card-controller/folders/manager';
import {
  FolderPathComponent,
  FolderQuery,
} from '../../../src/card-controller/folders/types';
import {
  AdvancedCameraCardTimelineItem,
  TimelineDataSource,
} from '../../../src/components-lib/timeline/source';
import { ConditionStateManagerReadonlyInterface } from '../../../src/conditions/types';
import { QuerySource } from '../../../src/query-source';
import { ViewMediaType } from '../../../src/view/item';
import { QueryNode, UnifiedQuery } from '../../../src/view/unified-query';
import {
  createCameraManager,
  createFolder,
  createStore,
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

const folder = createFolder({ id: 'folder-1', title: 'Folder Title' });
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
    source: QuerySource.Camera,
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
  // Create camera-based query with events for two cameras
  const cameraEventsQuery = new UnifiedQuery();
  const eventQuery1: EventQuery = {
    source: QuerySource.Camera,
    type: QueryType.Event,
    cameraIDs: new Set(['camera-1']),
    hasClip: true,
  };
  cameraEventsQuery.addNode(eventQuery1);

  const eventQuery2: EventQuery = {
    source: QuerySource.Camera,
    type: QueryType.Event,
    cameraIDs: new Set(['camera-2']),
    hasSnapshot: true,
  };
  cameraEventsQuery.addNode(eventQuery2);

  // Create camera-based query with reviews for one camera
  const reviewQuery = new UnifiedQuery();
  const reviewQueryNode: ReviewQuery = {
    source: QuerySource.Camera,
    type: QueryType.Review,
    cameraIDs: new Set(['camera-1']),
  };
  reviewQuery.addNode(reviewQueryNode);

  // Create folder-based query
  const folderQuery = new UnifiedQuery();
  const folderPath: NonEmptyTuple<FolderPathComponent> = [{}];
  const folderQueryNode: FolderQuery = {
    source: QuerySource.Folder,
    folder: folder,
    path: folderPath,
  };
  folderQuery.addNode(folderQueryNode);

  // Helper to create a TimelineDataSource with a shape query
  const createSource = (
    cameraManager: CameraManager,
    foldersManager: FoldersManager,
    conditionStateManager: ConditionStateManagerReadonlyInterface,
    shape: UnifiedQuery,
    showRecordings = true,
  ): TimelineDataSource => {
    return new TimelineDataSource(
      cameraManager,
      foldersManager,
      conditionStateManager,
      shape,
      showRecordings,
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('should get groups', () => {
    it('should get camera based groups', () => {
      const source = createSource(
        createTestCameraManager(),
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
        cameraEventsQuery,
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
      const source = createSource(
        createTestCameraManager(),
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
        folderQuery,
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

      const source = createSource(
        cameraManager,
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
        cameraEventsQuery,
        true,
      );

      expect(source.groups.get('camera/camera-1')).toEqual({
        content: 'camera-1',
        id: 'camera/camera-1',
      });
    });

    it('should use folder id if folder has no title', () => {
      const folder = createFolder({ id: 'folder-1' });
      const testQuery = new UnifiedQuery();
      const folderPath: NonEmptyTuple<FolderPathComponent> = [{}];
      testQuery.addNode({
        source: QuerySource.Folder,
        folder: folder,
        path: folderPath,
      });

      const source = createSource(
        createTestCameraManager(),
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
        testQuery,
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

      const source = createSource(
        createTestCameraManager(),
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
        cameraEventsQuery,
        true,
      );
      source.addMediaToDataset(cameraEventsQuery, [media]);

      expect(source.dataset.length).toBe(1);
      expect(source.dataset.get(id)).toEqual({
        id,
        start: startTime.getTime(),
        end: endTime.getTime(),
        media,
        group: 'camera/camera-1',
        content: '',
        type: 'range',
        query: cameraEventsQuery,
      });
    });

    it('should add review media with severity to dataset', () => {
      const startTime = new Date('2025-09-21T15:32:21Z');
      const endTime = new Date('2025-09-21T15:35:28Z');
      const id = 'REVIEW_ID';
      const media = new TestViewMedia({
        cameraID: 'camera-1',
        id,
        startTime,
        endTime,
        mediaType: ViewMediaType.Review,
        severity: 'high',
      });

      const source = createSource(
        createTestCameraManager(),
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
        reviewQuery,
        false,
      );
      source.addMediaToDataset(reviewQuery, [media]);

      expect(source.dataset.length).toBe(1);
      expect(source.dataset.get(id)).toEqual({
        id,
        start: startTime.getTime(),
        end: endTime.getTime(),
        media,
        group: 'camera/camera-1',
        content: '',
        type: 'range',
        query: reviewQuery,
        severity: 'high',
      });
    });

    it('should add review media with null severity to dataset', () => {
      const startTime = new Date('2025-09-21T15:32:21Z');
      const endTime = new Date('2025-09-21T15:35:28Z');
      const id = 'REVIEW_ID';
      const media = new TestViewMedia({
        cameraID: 'camera-1',
        id,
        startTime,
        endTime,
        mediaType: ViewMediaType.Review,
        severity: null,
      });

      const source = createSource(
        createTestCameraManager(),
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
        reviewQuery,
        false,
      );
      source.addMediaToDataset(reviewQuery, [media]);

      expect(source.dataset.length).toBe(1);
      expect(source.dataset.get(id)).toEqual({
        id,
        start: startTime.getTime(),
        end: endTime.getTime(),
        media,
        group: 'camera/camera-1',
        content: '',
        type: 'range',
        query: reviewQuery,
        severity: undefined,
      });
    });

    it('should add folder events to dataset', () => {
      const startTime = new Date('2025-09-21T15:32:21Z');
      const endTime = new Date('2025-09-21T15:35:28Z');
      const id = 'EVENT_ID';
      const folderID = 'FOLDER_ID';
      const folder = createFolder({ id: folderID });
      const media = new TestViewMedia({
        cameraID: null,
        id,
        startTime,
        endTime,
        folder,
      });

      const source = createSource(
        createTestCameraManager(),
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
        folderQuery,
        true,
      );
      source.addMediaToDataset(folderQuery, [media]);

      expect(source.dataset.length).toBe(1);
      expect(source.dataset.get(id)).toEqual({
        id,
        start: startTime.getTime(),
        end: endTime.getTime(),
        media,
        group: `folder/${folderID}`,
        content: '',
        type: 'range',
        query: folderQuery,
      });
    });

    it('should ignore non-events media', () => {
      const source = createSource(
        createTestCameraManager(),
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
        cameraEventsQuery,
        true,
      );

      source.addMediaToDataset(cameraEventsQuery, [
        new TestViewMedia({
          mediaType: ViewMediaType.Recording,
        }),
      ]);

      expect(source.dataset.length).toBe(0);
    });

    it('should ignore null results', () => {
      const source = createSource(
        createTestCameraManager(),
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
        cameraEventsQuery,
        true,
      );

      source.addMediaToDataset(cameraEventsQuery, null);

      expect(source.dataset.length).toBe(0);
    });

    it('should ignore media without camera or folder ownership', () => {
      const source = createSource(
        createTestCameraManager(),
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
        cameraEventsQuery,
        true,
      );

      source.addMediaToDataset(cameraEventsQuery, [
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
          const source = createSource(
            createTestCameraManager(),
            mock<FoldersManager>(),
            mock<ConditionStateManagerReadonlyInterface>(),
            cameraEventsQuery,
            false,
          );

          await source.refresh(window);

          expect(source.dataset.length).toBe(1);

          expect(source.dataset.get('TEST_MEDIA_ID')).toEqual({
            id: 'TEST_MEDIA_ID',
            content: '',
            start: new Date('2025-09-21T19:31:06Z').getTime(),
            end: new Date('2025-09-21T19:31:15Z').getTime(),
            media: testCameraMedia,
            type: 'range',
            query: expect.any(UnifiedQuery),
            group: 'camera/camera-1',
          });
        });

        it('should refresh events and handle exception', async () => {
          const consoleSpy = vi.spyOn(global.console, 'warn').mockReturnValue(undefined);

          const cameraManager = createTestCameraManager();
          vi.mocked(cameraManager.executeMediaQueries).mockRejectedValue(
            new Error('Error fetching events'),
          );

          const source = createSource(
            cameraManager,
            mock<FoldersManager>(),
            mock<ConditionStateManagerReadonlyInterface>(),
            cameraEventsQuery,
            false,
          );

          expect(source.dataset.length).toBe(0);

          await source.refresh(window);

          expect(source.dataset.length).toBe(0);

          expect(consoleSpy).toHaveBeenCalledWith('Error fetching events');
        });

        it('should not refresh events when window is cached', async () => {
          const cameraManager = createTestCameraManager();
          const source = createSource(
            cameraManager,
            mock<FoldersManager>(),
            mock<ConditionStateManagerReadonlyInterface>(),
            cameraEventsQuery,
            false,
          );

          await source.refresh(window);
          expect(source.dataset.length).toBe(1);

          await source.refresh(window);
          expect(source.dataset.length).toBe(1);
          expect(cameraManager.executeMediaQueries).toHaveBeenCalledTimes(1);
        });
      });

      describe('should refresh events from folder', () => {
        it('should refresh events successfully', async () => {
          const foldersManager = mock<FoldersManager>();
          vi.mocked(foldersManager.getDefaultQueryParameters).mockReturnValue({
            source: QuerySource.Folder,
            folder,
            path: [{}],
          });
          vi.mocked(foldersManager.expandFolder).mockResolvedValue([testFolderMedia]);

          const source = createSource(
            mock<CameraManager>(),
            foldersManager,
            mock<ConditionStateManagerReadonlyInterface>(),
            folderQuery,
            false,
          );

          await source.refresh(window);

          expect(source.dataset.length).toBe(1);

          expect(source.dataset.get('TEST_MEDIA_ID')).toEqual({
            id: 'TEST_MEDIA_ID',
            content: '',
            start: new Date('2025-09-21T19:31:06Z').getTime(),
            end: new Date('2025-09-21T19:31:15Z').getTime(),
            media: testFolderMedia,
            type: 'range',
            group: 'folder/folder-1',
            query: expect.any(UnifiedQuery),
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
            vi.mocked(foldersManager.getDefaultQueryParameters).mockReturnValue({
              source: QuerySource.Folder,
              folder,
              path: [{}],
            });
            vi.mocked(foldersManager.expandFolder).mockResolvedValue([testFolderMedia]);

            const source = createSource(
              mock<CameraManager>(),
              foldersManager,
              mock<ConditionStateManagerReadonlyInterface>(),
              folderQuery,
              false,
            );

            await source.refresh(window);
            await source.refresh(window);
            await source.refresh(window);

            expect(foldersManager.expandFolder).toHaveBeenCalledTimes(1);
          });

          it('should refresh events when cached expired', async () => {
            const start = new Date();
            vi.setSystemTime(start);
            const foldersManager = mock<FoldersManager>();
            vi.mocked(foldersManager.getDefaultQueryParameters).mockReturnValue({
              source: QuerySource.Folder,
              folder,
              path: [{}],
            });
            vi.mocked(foldersManager.expandFolder).mockResolvedValue([testFolderMedia]);

            const source = createSource(
              mock<CameraManager>(),
              foldersManager,
              mock<ConditionStateManagerReadonlyInterface>(),
              folderQuery,
              false,
            );

            await source.refresh(window);

            vi.setSystemTime(add(start, { hours: 1 }));

            await source.refresh(window);

            expect(foldersManager.expandFolder).toHaveBeenCalledTimes(2);
          });
        });
      });
    });

    describe('should refresh reviews', () => {
      beforeEach(() => {
        vi.restoreAllMocks();
      });

      it('should refresh reviews successfully', async () => {
        const cameraManager = createTestCameraManager();
        const cameraReviewQuery: ReviewQuery = {
          source: QuerySource.Camera,
          type: QueryType.Review,
          cameraIDs: new Set([CAMERA_ID]),
          start,
          end,
        };
        vi.mocked(cameraManager.generateDefaultReviewQueries).mockReturnValue([
          cameraReviewQuery,
        ]);

        const source = createSource(
          cameraManager,
          mock<FoldersManager>(),
          mock<ConditionStateManagerReadonlyInterface>(),
          reviewQuery,
          false,
        );

        await source.refresh(window);

        expect(cameraManager.executeMediaQueries).toHaveBeenCalled();
        expect(source.dataset.length).toBe(1);
      });

      it('should not refresh reviews when window is cached', async () => {
        const cameraManager = createTestCameraManager();
        const cameraReviewQuery: ReviewQuery = {
          source: QuerySource.Camera,
          type: QueryType.Review,
          cameraIDs: new Set([CAMERA_ID]),
          start,
          end,
        };
        vi.mocked(cameraManager.generateDefaultReviewQueries).mockReturnValue([
          cameraReviewQuery,
        ]);

        const source = createSource(
          cameraManager,
          mock<FoldersManager>(),
          mock<ConditionStateManagerReadonlyInterface>(),
          reviewQuery,
          false,
        );

        await source.refresh(window);
        await source.refresh(window);

        expect(cameraManager.executeMediaQueries).toHaveBeenCalledTimes(1);
      });

      it('should not refresh reviews without review queries', async () => {
        const cameraManager = createTestCameraManager();
        vi.mocked(cameraManager.generateDefaultReviewQueries).mockReturnValue(null);

        const source = createSource(
          cameraManager,
          mock<FoldersManager>(),
          mock<ConditionStateManagerReadonlyInterface>(),
          new UnifiedQuery(),
          false,
        );

        await source.refresh(window);

        expect(cameraManager.executeMediaQueries).not.toHaveBeenCalled();
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
        const source = createSource(
          createTestCameraManager(),
          mock<FoldersManager>(),
          mock<ConditionStateManagerReadonlyInterface>(),
          cameraEventsQuery,
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

        const source = createSource(
          cameraManager,
          mock<FoldersManager>(),
          mock<ConditionStateManagerReadonlyInterface>(),
          cameraEventsQuery,
          true,
        );

        expect(getRecordings(source.dataset).length).toBe(0);

        await source.refresh(window);

        expect(getRecordings(source.dataset).length).toBe(0);

        expect(consoleSpy).toHaveBeenCalledWith('Error fetching recordings');
      });

      it('should not refresh recordings when window is cached', async () => {
        const cameraManager = createTestCameraManager();
        const source = createSource(
          cameraManager,
          mock<FoldersManager>(),
          mock<ConditionStateManagerReadonlyInterface>(),
          cameraEventsQuery,
          true,
        );

        await source.refresh(window);
        expect(getRecordings(source.dataset).length).toBe(1);

        await source.refresh(window);
        expect(getRecordings(source.dataset).length).toBe(1);

        expect(cameraManager.getRecordingSegments).toHaveBeenCalledTimes(1);
      });

      it('should not refresh recordings when recordings disabled', async () => {
        const source = createSource(
          createTestCameraManager(),
          mock<FoldersManager>(),
          mock<ConditionStateManagerReadonlyInterface>(),
          cameraEventsQuery,

          // Disable recordings.
          false,
        );

        await source.refresh(window);

        expect(source.dataset.get(EXPECTED_RECORDING_ID)).toBeNull();
      });

      it('should not refresh recordings with folders', async () => {
        const source = createSource(
          createTestCameraManager(),
          mock<FoldersManager>(),
          mock<ConditionStateManagerReadonlyInterface>(),
          folderQuery,
          true,
        );

        await source.refresh(window);

        expect(source.dataset.get(EXPECTED_RECORDING_ID)).toBeNull();
      });

      it('should not refresh recordings without cameras', async () => {
        // Create an empty query with no slices
        const emptyQuery = new UnifiedQuery();
        const source = createSource(
          createTestCameraManager(),
          mock<FoldersManager>(),
          mock<ConditionStateManagerReadonlyInterface>(),
          emptyQuery,
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

        const source = createSource(
          cameraManager,
          mock<FoldersManager>(),
          mock<ConditionStateManagerReadonlyInterface>(),
          cameraEventsQuery,
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

        const source = createSource(
          cameraManager,
          mock<FoldersManager>(),
          mock<ConditionStateManagerReadonlyInterface>(),
          cameraEventsQuery,
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

        const source = createSource(
          cameraManager,
          mock<FoldersManager>(),
          mock<ConditionStateManagerReadonlyInterface>(),
          cameraEventsQuery,
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

        const source = createSource(
          cameraManager,
          mock<FoldersManager>(),
          mock<ConditionStateManagerReadonlyInterface>(),
          cameraEventsQuery,
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

  describe('should rewrite event', () => {
    it('should not rewrite when item is not found', () => {
      const source = createSource(
        createTestCameraManager(),
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
        cameraEventsQuery,
        true,
      );
      source.rewriteEvent('UNKNOWN_ID');

      expect(source.dataset.length).toBe(0);
    });

    it('should not rewrite when item is not found', () => {
      const source = createSource(
        createTestCameraManager(),
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
        cameraEventsQuery,
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
        query: cameraEventsQuery,
      };
      source.dataset.add(item);

      source.rewriteEvent('id');

      expect(source.dataset.get('id')).toBe(item);
    });
  });

  describe('shape getter', () => {
    it('should return the shape query', () => {
      const source = createSource(
        createTestCameraManager(),
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
        cameraEventsQuery,
        true,
      );

      const shape = source.shape;

      expect(shape).toBe(cameraEventsQuery);
    });
  });

  describe('areResultsFresh', () => {
    it('should delegate to runner', () => {
      const cameraManager = createTestCameraManager();
      vi.mocked(cameraManager.areMediaQueriesResultsFresh).mockReturnValue(true);

      const source = createSource(
        cameraManager,
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
        cameraEventsQuery,
        true,
      );

      const result = source.areResultsFresh(new Date(), cameraEventsQuery);

      expect(result).toBe(true);
    });

    it('should return false when stale', () => {
      const cameraManager = createTestCameraManager();
      vi.mocked(cameraManager.areMediaQueriesResultsFresh).mockReturnValue(false);

      const source = createSource(
        cameraManager,
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
        cameraEventsQuery,
        true,
      );

      const result = source.areResultsFresh(new Date(), cameraEventsQuery);

      expect(result).toBe(false);
    });
  });

  describe('buildRecordingsWindowedQuery', () => {
    it('should build recordings query with window', () => {
      const source = createSource(
        createTestCameraManager(),
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
        cameraEventsQuery,
        true,
      );

      const window = { start, end };
      const query = source.buildRecordingsWindowedQuery(window);

      expect(query).not.toBeNull();
      const mediaQueries = query?.getMediaQueries({ type: QueryType.Recording });
      expect(mediaQueries?.length).toBeGreaterThan(0);
      expect(mediaQueries?.[0].start).toBe(start);
      expect(mediaQueries?.[0].end).toBe(end);
    });

    it('should return null when no cameras', () => {
      const emptyQuery = new UnifiedQuery();
      const source = createSource(
        createTestCameraManager(),
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
        emptyQuery,
        true,
      );

      const query = source.buildRecordingsWindowedQuery({ start, end });

      expect(query).toBeNull();
    });
  });

  describe('hasClip/hasSnapshot in refresh', () => {
    beforeAll(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    afterAll(() => {
      vi.useRealTimers();
    });

    const isEventQuery = (query: QueryNode): query is EventQuery =>
      query.source === QuerySource.Camera && query.type === QueryType.Event;

    it('should set hasClip for clips media type', async () => {
      const cameraManager = createTestCameraManager();
      vi.mocked(cameraManager.executeMediaQueries).mockResolvedValue([]);

      const clipsQuery = new UnifiedQuery();
      const queryNode: EventQuery = {
        source: QuerySource.Camera,
        type: QueryType.Event,
        cameraIDs: new Set(['camera-1']),
        hasClip: true,
      };
      clipsQuery.addNode(queryNode);

      const source = createSource(
        cameraManager,
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
        clipsQuery,
        true,
      );

      const window = { start, end };
      await source.refresh(window);

      expect(cameraManager.executeMediaQueries).toHaveBeenCalled();
      const call = vi.mocked(cameraManager.executeMediaQueries).mock.calls[0];
      const eventQuery = call[0][0];
      assert(isEventQuery(eventQuery));

      expect(eventQuery.hasClip).toBe(true);
      expect(eventQuery.hasSnapshot).toBeUndefined();
    });

    it('should set hasSnapshot for snapshots media type', async () => {
      const cameraManager = createTestCameraManager();
      vi.mocked(cameraManager.executeMediaQueries).mockResolvedValue([]);

      const snapshotsQuery = new UnifiedQuery();
      const queryNode: EventQuery = {
        source: QuerySource.Camera,
        type: QueryType.Event,
        cameraIDs: new Set(['camera-1']),
        hasSnapshot: true,
      };
      snapshotsQuery.addNode(queryNode);

      const source = createSource(
        cameraManager,
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
        snapshotsQuery,
        true,
      );

      const window = { start, end };
      await source.refresh(window);

      expect(cameraManager.executeMediaQueries).toHaveBeenCalled();
      const call = vi.mocked(cameraManager.executeMediaQueries).mock.calls[0];
      const eventQuery = call[0][0];
      assert(isEventQuery(eventQuery));

      expect(eventQuery.hasSnapshot).toBe(true);
      expect(eventQuery.hasClip).toBeUndefined();
    });
  });
});
