import { afterEach, describe, expect, it, vi } from 'vitest';
import { MediaPlayerAction } from '../../../../src/card-controller/actions/actions/media-player';
import { createCardAPI, createView, createViewWithMedia } from '../../../test-utils';

afterEach(() => {
  vi.resetAllMocks();
});

describe('should handle media_player action', () => {
  it('to stop', async () => {
    const api = createCardAPI();

    const action = new MediaPlayerAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'media_player',
        media_player_action: 'stop',
        media_player: 'this_is_a_media_player',
      },
    );

    await action.execute(api);

    expect(api.getMediaPlayerManager().stop).toBeCalledWith('this_is_a_media_player');
  });

  it('to play live', async () => {
    const api = createCardAPI();
    vi.mocked(api.getViewManager().getView).mockReturnValue(
      createView({
        camera: 'camera',
        view: 'live',
      }),
    );

    const action = new MediaPlayerAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'media_player',
        media_player_action: 'play',
        media_player: 'this_is_a_media_player',
      },
    );

    await action.execute(api);

    expect(api.getMediaPlayerManager().playLive).toBeCalledWith(
      'this_is_a_media_player',
      'camera',
    );
  });

  it('to play media', async () => {
    const api = createCardAPI();
    const view = createViewWithMedia({
      camera: 'camera',
      view: 'media',
    });

    vi.mocked(api.getViewManager().getView).mockReturnValue(view);

    const action = new MediaPlayerAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'media_player',
        media_player_action: 'play',
        media_player: 'this_is_a_media_player',
      },
    );

    await action.execute(api);

    expect(api.getMediaPlayerManager().playMedia).toBeCalledWith(
      'this_is_a_media_player',
      view.queryResults?.getSelectedResult(),
    );
  });

  it('to play media without selected media', async () => {
    const api = createCardAPI();
    vi.mocked(api.getViewManager().getView).mockReturnValue(
      createView({
        view: 'media',
      }),
    );

    const action = new MediaPlayerAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'media_player',
        media_player_action: 'play',
        media_player: 'this_is_a_media_player',
      },
    );

    await action.execute(api);

    expect(api.getMediaPlayerManager().playMedia).not.toBeCalled();
  });

  it('to not play live without camera', async () => {
    const api = createCardAPI();
    vi.mocked(api.getViewManager().getView).mockReturnValue(
      createView({
        camera: null,
        view: 'live',
      }),
    );

    const action = new MediaPlayerAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'media_player',
        media_player_action: 'play',
        media_player: 'this_is_a_media_player',
      },
    );

    await action.execute(api);

    expect(api.getMediaPlayerManager().playLive).not.toBeCalled();
  });
});
