import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import { FULLSCREEN_MAX_HEIGHT_PROPERTY } from '../../src/components-lib/media-height-controller';
import cardStyle from '../../src/scss/card.scss?inline';

// A host with the card's own styles, holding a child capped the way
// MediaHeightController caps the carousels.
const mount = (): { host: HTMLElement; capped: HTMLElement } => {
  const host = document.createElement('div');
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = cardStyle;
  const haCard = document.createElement('div');
  haCard.id = 'ha-card';
  const capped = document.createElement('div');
  capped.style.maxHeight = `var(${FULLSCREEN_MAX_HEIGHT_PROPERTY}, 100px)`;
  haCard.append(capped);
  root.append(style, haCard);
  document.body.append(host);
  return { host, capped };
};

afterEach(async () => {
  if (document.fullscreenElement) {
    await document.exitFullscreen();
  }
  document.body.replaceChildren();
});

describe('card fullscreen styles', () => {
  it('should cap the media height outside fullscreen', () => {
    const { capped } = mount();
    expect(getComputedStyle(capped).maxHeight).toBe('100px');
  });

  it('should lift the cap as soon as the card is fullscreen', async () => {
    const { host, capped } = mount();
    const button = document.createElement('button');
    button.textContent = 'fullscreen';
    let request: Promise<void> | null = null;
    button.addEventListener('click', () => {
      request = host.requestFullscreen();
    });
    document.body.append(button);

    // A real click: requesting fullscreen needs a user gesture.
    await userEvent.click(button);
    await request;

    expect(document.fullscreenElement).toBe(host);
    expect(getComputedStyle(capped).maxHeight).toBe('none');
  });
});
