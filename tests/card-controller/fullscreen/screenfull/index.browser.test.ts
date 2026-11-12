import { afterEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { userEvent } from 'vitest/browser';

import type { CardElementManager } from '../../../../src/card-controller/card-element-manager';
import { ScreenfullFullScreenProvider } from '../../../../src/card-controller/fullscreen/screenfull';
import type { CardFullscreenAPI } from '../../../../src/card-controller/types';
import { sharedDocumentVisibility } from '../../../../src/utils/document-visibility';

const createProvider = (element: HTMLElement): ScreenfullFullScreenProvider => {
  const cardElementManager = mock<CardElementManager>();
  cardElementManager.getElement.mockReturnValue(element);
  const api = mock<CardFullscreenAPI>();
  api.getCardElementManager.mockReturnValue(cardElementManager);
  return new ScreenfullFullScreenProvider(api, vi.fn());
};

const setHidden = (): void => {
  Object.defineProperty(document, 'visibilityState', {
    value: 'hidden',
    configurable: true,
  });
};

describe('ScreenfullFullScreenProvider', () => {
  afterEach(async () => {
    // Removes the own property `setHidden` defines, restoring the browser's.
    Reflect.deleteProperty(document, 'visibilityState');
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
    document.body.replaceChildren();
  });

  it('should count a hidden page as visible only until a real fullscreen request settles', async () => {
    const element = document.createElement('div');
    document.body.append(element);
    const provider = createProvider(element);

    const entered = new Promise<void>((resolve) =>
      document.addEventListener('fullscreenchange', () => resolve(), { once: true }),
    );

    let visibleWhilePending: boolean | null = null;
    const button = document.createElement('button');
    button.textContent = 'fullscreen';
    button.addEventListener('click', () => {
      provider.setFullscreen(true);
      setHidden();
      visibleWhilePending = sharedDocumentVisibility.isVisible();
    });
    document.body.append(button);

    // A real click: requesting fullscreen needs a user gesture.
    await userEvent.click(button);
    await entered;
    await vi.waitFor(() => expect(sharedDocumentVisibility.isVisible()).toBe(false));

    expect(document.fullscreenElement).toBe(element);
    expect(visibleWhilePending).toBe(true);
  });
});
