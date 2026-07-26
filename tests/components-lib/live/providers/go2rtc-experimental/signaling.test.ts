import { describe, expect, it, vi } from 'vitest';

import { SignalingChannel } from '../../../../../src/components-lib/live/providers/go2rtc-experimental/signaling';
import { FakeWebSocket } from './test-utils';

describe('SignalingChannel', () => {
  const setup = (options?: {
    openCallback?: () => void;
    disconnectCallback?: () => void;
  }) => {
    const websockets: FakeWebSocket[] = [];
    const createWebSocket = vi.fn<(url: string) => WebSocket>(() => {
      const websocket = new FakeWebSocket();
      websockets.push(websocket);
      return websocket.asWebSocket();
    });
    const channel = new SignalingChannel(
      'ws://host/api/ws?src=camera',
      {
        openCallback: options?.openCallback,
        disconnectCallback: options?.disconnectCallback,
      },
      { createWebSocket },
    );
    return { channel, createWebSocket, websockets };
  };

  it('should connect with an arraybuffer binary type', () => {
    const { channel, createWebSocket, websockets } = setup();
    channel.connect();

    expect(createWebSocket).toHaveBeenCalledWith('ws://host/api/ws?src=camera');
    expect(websockets[0].binaryType).toBe('arraybuffer');
  });

  it('should not connect twice', () => {
    const { channel, createWebSocket } = setup();
    channel.connect();
    channel.connect();

    expect(createWebSocket).toHaveBeenCalledTimes(1);
  });

  it('should report open state and call the open callback', () => {
    const openCallback = vi.fn();
    const { channel, websockets } = setup({ openCallback });
    channel.connect();

    expect(channel.isOpen()).toBe(false);

    websockets[0].fireOpen();

    expect(channel.isOpen()).toBe(true);
    expect(openCallback).toHaveBeenCalled();
  });

  it('should tolerate an absent open callback', () => {
    const { channel, websockets } = setup();
    channel.connect();

    expect(() => websockets[0].fireOpen()).not.toThrow();
  });

  it('should not send before the connection is open', () => {
    const { channel, websockets } = setup();
    channel.connect();
    channel.send({ type: 'mse', value: 'codecs' });

    expect(websockets[0].send).not.toHaveBeenCalled();
  });

  it('should send JSON once open', () => {
    const { channel, websockets } = setup();
    channel.connect();
    websockets[0].fireOpen();
    const message = { type: 'mse', value: 'codecs' };
    channel.send(message);

    expect(websockets[0].sent).toEqual([JSON.stringify(message)]);
  });

  it('should dispatch parsed messages to subscribers', () => {
    const { channel, websockets } = setup();
    const callback = vi.fn();
    channel.subscribeToMessages(callback);
    channel.connect();
    websockets[0].fireMessage('{"type":"mse","value":"video/mp4"}');

    expect(callback).toHaveBeenCalledWith({ type: 'mse', value: 'video/mp4' });
  });

  it('should stop dispatching after unsubscribe', () => {
    const { channel, websockets } = setup();
    const callback = vi.fn();
    const unsubscribe = channel.subscribeToMessages(callback);
    channel.connect();
    unsubscribe();
    websockets[0].fireMessage('{"type":"mse"}');

    expect(callback).not.toHaveBeenCalled();
  });

  it('should dispatch to remaining subscribers when one unsubscribes during dispatch', () => {
    const { channel, websockets } = setup();
    const secondCallback = vi.fn();
    const unsubscribeDuringDispatch = vi.fn((): void => {
      unsubscribe();
    });
    const unsubscribe = channel.subscribeToMessages(unsubscribeDuringDispatch);
    channel.subscribeToMessages(secondCallback);
    channel.connect();
    websockets[0].fireMessage('{"type":"mse"}');

    expect(unsubscribeDuringDispatch).toHaveBeenCalledTimes(1);
    expect(secondCallback).toHaveBeenCalledTimes(1);
  });

  it('should ignore invalid JSON', () => {
    const { channel, websockets } = setup();
    const callback = vi.fn();
    channel.subscribeToMessages(callback);
    channel.connect();
    websockets[0].fireMessage('NOT JSON');

    expect(callback).not.toHaveBeenCalled();
  });

  it('should ignore malformed messages', () => {
    const { channel, websockets } = setup();
    const callback = vi.fn();
    channel.subscribeToMessages(callback);
    channel.connect();
    websockets[0].fireMessage('{"type":6}');

    expect(callback).not.toHaveBeenCalled();
  });

  it('should ignore unexpected data types', () => {
    const { channel, websockets } = setup();
    const callback = vi.fn();
    channel.subscribeToMessages(callback);
    channel.connect();
    websockets[0].fireMessage(42);

    expect(callback).not.toHaveBeenCalled();
  });

  it('should route binary data to the binary callback', () => {
    const { channel, websockets } = setup();
    const binaryCallback = vi.fn();
    channel.setBinaryCallback(binaryCallback);
    channel.connect();
    const data = new ArrayBuffer(8);
    websockets[0].fireMessage(data);

    expect(binaryCallback).toHaveBeenCalledWith(data);
  });

  it('should drop binary data without a binary callback', () => {
    const { channel, websockets } = setup();
    channel.connect();

    expect(() => websockets[0].fireMessage(new ArrayBuffer(8))).not.toThrow();
  });

  it('should drop binary data after the binary callback is cleared', () => {
    const { channel, websockets } = setup();
    const binaryCallback = vi.fn();
    channel.setBinaryCallback(binaryCallback);
    channel.setBinaryCallback(null);
    channel.connect();
    websockets[0].fireMessage(new ArrayBuffer(8));

    expect(binaryCallback).not.toHaveBeenCalled();
  });

  it('should close the underlying websocket without firing the disconnect callback', () => {
    const disconnectCallback = vi.fn();
    const { channel, websockets } = setup({ disconnectCallback });
    channel.connect();
    websockets[0].fireOpen();
    channel.close();

    expect(websockets[0].close).toHaveBeenCalled();
    expect(channel.isOpen()).toBe(false);
    expect(disconnectCallback).not.toHaveBeenCalled();
  });

  it('should tolerate closing when never connected', () => {
    const { channel } = setup();

    expect(() => channel.close()).not.toThrow();
  });

  it('should ignore websocket events delivered after close', () => {
    const openCallback = vi.fn();
    const disconnectCallback = vi.fn();
    const messageCallback = vi.fn();
    const { channel, websockets } = setup({ openCallback, disconnectCallback });
    channel.subscribeToMessages(messageCallback);
    channel.connect();
    channel.close();

    websockets[0].fireOpen();
    websockets[0].fireMessage('{"type":"mse"}');
    websockets[0].fireClose();

    expect(openCallback).not.toHaveBeenCalled();
    expect(messageCallback).not.toHaveBeenCalled();
    expect(disconnectCallback).not.toHaveBeenCalled();
  });

  it('should fire the disconnect callback on unexpected closure', () => {
    const disconnectCallback = vi.fn();
    const { channel, websockets } = setup({ disconnectCallback });
    channel.connect();
    websockets[0].fireOpen();
    websockets[0].fireClose();

    expect(disconnectCallback).toHaveBeenCalledTimes(1);
    expect(channel.isOpen()).toBe(false);
  });

  it('should tolerate an absent disconnect callback on unexpected closure', () => {
    const { channel, websockets } = setup();
    channel.connect();

    expect(() => websockets[0].fireClose()).not.toThrow();
  });

  it('should allow reconnecting after unexpected closure', () => {
    const { channel, createWebSocket, websockets } = setup();
    channel.connect();
    websockets[0].fireClose();
    channel.connect();

    expect(createWebSocket).toHaveBeenCalledTimes(2);
  });

  it('should construct a real websocket by default', () => {
    // A mock implementation must be callable with `new`, so it cannot be an
    // arrow function.
    const webSocketConstructor = vi.fn(function () {
      return new FakeWebSocket().asWebSocket();
    });
    vi.stubGlobal('WebSocket', webSocketConstructor);
    const channel = new SignalingChannel('ws://host/api/ws', {});
    channel.connect();
    channel.close();

    expect(webSocketConstructor).toHaveBeenCalledWith('ws://host/api/ws');
    vi.unstubAllGlobals();
  });
});
