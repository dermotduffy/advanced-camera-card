import { afterEach, assert, describe, expect, it, vi } from 'vitest';

import { createBrowserMediaSource } from '../../../../../../src/components-lib/live/providers/go2rtc-experimental/adapters/media-source';

class FakeMediaSource extends EventTarget {
  public static instances: FakeMediaSource[] = [];

  public addSourceBuffer = vi.fn();
  public setLiveSeekableRange = vi.fn();
  public static isTypeSupported = vi.fn<(mimeType: string) => boolean>(() => true);

  constructor() {
    super();
    FakeMediaSource.instances.push(this);
  }
}

class FakeManagedMediaSource extends EventTarget {
  public addSourceBuffer = vi.fn();
  public setLiveSeekableRange = vi.fn();
  public readyState: 'closed' | 'open' | 'ended' = 'closed';
  public static isTypeSupported = vi.fn<(mimeType: string) => boolean>(() => true);
}

const createObjectURL = vi.fn(() => 'blob:fake-url');
const revokeObjectURL = vi.fn();

const stubManagedMediaSource = (): void => {
  vi.stubGlobal('ManagedMediaSource', FakeManagedMediaSource);
};

const stubClassicMediaSource = (): void => {
  vi.stubGlobal('MediaSource', FakeMediaSource);
  vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
};

// @vitest-environment jsdom
describe('media-source', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    FakeMediaSource.instances = [];
  });

  it('should return null without any MediaSource support', () => {
    expect(createBrowserMediaSource()).toBeNull();
  });

  describe('with ManagedMediaSource support', () => {
    it('should prefer ManagedMediaSource over MediaSource', () => {
      stubManagedMediaSource();
      stubClassicMediaSource();

      const instance = createBrowserMediaSource();
      const video = document.createElement('video');
      instance?.attach(video);

      expect(video.srcObject).toBeInstanceOf(FakeManagedMediaSource);
    });

    it('should attach via srcObject with remote playback disabled', () => {
      stubManagedMediaSource();

      const instance = createBrowserMediaSource();
      const video = document.createElement('video');
      instance?.attach(video);

      expect(video.disableRemotePlayback).toBe(true);
      expect(video.srcObject).toBeInstanceOf(FakeManagedMediaSource);
    });

    it('should detach by clearing srcObject', () => {
      stubManagedMediaSource();

      const instance = createBrowserMediaSource();
      const video = document.createElement('video');
      instance?.attach(video);
      instance?.detach(video);

      expect(video.srcObject).toBeNull();
    });

    it('should delegate isTypeSupported to ManagedMediaSource', () => {
      stubManagedMediaSource();
      FakeManagedMediaSource.isTypeSupported.mockReturnValue(false);

      const instance = createBrowserMediaSource();

      expect(instance?.isTypeSupported('video/mp4')).toBe(false);
      expect(FakeManagedMediaSource.isTypeSupported).toHaveBeenCalledWith('video/mp4');
    });
  });

  describe('with classic MediaSource support', () => {
    it('should attach via an object URL', () => {
      stubClassicMediaSource();

      const instance = createBrowserMediaSource();
      const video = document.createElement('video');
      instance?.attach(video);

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(video.src).toContain('blob:fake-url');
      expect(video.srcObject).toBeNull();
    });

    it('should revoke the object URL once the source opens', () => {
      stubClassicMediaSource();

      const instance = createBrowserMediaSource();
      const video = document.createElement('video');
      instance?.attach(video);

      expect(revokeObjectURL).not.toHaveBeenCalled();

      FakeMediaSource.instances[0].dispatchEvent(new Event('sourceopen'));

      expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');

      instance?.detach(video);

      expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    });

    it('should delegate isTypeSupported to MediaSource', () => {
      stubClassicMediaSource();
      FakeMediaSource.isTypeSupported.mockReturnValue(false);

      const instance = createBrowserMediaSource();

      expect(instance?.isTypeSupported('video/mp4')).toBe(false);
      expect(FakeMediaSource.isTypeSupported).toHaveBeenCalledWith('video/mp4');
    });

    it('should detach by clearing src and revoking the object URL', () => {
      stubClassicMediaSource();

      const instance = createBrowserMediaSource();
      const video = document.createElement('video');
      instance?.attach(video);
      instance?.detach(video);

      expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
      expect(video.getAttribute('src')).toBe('');
    });

    it('should not revoke the object URL twice', () => {
      stubClassicMediaSource();

      const instance = createBrowserMediaSource();
      const video = document.createElement('video');
      instance?.attach(video);
      instance?.detach(video);
      instance?.detach(video);

      expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    });
  });

  describe('shared behavior', () => {
    it('should subscribe and unsubscribe from sourceopen', () => {
      stubManagedMediaSource();

      const instance = createBrowserMediaSource();
      const video = document.createElement('video');
      instance?.attach(video);
      const callback = vi.fn();
      const unsubscribe = instance?.subscribeToSourceOpen(callback);

      const mediaSource = video.srcObject;
      assert(mediaSource instanceof FakeManagedMediaSource);
      mediaSource.dispatchEvent(new Event('sourceopen'));
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe?.();

      mediaSource.dispatchEvent(new Event('sourceopen'));
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should delegate addSourceBuffer', () => {
      stubManagedMediaSource();

      const instance = createBrowserMediaSource();
      const video = document.createElement('video');
      instance?.attach(video);
      instance?.addSourceBuffer('video/mp4; codecs="avc1.640029"');

      const mediaSource = video.srcObject;
      assert(mediaSource instanceof FakeManagedMediaSource);
      expect(mediaSource.addSourceBuffer).toHaveBeenCalledWith(
        'video/mp4; codecs="avc1.640029"',
      );
    });

    it('should delegate setLiveSeekableRange', () => {
      stubManagedMediaSource();

      const instance = createBrowserMediaSource();
      const video = document.createElement('video');
      instance?.attach(video);
      instance?.setLiveSeekableRange(10, 20);

      const mediaSource = video.srcObject;
      assert(mediaSource instanceof FakeManagedMediaSource);
      expect(mediaSource.setLiveSeekableRange).toHaveBeenCalledWith(10, 20);
    });

    it('should report open only while the media source readyState is open', () => {
      stubManagedMediaSource();

      const instance = createBrowserMediaSource();
      const video = document.createElement('video');
      instance?.attach(video);

      const mediaSource = video.srcObject;
      assert(mediaSource instanceof FakeManagedMediaSource);

      mediaSource.readyState = 'open';
      expect(instance?.isOpen()).toBe(true);

      mediaSource.readyState = 'closed';
      expect(instance?.isOpen()).toBe(false);
    });
  });
});
