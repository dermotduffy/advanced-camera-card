import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Go2RTCMode } from '../../../../src/config/schema/cameras';
import {
  createFakeGo2RTCCameraConfig,
  useFakeGo2RTC,
} from '../../../browser/fake-go2rtc';
import type { FakeHASS } from '../../../browser/fake-hass';
import { MountedCardFactory, type MountedCard } from '../../../browser/mounted-card';
import {
  CAMERA_ENTITY,
  captureRTCPeerConnectionConfigurations,
  createGenericCameraHASS,
} from '../../../browser/test-utils';

const go2rtc = useFakeGo2RTC();

const mount = async (
  stream: string,
  options?: { modes?: Go2RTCMode[]; hass?: FakeHASS },
): Promise<MountedCard> =>
  await MountedCardFactory.createFromSource(
    {
      type: 'custom:advanced-camera-card',
      cameras: [
        {
          camera_entity: CAMERA_ENTITY,
          live_provider: 'go2rtc-experimental',
          ...createFakeGo2RTCCameraConfig(stream, options?.modes),
        },
      ],
      performance: { features: { card_loading_indicator: false } },
    },
    options?.hass ?? createGenericCameraHASS(),
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
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it("should negotiate WebRTC with Home Assistant's ICE servers", async () => {
    const iceServers = [{ urls: ['stun:127.0.0.1:3478'] }];
    const hass = createGenericCameraHASS();
    hass.registerCommand('web_rtc/ice_servers', () => iceServers);

    const configurations = captureRTCPeerConnectionConfigurations();

    await mount('office', { modes: ['webrtc'], hass });

    await vi.waitFor(() => expect(configurations).not.toHaveLength(0));
    expect(configurations[0].iceServers).toEqual(iceServers);
  });
});
