import { format } from 'date-fns';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ViewItemManager } from '../../../src/card-controller/view/item-manager';
import { homeAssistantSignPath } from '../../../src/ha/sign-path.js';
import { downloadURL } from '../../../src/utils/download';
import { ViewFolder, ViewMediaType } from '../../../src/view/item';
import {
  createCardAPI,
  createFolder,
  createHASS,
  TestViewMedia,
} from '../../test-utils';

vi.mock('../../../src/utils/download');
vi.mock('../../../src/ha/sign-path.js');

describe('ViewItemManager', () => {
  describe('getCapabilities', () => {
    it('should return null for unsupported item types', () => {
      const api = createCardAPI();
      const manager = new ViewItemManager(api);

      expect(manager.getCapabilities(new TestViewMedia({ cameraID: null }))).toBeNull();
    });

    it('should return capabilities for camera media', () => {
      const api = createCardAPI();
      const capabilities = {
        canDownload: true,
        canFavorite: true,
      };
      vi.mocked(api.getCameraManager().getMediaCapabilities).mockReturnValue(
        capabilities,
      );

      const manager = new ViewItemManager(api);
      const item = new TestViewMedia({ cameraID: 'camera.office' });

      expect(manager.getCapabilities(item)).toEqual(capabilities);
    });

    it('should return capabilities for folder media', () => {
      const api = createCardAPI();
      const capabilities = {
        canDownload: true,
        canFavorite: true,
      };
      vi.mocked(api.getFoldersManager().getItemCapabilities).mockReturnValue(
        capabilities,
      );

      const manager = new ViewItemManager(api);
      const item = new TestViewMedia({ folder: createFolder() });

      expect(manager.getCapabilities(item)).toEqual(capabilities);
    });
  });

  describe('download', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should not download without hass', async () => {
      const api = createCardAPI();
      const manager = new ViewItemManager(api);
      const item = new TestViewMedia({ cameraID: 'camera.office' });

      expect(await manager.download(item)).toBe(true);
      expect(downloadURL).not.toHaveBeenCalled();
    });

    it('should throw error when signing fails', async () => {
      const consoleSpy = vi.spyOn(global.console, 'warn').mockReturnValue(undefined);

      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

      const manager = new ViewItemManager(api);
      const item = new TestViewMedia({ cameraID: 'camera.office' });

      vi.mocked(api.getCameraManager().getMediaDownloadPath).mockResolvedValue({
        sign: true,
        endpoint: 'foo',
      });

      const signError = new Error('sign-error');
      vi.mocked(homeAssistantSignPath).mockRejectedValue(signError);

      expect(await manager.download(item)).toBe(false);
      expect(api.getMessageManager().setErrorIfHigherPriority).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Could not sign media URL for download',
        }),
      );
      expect(consoleSpy).toHaveBeenCalledWith('sign-error');
    });

    it('should download camera media', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

      const manager = new ViewItemManager(api);
      const item = new TestViewMedia({ cameraID: 'camera.office' });

      vi.mocked(api.getCameraManager().getMediaDownloadPath).mockResolvedValue({
        sign: true,
        endpoint: 'foo',
      });

      vi.mocked(homeAssistantSignPath).mockResolvedValue('http://foo/signed-url');

      expect(await manager.download(item)).toBe(true);
      expect(downloadURL).toBeCalledWith(
        'http://foo/signed-url',
        'camera-office_id.mp4',
      );
    });

    it('should download folder media', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

      const manager = new ViewItemManager(api);
      const item = new TestViewMedia({ cameraID: null, folder: createFolder() });

      vi.mocked(api.getFoldersManager().getDownloadPath).mockResolvedValue({
        sign: true,
        endpoint: 'foo',
      });

      vi.mocked(homeAssistantSignPath).mockResolvedValue('http://foo/signed-url');

      expect(await manager.download(item)).toBe(true);
      expect(downloadURL).toBeCalledWith('http://foo/signed-url', 'media_id.mp4');
    });

    it('should download media without signing', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

      const manager = new ViewItemManager(api);
      const item = new TestViewMedia({ cameraID: 'camera.office' });

      vi.mocked(api.getCameraManager().getMediaDownloadPath).mockResolvedValue({
        sign: false,
        endpoint: 'foo',
      });

      expect(homeAssistantSignPath).not.toBeCalled();

      expect(await manager.download(item)).toBe(true);
      expect(downloadURL).toBeCalledWith('foo', 'camera-office_id.mp4');
    });

    it('should download media without camera or folder', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

      const manager = new ViewItemManager(api);
      const item = new TestViewMedia({ cameraID: null, folder: null });

      expect(await manager.download(item)).toBe(false);
      expect(api.getMessageManager().setErrorIfHigherPriority).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'No media to download',
        }),
      );
    });

    describe('should generate useful download filenames', () => {
      it('should generate filename for media without ID', async () => {
        const api = createCardAPI();
        vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

        const manager = new ViewItemManager(api);
        const item = new TestViewMedia({ id: null });

        vi.mocked(api.getCameraManager().getMediaDownloadPath).mockResolvedValue({
          sign: false,
          endpoint: 'foo',
        });

        expect(await manager.download(item)).toBe(true);
        expect(downloadURL).toBeCalledWith('foo', 'camera.mp4');
      });

      it('should generate filename for media with start time', async () => {
        const api = createCardAPI();
        vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

        const manager = new ViewItemManager(api);
        const startTime = new Date('2025-05-03T17:41:00Z');
        const item = new TestViewMedia({ startTime });

        vi.mocked(api.getCameraManager().getMediaDownloadPath).mockResolvedValue({
          sign: false,
          endpoint: 'foo',
        });

        expect(await manager.download(item)).toBe(true);

        // Use format() to generate expected filename timestamp (formats in local time)
        const expectedFilename = `camera_id_${format(startTime, 'yyyy-MM-dd-HH-mm-ss')}.mp4`;
        expect(downloadURL).toBeCalledWith('foo', expectedFilename);
      });

      it('should generate filename for snapshot', async () => {
        const api = createCardAPI();
        vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

        const manager = new ViewItemManager(api);
        const item = new TestViewMedia({ mediaType: ViewMediaType.Snapshot });

        vi.mocked(api.getCameraManager().getMediaDownloadPath).mockResolvedValue({
          sign: false,
          endpoint: 'foo',
        });

        expect(await manager.download(item)).toBe(true);
        expect(downloadURL).toBeCalledWith('foo', 'camera_id.jpg');
      });

      it('should generate filename for folder without title', async () => {
        const api = createCardAPI();
        vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

        const manager = new ViewItemManager(api);
        const item = new ViewFolder(createFolder());

        vi.mocked(api.getFoldersManager().getDownloadPath).mockResolvedValue({
          sign: false,
          endpoint: 'foo',
        });

        expect(await manager.download(item)).toBe(true);
        expect(downloadURL).toBeCalledWith('foo', 'media');
      });

      it('should generate filename for folder with title', async () => {
        const api = createCardAPI();
        vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

        const manager = new ViewItemManager(api);
        const item = new ViewFolder(createFolder(), { title: 'title' });

        vi.mocked(api.getFoldersManager().getDownloadPath).mockResolvedValue({
          sign: false,
          endpoint: 'foo',
        });

        expect(await manager.download(item)).toBe(true);
        expect(downloadURL).toBeCalledWith('foo', 'title');
      });
    });
  });

  describe('favorite', () => {
    it('should favorite camera media', async () => {
      const api = createCardAPI();

      const manager = new ViewItemManager(api);
      const item = new TestViewMedia({
        cameraID: 'camera.office',
        mediaType: ViewMediaType.Snapshot,
      });

      await manager.favorite(item, true);

      expect(api.getCameraManager().favoriteMedia).toBeCalledWith(item, true);
    });

    it('should favorite folder media', async () => {
      const api = createCardAPI();

      const manager = new ViewItemManager(api);
      const item = new TestViewMedia({
        folder: createFolder(),
        mediaType: ViewMediaType.Snapshot,
      });

      await manager.favorite(item, true);

      expect(api.getFoldersManager().favorite).toBeCalledWith(item, true);
    });
  });
});
