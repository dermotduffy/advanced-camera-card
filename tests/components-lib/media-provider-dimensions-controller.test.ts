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
import { MediaProviderDimensionsController } from '../../src/components-lib/media-provider-dimensions-controller';
import { CameraDimensionsConfig } from '../../src/config/schema/cameras';
import { dispatchExistingMediaLoadedInfoAsEvent } from '../../src/utils/media-info';
import {
  callResizeHandler,
  createLitElement,
  createMediaLoadedInfo,
  getResizeObserver,
  requestAnimationFrameMock,
  ResizeObserverMock,
} from '../test-utils';

vi.mock('lodash-es', () => ({
  throttle: vi.fn((fn) => fn),
}));

// @vitest-environment jsdom
describe('MediaProviderDimensionsController', () => {
  beforeAll(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  });
  afterAll(() => {
    vi.unstubAllGlobals();
  });
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const configWithAspectRatioLandscape: CameraDimensionsConfig = {
    aspect_ratio: [16, 9],
  };
  const configWithAspectRatioPortrait: CameraDimensionsConfig = {
    aspect_ratio: [9, 16],
  };

  it('should construct', () => {
    const host = createLitElement();
    const eventListener = vi.fn();
    host.addEventListener = eventListener;

    new MediaProviderDimensionsController(host);

    const observer = getResizeObserver();

    // No resize observer should be created.
    expect(observer?.observe).not.toBeCalled();
    expect(eventListener).not.toBeCalled();
  });

  describe('should connect and disconnect', () => {
    it('should connect and disconnect without a container', () => {
      const host = createLitElement();
      const controller = new MediaProviderDimensionsController(host);

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

      const controller = new MediaProviderDimensionsController(host);

      const observer = getResizeObserver(0);

      const container = createLitElement();
      controller.setContainer(container);

      expect(observer?.observe).not.toBeCalled();

      controller.hostDisconnected();
      expect(observer?.disconnect).toBeCalled();

      controller.hostConnected();
      expect(observer?.observe).toBeCalledWith(host);
    });
  });

  describe('should set container respecting config ', () => {
    it('should set aspect ratio on container', () => {
      const host = createLitElement();
      const container = document.createElement('div');
      const controller = new MediaProviderDimensionsController(host);

      controller.setCameraConfig(configWithAspectRatioLandscape);
      controller.setContainer(container);

      expect(container.style.aspectRatio).toBe('16 / 9');
    });

    describe('should set host attribute', () => {
      it.each([
        ['max', {}],
        ['max-width', { aspect_ratio: [16, 9] }],
        ['max-height', { aspect_ratio: [9, 16] }],
      ])('%s', async (value: string, config: CameraDimensionsConfig) => {
        const host = createLitElement();
        const container = document.createElement('div');
        const controller = new MediaProviderDimensionsController(host);
        controller.setCameraConfig(config);

        controller.setContainer(container);

        expect(host.getAttribute('size')).toBe(value);
      });
    });

    it('should set layout attributes', () => {
      const host = createLitElement();
      const container = document.createElement('div');
      const controller = new MediaProviderDimensionsController(host);

      const config = {
        layout: {
          fit: 'contain' as const,
          position: { x: 1, y: 2 },
          view_box: { top: 3, bottom: 4, left: 5, right: 6 },
        },
      };
      controller.setCameraConfig(config);
      controller.setContainer(container);

      expect(
        host.style.getPropertyValue('--advanced-camera-card-media-layout-fit'),
      ).toBe('contain');
      expect(
        host.style.getPropertyValue('--advanced-camera-card-media-layout-position-x'),
      ).toBe('1%');
      expect(
        host.style.getPropertyValue('--advanced-camera-card-media-layout-position-y'),
      ).toBe('2%');
      expect(
        host.style.getPropertyValue('--advanced-camera-card-media-layout-view-box-top'),
      ).toBe('3%');
      expect(
        host.style.getPropertyValue(
          '--advanced-camera-card-media-layout-view-box-bottom',
        ),
      ).toBe('4%');
      expect(
        host.style.getPropertyValue('--advanced-camera-card-media-layout-view-box-left'),
      ).toBe('5%');
      expect(
        host.style.getPropertyValue(
          '--advanced-camera-card-media-layout-view-box-right',
        ),
      ).toBe('6%');
    });
  });

  it('should ignore multiple calls to set same container', () => {
    const host = createLitElement();
    const container = document.createElement('div');
    const controller = new MediaProviderDimensionsController(host);
    controller.setCameraConfig(configWithAspectRatioLandscape);

    controller.setContainer(container);

    expect(host.getAttribute('size')).toBe('max-width');
    host.setAttribute('size', 'custom');

    controller.setContainer(container);
    expect(host.getAttribute('size')).toBe('custom');
  });

  it('should reset container', () => {
    const host = createLitElement();
    const container = document.createElement('div');
    const controller = new MediaProviderDimensionsController(host);
    controller.setCameraConfig(configWithAspectRatioLandscape);

    controller.setContainer(container);
    controller.setContainer();

    expect(host.getAttribute('size')).toBe('max-width');
  });

  describe('should set size attribute correctly', () => {
    it('should set max-width', () => {
      const host = createLitElement();
      const container = document.createElement('div');
      const controller = new MediaProviderDimensionsController(host);

      controller.setCameraConfig(configWithAspectRatioLandscape);
      controller.setContainer(container);

      expect(container.style.aspectRatio).toBe('16 / 9');
      expect(host.getAttribute('size')).toBe('max-width');
    });

    it('should set max-height', () => {
      const host = createLitElement();
      const container = document.createElement('div');
      const controller = new MediaProviderDimensionsController(host);

      controller.setCameraConfig(configWithAspectRatioPortrait);
      controller.setContainer(container);

      expect(container.style.aspectRatio).toBe('9 / 16');
      expect(host.getAttribute('size')).toBe('max-height');
    });

    it('should set max', () => {
      const host = createLitElement();
      const container = document.createElement('div');
      const controller = new MediaProviderDimensionsController(host);

      controller.setContainer(container);
      expect(host.getAttribute('size')).toBe('max');
    });

    it('should set max without a config', () => {
      const host = createLitElement();
      const container = document.createElement('div');
      const controller = new MediaProviderDimensionsController(host);

      controller.setCameraConfig();
      controller.setContainer(container);

      expect(host.getAttribute('size')).toBe('max');
    });
  });

  describe('should respond to size changes', () => {
    it('should ignore without an aspect ratio', () => {
      const host = createLitElement();
      host.setAttribute('size', '__RANDOM__');

      host.getBoundingClientRect = vi.fn().mockReturnValue({
        height: 600,
        width: 300,
      });

      new MediaProviderDimensionsController(host);

      callResizeHandler();

      expect(host.getAttribute('size')).toBe('__RANDOM__');
    });

    it('should set host to max if no container', () => {
      const host = createLitElement();
      host.setAttribute('size', 'custom');

      host.getBoundingClientRect = vi.fn().mockReturnValue({
        height: 600,
        width: 300,
      });

      const controller = new MediaProviderDimensionsController(host);
      controller.setCameraConfig(configWithAspectRatioLandscape);

      callResizeHandler();

      expect(host.getAttribute('size')).toBe('max');
    });

    it('should set host to max if container has no dimensions', () => {
      const host = createLitElement();
      host.setAttribute('size', 'custom');

      host.getBoundingClientRect = vi.fn().mockReturnValue({
        height: 100,
        width: 200,
      });

      const container = document.createElement('div');
      container.getBoundingClientRect = vi.fn().mockReturnValue({
        height: 0,
        width: 0,
      });

      const controller = new MediaProviderDimensionsController(host);
      controller.setCameraConfig(configWithAspectRatioLandscape);
      controller.setContainer(container);

      callResizeHandler();

      expect(host.getAttribute('size')).toBe('max');
    });

    it('should ignore resize calls where actual equals intended size', () => {
      const host = createLitElement();
      host.setAttribute('size', 'custom');

      host.getBoundingClientRect = vi.fn().mockReturnValue({
        height: 100,
        width: 200,
      });

      const container = document.createElement('div');
      container.getBoundingClientRect = vi.fn().mockReturnValue({
        height: 100,
        width: 200,
      });

      const controller = new MediaProviderDimensionsController(host);
      controller.setCameraConfig(configWithAspectRatioLandscape);
      controller.setContainer(container);

      callResizeHandler();

      host.setAttribute('size', '__RANDOM__');

      // 2nd call should be ignored.
      callResizeHandler();

      expect(host.getAttribute('size')).toBe('__RANDOM__');
    });

    describe('should resize container to fit width-limited container', () => {
      it('should resize container to fit width-limited container', () => {
        const host = createLitElement();
        host.getBoundingClientRect = vi.fn().mockReturnValue({
          height: 200,
          width: 200,
        });

        const container = document.createElement('div');
        container.getBoundingClientRect = vi.fn().mockReturnValue({
          height: 90,
          width: 160,
        });

        const controller = new MediaProviderDimensionsController(host);
        controller.setCameraConfig(configWithAspectRatioLandscape);
        controller.setContainer(container);

        callResizeHandler();

        expect(container.style.width).toBe('100%');
        expect(container.style.height).toBe('auto');
        expect(host.getAttribute('size')).toBe('custom');
      });

      it('should resize container to fit height-limited container', () => {
        const host = createLitElement();
        host.getBoundingClientRect = vi.fn().mockReturnValue({
          height: 100,
          width: 400,
        });

        const container = document.createElement('div');
        container.getBoundingClientRect = vi.fn().mockReturnValue({
          height: 200,
          width: 160,
        });

        const controller = new MediaProviderDimensionsController(host);
        controller.setCameraConfig(configWithAspectRatioLandscape);
        controller.setContainer(container);

        callResizeHandler();

        expect(container.style.width).toBe(`${100 * (160 / 200)}px`);
        expect(container.style.height).toBe('100px');
        expect(host.getAttribute('size')).toBe('custom');
      });
    });
  });

  describe('should respond to media loading', () => {
    beforeEach(() => {
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
        requestAnimationFrameMock,
      );
    });

    afterEach(() => {
      vi.mocked(window.requestAnimationFrame).mockRestore();
    });

    it('should resize container after a media load', () => {
      const host = createLitElement();
      host.getBoundingClientRect = vi.fn().mockReturnValue({
        height: 100,
        width: 400,
      });

      const container = document.createElement('div');
      container.getBoundingClientRect = vi.fn().mockReturnValue({
        height: 90,
        width: 160,
      });

      const controller = new MediaProviderDimensionsController(host);
      controller.setCameraConfig(configWithAspectRatioLandscape);
      controller.setContainer(container);

      controller.hostConnected();

      dispatchExistingMediaLoadedInfoAsEvent(host, createMediaLoadedInfo());

      expect(container.style.width).toBe(`100%`);
      expect(container.style.height).toBe('auto');
      expect(host.getAttribute('size')).toBe('custom');
    });
  });
});
