import { expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { PlayAction } from '../../../../src/card-controller/actions/actions/play';
import { MediaPlayerController } from '../../../../src/types';
import { createCardAPI, createMediaLoadedInfo } from '../../../test-utils';

it('should handle play action', async () => {
  const api = createCardAPI();
  const mediaPlayerController = mock<MediaPlayerController>();
  vi.mocked(api.getMediaLoadedInfoManager().get).mockReturnValue(
    createMediaLoadedInfo({
      mediaPlayerController,
    }),
  );
  const action = new PlayAction(
    {},
    {
      action: 'fire-dom-event',
      advanced_camera_card_action: 'play',
    },
  );

  await action.execute(api);

  expect(mediaPlayerController.play).toBeCalled();
});
