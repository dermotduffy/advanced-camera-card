import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { DownloadManager } from '../../src/card-controller/download-manager';
import { MediaPlayerController } from '../../src/types';
import { downloadMedia, downloadURL } from '../../src/utils/download.js';
import {
  createCardAPI,
  createHASS,
  createMediaLoadedInfo,
  createViewWithMedia,
} from '../test-utils';

vi.mock('../../src/utils/download.js');

describe('DownloadManager.downloadViewerMedia', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should download', async () => {
    const api = createCardAPI();
    vi.mocked(api.getViewManager().getView).mockReturnValue(createViewWithMedia());
    vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
    const manager = new DownloadManager(api);

    expect(await manager.downloadViewerMedia()).toBeTruthy();
    expect(downloadMedia).toBeCalledWith(
      api.getHASSManager().getHASS(),
      api.getCameraManager(),
      api.getViewManager().getView()?.queryResults?.getResult(0),
    );
  });

  it('should not download due to exception thrown', async () => {
    const api = createCardAPI();
    vi.mocked(api.getViewManager().getView).mockReturnValue(createViewWithMedia());
    vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
    const manager = new DownloadManager(api);

    const error = new Error();
    vi.mocked(downloadMedia).mockRejectedValue(error);

    expect(await manager.downloadViewerMedia()).toBeFalsy();
    expect(api.getMessageManager().setErrorIfHigherPriority).toBeCalledWith(error);
  });

  it('should not download without hass', async () => {
    const api = createCardAPI();
    vi.mocked(api.getViewManager().getView).mockReturnValue(createViewWithMedia());
    vi.mocked(api.getHASSManager().getHASS).mockReturnValue(null);
    const manager = new DownloadManager(api);

    expect(await manager.downloadViewerMedia()).toBeFalsy();
    expect(downloadMedia).not.toBeCalled();
  });
});

describe('DownloadManager.downloadScreenshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('with url', async () => {
    const api = createCardAPI();
    const mediaPlayerController = mock<MediaPlayerController>();
    mediaPlayerController.getScreenshotURL.mockResolvedValue('http://screenshot');

    vi.mocked(api.getMediaLoadedInfoManager().get).mockReturnValue(
      createMediaLoadedInfo({
        mediaPlayerController,
      }),
    );
    const manager = new DownloadManager(api);
    await manager.downloadScreenshot();

    expect(downloadURL).toBeCalledWith('http://screenshot', 'screenshot.jpg');
  });

  it('without url', async () => {
    const api = createCardAPI();
    const mediaPlayerController = mock<MediaPlayerController>();
    mediaPlayerController.getScreenshotURL.mockResolvedValue(null);

    vi.mocked(api.getMediaLoadedInfoManager().get).mockReturnValue(
      createMediaLoadedInfo({
        mediaPlayerController,
      }),
    );
    const manager = new DownloadManager(api);
    await manager.downloadScreenshot();

    expect(downloadURL).not.toBeCalled();
  });
});
