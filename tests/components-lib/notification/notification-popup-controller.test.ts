import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { NotificationPopupController } from '../../../src/components-lib/notification/notification-popup-controller';
import { POP_OUT_ANIMATION_NAME } from '../../../src/const';
import { createLitElement } from '../../test-utils';

// @vitest-environment jsdom
describe('NotificationPopupController', () => {
  const create = (getNotificationElement?: () => HTMLElement | null) => {
    const host = createLitElement();
    document.body.appendChild(host);
    const popup = document.createElement('div');

    const controller = new NotificationPopupController(
      host,
      getNotificationElement ?? (() => popup),
    );
    controller.hostConnected();

    // Cleanup (disconnecting the window listeners and clearing the DOM) is
    // registered per test, so leaked listeners cannot bleed into later tests.
    onTestFinished(() => {
      controller.hostDisconnected();
      document.body.replaceChildren();
    });

    return { host, popup, controller };
  };

  it('should add itself to the host', () => {
    const { host, controller } = create();
    expect(host.addController).toHaveBeenCalledWith(controller);
  });

  describe('dismiss', () => {
    it('should mark the notification element as exiting', () => {
      const { popup, controller } = create();
      controller.dismiss();
      expect(popup.classList.contains('exiting')).toBe(true);
    });

    it('should do nothing when there is no notification element', () => {
      const controller = new NotificationPopupController(createLitElement(), () => null);
      expect(() => controller.dismiss()).not.toThrow();
    });
  });

  describe('outside interaction', () => {
    it('should dismiss on a click outside the host', () => {
      const { popup } = create();
      const outside = document.createElement('div');
      document.body.appendChild(outside);
      outside.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
      expect(popup.classList.contains('exiting')).toBe(true);
    });

    it('should dismiss on a focus outside the host', () => {
      const { popup } = create();
      const outside = document.createElement('div');
      document.body.appendChild(outside);
      outside.dispatchEvent(new Event('focusin', { bubbles: true, composed: true }));
      expect(popup.classList.contains('exiting')).toBe(true);
    });

    it('should not dismiss on an interaction inside the host', () => {
      const { host, popup } = create();
      host.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
      expect(popup.classList.contains('exiting')).toBe(false);
    });

    it('should stop listening once disconnected', () => {
      const { popup, controller } = create();
      controller.hostDisconnected();

      const outside = document.createElement('div');
      document.body.appendChild(outside);
      outside.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
      expect(popup.classList.contains('exiting')).toBe(false);
    });
  });

  describe('keydown', () => {
    it('should dismiss and consume the Escape key', () => {
      const { popup } = create();
      const ev = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      document.body.dispatchEvent(ev);
      expect(popup.classList.contains('exiting')).toBe(true);
      expect(ev.defaultPrevented).toBe(true);
    });

    it('should ignore other keys', () => {
      const { popup } = create();
      const ev = new KeyboardEvent('keydown', {
        key: 'a',
        bubbles: true,
        cancelable: true,
      });
      document.body.dispatchEvent(ev);
      expect(popup.classList.contains('exiting')).toBe(false);
      expect(ev.defaultPrevented).toBe(false);
    });
  });

  describe('animation end', () => {
    // Dispatch a real `animationend` event on the element the handler is bound
    // to, so `target` and `currentTarget` are genuinely the same node.
    const dispatchAnimationEnd = (
      controller: NotificationPopupController,
      animationName: string,
    ): void => {
      const element = document.createElement('div');
      element.addEventListener('animationend', controller.handleAnimationEnd);

      const ev = new Event('animationend');
      Object.defineProperty(ev, 'animationName', { value: animationName });
      element.dispatchEvent(ev);
    };

    it('should dispatch the dismiss event when the pop-out animation ends', () => {
      const { host, controller } = create();
      const dismissed = vi.fn();
      host.addEventListener('advanced-camera-card:notification:dismiss', dismissed);
      dispatchAnimationEnd(controller, POP_OUT_ANIMATION_NAME);
      expect(dismissed).toHaveBeenCalled();
    });

    it('should ignore other animations ending', () => {
      const { host, controller } = create();
      const dismissed = vi.fn();
      host.addEventListener('advanced-camera-card:notification:dismiss', dismissed);
      dispatchAnimationEnd(controller, 'pop-in');
      expect(dismissed).not.toHaveBeenCalled();
    });
  });
});
