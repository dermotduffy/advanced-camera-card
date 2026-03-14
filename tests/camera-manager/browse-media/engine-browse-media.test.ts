import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { BrowseMediaCameraManagerEngine } from '../../../src/camera-manager/browse-media/engine-browse-media';
import {
  CameraManagerRequestCache,
  CameraQuery,
  QueryType,
} from '../../../src/camera-manager/types';
import { StateWatcher } from '../../../src/card-controller/hass/state-watcher';
import { BROWSE_MEDIA_CACHE_SECONDS } from '../../../src/ha/browse-media/types';
import { BrowseMediaWalker } from '../../../src/ha/browse-media/walker';
import { ResolvedMediaCache } from '../../../src/ha/resolved-media';
import { QuerySource } from '../../../src/query-source';
import { ViewMedia } from '../../../src/view/item';
import { CameraManagerReadOnlyConfigStore } from '../../../src/camera-manager/store';
import { EntityRegistryManagerMock } from '../../ha/registry/entity/mock';
import { createCameraConfig, createHASS } from '../../test-utils';

const createEngine = (): BrowseMediaCameraManagerEngine => {
  return new BrowseMediaCameraManagerEngine(
    new EntityRegistryManagerMock(),
    mock<StateWatcher>(),
    new BrowseMediaWalker(),
    new ResolvedMediaCache(),
    new CameraManagerRequestCache(),
  );
};

describe('BrowseMediaCameraManagerEngine', () => {
  describe('generateDefaultEventQuery', () => {
    it('should generate event query', () => {
      const engine = createEngine();
      const cameraIDs = new Set(['camera1']);
      const result = engine.generateDefaultEventQuery(
        mock<CameraManagerReadOnlyConfigStore>(),
        cameraIDs,
        {},
      );

      expect(result).toEqual([
        {
          source: QuerySource.Camera,
          type: QueryType.Event,
          cameraIDs: cameraIDs,
        },
      ]);
    });

    it('should merge partial query fields', () => {
      const engine = createEngine();
      const cameraIDs = new Set(['camera1']);
      const result = engine.generateDefaultEventQuery(
        mock<CameraManagerReadOnlyConfigStore>(),
        cameraIDs,
        { limit: 10 },
      );

      expect(result).toEqual([
        {
          source: QuerySource.Camera,
          type: QueryType.Event,
          cameraIDs: cameraIDs,
          limit: 10,
        },
      ]);
    });
  });

  describe('getMediaDownloadPath', () => {
    it('should call getMediaDownloadPath with content ID', async () => {
      const engine = createEngine();
      const hass = createHASS();
      const media = mock<ViewMedia>();
      media.getContentID.mockReturnValue('content-id');

      await engine.getMediaDownloadPath(hass, createCameraConfig(), media);

      expect(media.getContentID).toHaveBeenCalled();
    });
  });

  describe('getQueryResultMaxAge', () => {
    it('should return cache seconds for event queries', () => {
      const engine = createEngine();
      const query = {
        type: QueryType.Event,
      } as CameraQuery;

      expect(engine.getQueryResultMaxAge(query)).toBe(BROWSE_MEDIA_CACHE_SECONDS);
    });

    it('should return null for non-event queries', () => {
      const engine = createEngine();
      const query = {
        type: QueryType.Recording,
      } as CameraQuery;

      expect(engine.getQueryResultMaxAge(query)).toBeNull();
    });
  });

  describe('getMediaCapabilities', () => {
    it('should return correct capabilities', () => {
      const engine = createEngine();
      const media = mock<ViewMedia>();

      expect(engine.getMediaCapabilities(media)).toEqual({
        canFavorite: false,
        canDownload: true,
      });
    });
  });
});
