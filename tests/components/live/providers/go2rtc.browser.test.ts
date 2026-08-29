import { describe, expect, it } from 'vitest';

import type { VideoRTC } from '../../../../src/components/live/providers/go2rtc/video-rtc';
import type { RawAdvancedCameraCardConfig } from '../../../../src/config/types';
import { MountedCardFactory, type MountedCard } from '../../../browser/mounted-card';
import { CAMERA_ENTITY, createGenericCameraHASS } from '../../../browser/test-utils';

const PLAYER_SELECTOR = 'advanced-camera-card-live-go2rtc-player';

const mount = async (camera: RawAdvancedCameraCardConfig): Promise<MountedCard> =>
  await MountedCardFactory.createFromSource(
    {
      type: 'custom:advanced-camera-card',
      cameras: [{ camera_entity: CAMERA_ENTITY, live_provider: 'go2rtc', ...camera }],
      performance: { features: { card_loading_indicator: false } },
    },
    createGenericCameraHASS(),
  );

describe('AdvancedCameraCardGo2RTC', () => {
  it('should play a go2rtc server that is reached without signing or proxying', async () => {
    // An absolute URL is not Home Assistant's to sign, and proxying is off, so
    // the stream URL needs no resolving at all.
    const card = await mount({
      go2rtc: { url: 'http://localhost:1984', stream: 'office' },
      proxy: { live: false },
    });

    const player = await card.waitForSelector<VideoRTC>(PLAYER_SELECTOR);
    expect(player.wsURL).toBe('ws://localhost:1984/api/ws?src=office');
  });
});
