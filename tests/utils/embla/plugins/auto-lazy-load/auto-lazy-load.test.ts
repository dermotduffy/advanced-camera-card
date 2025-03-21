import { describe, expect, it, vi } from 'vitest';
import { MEDIA_ACTION_NEGATIVE_CONDITIONS } from '../../../../../src/config/schema/common/media-actions';
import { AutoLazyLoad } from '../../../../../src/utils/embla/plugins/auto-lazy-load/auto-lazy-load';
import {
  callEmblaHandler,
  callVisibilityHandler,
  createEmblaApiInstance,
  createTestEmblaOptionHandler,
  createTestSlideNodes,
} from '../../test-utils';

// @vitest-environment jsdom
describe('AutoLazyLoad', () => {
  it('should construct', () => {
    const plugin = AutoLazyLoad();
    expect(plugin.name).toBe('autoLazyLoad');
  });

  it('should destroy', () => {
    const plugin = AutoLazyLoad({
      lazyLoadCallback: vi.fn(),
      lazyUnloadCallback: vi.fn(),
    });
    const emblaApi = createEmblaApiInstance();
    plugin.init(emblaApi, createTestEmblaOptionHandler());
    plugin.destroy();

    expect(emblaApi.off).toBeCalledWith('init', expect.anything());
    expect(emblaApi.off).toBeCalledWith('select', expect.anything());
  });

  it('should do nothing without callbacks', () => {
    const plugin = AutoLazyLoad({
      // No callbacks provided.
    });

    const children = createTestSlideNodes();
    const emblaApi = createEmblaApiInstance({ slideNodes: children });

    plugin.init(emblaApi, createTestEmblaOptionHandler());
    expect(emblaApi.on).not.toBeCalled();

    plugin.destroy();
    expect(emblaApi.off).not.toBeCalled();
  });

  it('should lazy load single slide on select', () => {
    const lazyLoadCallback = vi.fn();
    const plugin = AutoLazyLoad({
      lazyLoadCallback: lazyLoadCallback,
    });

    const children = createTestSlideNodes();
    const emblaApi = createEmblaApiInstance({ slideNodes: children });
    plugin.init(emblaApi, createTestEmblaOptionHandler());

    expect(emblaApi.on).toBeCalledWith('init', expect.anything());
    expect(emblaApi.on).toBeCalledWith('select', expect.anything());

    callEmblaHandler(emblaApi, 'init');
    expect(lazyLoadCallback).toBeCalledWith(0, children[0]);

    callEmblaHandler(emblaApi, 'select');

    // The select call will not re-lazyload the same slide.
    expect(lazyLoadCallback).toBeCalledTimes(1);
  });

  it('should lazy load multiple slides on select', () => {
    const lazyLoadCallback = vi.fn();
    const plugin = AutoLazyLoad({
      lazyLoadCallback: lazyLoadCallback,
      lazyLoadCount: 3,
    });

    const children = createTestSlideNodes();
    const emblaApi = createEmblaApiInstance({
      slideNodes: children,
      selectedScrollSnap: 5,
    });
    plugin.init(emblaApi, createTestEmblaOptionHandler());

    callEmblaHandler(emblaApi, 'select');
    for (let i = 3; i <= 8; ++i) {
      expect(lazyLoadCallback).toBeCalledWith(i, children[i]);
    }
  });

  it('should lazy unload on select', () => {
    const lazyUnloadCallback = vi.fn();
    const plugin = AutoLazyLoad({
      lazyLoadCallback: vi.fn(),
      lazyLoadCount: 3,
      lazyUnloadCallback: lazyUnloadCallback,
      lazyUnloadConditions: MEDIA_ACTION_NEGATIVE_CONDITIONS,
    });

    const children = createTestSlideNodes();
    const emblaApi = createEmblaApiInstance({
      selectedScrollSnap: 5,
      slideNodes: children,
    });
    plugin.init(emblaApi, createTestEmblaOptionHandler());

    callEmblaHandler(emblaApi, 'select');

    // First call will not unload anything, since it was not lazy loaded.
    expect(lazyUnloadCallback).not.toBeCalled();

    vi.mocked(emblaApi.previousScrollSnap).mockReturnValue(5);
    callEmblaHandler(emblaApi, 'select');

    // Second call should lazy unload the previous slide.
    expect(lazyUnloadCallback).toBeCalledWith(5, children[5]);
  });

  it('should lazy load on visibility', () => {
    vi.spyOn(global.document, 'addEventListener');

    const lazyLoadCallback = vi.fn();
    const plugin = AutoLazyLoad({
      lazyLoadCallback: lazyLoadCallback,
    });

    const children = createTestSlideNodes();
    const emblaApi = createEmblaApiInstance({
      slideNodes: children,
    });
    plugin.init(emblaApi, createTestEmblaOptionHandler());

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
    });
    callVisibilityHandler();
    expect(lazyLoadCallback).toBeCalledWith(0, children[0]);
  });

  it('should lazy unload on visibility', () => {
    vi.spyOn(global.document, 'addEventListener');

    const lazyUnloadCallback = vi.fn();

    const plugin = AutoLazyLoad({
      lazyLoadCallback: vi.fn(),
      lazyUnloadCallback: lazyUnloadCallback,
      lazyUnloadConditions: MEDIA_ACTION_NEGATIVE_CONDITIONS,
    });

    const children = createTestSlideNodes();
    const emblaApi = createEmblaApiInstance({
      slideNodes: children,
    });
    plugin.init(emblaApi, createTestEmblaOptionHandler());

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
    });
    callVisibilityHandler();

    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
    });
    callVisibilityHandler();
    expect(lazyUnloadCallback).toBeCalledWith(0, children[0]);
  });

  it('should not lazy unload on visibility without a callback', () => {
    vi.spyOn(global.document, 'addEventListener');

    const lazyLoadCallback = vi.fn();
    const plugin = AutoLazyLoad({
      lazyLoadCallback: lazyLoadCallback,
      lazyUnloadConditions: MEDIA_ACTION_NEGATIVE_CONDITIONS,
      // No lazy unload callback.
    });
    const children = createTestSlideNodes();
    const emblaApi = createEmblaApiInstance({
      slideNodes: children,
    });
    plugin.init(emblaApi, createTestEmblaOptionHandler());

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
    });
    callVisibilityHandler();
    expect(lazyLoadCallback).toBeCalledTimes(1);

    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
    });
    callVisibilityHandler();
    expect(lazyLoadCallback).toBeCalledTimes(1);
  });

  it('should not lazy load or unload on visibility when no callback provided', () => {
    vi.spyOn(global.document, 'addEventListener');

    const plugin = AutoLazyLoad({
      lazyUnloadConditions: MEDIA_ACTION_NEGATIVE_CONDITIONS,
      // No callbacks provided.
    });

    const children = createTestSlideNodes();
    const emblaApi = createEmblaApiInstance({
      slideNodes: children,
    });
    plugin.init(emblaApi, createTestEmblaOptionHandler());

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
    });
    callVisibilityHandler();
  });
});
