import { describe, expect, it } from 'vitest';
import { createConfig } from '../../test-utils';
import '../../../src/components/live/carousel';
import { AdvancedCameraCardLiveCarousel } from '../../../src/components/live/carousel';

class MockIntersectionObserver {
  public observe(): void {}
  public unobserve(): void {}
  public disconnect(): void {}
}

class MockResizeObserver {
  public observe(): void {}
  public unobserve(): void {}
  public disconnect(): void {}
}

Object.defineProperty(globalThis, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
});

Object.defineProperty(globalThis, 'ResizeObserver', {
  writable: true,
  configurable: true,
  value: MockResizeObserver,
});

// @vitest-environment jsdom
describe('AdvancedCameraCardLiveCarousel', () => {
  const createElement = (navigationLocked: boolean): AdvancedCameraCardLiveCarousel => {
    const element = new AdvancedCameraCardLiveCarousel();
    element.liveConfig = {
      ...createConfig().live,
      draggable: true,
      controls: {
        ...createConfig().live.controls,
        wheel: true,
      },
    };
    element.navigationLocked = navigationLocked;
    return element;
  };

  it('should disable carousel navigation while call navigation is locked', () => {
    const element = createElement(true) as unknown as {
      _isCarouselDragEnabled: (
        hasMultipleCameras: boolean,
        gesturesPTZActive: boolean,
      ) => boolean;
      _isCarouselWheelScrollingEnabled: () => boolean;
    };

    expect(element._isCarouselDragEnabled(true, false)).toBe(false);
    expect(element._isCarouselWheelScrollingEnabled()).toBe(false);
  });

  it('should allow carousel navigation when call navigation is not locked', () => {
    const element = createElement(false) as unknown as {
      _isCarouselDragEnabled: (
        hasMultipleCameras: boolean,
        gesturesPTZActive: boolean,
      ) => boolean;
      _isCarouselWheelScrollingEnabled: () => boolean;
    };

    expect(element._isCarouselDragEnabled(true, false)).toBe(true);
    expect(element._isCarouselWheelScrollingEnabled()).toBe(true);
  });
});