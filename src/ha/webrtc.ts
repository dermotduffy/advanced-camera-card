import { z } from 'zod';

import type { HomeAssistant } from './types';
import { homeAssistantWSRequest } from './ws-request';

// Home Assistant answers over the websocket the card already holds, so a reply
// slower than this means that websocket is likely stalled or reconnecting.
const ICE_SERVERS_FETCH_TIMEOUT_SECONDS = 2;

// Default ICE Servers: Matches Home Assistant's default.
const HA_DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  {
    urls: ['stun:stun.home-assistant.io:3478', 'stun:stun.home-assistant.io:80'],
  },
];

export const haICEServerSchema = z.looseObject({
  urls: z.union([z.string(), z.string().array()]),
  username: z.string().optional(),
  credential: z.string().optional(),
});

// The ICE servers Home Assistant gives browsers for WebRTC: the user's
// configured STUN/TURN servers (or Home Assistant's own STUN server when none
// are configured), plus any an integration adds (e.g. Nabu Casa TURN). Falls
// back to Home Assistant's own STUN server when Home Assistant does not answer
// in time or at all, including on versions before 2026.1 that lack the command.
export const getICEServers = async (
  hass?: HomeAssistant | null,
): Promise<RTCIceServer[]> => {
  if (!hass) {
    return HA_DEFAULT_ICE_SERVERS;
  }
  try {
    return await homeAssistantWSRequest(
      hass,
      haICEServerSchema.array(),
      { type: 'web_rtc/ice_servers' },
      { timeoutSeconds: ICE_SERVERS_FETCH_TIMEOUT_SECONDS },
    );
  } catch {
    return HA_DEFAULT_ICE_SERVERS;
  }
};
