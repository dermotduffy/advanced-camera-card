import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from 'vitest';

import { NotificationPopupViewportController } from '../../../src/components-lib/notification/notification-popup-viewport-controller';
import {
  callResizeHandler,
  createLitElement,
  getResizeObserver,
  ResizeObserverMock,
} from '../../test-utils';

// @vitest-environment jsdom
describe('NotificationPopupViewportController', () => {
  beforeAll(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.replaceChildren();
  });

  const create = (options?: { containerTop?: number; containerHeight?: number }) => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const containerTop = options?.containerTop ?? 0;
    const containerHeight = options?.containerHeight ?? 100;
    const setContainerBox = (top: number, height: number): void => {
      container.getBoundingClientRect = vi.fn().mockReturnValue({
        top: top,
        bottom: top + height,
      });
    };
    setContainerBox(containerTop, containerHeight);

    const host = createLitElement();
    container.attachShadow({ mode: 'open' }).appendChild(host);

    const controller = new NotificationPopupViewportController(host);

    // Cleanup (disconnecting the window listeners) is registered per test, so
    // leaked listeners cannot bleed into later tests.
    onTestFinished(() => controller.hostDisconnected());

    return { container, host, controller, setContainerBox };
  };

  const getInsets = (host: HTMLElement): { top: string; bottom: string } => ({
    top: host.style.getPropertyValue('--notification-popup-inset-top'),
    bottom: host.style.getPropertyValue('--notification-popup-inset-bottom'),
  });

  it('should add itself to the host', () => {
    const { host, controller } = create();
    expect(host.addController).toHaveBeenCalledWith(controller);
  });

  it('should not inset a container that fits within the viewport', () => {
    const { host, controller } = create({ containerTop: 0, containerHeight: 100 });
    controller.hostConnected();

    expect(getInsets(host)).toEqual({ top: '0px', bottom: '0px' });
  });

  it('should inset the part of the container below the bottom of the viewport', () => {
    const { host, controller } = create({
      containerTop: 0,
      containerHeight: window.innerHeight + 200,
    });
    controller.hostConnected();

    expect(getInsets(host)).toEqual({ top: '0px', bottom: '200px' });
  });

  it('should inset the part of the container above the top of the viewport', () => {
    const { host, controller } = create({
      containerTop: -100,
      containerHeight: window.innerHeight + 300,
    });
    controller.hostConnected();

    expect(getInsets(host)).toEqual({ top: '100px', bottom: '200px' });
  });

  it('should keep the last inset when the container is entirely out of view', () => {
    const { host, controller, setContainerBox } = create({
      containerTop: 0,
      containerHeight: window.innerHeight + 200,
    });
    controller.hostConnected();

    setContainerBox(window.innerHeight, 100);
    document.body.dispatchEvent(new Event('scroll'));

    expect(getInsets(host)).toEqual({ top: '0px', bottom: '200px' });
  });

  it('should do nothing when the popup is not within a shadow root', () => {
    const host = createLitElement();
    document.body.appendChild(host);

    const controller = new NotificationPopupViewportController(host);
    controller.hostConnected();
    onTestFinished(() => controller.hostDisconnected());

    expect(getResizeObserver()?.observe).not.toHaveBeenCalled();
    expect(getInsets(host)).toEqual({ top: '', bottom: '' });
  });

  describe('while connected', () => {
    it('should recalculate the inset on scroll', () => {
      const { host, controller, setContainerBox } = create();
      controller.hostConnected();

      setContainerBox(0, window.innerHeight + 50);
      document.body.dispatchEvent(new Event('scroll'));

      expect(getInsets(host)).toEqual({ top: '0px', bottom: '50px' });
    });

    it('should recalculate the inset on a viewport resize', () => {
      const { host, controller, setContainerBox } = create();
      controller.hostConnected();

      setContainerBox(0, window.innerHeight + 50);
      window.dispatchEvent(new Event('resize'));

      expect(getInsets(host)).toEqual({ top: '0px', bottom: '50px' });
    });

    it('should recalculate the inset on a container resize', () => {
      const { container, host, controller, setContainerBox } = create();
      controller.hostConnected();
      expect(getResizeObserver()?.observe).toHaveBeenCalledWith(container);

      setContainerBox(0, window.innerHeight + 50);
      callResizeHandler();

      expect(getInsets(host)).toEqual({ top: '0px', bottom: '50px' });
    });
  });

  describe('once disconnected', () => {
    it('should not recalculate the inset on scroll', () => {
      const { host, controller, setContainerBox } = create();
      controller.hostConnected();
      controller.hostDisconnected();

      setContainerBox(0, window.innerHeight + 50);
      document.body.dispatchEvent(new Event('scroll'));

      expect(getInsets(host)).toEqual({ top: '0px', bottom: '0px' });
    });

    it('should not recalculate the inset on a viewport resize', () => {
      const { host, controller, setContainerBox } = create();
      controller.hostConnected();
      controller.hostDisconnected();

      setContainerBox(0, window.innerHeight + 50);
      window.dispatchEvent(new Event('resize'));

      expect(getInsets(host)).toEqual({ top: '0px', bottom: '0px' });
    });

    it('should stop observing container resizes', () => {
      const { controller } = create();
      controller.hostConnected();
      controller.hostDisconnected();

      expect(getResizeObserver()?.disconnect).toHaveBeenCalled();
    });
  });
});
