import { vi } from 'vitest';

// ===========================================================================
// Fakes for browser APIs jsdom does not provide.
// ===========================================================================

export class FakeWebSocket extends EventTarget {
  public binaryType = '';
  public sent: string[] = [];

  public close = vi.fn();
  public send = vi.fn((data: string): void => {
    this.sent.push(data);
  });

  public asWebSocket(): WebSocket {
    return this as unknown as WebSocket;
  }

  public fireOpen(): void {
    this.dispatchEvent(new Event('open'));
  }

  public fireClose(): void {
    this.dispatchEvent(new Event('close'));
  }

  public fireMessage(data: unknown): void {
    this.dispatchEvent(new MessageEvent('message', { data }));
  }
}
