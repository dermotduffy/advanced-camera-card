import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { downloadMedia, downloadURL } from '../../src/utils/download';
import { homeAssistantSignPath } from '../../src/utils/ha';
import { ViewMedia } from '../../src/view/media';
import {
  createCameraManager,
  createHASS,
  createStore,
  TestViewMedia,
} from '../test-utils';

vi.mock('../../src/utils/ha');

const media = new ViewMedia('clip', 'camera.office');

// @vitest-environment jsdom
describe('downloadURL', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    global.window.location = mock<Location>();
  });

  it('should download same origin via link', () => {
    const location: Location & { origin: string } = mock<Location>();
    location.origin = 'http://foo';
    global.window.location = location;

    const link = document.createElement('a');
    link.click = vi.fn();
    link.setAttribute = vi.fn();
    vi.spyOn(document, 'createElement').mockReturnValue(link);

    downloadURL('http://foo/url.mp4');

    expect(link.href).toBe('http://foo/url.mp4');
    expect(link.setAttribute).toBeCalledWith('download', 'download');
    expect(link.click).toBeCalled();
  });

  it('should download data URL via link', () => {
    const link = document.createElement('a');
    link.click = vi.fn();
    link.setAttribute = vi.fn();
    vi.spyOn(document, 'createElement').mockReturnValue(link);

    downloadURL('data:text/plain;charset=utf-8;base64,VEhJUyBJUyBEQVRB');

    expect(link.href).toBe('data:text/plain;charset=utf-8;base64,VEhJUyBJUyBEQVRB');
    expect(link.setAttribute).toBeCalledWith('download', 'download');
    expect(link.click).toBeCalled();
  });

  it('should download different origin via window.open', () => {
    // Set the origin to the same.
    const location: Location & { origin: string } = mock<Location>();
    location.origin = 'http://foo';
    global.window.location = location;

    const windowSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    downloadURL('http://bar/url.mp4');
    expect(windowSpy).toBeCalledWith('http://bar/url.mp4', '_blank');
  });
});

describe('downloadMedia', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.window.location = mock<Location>({ origin: 'https://foo' });
  });

  it('should throw error when no media', () => {
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager.getMediaDownloadPath).mockResolvedValue(null);

    expect(downloadMedia(createHASS(), cameraManager, media)).rejects.toThrow(
      /No media to download/,
    );
  });

  it('should throw error when signing fails', () => {
    vi.spyOn(global.console, 'warn').mockReturnValue(undefined);

    const cameraManager = createCameraManager();
    vi.mocked(cameraManager).getMediaDownloadPath.mockResolvedValue({
      sign: true,
      endpoint: 'foo',
    });
    const signError = new Error('sign-error');
    vi.mocked(homeAssistantSignPath).mockRejectedValue(signError);

    expect(downloadMedia(createHASS(), cameraManager, media)).rejects.toThrow(
      /Could not sign media URL for download/,
    );
  });

  it('should download media', async () => {
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager).getMediaDownloadPath.mockResolvedValue({
      sign: true,
      endpoint: 'foo',
    });
    vi.mocked(homeAssistantSignPath).mockResolvedValue('http://foo/signed-url');
    const windowSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    await downloadMedia(createHASS(), cameraManager, media);
    expect(windowSpy).toBeCalledWith('http://foo/signed-url', '_blank');
  });

  it('should download media without signing', async () => {
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager).getMediaDownloadPath.mockResolvedValue({
      sign: false,
      endpoint: 'https://another/',
    });
    const windowSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    await downloadMedia(createHASS(), cameraManager, media);
    expect(windowSpy).toBeCalledWith('https://another/', '_blank');
  });

  describe('should generate useful download filenames', () => {
    it('should generate filename with just camera ID', async () => {
      const cameraManager = createCameraManager(
        createStore([
          {
            cameraID: 'camera.office',
          },
        ]),
      );
      vi.mocked(cameraManager).getMediaDownloadPath.mockResolvedValue({
        sign: false,
        endpoint: 'https://foo/',
      });

      const link = document.createElement('a');
      link.click = vi.fn();
      link.setAttribute = vi.fn();
      vi.spyOn(document, 'createElement').mockReturnValue(link);

      await downloadMedia(createHASS(), cameraManager, media);

      expect(link.setAttribute).toBeCalledWith('download', 'camera-office');
    });

    it('should generate filename with full details ID', async () => {
      const cameraManager = createCameraManager(
        createStore([
          {
            cameraID: 'camera.office',
          },
        ]),
      );
      vi.mocked(cameraManager).getMediaDownloadPath.mockResolvedValue({
        sign: false,
        endpoint: 'https://foo/',
      });

      const link = document.createElement('a');
      link.click = vi.fn();
      link.setAttribute = vi.fn();
      vi.spyOn(document, 'createElement').mockReturnValue(link);

      const media = new TestViewMedia({
        cameraID: 'camera.office',
        id: 'clip-id',
        startTime: new Date('2025-03-06T21:31:29Z'),
      });
      await downloadMedia(createHASS(), cameraManager, media);

      expect(link.setAttribute).toBeCalledWith(
        'download',
        'camera-office_clip-id_2025-03-06-21-31-29',
      );
    });
  });
});
