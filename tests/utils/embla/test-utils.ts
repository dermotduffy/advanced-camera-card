import { EmblaCarouselType, EmblaEventType } from 'embla-carousel';
import { EngineType } from 'embla-carousel/components/Engine';
import { vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

export const callEmblaHandler = (
  emblaApi: EmblaCarouselType | null,
  eventName: EmblaEventType,
): void => {
  if (!emblaApi) {
    return;
  }
  const mock = vi.mocked(emblaApi.on).mock;
  for (const [evt, cb] of mock.calls) {
    if (evt === eventName) {
      cb(emblaApi, evt);
    }
  }
};

export const createEmblaApiInstance = (options?: {
  slideNodes?: HTMLElement[];
  selectedScrollSnap?: number;
  previousScrollSnap?: number;
  containerNode?: HTMLElement;
  axis?: 'x' | 'y';
  slideRegistry?: number[][];
}): EmblaCarouselType => {
  const emblaApi = mock<EmblaCarouselType>();
  emblaApi.slideNodes.mockReturnValue(options?.slideNodes ?? createTestSlideNodes());
  emblaApi.selectedScrollSnap.mockReturnValue(options?.selectedScrollSnap ?? 0);
  emblaApi.previousScrollSnap.mockReturnValue(options?.previousScrollSnap ?? 0);
  emblaApi.containerNode.mockReturnValue(
    options?.containerNode ?? document.createElement('div'),
  );
  emblaApi.internalEngine.mockReturnValue({
    options: { axis: options?.axis ?? 'x' },
    ...(options?.slideRegistry && { slideRegistry: options.slideRegistry }),
  } as EngineType);
  return emblaApi;
};

export const createTestSlideNodes = (options?: { n?: number }): HTMLElement[] => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return [...Array(options?.n ?? 10).keys()].map((_) => document.createElement('div'));
};
