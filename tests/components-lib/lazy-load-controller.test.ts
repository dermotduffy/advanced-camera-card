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
import { LazyUnloadCondition } from '../../src/config/schema/common/media-actions';
import {
  callIntersectionHandler,
  callVisibilityHandler,
  createLitElement,
  getMockIntersectionObserver,
  IntersectionObserverMock,
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
    vi.spyOn(global.document, 'removeEventListener');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be loaded by default', () => {
    const controller = new LazyLoadController(createLitElement());
    expect(controller.isLoaded()).toBe(true);
  });

  it('should not be loaded by default when lazy load is set to true', () => {
    const controller = new LazyLoadController(createLitElement(), true);
    expect(controller.isLoaded()).toBe(false);
  });

  it('should add controller to host', () => {
    const host = createLitElement();
    const controller = new LazyLoadController(host);
    expect(host.addController).toBeCalledWith(controller);
  });

  it('should remove controller from host', () => {
    const host = createLitElement();
    const controller = new LazyLoadController(host);
    controller.removeController();
    expect(host.removeController).toBeCalledWith(controller);
  });

  it('should remove handlers and listeners on destroy', () => {
    const controller = new LazyLoadController(createLitElement(), true, [
      'unselected',
      'hidden',
    ]);
    controller.hostConnected();

    const listener = vi.fn();
    controller.addListener(listener);

    controller.destroy();

    expect(getMockIntersectionObserver()?.disconnect).toBeCalled();
    expect(global.document.removeEventListener).toBeCalledWith(
      'visibilitychange',
      expect.anything(),
    );
    expect(controller.isLoaded()).toBe(false);

    callVisibilityHandler(true);
    callIntersectionHandler(true);
    expect(listener).not.toBeCalled();
  });

  describe('should lazy load', () => {
    it('should load when both visible and intersecting', () => {
      const controller = new LazyLoadController(createLitElement(), true);
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
      const controller = new LazyLoadController(createLitElement());
      controller.hostConnected();

      expect(controller.isLoaded()).toBe(true);

      controller.hostDisconnected();

      expect(controller.isLoaded()).toBe(false);

      // Should also stop observing.
      expect(getMockIntersectionObserver()?.disconnect).toBeCalled();
      expect(global.document.removeEventListener).toBeCalledWith(
        'visibilitychange',
        expect.anything(),
      );
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
          const controller = new LazyLoadController(
            createLitElement(),
            true,
            unloadConditions,
          );
          controller.hostConnected();

          callIntersectionHandler(true);
          callVisibilityHandler(true);
          expect(controller.isLoaded()).toBe(true);

          callVisibilityHandler(false);
          expect(controller.isLoaded()).toBe(shouldBeLoaded);
        },
      );
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
          const controller = new LazyLoadController(
            createLitElement(),
            true,
            unloadConditions,
          );
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

  it('should call listeners', () => {
    const listener = vi.fn();
    const controller = new LazyLoadController(createLitElement(), true, [
      'unselected',
      'hidden',
    ]);
    controller.hostConnected();
    controller.addListener(listener);

    expect(controller.isLoaded()).toBe(false);

    callIntersectionHandler(true);
    callVisibilityHandler(true);
    expect(listener).toHaveBeenLastCalledWith(true);
    expect(listener).toBeCalledTimes(1);

    callIntersectionHandler(false);
    expect(listener).toHaveBeenLastCalledWith(false);
    expect(listener).toBeCalledTimes(2);

    callIntersectionHandler(true);
    expect(listener).toHaveBeenLastCalledWith(true);
    expect(listener).toBeCalledTimes(3);

    controller.removeListener(listener);

    callIntersectionHandler(false);
    expect(listener).toBeCalledTimes(3);
  });
});
