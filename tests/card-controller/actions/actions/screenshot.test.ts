import { afterEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { ScreenshotAction } from '../../../../src/card-controller/actions/actions/screenshot';
import { MediaPlayerController } from '../../../../src/types';
import { downloadURL } from '../../../../src/utils/download';
import { createCardAPI, createMediaLoadedInfo } from '../../../test-utils';

vi.mock('../../../../src/utils/download');

describe('should handle screenshot action', async () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should handle screenshot action with screenshot URL', async () => {
    const api = createCardAPI();
    const action = new ScreenshotAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'screenshot',
      },
    );

    const mediaPlayerController = mock<MediaPlayerController>();
    mediaPlayerController.getScreenshotURL.mockResolvedValue('screenshot-url');

    vi.mocked(api.getMediaLoadedInfoManager().get).mockReturnValue(
      createMediaLoadedInfo({
        mediaPlayerController,
      }),
    );

    await action.execute(api);

    expect(downloadURL).toBeCalledWith('screenshot-url', 'screenshot.jpg');
  });

  it('should handle screenshot action without screenshot URL', async () => {
    const api = createCardAPI();
    const action = new ScreenshotAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'screenshot',
      },
    );

    const mediaPlayerController = mock<MediaPlayerController>();
    mediaPlayerController.getScreenshotURL.mockResolvedValue(null);

    vi.mocked(api.getMediaLoadedInfoManager().get).mockReturnValue(
      createMediaLoadedInfo({
        mediaPlayerController,
      }),
    );

    await action.execute(api);

    expect(downloadURL).not.toBeCalled();
  });
});
