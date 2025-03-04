import { expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { MuteAction } from '../../../../src/card-controller/actions/actions/mute';
import { MediaPlayerController } from '../../../../src/types';
import { createCardAPI, createMediaLoadedInfo } from '../../../test-utils';

it('should handle mute action', async () => {
  const api = createCardAPI();
  const mediaPlayerController = mock<MediaPlayerController>();
  vi.mocked(api.getMediaLoadedInfoManager().get).mockReturnValue(
    createMediaLoadedInfo({
      mediaPlayerController,
    }),
  );
  const action = new MuteAction(
    {},
    {
      action: 'fire-dom-event',
      advanced_camera_card_action: 'mute',
    },
  );

  await action.execute(api);

  expect(mediaPlayerController.mute).toBeCalled();
});
