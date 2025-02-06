import { expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { PauseAction } from '../../../../src/card-controller/actions/actions/pause';
import { AdvancedCameraCardMediaPlayer } from '../../../../src/types';
import { createCardAPI, createMediaLoadedInfo } from '../../../test-utils';

it('should handle pause action', async () => {
  const api = createCardAPI();
  const player = mock<AdvancedCameraCardMediaPlayer>();
  vi.mocked(api.getMediaLoadedInfoManager().get).mockReturnValue(
    createMediaLoadedInfo({
      player: player,
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

  expect(player.pause).toBeCalled();
});
