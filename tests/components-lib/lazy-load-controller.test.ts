import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { LazyLoadController } from '../../src/components-lib/lazy-load-controller';
import type { LazyUnloadCondition } from '../../src/config/schema/common/media-actions';
import {
  callIntersectionHandler,
  callVisibilityHandler,
  changeDocumentVisibility,
  createDocumentVisibility,
  createLitElement,
  getMockIntersectionObserver,
  IntersectionObserverMock,
  setVisibilityState,
} from '../test-utils';

// @vitest-environment jsdom
describe('LazyLoadController', () => {
  beforeAll(() => {
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.spyOn(global.document, 'addEventListener');
    setVisibilityState('visible');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('should be unloaded by default', () => {
    const controller = new LazyLoadController(createLitElement());
    expect(controller.isLoaded()).toBe(false);
  });

  it('should not be loaded by default when lazy load is set to true', () => {
    const controller = new LazyLoadController(createLitElement());
    controller.setConfiguration({ lazyLoad: true });
    expect(controller.isLoaded()).toBe(false);
  });

  it('should add controller to host', () => {
    const host = createLitElement();
    const controller = new LazyLoadController(host);
    expect(host.addController).toHaveBeenCalledWith(controller);
  });

  it('should remove controller from host', () => {
    const host = createLitElement();
    const controller = new LazyLoadController(host);
    controller.removeController();
    expect(host.removeController).toHaveBeenCalledWith(controller);
  });

  it('should remove handlers on destroy', () => {
    const documentVisibility = createDocumentVisibility();
    const unsubscribe = vi.fn();
    documentVisibility.subscribe.mockReturnValue(unsubscribe);
    const controller = new LazyLoadController(createLitElement(), documentVisibility);
    controller.setConfiguration({
      lazyLoad: true,
      lazyUnloadConditions: ['unselected', 'hidden'],
    });
    controller.hostConnected();

    controller.destroy();

    expect(getMockIntersectionObserver()?.disconnect).toHaveBeenCalled();
    expect(unsubscribe).toHaveBeenCalled();
    expect(controller.isLoaded()).toBe(false);
  });

  describe('should set configuration', () => {
    it('should set loaded if lazy loading set to false', () => {
      const controller = new LazyLoadController(createLitElement());

      expect(controller.isLoaded()).toBe(false);

      controller.setConfiguration({ lazyLoad: false });

      expect(controller.isLoaded()).toBe(true);
    });

    it('should re-evaluate unload when conditions change while loaded', () => {
      const controller = new LazyLoadController(createLitElement());
      controller.setConfiguration({ lazyLoad: true });
      controller.hostConnected();

      callIntersectionHandler(true);
      callVisibilityHandler(true);
      expect(controller.isLoaded()).toBe(true);

      callIntersectionHandler(false);
      expect(controller.isLoaded()).toBe(true);

      controller.setConfiguration({
        lazyLoad: true,
        lazyUnloadConditions: ['unselected'],
      });
      expect(controller.isLoaded()).toBe(false);
    });

    it('should unload via `hidden` immediately when toggled on a hidden tab', () => {
      const controller = new LazyLoadController(createLitElement());
      controller.setConfiguration({ lazyLoad: false });
      controller.hostConnected();
      expect(controller.isLoaded()).toBe(true);

      callVisibilityHandler(false);
      expect(controller.isLoaded()).toBe(true);

      controller.setConfiguration({
        lazyLoad: true,
        lazyUnloadConditions: ['hidden'],
      });
      expect(controller.isLoaded()).toBe(false);
    });

    it('should reset omitted fields to their defaults', () => {
      const controller = new LazyLoadController(createLitElement());
      controller.setConfiguration({
        lazyLoad: true,
        lazyUnloadConditions: ['unselected'],
        forceSelected: true,
      });
      controller.hostConnected();

      callVisibilityHandler(true);
      expect(controller.isLoaded()).toBe(true);

      // Each call is a complete snapshot: omitting `forceSelected` resets it
      // to false, and omitting `lazyUnloadConditions` resets it to []. With
      // forceSelected reset and intersection then dropping, no `unselected`
      // condition remains to act on it, so the host stays loaded.
      controller.setConfiguration({ lazyLoad: true });

      callIntersectionHandler(false);
      expect(controller.isLoaded()).toBe(true);

      // Re-introducing `unselected` while not intersecting (and with
      // forceSelected still defaulted to false) must now unload, proving
      // forceSelected was actually reset by the previous call.
      controller.setConfiguration({
        lazyLoad: true,
        lazyUnloadConditions: ['unselected'],
      });
      expect(controller.isLoaded()).toBe(false);
    });
  });

  describe('should lazy load', () => {
    it('should load when both visible and intersecting', () => {
      const controller = new LazyLoadController(createLitElement());
      controller.setConfiguration({ lazyLoad: true });
      controller.hostConnected();

      expect(controller.isLoaded()).toBe(false);

      callVisibilityHandler(true);
      expect(controller.isLoaded()).toBe(false);

      callIntersectionHandler(true);
      expect(controller.isLoaded()).toBe(true);
    });
  });

  describe('should lazy unload', () => {
    it('should unload on DOM disconnection', () => {
      const documentVisibility = createDocumentVisibility();
      const unsubscribe = vi.fn();
      documentVisibility.subscribe.mockReturnValue(unsubscribe);
      const controller = new LazyLoadController(createLitElement(), documentVisibility);

      // No lazy loading.
      controller.setConfiguration({ lazyLoad: false });
      controller.hostConnected();

      expect(controller.isLoaded()).toBe(true);

      controller.hostDisconnected();

      expect(controller.isLoaded()).toBe(false);

      // Should also stop observing.
      expect(getMockIntersectionObserver()?.disconnect).toHaveBeenCalled();
      expect(unsubscribe).toHaveBeenCalled();
    });

    describe('should lazy unload when not visible', () => {
      it.each([
        [[], true],
        [['unselected' as const], true],
        [['hidden' as const], false],
        [['unselected' as const, 'hidden' as const], false],
      ])(
        'when unload conditions are: %s',
        (unloadConditions: LazyUnloadCondition[], shouldBeLoaded: boolean) => {
          const controller = new LazyLoadController(createLitElement());
          controller.setConfiguration({
            lazyLoad: true,
            lazyUnloadConditions: unloadConditions,
          });
          controller.hostConnected();

          callIntersectionHandler(true);
          callVisibilityHandler(true);
          expect(controller.isLoaded()).toBe(true);

          callVisibilityHandler(false);
          expect(controller.isLoaded()).toBe(shouldBeLoaded);
        },
      );

      it('should respect the document visibility source over the raw document state', async () => {
        setVisibilityState('hidden');
        const documentVisibility = createDocumentVisibility(true);
        const controller = new LazyLoadController(
          createLitElement(),
          documentVisibility,
        );
        controller.setConfiguration({
          lazyLoad: true,
          lazyUnloadConditions: ['hidden'],
        });
        controller.hostConnected();

        callIntersectionHandler(true);
        expect(controller.isLoaded()).toBe(true);

        await changeDocumentVisibility(documentVisibility, false);
        expect(controller.isLoaded()).toBe(false);
      });
    });

    describe('should lazy unload when not intersecting', () => {
      it.each([
        [[], true],
        [['unselected' as const], false],
        [['hidden' as const], true],
        [['unselected' as const, 'hidden' as const], false],
      ])(
        'when unload conditions are: %s',
        (unloadConditions: LazyUnloadCondition[], shouldBeLoaded: boolean) => {
          const controller = new LazyLoadController(createLitElement());
          controller.setConfiguration({
            lazyLoad: true,
            lazyUnloadConditions: unloadConditions,
          });
          controller.hostConnected();

          callIntersectionHandler(true);
          callVisibilityHandler(true);
          expect(controller.isLoaded()).toBe(true);

          callIntersectionHandler(false);
          expect(controller.isLoaded()).toBe(shouldBeLoaded);
        },
      );
    });
  });

  describe('should force selected', () => {
    it('should load when forced selected even if not intersecting', () => {
      const controller = new LazyLoadController(createLitElement());
      controller.setConfiguration({ lazyLoad: true });
      controller.hostConnected();

      callVisibilityHandler(true);
      expect(controller.isLoaded()).toBe(false);

      controller.setConfiguration({ forceSelected: true });
      expect(controller.isLoaded()).toBe(true);
    });

    it('should not load while document is already hidden on connect', () => {
      setVisibilityState('hidden');

      const controller = new LazyLoadController(createLitElement());
      controller.setConfiguration({
        lazyLoad: true,
        lazyUnloadConditions: ['hidden'],
      });
      controller.hostConnected();

      controller.setConfiguration({ forceSelected: true });
      expect(controller.isLoaded()).toBe(false);

      callVisibilityHandler(true);
      expect(controller.isLoaded()).toBe(true);
    });

    it('should stay loaded with `unselected` unload condition while forced selected', () => {
      const controller = new LazyLoadController(createLitElement());
      controller.setConfiguration({
        lazyLoad: true,
        lazyUnloadConditions: ['unselected'],
        forceSelected: true,
      });
      controller.hostConnected();

      callVisibilityHandler(true);
      expect(controller.isLoaded()).toBe(true);

      callIntersectionHandler(false);
      expect(controller.isLoaded()).toBe(true);
    });

    it('should still unload via `hidden` while forced selected', () => {
      const controller = new LazyLoadController(createLitElement());
      controller.setConfiguration({
        lazyLoad: true,
        lazyUnloadConditions: ['hidden'],
        forceSelected: true,
      });
      controller.hostConnected();

      callVisibilityHandler(true);
      expect(controller.isLoaded()).toBe(true);

      callVisibilityHandler(false);
      expect(controller.isLoaded()).toBe(false);
    });

    it('should unload after force-selected is released and `unselected` applies', () => {
      const controller = new LazyLoadController(createLitElement());
      controller.setConfiguration({
        lazyLoad: true,
        lazyUnloadConditions: ['unselected'],
        forceSelected: true,
      });
      controller.hostConnected();

      callVisibilityHandler(true);
      callIntersectionHandler(false);
      expect(controller.isLoaded()).toBe(true);

      controller.setConfiguration({
        lazyLoad: true,
        lazyUnloadConditions: ['unselected'],
        forceSelected: false,
      });
      expect(controller.isLoaded()).toBe(false);
    });

    it('should keep selected stream loaded with default `unload: []`', () => {
      const controller = new LazyLoadController(createLitElement());
      controller.setConfiguration({ lazyLoad: true });
      controller.hostConnected();

      controller.setConfiguration({ forceSelected: true });
      callVisibilityHandler(true);
      expect(controller.isLoaded()).toBe(true);

      controller.setConfiguration({ forceSelected: false });
      callIntersectionHandler(false);
      expect(controller.isLoaded()).toBe(true);
    });
  });

  it('should request a host update whenever loadedness changes', () => {
    const host = createLitElement();
    const controller = new LazyLoadController(host);
    controller.setConfiguration({
      lazyLoad: true,
      lazyUnloadConditions: ['unselected', 'hidden'],
    });
    controller.hostConnected();
    vi.mocked(host.requestUpdate).mockClear();

    expect(controller.isLoaded()).toBe(false);

    callIntersectionHandler(true);
    callVisibilityHandler(true);
    expect(controller.isLoaded()).toBe(true);
    expect(host.requestUpdate).toHaveBeenCalledTimes(1);

    callIntersectionHandler(false);
    expect(controller.isLoaded()).toBe(false);
    expect(host.requestUpdate).toHaveBeenCalledTimes(2);

    callIntersectionHandler(true);
    expect(controller.isLoaded()).toBe(true);
    expect(host.requestUpdate).toHaveBeenCalledTimes(3);
  });
});
