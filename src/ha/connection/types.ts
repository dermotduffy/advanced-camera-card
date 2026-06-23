import { Connection } from 'home-assistant-js-websocket';

/**
 * Types describing the caller-supplied callbacks for opening and closing a
 * single WebSocket subscription on the HA bus.
 * `HASSConnectionSubscriptionManager` invokes `HASSWebSocketOpenCallback` every
 * time it needs to open a fresh WebSocket subscription on a given `Connection`
 * (initial open, replay after the manager moved to a new connection, retry
 * after a previous failure), and later invokes the returned
 * `HASSWebSocketCloseCallback` once to close it.
 *
 * `HASSWebSocketLiveness.isConnected()` is provided to the caller's open-callback
 * so its WS dispatch callback can drop events that arrived after the manager
 * has moved on to a different connection or is torn down. See
 * `subscription-manager.ts` for the "era" model behind this.
 */
export interface HASSWebSocketLiveness {
  isConnected(): boolean;
}

type HASSWebSocketCloseCallback = () => Promise<void>;

export type HASSWebSocketOpenCallback = (
  connection: Connection,
  liveness: HASSWebSocketLiveness,
) => Promise<HASSWebSocketCloseCallback>;
