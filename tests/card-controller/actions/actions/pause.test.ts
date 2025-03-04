import { expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { PauseAction } from '../../../../src/card-controller/actions/actions/pause';
import { MediaPlayerController } from '../../../../src/types';
import { createCardAPI, createMediaLoadedInfo } from '../../../test-utils';

it('should handle pause action', async () => {
  const api = createCardAPI();
  const mediaPlayerController = mock<MediaPlayerController>();
  vi.mocked(api.getMediaLoadedInfoManager().get).mockReturnValue(
    createMediaLoadedInfo({
      mediaPlayerController,
    }),
  );
  const action = new PauseAction(
    {},
    {
      action: 'fire-dom-event',
      advanced_camera_card_action: 'pause',
    },
  );

  await action.execute(api);

  expect(mediaPlayerController.pause).toBeCalled();
});
