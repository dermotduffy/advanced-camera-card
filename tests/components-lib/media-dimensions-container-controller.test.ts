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

import {
  MediaDimensionsContainerController,
  RESIZE_DEBOUNCE_SECONDS,
} from '../../src/components-lib/media-dimensions-container-controller';
import type { CameraDimensionsConfig, Rotation } from '../../src/config/schema/cameras';
import type { MediaLoadedInfo } from '../../src/types';
import {
  callResizeHandler,
  createLitElement,
  createMediaLoadedInfoEvent,
  getResizeObserver,
  ResizeObserverMock,
} from '../test-utils';
import { setLayoutSize } from './test-utils';

// @vitest-environment jsdom
describe('MediaDimensionsContainerController', () => {
  beforeAll(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  });
  afterAll(() => {
    vi.unstubAllGlobals();
  });
  beforeEach(() => {
    vi.clearAllMocks();

    // The controller debounces its resize. Without fake timers a trailing
    // resize outlives the test that scheduled it and runs against mocks that
    // have since been cleared, in whatever test file happens to be running.
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const configWithAspectRatio: CameraDimensionsConfig = {
    aspect_ratio: [16, 9],
  };
  const configWithRotation: CameraDimensionsConfig = {
    rotation: 90,
  };

  it('should construct', () => {
    const host = createLitElement();
    const eventListener = vi.fn();
    host.addEventListener = eventListener;

    new MediaDimensionsContainerController(host);

    const observer = getResizeObserver();

    // No resize observer should be created.
    expect(observer?.observe).not.toHaveBeenCalled();
    expect(eventListener).not.toHaveBeenCalled();
  });

  describe('should connect and disconnect', () => {
    it('should connect and disconnect without a container', () => {
      const host = createLitElement();
      const controller = new MediaDimensionsContainerController(host);

      const observer = getResizeObserver();
      expect(observer?.observe).toHaveBeenCalledTimes(0);

      controller.hostConnected();
      expect(observer?.observe).toHaveBeenCalledWith(host);
      expect(observer?.observe).toHaveBeenCalledTimes(1);

      controller.hostDisconnected();
      expect(observer?.disconnect).toHaveBeenCalled();
    });

    it('should cancel a pending resize on disconnect', () => {
      const host = createLitElement();
      setLayoutSize(host, { width: 200, height: 200 });

      const innerContainer = document.createElement('div');
      setLayoutSize(innerContainer, { width: 160, height: 90 });
      const outerContainer = document.createElement('div');

      const controller = new MediaDimensionsContainerController(host);

      Object.defineProperty(host, 'isConnected', {
        value: true,
      });
      controller.hostConnected();

      controller.setConfig(configWithRotation);
      controller.setContainers(innerContainer, outerContainer);

      host.removeAttribute('rotated');

      innerContainer.dispatchEvent(new Event('slotchange'));
      controller.hostDisconnected();
      vi.advanceTimersByTime(RESIZE_DEBOUNCE_SECONDS * 1000);

      expect(host.hasAttribute('rotated')).toBeFalsy();
    });

    it('should connect and disconnect with a container when host is connected', () => {
      const host = createLitElement();
      Object.defineProperty(host, 'isConnected', {
        value: true,
      });

      const controller = new MediaDimensionsContainerController(host);

      const observer = getResizeObserver(0);

      const container = createLitElement();
      controller.setContainers(container);

      expect(observer?.observe).not.toHaveBeenCalled();

      controller.hostDisconnected();
      expect(observer?.disconnect).toHaveBeenCalled();

      controller.hostConnected();
      expect(observer?.observe).toHaveBeenCalledWith(host);
    });
  });

  describe('should set container respecting config', () => {
    it('should set aspect ratio on container', () => {
      const host = createLitElement();
      const container = document.createElement('div');
      const controller = new MediaDimensionsContainerController(host);

      controller.setConfig(configWithAspectRatio);
      controller.setContainers(container);

      expect(container.style.aspectRatio).toBe('16 / 9');
    });

    it('should set layout attributes', () => {
      const host = createLitElement();
      const container = document.createElement('div');
      const controller = new MediaDimensionsContainerController(host);

      const config = {
        layout: {
          fit: 'contain' as const,
          position: { x: 1, y: 2 },
          view_box: { top: 3, bottom: 4, left: 5, right: 6 },
        },
      };
      controller.setConfig(config);
      controller.setContainers(container);

      expect(
        container.style.getPropertyValue('--advanced-camera-card-media-layout-fit'),
      ).toBe('contain');
      expect(
        container.style.getPropertyValue(
          '--advanced-camera-card-media-layout-position-x',
        ),
      ).toBe('1%');
      expect(
        container.style.getPropertyValue(
          '--advanced-camera-card-media-layout-position-y',
        ),
      ).toBe('2%');
      expect(
        container.style.getPropertyValue(
          '--advanced-camera-card-media-layout-view-box-top',
        ),
      ).toBe('3%');
      expect(
        container.style.getPropertyValue(
          '--advanced-camera-card-media-layout-view-box-bottom',
        ),
      ).toBe('4%');
      expect(
        container.style.getPropertyValue(
          '--advanced-camera-card-media-layout-view-box-left',
        ),
      ).toBe('5%');
      expect(
        container.style.getPropertyValue(
          '--advanced-camera-card-media-layout-view-box-right',
        ),
      ).toBe('6%');
    });
  });

  it('should ignore multiple calls to set same container', () => {
    const host = createLitElement();
    const container = document.createElement('div');
    const controller = new MediaDimensionsContainerController(host);
    controller.setConfig(configWithAspectRatio);

    controller.setContainers(container);
    expect(container.style.aspectRatio).toBe('16 / 9');

    container.style.aspectRatio = '';

    controller.setContainers(container);
    expect(container.style.aspectRatio).toBe('');
  });

  it('should ignore multiple calls to set same config', () => {
    const host = createLitElement();
    const container = document.createElement('div');
    const controller = new MediaDimensionsContainerController(host);
    controller.setConfig(configWithAspectRatio);

    controller.setContainers(container);

    container.style.aspectRatio = '';

    controller.setConfig(configWithAspectRatio);

    expect(container.style.aspectRatio).toBe('');
  });

  it('should reset config', () => {
    const host = createLitElement();
    const container = document.createElement('div');
    const controller = new MediaDimensionsContainerController(host);
    controller.setConfig(configWithAspectRatio);

    controller.setContainers(container);

    expect(container.style.aspectRatio).toBe('16 / 9');

    controller.setConfig();

    expect(container.style.aspectRatio).toBe('auto');
  });

  describe('should respond to size changes', () => {
    it('should ignore without an aspect ratio or rotation', () => {
      const host = createLitElement();

      setLayoutSize(host, { width: 300, height: 600 });

      const controller = new MediaDimensionsContainerController(host);

      const innerContainer = document.createElement('div');
      const outerContainer = document.createElement('div');
      innerContainer.style.width = '1px';
      innerContainer.style.height = '2px';
      outerContainer.style.width = '3px';
      outerContainer.style.height = '4px';
      controller.setContainers(innerContainer, outerContainer);

      callResizeHandler();

      expect(innerContainer.style.width).toBe('100%');
      expect(innerContainer.style.height).toBe('100%');
      expect(outerContainer.style.width).toBe('100%');
      expect(outerContainer.style.height).toBe('100%');
    });

    describe('should ignore without containers', () => {
      describe.each([
        ['with aspect ratio', configWithAspectRatio],
        ['with rotation', configWithRotation],
      ])('%s', async (_name: string, config: CameraDimensionsConfig) => {
        it('should ignore without inner container', () => {
          const host = createLitElement();
          const controller = new MediaDimensionsContainerController(host);

          controller.setConfig(config);

          const outerContainer = document.createElement('div');
          outerContainer.style.width = '1px';
          outerContainer.style.height = '2px';

          controller.setContainers(undefined, outerContainer);

          callResizeHandler();

          expect(outerContainer.style.width).toBe('1px');
          expect(outerContainer.style.height).toBe('2px');
        });

        it('should ignore without outer container', () => {
          const host = createLitElement();
          const controller = new MediaDimensionsContainerController(host);

          controller.setConfig(config);

          const innerContainer = document.createElement('div');
          innerContainer.style.width = '1px';
          innerContainer.style.height = '2px';

          controller.setContainers(innerContainer);

          callResizeHandler();

          expect(innerContainer.style.width).toBe('1px');
          expect(innerContainer.style.height).toBe('2px');
        });
      });
    });

    describe('should ignore without container sizes', () => {
      describe('should ignore without container sizes with aspect ratio', () => {
        it('should ignore without inner container size', () => {
          const host = createLitElement();
          const controller = new MediaDimensionsContainerController(host);

          controller.setConfig(configWithAspectRatio);

          const outerContainer = document.createElement('div');

          const innerContainer = document.createElement('div');
          setLayoutSize(innerContainer, { width: 0, height: 0 });
          innerContainer.style.width = '1px';
          innerContainer.style.height = '2px';

          controller.setContainers(innerContainer, outerContainer);

          callResizeHandler();

          expect(outerContainer.style.width).toBe('100%');
          expect(outerContainer.style.height).toBe('100%');
        });

        it('should ignore without host size', () => {
          const host = createLitElement();
          setLayoutSize(host, { width: 0, height: 0 });

          const controller = new MediaDimensionsContainerController(host);

          controller.setConfig(configWithAspectRatio);

          const innerContainer = document.createElement('div');
          innerContainer.style.width = '100px';
          innerContainer.style.height = '200px';
          setLayoutSize(innerContainer, { width: 200, height: 100 });

          controller.setContainers(innerContainer, document.createElement('div'));

          callResizeHandler();

          expect(innerContainer.style.width).toBe('100%');
          expect(innerContainer.style.height).toBe('100%');
        });
      });

      describe('should ignore without container sizes with rotation', () => {
        it('should ignore without inner container size', () => {
          const host = createLitElement();
          const controller = new MediaDimensionsContainerController(host);

          controller.setConfig(configWithRotation);

          const outerContainer = document.createElement('div');

          const innerContainer = document.createElement('div');
          setLayoutSize(innerContainer, { width: 0, height: 0 });
          innerContainer.style.width = '1px';
          innerContainer.style.height = '2px';

          controller.setContainers(innerContainer, outerContainer);

          callResizeHandler();

          expect(outerContainer.style.width).toBe('100%');
          expect(outerContainer.style.height).toBe('100%');
        });

        it('should ignore without host size', () => {
          const host = createLitElement();
          setLayoutSize(host, { width: 0, height: 0 });

          const controller = new MediaDimensionsContainerController(host);

          controller.setConfig(configWithRotation);

          const innerContainer = document.createElement('div');
          innerContainer.style.width = '100px';
          innerContainer.style.height = '200px';
          setLayoutSize(innerContainer, { width: 200, height: 100 });

          controller.setContainers(innerContainer, document.createElement('div'));

          callResizeHandler();

          expect(innerContainer.style.width).toBe('100%');
          expect(innerContainer.style.height).toBe('100%');
        });

        it('should ignore without inner container size during resize', () => {
          const host = createLitElement();
          setLayoutSize(host, { width: 200, height: 100 });

          const controller = new MediaDimensionsContainerController(host);

          controller.setConfig(configWithRotation);

          const innerContainer = document.createElement('div');
          innerContainer.style.width = '100px';
          innerContainer.style.height = '200px';
          setLayoutSize(
            innerContainer,
            { width: 200, height: 100 },
            { width: 0, height: 0 },
          );

          controller.setContainers(innerContainer, document.createElement('div'));

          expect(innerContainer.style.width).toBe('100%');
          expect(innerContainer.style.height).toBe('100%');
        });

        it('should ignore without host size during resize', () => {
          const host = createLitElement();
          setLayoutSize(host, { width: 200, height: 100 }, { width: 0, height: 0 });

          const controller = new MediaDimensionsContainerController(host);

          controller.setConfig(configWithRotation);

          const innerContainer = document.createElement('div');
          innerContainer.style.width = '100px';
          innerContainer.style.height = '200px';
          setLayoutSize(innerContainer, { width: 200, height: 100 });

          controller.setContainers(innerContainer, document.createElement('div'));

          expect(innerContainer.style.width).toBe('100%');
          expect(innerContainer.style.height).toBe('100%');
        });
      });
    });

    describe('should set rotation attributes and properties on container', () => {
      it.each([
        [false, undefined],
        [false, 0 as const],
        [true, 90 as const],
        [true, 180 as const],
        [true, 270 as const],
      ])(
        'should rotate %s with rotation degrees %s',
        (shouldRotate: boolean, degrees?: Rotation) => {
          const host = createLitElement();
          setLayoutSize(host, { width: 200, height: 100 });

          const controller = new MediaDimensionsContainerController(host);
          controller.setConfig({
            rotation: degrees,
          });

          const innerContainer = document.createElement('div');
          setLayoutSize(innerContainer, { width: 200, height: 100 });
          controller.setContainers(innerContainer, document.createElement('div'));

          callResizeHandler();

          expect(host.hasAttribute('rotated')).toBe(shouldRotate);

          expect(
            innerContainer.style.getPropertyValue(
              '--advanced-camera-card-media-rotation',
            ),
          ).toBe(shouldRotate ? `${degrees}deg` : '');
        },
      );
    });

    describe('should resize container with aspect-ratio', () => {
      it('should resize container to fit width-limited container', () => {
        const host = createLitElement();
        setLayoutSize(host, { width: 200, height: 200 });

        const innerContainer = document.createElement('div');
        setLayoutSize(innerContainer, { width: 160, height: 90 });
        const outerContainer = document.createElement('div');

        const controller = new MediaDimensionsContainerController(host);
        controller.setConfig(configWithAspectRatio);
        controller.setContainers(innerContainer, outerContainer);

        callResizeHandler();

        expect(innerContainer.style.width).toBe('100%');
        expect(innerContainer.style.height).toBe('auto');
        expect(outerContainer.style.width).toBe('100%');
        expect(outerContainer.style.height).toBe('100%');

        expect(host.hasAttribute('rotated')).toBeFalsy();
      });

      it('should resize container to fit height-limited container', () => {
        const host = createLitElement();
        setLayoutSize(host, { width: 400, height: 100 });

        const innerContainer = document.createElement('div');
        setLayoutSize(innerContainer, { width: 160, height: 200 });
        const outerContainer = document.createElement('div');

        const controller = new MediaDimensionsContainerController(host);
        controller.setConfig(configWithAspectRatio);
        controller.setContainers(innerContainer, outerContainer);

        callResizeHandler();

        expect(innerContainer.style.width).toBe(`auto`);
        expect(innerContainer.style.height).toBe('100%');
        expect(outerContainer.style.width).toBe('100%');
        expect(outerContainer.style.height).toBe('100%');

        expect(host.hasAttribute('rotated')).toBeFalsy();
      });
    });

    describe('should resize container with rotation', () => {
      it('should resize container to fit width-limited container', () => {
        const host = createLitElement();
        setLayoutSize(host, { width: 500, height: 1000 });

        const innerContainer = document.createElement('div');
        // The media's natural 1000x2000 (ratio 0.5), then the 250x500 the
        // controller sets from the 500 host width. Rotated, the 250 width fits
        // within the 1000 host height.
        setLayoutSize(
          innerContainer,
          { width: 1000, height: 2000 },
          { width: 250, height: 500 },
        );
        const outerContainer = document.createElement('div');

        const controller = new MediaDimensionsContainerController(host);
        controller.setConfig(configWithRotation);
        controller.setContainers(innerContainer, outerContainer);

        callResizeHandler();

        // These are pre-rotation dimensions.
        expect(innerContainer.style.width).toBe('250px');
        expect(innerContainer.style.height).toBe('500px');

        expect(outerContainer.style.width).toBe('100%');
        expect(outerContainer.style.height).toBe('250px');

        expect(host.hasAttribute('rotated')).toBeTruthy();
      });

      it('should resize container to fit height-limited container', () => {
        const host = createLitElement();
        setLayoutSize(host, { width: 500, height: 1000 });

        const innerContainer = document.createElement('div');
        // The media's natural 2000x500 (ratio 4), then the 2000x500 the
        // controller sets from the 500 host width. Rotated, the 2000 width
        // overflows the 1000 host height.
        setLayoutSize(
          innerContainer,
          { width: 2000, height: 500 },
          { width: 2000, height: 500 },
        );
        const outerContainer = document.createElement('div');

        const controller = new MediaDimensionsContainerController(host);
        controller.setConfig(configWithRotation);
        controller.setContainers(innerContainer, outerContainer);

        callResizeHandler();

        // These are pre-rotation dimensions.
        expect(innerContainer.style.width).toBe('1000px');
        expect(innerContainer.style.height).toBe('250px');

        expect(outerContainer.style.width).toBe('100%');
        expect(outerContainer.style.height).toBe('1000px');

        expect(host.hasAttribute('rotated')).toBeTruthy();
      });
    });
  });

  describe('should respond to slot changes', () => {
    it('should resize container on slotchange event', () => {
      const host = createLitElement();
      setLayoutSize(host, { width: 200, height: 200 });

      const innerContainer = document.createElement('div');
      setLayoutSize(innerContainer, { width: 160, height: 90 });
      const outerContainer = document.createElement('div');

      const controller = new MediaDimensionsContainerController(host);

      Object.defineProperty(host, 'isConnected', {
        value: true,
      });
      controller.hostConnected();

      controller.setConfig(configWithRotation);
      controller.setContainers(innerContainer, outerContainer);

      host.removeAttribute('rotated');

      innerContainer.dispatchEvent(new Event('slotchange'));
      vi.advanceTimersByTime(RESIZE_DEBOUNCE_SECONDS * 1000);

      expect(host.hasAttribute('rotated')).toBeTruthy();
    });
  });

  describe('should respond to media load', () => {
    it('should resize container on media load', () => {
      const host = createLitElement();
      setLayoutSize(host, { width: 200, height: 200 });

      const innerContainer = document.createElement('div');
      setLayoutSize(innerContainer, { width: 160, height: 90 });
      const outerContainer = document.createElement('div');

      const controller = new MediaDimensionsContainerController(host);

      Object.defineProperty(host, 'isConnected', {
        value: true,
      });
      controller.hostConnected();

      controller.setConfig(configWithRotation);
      controller.setContainers(innerContainer, outerContainer);

      host.removeAttribute('rotated');

      const mediaLoadedInfo: MediaLoadedInfo = {
        width: 90,
        height: 160,
      };
      innerContainer.dispatchEvent(
        createMediaLoadedInfoEvent({ info: mediaLoadedInfo }),
      );
      vi.advanceTimersByTime(RESIZE_DEBOUNCE_SECONDS * 1000);

      expect(host.hasAttribute('rotated')).toBeTruthy();
    });

    it('should not resize container on media load to same size', () => {
      const host = createLitElement();
      setLayoutSize(host, { width: 200, height: 200 });

      const innerContainer = document.createElement('div');
      setLayoutSize(innerContainer, { width: 160, height: 90 });
      const outerContainer = document.createElement('div');

      const controller = new MediaDimensionsContainerController(host);

      Object.defineProperty(host, 'isConnected', {
        value: true,
      });
      controller.hostConnected();

      controller.setConfig(configWithRotation);
      controller.setContainers(innerContainer, outerContainer);

      const mediaLoadedInfo: MediaLoadedInfo = {
        width: 90,
        height: 160,
      };
      innerContainer.dispatchEvent(
        createMediaLoadedInfoEvent({ info: mediaLoadedInfo }),
      );

      expect(host.hasAttribute('rotated')).toBeTruthy();
      host.removeAttribute('rotated');

      innerContainer.dispatchEvent(
        createMediaLoadedInfoEvent({ info: mediaLoadedInfo }),
      );

      expect(host.hasAttribute('rotated')).toBeFalsy();
    });
  });
});
