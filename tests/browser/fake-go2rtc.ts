import { http, HttpResponse, ws, type WebSocketHandlerConnection } from 'msw';
import { setupWorker } from 'msw/browser';
import { afterAll, beforeAll } from 'vitest';

import type { Go2RTCMode } from '../../src/config/schema/cameras';
import type { RawAdvancedCameraCardConfig } from '../../src/config/types';

const FAKE_GO2RTC_URL = 'http://localhost:1984';

/**
 * Camera configuration that plays a stream from the fake go2rtc server. The
 * URL is absolute and proxying is off, so Home Assistant neither signs nor
 * proxies it.
 */
export const createFakeGo2RTCCameraConfig = (
  stream: string,
  modes: Go2RTCMode[] = ['mjpeg'],
): RawAdvancedCameraCardConfig => ({
  go2rtc: { url: FAKE_GO2RTC_URL, stream, modes },
  proxy: { live: false },
});

const createJPEGFrame = async (): Promise<ArrayBuffer> => {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 36;
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg'),
  );
  if (!blob) {
    throw new Error('The browser could not encode a JPEG frame');
  }
  return await blob.arrayBuffer();
};

type Go2RTCClient = WebSocketHandlerConnection['client'];

/**
 * A go2rtc server that answers each MJPEG request with one frame, and tracks
 * the connections the card holds open to each stream.
 */
export class FakeGo2RTC {
  private _openConnections = new Map<string, Set<Go2RTCClient>>();

  private _worker = setupWorker(
    http.get(`${FAKE_GO2RTC_URL}/api/streams`, () => HttpResponse.json({})),
    ws
      .link(`${FAKE_GO2RTC_URL.replace(/^http/, 'ws')}/api/ws`)
      .addEventListener('connection', ({ client }) => {
        const stream = client.url.searchParams.get('src') ?? '';
        const connections = this._openConnections.get(stream) ?? new Set();
        connections.add(client);
        this._openConnections.set(stream, connections);
        client.addEventListener('close', () => connections.delete(client));

        client.addEventListener('message', async (event) => {
          if (event.data === JSON.stringify({ type: 'mjpeg' })) {
            client.send(await createJPEGFrame());
          }
        });
      }),
  );

  public async start(): Promise<void> {
    await this._worker.start({ onUnhandledRequest: 'bypass', quiet: true });
  }

  public stop(): void {
    this._worker.stop();
  }

  public getOpenConnectionCount(stream: string): number {
    return this._openConnections.get(stream)?.size ?? 0;
  }

  /**
   * Close the stream's open connections from the server side, as a go2rtc
   * restart or a network drop would.
   */
  public dropConnections(stream: string): void {
    this._openConnections.get(stream)?.forEach((client) => client.close());
  }

  /**
   * Tell the stream's open connections that the server failed to serve a mode.
   */
  public sendModeError(stream: string, mode: Go2RTCMode): void {
    this._openConnections
      .get(stream)
      ?.forEach((client) =>
        client.send(JSON.stringify({ type: 'error', value: `${mode}: stream failed` })),
      );
  }
}

/**
 * Serve go2rtc streams to this page's tests.
 */
export const useFakeGo2RTC = (): FakeGo2RTC => {
  const go2rtc = new FakeGo2RTC();
  beforeAll(async () => await go2rtc.start());
  afterAll(() => go2rtc.stop());
  return go2rtc;
};
