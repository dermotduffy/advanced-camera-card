import { describe, expect, it } from 'vitest';

import {
  createFakeGo2RTCCameraConfig,
  useFakeGo2RTC,
} from '../../../browser/fake-go2rtc';
import { MountedCardFactory, type MountedCard } from '../../../browser/mounted-card';
import { CAMERA_ENTITY, createGenericCameraHASS } from '../../../browser/test-utils';

const go2rtc = useFakeGo2RTC();

const mount = async (stream: string): Promise<MountedCard> =>
  await MountedCardFactory.createFromSource(
    {
      type: 'custom:advanced-camera-card',
      cameras: [
        {
          camera_entity: CAMERA_ENTITY,
          live_provider: 'go2rtc-experimental',
          ...createFakeGo2RTCCameraConfig(stream),
        },
      ],
      performance: { features: { card_loading_indicator: false } },
    },
    createGenericCameraHASS(),
  );

const waitForFrame = async (card: MountedCard): Promise<void> => {
  const provider = await card.waitForSelector(
    'advanced-camera-card-live-go2rtc-experimental',
  );
  await card.waitForRender(
    () => provider.shadowRoot?.querySelector('img:not([hidden])') ?? null,
    'a frame from the go2rtc stream',
  );
};

describe('AdvancedCameraCardGo2RTCExperimental', () => {
  it('should leave no stream open when removed from the page while playing', async () => {
    // See: https://github.com/dermotduffy/advanced-camera-card/issues/2864

    const office = await mount('office');
    await waitForFrame(office);
    expect(go2rtc.getOpenConnectionCount('office')).toBe(1);

    office.detach();

    const garage = await mount('garage');
    await waitForFrame(garage);

    expect(go2rtc.getOpenConnectionCount('garage')).toBe(1);
    expect(go2rtc.getOpenConnectionCount('office')).toBe(0);
  });
});
