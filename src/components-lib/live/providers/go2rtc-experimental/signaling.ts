import {
  go2RTCMessageSchema,
  type BinaryCallback,
  type Go2RTCMessage,
  type MessageCallback,
  type UnsubscribeCallback,
} from './types';

export type WebSocketFactory = (url: string) => WebSocket;

interface SignalingChannelCallbacks {
  openCallback?: () => void;

  // Fires when the socket disconnects (i.e. not intentional `close()`).
  disconnectCallback?: () => void;
}

// Injectable test seam. Defaults to the real `WebSocket`; production passes
// nothing here.
interface SignalingChannelOptions {
  createWebSocket?: WebSocketFactory;
}

// Owns the go2rtc WebSocket: JSON text frames are parsed and fanned out to
// message subscribers, binary frames go to the single binary consumer. No
// callbacks of any kind are delivered after `close()`.
export class SignalingChannel {
  private _url: string;

  private _ws: WebSocket | null = null;

  private _open = false;

  private _callbacks: SignalingChannelCallbacks;
  private _createWebSocket: WebSocketFactory;
  private _binaryCallback: BinaryCallback | null = null;

  private _messageCallbacks = new Set<MessageCallback>();

  constructor(
    url: string,
    callbacks: SignalingChannelCallbacks,
    options?: SignalingChannelOptions,
  ) {
    this._url = url;
    this._callbacks = callbacks;
    this._createWebSocket =
      options?.createWebSocket ?? ((wsURL: string) => new WebSocket(wsURL));
  }

  public connect(): void {
    if (this._ws) {
      return;
    }

    const ws = this._createWebSocket(this._url);
    this._ws = ws;

    ws.binaryType = 'arraybuffer';

    // Each listener ignores events once this websocket is no longer current
    // (e.g. events already queued when `close()` was called).
    ws.addEventListener('open', () => {
      if (this._ws !== ws) {
        return;
      }
      this._open = true;
      this._callbacks.openCallback?.();
    });

    ws.addEventListener('close', () => {
      if (this._ws !== ws) {
        return;
      }
      this._ws = null;
      this._open = false;

      // This will not be called when we intentionally call close(), as the
      // guard above will have nulled out this._ws.
      this._callbacks.disconnectCallback?.();
    });

    ws.addEventListener('message', (ev) => {
      if (this._ws !== ws) {
        return;
      }
      this._handleMessage(ev.data);
    });
  }

  public close(): void {
    const ws = this._ws;
    this._ws = null;
    this._open = false;

    ws?.close();
  }

  public isOpen(): boolean {
    return this._open;
  }

  public send(message: Go2RTCMessage): void {
    if (this._ws && this._open) {
      this._ws.send(JSON.stringify(message));
    }
  }

  public subscribeToMessages(callback: MessageCallback): UnsubscribeCallback {
    this._messageCallbacks.add(callback);

    return () => {
      this._messageCallbacks.delete(callback);
    };
  }

  public setBinaryCallback(callback: BinaryCallback | null): void {
    this._binaryCallback = callback;
  }

  private _handleMessage(data: unknown): void {
    if (data instanceof ArrayBuffer) {
      this._binaryCallback?.(data);
      return;
    }

    if (typeof data !== 'string') {
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      return;
    }

    const result = go2RTCMessageSchema.safeParse(parsed);
    if (!result.success) {
      return;
    }

    // Iterate over a copy: a callback may subscribe or unsubscribe during
    // dispatch.
    for (const callback of [...this._messageCallbacks]) {
      callback(result.data);
    }
  }
}
