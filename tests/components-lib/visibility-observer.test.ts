import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { VisibilityObserver } from '../../src/components-lib/visibility-observer';
import {
  IntersectionObserverMock,
  callIntersectionHandler,
  callVisibilityHandler,
  createParent,
  getMockIntersectionObserver,
} from '../test-utils';

// @vitest-environment jsdom
describe('VisibilityObserver', () => {
  beforeAll(() => {
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);
    vi.spyOn(global.document, 'addEventListener');
  });

  afterAll(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset document.visibilityState so each test starts with the tab
    // visible and is not affected by leftover state from a prior
    // `callVisibilityHandler(false)`.
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });
  });

  describe('intersection', () => {
    it('should treat the first callback as baseline and not emit', async () => {
      const onChange = vi.fn();
      const observer = new VisibilityObserver(onChange);
      observer.setRoot(createParent());

      await callIntersectionHandler(false);

      expect(onChange).not.toHaveBeenCalled();
    });

    it('should emit true when the root scrolls into view', async () => {
      const onChange = vi.fn();
      const observer = new VisibilityObserver(onChange);
      observer.setRoot(createParent());

      await callIntersectionHandler(false);
      await callIntersectionHandler(true);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(true);
    });

    it('should emit false when the root scrolls out of view', async () => {
      const onChange = vi.fn();
      const observer = new VisibilityObserver(onChange);
      observer.setRoot(createParent());

      await callIntersectionHandler(true);
      await callIntersectionHandler(false);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(false);
    });

    it('should not emit when intersection state is unchanged', async () => {
      const onChange = vi.fn();
      const observer = new VisibilityObserver(onChange);
      observer.setRoot(createParent());

      await callIntersectionHandler(true);
      await callIntersectionHandler(true);

      expect(onChange).not.toHaveBeenCalled();
    });

    it('should reset the baseline when setRoot accepts a new element', async () => {
      // Without the reset, the first callback for the new root would be
      // compared against the previous root's last-known intersection state and
      // could emit a spurious change.
      const onChange = vi.fn();
      const observer = new VisibilityObserver(onChange);
      observer.setRoot(createParent());

      // Establish a non-null intersection state on the first root.
      await callIntersectionHandler(false);
      await callIntersectionHandler(true);
      expect(onChange).toHaveBeenCalledTimes(1);
      onChange.mockClear();

      observer.setRoot(createParent());

      // First callback after the new setRoot is the new baseline -- no emit.
      await callIntersectionHandler(false);
      expect(onChange).not.toHaveBeenCalled();

      // Subsequent transition does emit.
      await callIntersectionHandler(true);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(true);
    });
  });

  describe('document visibility', () => {
    it('should emit false when the tab becomes hidden while the element is intersecting', async () => {
      const onChange = vi.fn();
      const observer = new VisibilityObserver(onChange);
      observer.setRoot(createParent());
      await callIntersectionHandler(true); // baseline: visible=true

      await callVisibilityHandler(false);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(false);
    });

    it('should emit true when the tab becomes visible while the element is intersecting', async () => {
      const onChange = vi.fn();
      const observer = new VisibilityObserver(onChange);
      observer.setRoot(createParent());
      await callIntersectionHandler(true); // baseline: visible=true
      await callVisibilityHandler(false); // visible -> hidden
      onChange.mockClear();

      await callVisibilityHandler(true);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(true);
    });

    it('should not emit on tab visibility changes while the element is not intersecting', async () => {
      // Regression: live.preload renders the live element while the user is
      // on gallery/viewer, where it is hidden via display:none
      // (intersecting=false). Without this gate, document.visibilitychange
      // would emit visible=true on tab focus, making microphone
      // auto_unmute: ['visible'] open the mic from a hidden view.
      const onChange = vi.fn();
      const observer = new VisibilityObserver(onChange);
      observer.setRoot(createParent());
      await callIntersectionHandler(false); // baseline: visible=false

      await callVisibilityHandler(false);
      await callVisibilityHandler(true);

      expect(onChange).not.toHaveBeenCalled();
    });

    it('should emit nothing for tab events received before any intersection callback', async () => {
      const onChange = vi.fn();
      const observer = new VisibilityObserver(onChange);
      observer.setRoot(createParent());

      await callVisibilityHandler(false);
      await callVisibilityHandler(true);

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('combining tab and intersection signals', () => {
    it('should emit true only when both signals are visible', async () => {
      const onChange = vi.fn();
      const observer = new VisibilityObserver(onChange);
      observer.setRoot(createParent());

      // baseline: visible=false
      await callIntersectionHandler(false);

      // visible=false (still)
      await callVisibilityHandler(false);
      expect(onChange).not.toHaveBeenCalled();

      // Tab visible but element not intersecting -> still false.
      await callVisibilityHandler(true);
      expect(onChange).not.toHaveBeenCalled();

      // Element starts intersecting AND tab visible -> emit true.
      await callIntersectionHandler(true);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(true);
    });
  });

  describe('lifecycle', () => {
    it('should be idempotent on setRoot for the same element', () => {
      const observer = new VisibilityObserver(vi.fn());
      const parent = createParent();

      observer.setRoot(parent);
      const intersectionObserver = getMockIntersectionObserver();
      expect(intersectionObserver?.observe).toHaveBeenCalledTimes(1);
      expect(intersectionObserver?.disconnect).toHaveBeenCalledTimes(1);

      observer.setRoot(parent);

      // Same root: no re-observe, no re-disconnect.
      expect(intersectionObserver?.observe).toHaveBeenCalledTimes(1);
      expect(intersectionObserver?.disconnect).toHaveBeenCalledTimes(1);
    });

    it('should disconnect the intersection observer and remove the visibility listener on destroy', () => {
      const removeEventListenerSpy = vi.spyOn(global.document, 'removeEventListener');
      const observer = new VisibilityObserver(vi.fn());
      observer.setRoot(createParent());

      const intersectionObserver = getMockIntersectionObserver();

      observer.destroy();

      expect(intersectionObserver?.disconnect).toHaveBeenCalled();
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'visibilitychange',
        expect.any(Function),
      );
    });
  });
});
