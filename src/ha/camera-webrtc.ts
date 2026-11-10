import { z } from 'zod';

import type { HomeAssistant } from './types';
import { homeAssistantWSRequest } from './ws-request';

const haCameraCapabilitiesSchema = z.object({
  frontend_stream_types: z.string().array(),

  // Absent before Home Assistant 2026.11.
  two_way_audio: z.boolean().optional(),
});
export type HACameraCapabilities = z.infer<typeof haCameraCapabilitiesSchema>;

export const getHACameraCapabilities = async (
  hass: HomeAssistant,
  entityID: string,
): Promise<HACameraCapabilities> =>
  await homeAssistantWSRequest(hass, haCameraCapabilitiesSchema, {
    type: 'camera/capabilities',
    entity_id: entityID,
  });

// Home Assistant reports two-way audio only when the integration declares it,
// the camera streams over WebRTC and the user enabled the "Two-way audio" Labs
// preview, so the capability alone settles whether a camera can be spoken to.
// See: https://contributors.home-assistant.io/blog/2026/10/24/camera-two-way-audio/
export const supportsHA2WayAudio = async (
  hass: HomeAssistant,
  entityID: string,
): Promise<boolean> => {
  try {
    return !!(await getHACameraCapabilities(hass, entityID)).two_way_audio;
  } catch {
    return false;
  }
};

const webrtcClientConfigSchema = z.object({
  configuration: z.looseObject({
    iceServers: z
      .looseObject({
        urls: z.union([z.string(), z.string().array()]),
        username: z.string().optional(),
        credential: z.string().optional(),
      })
      .array()
      .optional(),
  }),

  // The label of a data channel the client must open in its offer.
  dataChannel: z.string().optional(),
});
type WebRTCClientConfiguration = z.infer<typeof webrtcClientConfigSchema>;

// The settings the camera's WebRTC provider asks clients to use: the peer
// connection configuration (its ICE servers) and any data channel to open.
export const getWebRTCClientConfiguration = async (
  hass: HomeAssistant,
  entityID: string,
): Promise<WebRTCClientConfiguration> =>
  await homeAssistantWSRequest(hass, webrtcClientConfigSchema, {
    type: 'camera/webrtc/get_client_config',
    entity_id: entityID,
  });

// The events of a `camera/webrtc/offer` subscription.
export const webrtcOfferEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('session'), session_id: z.string() }),
  z.object({ type: z.literal('answer'), answer: z.string() }),
  z.object({
    type: z.literal('candidate'),
    candidate: z.object({
      candidate: z.string(),
      sdpMid: z.string().nullish(),
      sdpMLineIndex: z.number().nullish(),
    }),
  }),
  z.object({ type: z.literal('error'), code: z.string(), message: z.string() }),
]);
