import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DocumentVisibility } from '../../src/utils/document-visibility';
import { setVisibilityState } from '../test-utils';
import { createPromiseWithResolvers } from './test-utils';

const changeVisibilityState = (state: DocumentVisibilityState): void => {
  setVisibilityState(state);
  document.dispatchEvent(new Event('visibilitychange'));
};

// @vitest-environment jsdom
describe('DocumentVisibility', () => {
  beforeEach(() => {
    setVisibilityState('visible');
  });

  afterEach(() => {
    setVisibilityState('visible');
  });

  describe('should report visibility', () => {
    it('should be visible when the document is visible', () => {
      const visibility = new DocumentVisibility();
      expect(visibility.isVisible()).toBe(true);
    });

    it('should be hidden when the document is hidden', () => {
      setVisibilityState('hidden');
      const visibility = new DocumentVisibility();
      expect(visibility.isVisible()).toBe(false);
    });

    it('should be visible when the document is hidden during a fullscreen request', () => {
      const visibility = new DocumentVisibility();
      visibility.trackFullscreenRequest(createPromiseWithResolvers().promise);
      setVisibilityState('hidden');

      expect(visibility.isVisible()).toBe(true);
    });
  });

  describe('should notify subscribers', () => {
    it('should notify when the document is hidden', () => {
      const visibility = new DocumentVisibility();
      const callback = vi.fn();
      visibility.subscribe(callback);

      changeVisibilityState('hidden');

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(false);
    });

    it('should notify when the document becomes visible', () => {
      setVisibilityState('hidden');
      const visibility = new DocumentVisibility();
      const callback = vi.fn();
      visibility.subscribe(callback);

      changeVisibilityState('visible');

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(true);
    });

    it('should not notify when the visibility is unchanged', () => {
      const visibility = new DocumentVisibility();
      const callback = vi.fn();
      visibility.subscribe(callback);

      changeVisibilityState('visible');

      expect(callback).not.toHaveBeenCalled();
    });

    it('should not notify after unsubscribing', async () => {
      const visibility = new DocumentVisibility();
      const callback = vi.fn();
      const unsubscribe = visibility.subscribe(callback);
      const request = createPromiseWithResolvers();
      visibility.trackFullscreenRequest(request.promise);

      unsubscribe();
      changeVisibilityState('hidden');
      request.resolve();
      await request.promise;

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('should handle a fullscreen request', () => {
    it('should not notify of a hidden blip that ends while the request is pending', async () => {
      const visibility = new DocumentVisibility();
      const callback = vi.fn();
      visibility.subscribe(callback);
      const request = createPromiseWithResolvers();

      visibility.trackFullscreenRequest(request.promise);
      changeVisibilityState('hidden');
      changeVisibilityState('visible');
      request.resolve();
      await request.promise;

      expect(callback).not.toHaveBeenCalled();
    });

    it('should notify of hidden when the document is still hidden as the request resolves', async () => {
      const visibility = new DocumentVisibility();
      const callback = vi.fn();
      visibility.subscribe(callback);
      const request = createPromiseWithResolvers();

      visibility.trackFullscreenRequest(request.promise);
      changeVisibilityState('hidden');
      expect(callback).not.toHaveBeenCalled();

      request.resolve();
      await request.promise;

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(false);
    });

    it('should notify of hidden when the document is still hidden as the request rejects', async () => {
      const visibility = new DocumentVisibility();
      const callback = vi.fn();
      visibility.subscribe(callback);
      const request = createPromiseWithResolvers();

      visibility.trackFullscreenRequest(request.promise);
      changeVisibilityState('hidden');

      request.reject(new Error('denied'));
      await expect(request.promise).rejects.toThrow();

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(false);
    });

    it('should not notify of hidden until the last of overlapping requests settles', async () => {
      const visibility = new DocumentVisibility();
      const callback = vi.fn();
      visibility.subscribe(callback);
      const first = createPromiseWithResolvers();
      const second = createPromiseWithResolvers();

      visibility.trackFullscreenRequest(first.promise);
      visibility.trackFullscreenRequest(second.promise);
      changeVisibilityState('hidden');

      first.resolve();
      await first.promise;
      expect(callback).not.toHaveBeenCalled();

      second.resolve();
      await second.promise;
      expect(callback).toHaveBeenCalledWith(false);
    });

    it('should notify of hidden at once when no request is pending', async () => {
      const visibility = new DocumentVisibility();
      const callback = vi.fn();
      visibility.subscribe(callback);
      const request = createPromiseWithResolvers();

      visibility.trackFullscreenRequest(request.promise);
      request.resolve();
      await request.promise;

      changeVisibilityState('hidden');

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(false);
    });
  });
});
