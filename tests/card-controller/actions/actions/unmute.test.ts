import { expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { UnmuteAction } from '../../../../src/card-controller/actions/actions/unmute';
import { MediaPlayerController } from '../../../../src/types';
import { createCardAPI, createMediaLoadedInfo } from '../../../test-utils';

it('should handle unmute action', async () => {
  const api = createCardAPI();
  const mediaPlayerController = mock<MediaPlayerController>();
  vi.mocked(api.getMediaLoadedInfoManager().get).mockReturnValue(
    createMediaLoadedInfo({
      mediaPlayerController,
    }),
  );
  const action = new UnmuteAction(
    {},
    {
      action: 'fire-dom-event',
      advanced_camera_card_action: 'unmute',
    },
  );

  await action.execute(api);

  expect(mediaPlayerController.unmute).toBeCalled();
});
