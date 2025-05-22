import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmblaReInitController } from '../../../src/utils/embla/reinit-controller';
import { requestAnimationFrameMock } from '../../test-utils';
import { callEmblaHandler, createEmblaApiInstance } from './test-utils';

vi.mock('lodash-es', () => ({
  debounce: vi.fn((fn) => fn),
}));

// @vitest-environment jsdom
describe('EmblaReInitController', () => {
  beforeAll(() => {
    window.requestAnimationFrame = requestAnimationFrameMock;
  });
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should construct', () => {
    const emblaApi = createEmblaApiInstance();
    new EmblaReInitController(emblaApi);
    expect(emblaApi.on).toBeCalledWith('scroll', expect.anything());
    expect(emblaApi.on).toBeCalledWith('settle', expect.anything());
    expect(emblaApi.on).toBeCalledWith('destroy', expect.anything());
  });

  it('should destroy', () => {
    const emblaApi = createEmblaApiInstance();
    const controller = new EmblaReInitController(emblaApi);

    controller.destroy();

    expect(emblaApi.off).toBeCalledWith('scroll', expect.anything());
    expect(emblaApi.off).toBeCalledWith('settle', expect.anything());
    expect(emblaApi.off).toBeCalledWith('destroy', expect.anything());
  });

  it('should reinit when not scrolling', () => {
    const emblaApi = createEmblaApiInstance();
    const controller = new EmblaReInitController(emblaApi);

    controller.reinit();

    expect(emblaApi.reInit).toBeCalled();
  });

  it('should carefully reinit when scrolling', () => {
    const emblaApi = createEmblaApiInstance();
    const controller = new EmblaReInitController(emblaApi);

    callEmblaHandler(emblaApi, 'scroll');

    controller.reinit();
    expect(emblaApi.reInit).not.toBeCalled();

    callEmblaHandler(emblaApi, 'settle');
    expect(emblaApi.reInit).toBeCalled();
  });
});
