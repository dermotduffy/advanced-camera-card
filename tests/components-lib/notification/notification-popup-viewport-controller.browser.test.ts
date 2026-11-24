import type { ReactiveControllerHost } from 'lit';
import { describe, expect, it, onTestFinished } from 'vitest';

import { NotificationPopupViewportController } from '../../../src/components-lib/notification/notification-popup-viewport-controller';

describe('NotificationPopupViewportController', () => {
  it('should convert the inset to the container pixels when an ancestor scales it', () => {
    const scaler = document.createElement('div');
    scaler.style.transform = 'scale(0.5)';
    scaler.style.transformOrigin = 'top left';

    // Twice the window height once scaled, so half of it is below the window.
    const container = document.createElement('div');
    container.style.height = `${window.innerHeight * 4}px`;
    scaler.append(container);
    document.body.append(scaler);
    onTestFinished(() => scaler.remove());

    const host: ReactiveControllerHost & HTMLElement = Object.assign(
      document.createElement('div'),
      {
        addController: () => undefined,
        removeController: () => undefined,
        requestUpdate: () => undefined,
        updateComplete: Promise.resolve(true),
      },
    );
    container.attachShadow({ mode: 'open' }).append(host);

    const controller = new NotificationPopupViewportController(host);
    controller.hostConnected();
    onTestFinished(() => controller.hostDisconnected());

    const belowWindow = container.getBoundingClientRect().bottom - window.innerHeight;
    expect(belowWindow).toBeGreaterThan(0);
    expect(host.style.getPropertyValue('--notification-popup-inset-bottom')).toBe(
      `${belowWindow * 2}px`,
    );
  });
});
