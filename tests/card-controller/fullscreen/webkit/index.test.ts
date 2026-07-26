import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { WebkitFullScreenProvider } from '../../../../src/card-controller/fullscreen/webkit';
import { ConditionStateManager } from '../../../../src/condition-trigger/conditions/state-manager';
import type {
  MediaPlayerController,
  WebkitHTMLVideoElement,
} from '../../../../src/types';
import {
  createCardAPI,
  createMediaLoadedInfo,
  flushPromises,
} from '../../../test-utils';

const createWebkitVideoElement = (): HTMLVideoElement &
  Partial<WebkitHTMLVideoElement> => {
  return document.createElement('video');
};

const createMediaPlayerController = (element: HTMLElement): MediaPlayerController => {
  const mediaPlayerController = mock<MediaPlayerController>();
  mediaPlayerController.getFullscreenElement.mockReturnValue(element);
  return mediaPlayerController;
};

// @vitest-environment jsdom
describe('WebkitFullScreenProvider', () => {
  beforeAll(() => {
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it('should connect', () => {
    const api = createCardAPI();
    const provider = new WebkitFullScreenProvider(api, vi.fn());

    provider.connect();

    expect(api.getConditionStateManager().addListener).toHaveBeenCalledWith(
      expect.anything(),
    );
  });

  it('should disconnect', () => {
    const api = createCardAPI();
    const provider = new WebkitFullScreenProvider(api, vi.fn());

    provider.disconnect();

    expect(api.getConditionStateManager().removeListener).toHaveBeenCalledWith(
      expect.anything(),
    );
  });

  describe('should return if in fullscreen', () => {
    it.each([[true], [false]])('%s', async (fullscreen: boolean) => {
      const api = createCardAPI();
      const provider = new WebkitFullScreenProvider(api, vi.fn());

      const element = createWebkitVideoElement();
      element.webkitDisplayingFullscreen = fullscreen;

      const mediaPlayerController = createMediaPlayerController(element);
      vi.mocked(api.getMediaLoadedInfoManager().get).mockReturnValue(
        createMediaLoadedInfo({
          mediaPlayerController,
        }),
      );

      expect(provider.isInFullscreen()).toBe(fullscreen);
    });
  });

  describe('should return if supported', () => {
    it.each([[true], [false]])('%s', async (supported: boolean) => {
      const api = createCardAPI();
      const provider = new WebkitFullScreenProvider(api, vi.fn());

      const element = createWebkitVideoElement();
      element.webkitSupportsFullscreen = supported;

      const mediaPlayerController = createMediaPlayerController(element);
      vi.mocked(api.getMediaLoadedInfoManager().get).mockReturnValue(
        createMediaLoadedInfo({
          mediaPlayerController,
        }),
      );

      expect(provider.isSupported()).toBe(supported);
    });
  });

  describe('should set fullscreen', () => {
    it('should request fullscreen if fullscreen is true', () => {
      const api = createCardAPI();
      const provider = new WebkitFullScreenProvider(api, vi.fn());

      const element = createWebkitVideoElement();
      element.webkitEnterFullscreen = vi.fn();
      element.webkitSupportsFullscreen = true;

      const mediaPlayerController = createMediaPlayerController(element);
      vi.mocked(api.getMediaLoadedInfoManager().get).mockReturnValue(
        createMediaLoadedInfo({
          mediaPlayerController,
        }),
      );

      provider.setFullscreen(true);

      expect(element.webkitEnterFullscreen).toHaveBeenCalled();
    });

    it('should exit fullscreen if fullscreen is true', () => {
      const api = createCardAPI();
      const provider = new WebkitFullScreenProvider(api, vi.fn());

      const element = createWebkitVideoElement();
      element.webkitExitFullscreen = vi.fn();
      element.webkitSupportsFullscreen = true;

      const mediaPlayerController = createMediaPlayerController(element);
      vi.mocked(api.getMediaLoadedInfoManager().get).mockReturnValue(
        createMediaLoadedInfo({
          mediaPlayerController,
        }),
      );

      provider.setFullscreen(false);

      expect(element.webkitExitFullscreen).toHaveBeenCalled();
    });

    it('should take no action if not supported', () => {
      const api = createCardAPI();
      const provider = new WebkitFullScreenProvider(api, vi.fn());

      const element = createWebkitVideoElement();
      element.webkitEnterFullscreen = vi.fn();
      element.webkitExitFullscreen = vi.fn();
      element.webkitSupportsFullscreen = false;

      const mediaPlayerController = createMediaPlayerController(element);
      vi.mocked(api.getMediaLoadedInfoManager().get).mockReturnValue(
        createMediaLoadedInfo({
          mediaPlayerController,
        }),
      );

      provider.setFullscreen(true);
      provider.setFullscreen(false);

      expect(element.webkitEnterFullscreen).not.toHaveBeenCalled();
      expect(element.webkitExitFullscreen).not.toHaveBeenCalled();
    });

    it('should take no action if element is not a video', () => {
      const api = createCardAPI();
      const provider = new WebkitFullScreenProvider(api, vi.fn());

      const element = document.createElement('img') as HTMLImageElement &
        Partial<WebkitHTMLVideoElement>;
      element.webkitEnterFullscreen = vi.fn();
      element.webkitExitFullscreen = vi.fn();

      const mediaPlayerController = createMediaPlayerController(element);
      vi.mocked(api.getMediaLoadedInfoManager().get).mockReturnValue(
        createMediaLoadedInfo({
          mediaPlayerController,
        }),
      );

      provider.setFullscreen(true);
      provider.setFullscreen(false);

      expect(element.webkitEnterFullscreen).not.toHaveBeenCalled();
      expect(element.webkitExitFullscreen).not.toHaveBeenCalled();
    });
  });

  describe('should handle state changes', () => {
    describe('should call handler when fullscreen state changes', () => {
      it.each([['webkitbeginfullscreen'], ['webkitendfullscreen']])(
        '%s',
        (event: string) => {
          const handler = vi.fn();
          const api = createCardAPI();
          const stateManager = new ConditionStateManager();
          vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

          const provider = new WebkitFullScreenProvider(api, handler);

          provider.connect();

          const element_1 = createWebkitVideoElement();
          const mediaPlayerController_1 = mock<MediaPlayerController>();
          mediaPlayerController_1.getFullscreenElement.mockReturnValue(element_1);
          const mediaLoadedInfo_1 = createMediaLoadedInfo({
            mediaPlayerController: mediaPlayerController_1,
          });

          stateManager.setState({ mediaLoadedInfo: mediaLoadedInfo_1 });

          element_1.dispatchEvent(new Event(event));

          expect(handler).toHaveBeenCalledTimes(1);

          const element_2 = createWebkitVideoElement();
          const mediaPlayerController_2 = mock<MediaPlayerController>();
          mediaPlayerController_2.getFullscreenElement.mockReturnValue(element_2);
          const mediaLoadedInfo_2 = createMediaLoadedInfo({
            mediaPlayerController: mediaPlayerController_2,
          });

          stateManager.setState({ mediaLoadedInfo: mediaLoadedInfo_2 });

          element_2.dispatchEvent(new Event(event));

          expect(handler).toHaveBeenCalledTimes(2);

          // Events on the old element should be ignored.
          element_1.dispatchEvent(new Event(event));

          expect(handler).toHaveBeenCalledTimes(2);

          // Test the media loaded info changing, but the player not changing.
          stateManager.setState({
            mediaLoadedInfo: { ...mediaLoadedInfo_2, width: 101 },
          });

          // Events on the new element should still be handled.
          element_2.dispatchEvent(new Event(event));

          expect(handler).toHaveBeenCalledTimes(3);
        },
      );
    });
  });

  it('should play the video after fullscreen ends', () => {
    const handler = vi.fn();
    const api = createCardAPI();
    const stateManager = new ConditionStateManager();
    vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

    const provider = new WebkitFullScreenProvider(api, handler);

    provider.connect();

    const element = createWebkitVideoElement();
    element.play = vi.fn().mockResolvedValue(undefined);

    const mediaPlayerController = createMediaPlayerController(element);
    vi.mocked(api.getMediaLoadedInfoManager().get).mockReturnValue(
      createMediaLoadedInfo({
        mediaPlayerController,
      }),
    );

    const mediaLoadedInfo = createMediaLoadedInfo({ mediaPlayerController });

    stateManager.setState({ mediaLoadedInfo });

    element.dispatchEvent(new Event('webkitendfullscreen'));

    expect(element.play).not.toHaveBeenCalled();

    vi.runOnlyPendingTimers();

    expect(element.play).toHaveBeenCalled();
  });

  it('should swallow a rejected video replay after fullscreen ends', async () => {
    const api = createCardAPI();
    const stateManager = new ConditionStateManager();
    vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

    const provider = new WebkitFullScreenProvider(api, vi.fn());
    provider.connect();

    const element = createWebkitVideoElement();
    element.play = vi.fn().mockRejectedValue(new Error('denied'));

    const mediaPlayerController = createMediaPlayerController(element);
    vi.mocked(api.getMediaLoadedInfoManager().get).mockReturnValue(
      createMediaLoadedInfo({ mediaPlayerController }),
    );
    stateManager.setState({
      mediaLoadedInfo: createMediaLoadedInfo({ mediaPlayerController }),
    });

    element.dispatchEvent(new Event('webkitendfullscreen'));
    vi.runOnlyPendingTimers();
    await flushPromises();

    expect(element.play).toHaveBeenCalled();
  });
});
