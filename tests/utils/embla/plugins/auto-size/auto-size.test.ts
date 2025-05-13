import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import AutoSize from '../../../../../src/utils/embla/plugins/auto-size/auto-size';
import {
  IntersectionObserverMock,
  ResizeObserverMock,
  callIntersectionHandler,
  createParent,
  requestAnimationFrameMock,
} from '../../../../test-utils';
import {
  callEmblaHandler,
  callResizeHandler,
  createEmblaApiInstance,
  createTestEmblaOptionHandler,
  createTestSlideNodes,
} from '../../test-utils';

vi.mock('lodash-es', () => ({
  debounce: vi.fn((fn) => fn),
}));

// @vitest-environment jsdom
describe('AutoSize', () => {
  beforeAll(() => {
    // Mock out requestAnimationFrame (used in the reinit controller).
    window.requestAnimationFrame = requestAnimationFrameMock;
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should construct', () => {
    const plugin = AutoSize();
    expect(plugin.name).toBe('autoSize');
  });

  it('should destroy', () => {
    const plugin = AutoSize();
    const emblaApi = createEmblaApiInstance();
    plugin.init(emblaApi, createTestEmblaOptionHandler());
    plugin.destroy();

    expect(emblaApi.off).toBeCalledWith('settle', expect.anything());

    expect(
      vi.mocked(IntersectionObserver).mock.results[0].value.disconnect,
    ).toBeCalled();
    expect(vi.mocked(ResizeObserver).mock.results[0].value.disconnect).toBeCalled();
  });

  it('should correctly handle intersection', () => {
    const plugin = AutoSize();
    const emblaApi = createEmblaApiInstance();
    plugin.init(emblaApi, createTestEmblaOptionHandler());

    // First intersection handler call sets the state only.
    callIntersectionHandler(true);

    // When not visible, will not re-init.
    callIntersectionHandler(false);
    callIntersectionHandler(false);
    callIntersectionHandler(false);

    expect(emblaApi.reInit).not.toBeCalled();

    // When visible, will re-initialize once.
    callIntersectionHandler(true);
    callIntersectionHandler(true);

    expect(emblaApi.reInit).toBeCalledTimes(1);
  });

  it('should correctly handle resize', () => {
    const plugin = AutoSize();
    const parent = createParent();
    const children = createTestSlideNodes();
    const emblaApi = createEmblaApiInstance({
      containerNode: parent,
      selectedScrollSnap: 0,
      slideNodes: children,
      slideRegistry: [[0]],
    });

    plugin.init(emblaApi, createTestEmblaOptionHandler());

    children[0].getBoundingClientRect = vi.fn().mockReturnValue({
      width: 200,
      height: 800,
    });

    callResizeHandler([{ target: parent, width: 10, height: 20 }]);
    callResizeHandler([{ target: parent, width: 10, height: 20 }]);
    callResizeHandler([{ target: parent, width: 10, height: 20 }]);

    expect(parent.style.maxHeight).toBe('800px');
    expect(emblaApi.reInit).toBeCalledTimes(1);

    children[0].getBoundingClientRect = vi.fn().mockReturnValue({
      width: 200,
      height: 600,
    });

    callResizeHandler([{ target: parent, width: 20, height: 40 }]);

    expect(parent.style.maxHeight).toBe('600px');
    expect(emblaApi.reInit).toBeCalledTimes(2);
  });

  it('should set container height on slide settle', () => {
    const plugin = AutoSize();
    const parent = createParent();
    const children = createTestSlideNodes();
    const emblaApi = createEmblaApiInstance({
      containerNode: parent,
      selectedScrollSnap: 0,
      slideNodes: children,
      // 0th scroll snap shows the 0th slide only.
      slideRegistry: [[0]],
    });
    plugin.init(emblaApi, createTestEmblaOptionHandler());

    children[0].getBoundingClientRect = vi.fn().mockReturnValue({
      width: 200,
      height: 800,
    });

    // select should not do anything, we wait for it to have settled for
    // smoothness.
    callEmblaHandler(emblaApi, 'select');
    expect(parent.style.maxHeight).toBeFalsy();

    callEmblaHandler(emblaApi, 'settle');
    expect(parent.style.maxHeight).toBe('800px');
  });

  it('should not set container height on horizontal carousel', () => {
    const plugin = AutoSize();
    const parent = createParent();
    const children = createTestSlideNodes();
    const emblaApi = createEmblaApiInstance({
      containerNode: parent,
      selectedScrollSnap: 0,
      slideNodes: children,
      axis: 'y',
      // 0th scroll snap shows the 0th slide only.
      slideRegistry: [[0]],
    });
    plugin.init(emblaApi, createTestEmblaOptionHandler());

    children[0].getBoundingClientRect = vi.fn().mockReturnValue({
      width: 200,
      height: 800,
    });

    callEmblaHandler(emblaApi, 'settle');

    expect(parent.style.maxHeight).toBeFalsy();
  });

  it('should not set container height when slide dimensions are invalid', () => {
    const plugin = AutoSize();
    const parent = createParent();
    const children = createTestSlideNodes();
    const emblaApi = createEmblaApiInstance({
      containerNode: parent,
      selectedScrollSnap: 0,
      slideNodes: children,
      axis: 'x',
      // 0th scroll snap shows the 0th slide only.
      slideRegistry: [[0]],
    });
    plugin.init(emblaApi, createTestEmblaOptionHandler());

    children[0].getBoundingClientRect = vi.fn().mockReturnValue(NaN);
    callEmblaHandler(emblaApi, 'settle');

    children[0].getBoundingClientRect = vi.fn().mockReturnValue(0);
    callEmblaHandler(emblaApi, 'settle');

    expect(parent.style.maxHeight).toBeFalsy();
  });
});
