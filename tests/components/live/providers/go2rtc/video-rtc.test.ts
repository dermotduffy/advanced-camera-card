import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VideoRTC } from '../../../../../src/components/live/providers/go2rtc/video-rtc.js';

// @vitest-environment jsdom

const TAG = 'video-rtc-visibility-test';

class FakeIntersectionObserver {
  public static instances: FakeIntersectionObserver[] = [];
  public disconnected = false;
  public callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    FakeIntersectionObserver.instances.push(this);
  }

  public observe(): void {}

  public unobserve(): void {}

  public disconnect(): void {
    this.disconnected = true;
  }

  public takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

const definePlayer = (): void => {
  if (!customElements.get(TAG)) {
    customElements.define(TAG, VideoRTC);
  }
};

const createPlayer = (): VideoRTC => {
  definePlayer();
  const player = document.createElement(TAG) as VideoRTC;
  player.visibilityThreshold = 0.5;
  return player;
};

const spyOnConnected = (player: VideoRTC): ReturnType<typeof vi.spyOn> => {
  return vi.spyOn(
    player as unknown as { connectedCallback: () => void },
    'connectedCallback',
  );
};

describe('VideoRTC visibility watchers', () => {
  let hidden = false;
  let hiddenDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    hidden = false;
    FakeIntersectionObserver.instances = [];
    hiddenDescriptor = Object.getOwnPropertyDescriptor(document, 'hidden');
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => hidden,
    });
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    vi.spyOn(document, 'addEventListener');
    vi.spyOn(document, 'removeEventListener');
  });

  afterEach(() => {
    document.querySelector(TAG)?.remove();
    if (hiddenDescriptor) {
      Object.defineProperty(document, 'hidden', hiddenDescriptor);
    }
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should pause while the document is hidden and resume when it is shown', () => {
    const player = createPlayer();
    const connected = spyOnConnected(player);
    document.body.append(player);

    hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));

    // The browser invokes the prototype callback, which a spy does not see.
    // The listener calls the method directly, so this is the resume.
    expect(connected).toHaveBeenCalledTimes(1);
    expect(document.removeEventListener).not.toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    );
    expect(FakeIntersectionObserver.instances[0]?.disconnected).toBe(false);
  });

  it('should drop the document listener and viewport observer when removed', () => {
    const player = createPlayer();
    const connected = spyOnConnected(player);
    document.body.append(player);
    player.remove();

    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));

    expect(document.removeEventListener).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    );
    expect(FakeIntersectionObserver.instances[0]?.disconnected).toBe(true);
    expect(connected).not.toHaveBeenCalled();
  });

  it('should drop the watchers when the player is reset', () => {
    const player = createPlayer();
    const connected = spyOnConnected(player);
    document.body.append(player);

    player.reset();
    hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));

    expect(document.removeEventListener).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    );
    expect(FakeIntersectionObserver.instances[0]?.disconnected).toBe(true);
    expect(connected).not.toHaveBeenCalled();
  });

  it('should keep the viewport observer while the player leaves the viewport', () => {
    const player = createPlayer();
    document.body.append(player);
    const observer = FakeIntersectionObserver.instances[0];
    if (!observer) {
      throw new Error('IntersectionObserver was not created');
    }

    observer.callback(
      [{ isIntersecting: false } as IntersectionObserverEntry],
      observer as unknown as IntersectionObserver,
    );
    expect(observer.disconnected).toBe(false);

    observer.callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      observer as unknown as IntersectionObserver,
    );
    expect(observer.disconnected).toBe(false);
  });

  it('should not watch the document when visibility checks are disabled', () => {
    const player = createPlayer();
    player.visibilityCheck = false;
    player.visibilityThreshold = 0;
    document.body.append(player);
    player.remove();

    expect(document.addEventListener).not.toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    );
    expect(FakeIntersectionObserver.instances).toHaveLength(0);
  });
});
