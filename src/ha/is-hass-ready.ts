import { STATE_RUNNING } from 'home-assistant-js-websocket';

import type { HomeAssistant } from './types';

// HA is "ready" when the WebSocket is connected AND integrations have finished
// loading (`config.state === STATE_RUNNING`). HA exposes the WebSocket before
// integrations load, so `connected` alone is insufficient for
// integration-specific calls (e.g. Frigate WS subscriptions, which fail with
// "Unknown command" against a half-loaded HA).
//
// Typed as a predicate so callers can use the readiness check to narrow a
// nullable `hass?` reference to a non-null `HomeAssistant` for follow-up
// `hass.connection`-style access.
export const isHassReady = (hass?: HomeAssistant | null): hass is HomeAssistant =>
  !!hass?.connected && hass.config?.state === STATE_RUNNING;
