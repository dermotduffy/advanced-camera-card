import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaDimensionsContainerController } from '../../src/components-lib/media-dimensions-container-controller';
import { CameraDimensionsConfig, Rotation } from '../../src/config/schema/cameras';
import { MediaLoadedInfo } from '../../src/types';
import {
  callResizeHandler,
  createLitElement,
  getResizeObserver,
  ResizeObserverMock,
} from '../test-utils';

vi.mock('lodash-es', () => ({
  debounce: vi.fn((fn) => fn),
}));

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
    expect(observer?.observe).not.toBeCalled();
    expect(eventListener).not.toBeCalled();
  });

  describe('should connect and disconnect', () => {
    it('should connect and disconnect without a container', () => {
      const host = createLitElement();
      const controller = new MediaDimensionsContainerController(host);

      const observer = getResizeObserver();
      expect(observer?.observe).toBeCalledTimes(0);

      controller.hostConnected();
      expect(observer?.observe).toBeCalledWith(host);
      expect(observer?.observe).toBeCalledTimes(1);

      controller.hostDisconnected();
      expect(observer?.disconnect).toBeCalled();
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

      expect(observer?.observe).not.toBeCalled();

      controller.hostDisconnected();
      expect(observer?.disconnect).toBeCalled();

      controller.hostConnected();
      expect(observer?.observe).toBeCalledWith(host);
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

      host.getBoundingClientRect = vi.fn().mockReturnValue({
        height: 600,
        width: 300,
      });

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
          innerContainer.getBoundingClientRect = vi.fn().mockReturnValue({
            height: 0,
            width: 0,
          });
          innerContainer.style.width = '1px';
          innerContainer.style.height = '2px';

          controller.setContainers(innerContainer, outerContainer);

          callResizeHandler();

          expect(outerContainer.style.width).toBe('100%');
          expect(outerContainer.style.height).toBe('100%');
        });

        it('should ignore without host size', () => {
          const host = createLitElement();
          host.getBoundingClientRect = vi.fn().mockReturnValue({
            height: 0,
            width: 0,
          });

          const controller = new MediaDimensionsContainerController(host);

          controller.setConfig(configWithAspectRatio);

          const innerContainer = document.createElement('div');
          innerContainer.style.width = '100px';
          innerContainer.style.height = '200px';
          innerContainer.getBoundingClientRect = vi.fn().mockReturnValue({
            height: 100,
            width: 200,
          });

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
          innerContainer.getBoundingClientRect = vi.fn().mockReturnValue({
            height: 0,
            width: 0,
          });
          innerContainer.style.width = '1px';
          innerContainer.style.height = '2px';

          controller.setContainers(innerContainer, outerContainer);

          callResizeHandler();

          expect(outerContainer.style.width).toBe('100%');
          expect(outerContainer.style.height).toBe('100%');
        });

        it('should ignore without host size', () => {
          const host = createLitElement();
          host.getBoundingClientRect = vi.fn().mockReturnValue({
            height: 0,
            width: 0,
          });

          const controller = new MediaDimensionsContainerController(host);

          controller.setConfig(configWithRotation);

          const innerContainer = document.createElement('div');
          innerContainer.style.width = '100px';
          innerContainer.style.height = '200px';
          innerContainer.getBoundingClientRect = vi.fn().mockReturnValue({
            height: 100,
            width: 200,
          });

          controller.setContainers(innerContainer, document.createElement('div'));

          callResizeHandler();

          expect(innerContainer.style.width).toBe('100%');
          expect(innerContainer.style.height).toBe('100%');
        });

        it('should ignore without inner container size during resize', () => {
          const host = createLitElement();
          host.getBoundingClientRect = vi.fn().mockReturnValue({
            height: 100,
            width: 200,
          });

          const controller = new MediaDimensionsContainerController(host);

          controller.setConfig(configWithRotation);

          const innerContainer = document.createElement('div');
          innerContainer.style.width = '100px';
          innerContainer.style.height = '200px';
          innerContainer.getBoundingClientRect = vi
            .fn()
            .mockReturnValueOnce({
              height: 100,
              width: 200,
            })
            .mockReturnValueOnce({
              height: 0,
              width: 0,
            });

          controller.setContainers(innerContainer, document.createElement('div'));

          expect(innerContainer.style.width).toBe('100%');
          expect(innerContainer.style.height).toBe('100%');
        });

        it('should ignore without host size during resize', () => {
          const host = createLitElement();
          host.getBoundingClientRect = vi
            .fn()
            .mockReturnValueOnce({
              height: 100,
              width: 200,
            })
            .mockReturnValueOnce({
              height: 0,
              width: 0,
            });

          const controller = new MediaDimensionsContainerController(host);

          controller.setConfig(configWithRotation);

          const innerContainer = document.createElement('div');
          innerContainer.style.width = '100px';
          innerContainer.style.height = '200px';
          innerContainer.getBoundingClientRect = vi.fn().mockReturnValue({
            height: 100,
            width: 200,
          });

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
          host.getBoundingClientRect = vi.fn().mockReturnValue({
            height: 100,
            width: 200,
          });

          const controller = new MediaDimensionsContainerController(host);
          controller.setConfig({
            rotation: degrees,
          });

          const innerContainer = document.createElement('div');
          innerContainer.getBoundingClientRect = vi.fn().mockReturnValue({
            height: 100,
            width: 200,
          });
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
        host.getBoundingClientRect = vi.fn().mockReturnValue({
          height: 200,
          width: 200,
        });

        const innerContainer = document.createElement('div');
        innerContainer.getBoundingClientRect = vi.fn().mockReturnValue({
          height: 90,
          width: 160,
        });
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
        host.getBoundingClientRect = vi.fn().mockReturnValue({
          height: 100,
          width: 400,
        });

        const innerContainer = document.createElement('div');
        innerContainer.getBoundingClientRect = vi.fn().mockReturnValue({
          height: 200,
          width: 160,
        });
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
        host.getBoundingClientRect = vi.fn().mockReturnValue({
          width: 500,
          height: 1000,
        });

        const innerContainer = document.createElement('div');
        innerContainer.getBoundingClientRect = vi
          .fn()
          .mockReturnValue({
            // These are the pre-rotation dimensions.
            width: 1000,
            height: 2000,
          })
          .mockReturnValue({
            // These are the post-rotation dimensions.
            width: 500,
            height: 1000,
          });
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
        host.getBoundingClientRect = vi.fn().mockReturnValue({
          width: 500,
          height: 1000,
        });

        const innerContainer = document.createElement('div');
        innerContainer.getBoundingClientRect = vi
          .fn()
          .mockReturnValue({
            // These are the pre-rotation dimensions.
            width: 1000,
            height: 2000,
          })
          .mockReturnValue({
            // These are the post-rotation dimensions.
            width: 500,
            height: 2000,
          });
        const outerContainer = document.createElement('div');

        const controller = new MediaDimensionsContainerController(host);
        controller.setConfig(configWithRotation);
        controller.setContainers(innerContainer, outerContainer);

        callResizeHandler();

        // These are pre-rotation dimensions.
        expect(innerContainer.style.width).toBe('1000px');
        expect(innerContainer.style.height).toBe('4000px');

        expect(outerContainer.style.width).toBe('100%');
        expect(outerContainer.style.height).toBe('1000px');

        expect(host.hasAttribute('rotated')).toBeTruthy();
      });
    });
  });

  describe('should respond to slot changes', () => {
    it('should resize container on slotchange event', () => {
      const host = createLitElement();
      host.getBoundingClientRect = vi.fn().mockReturnValue({
        height: 200,
        width: 200,
      });

      const innerContainer = document.createElement('div');
      innerContainer.getBoundingClientRect = vi.fn().mockReturnValue({
        height: 90,
        width: 160,
      });
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

      expect(host.hasAttribute('rotated')).toBeTruthy();
    });
  });

  describe('should respond to media load', () => {
    it('should resize container on media load', () => {
      const host = createLitElement();
      host.getBoundingClientRect = vi.fn().mockReturnValue({
        height: 200,
        width: 200,
      });

      const innerContainer = document.createElement('div');
      innerContainer.getBoundingClientRect = vi.fn().mockReturnValue({
        height: 90,
        width: 160,
      });
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
        new CustomEvent<MediaLoadedInfo>('advanced-camera-card:media:loaded', {
          detail: mediaLoadedInfo,
        }),
      );

      expect(host.hasAttribute('rotated')).toBeTruthy();
    });

    it('should not resize container on media load to same size', () => {
      const host = createLitElement();
      host.getBoundingClientRect = vi.fn().mockReturnValue({
        height: 200,
        width: 200,
      });

      const innerContainer = document.createElement('div');
      innerContainer.getBoundingClientRect = vi.fn().mockReturnValue({
        height: 90,
        width: 160,
      });
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
        new CustomEvent<MediaLoadedInfo>('advanced-camera-card:media:loaded', {
          detail: mediaLoadedInfo,
        }),
      );

      expect(host.hasAttribute('rotated')).toBeTruthy();
      host.removeAttribute('rotated');

      innerContainer.dispatchEvent(
        new CustomEvent<MediaLoadedInfo>('advanced-camera-card:media:loaded', {
          detail: mediaLoadedInfo,
        }),
      );

      expect(host.hasAttribute('rotated')).toBeFalsy();
    });
  });
});
