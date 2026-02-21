import { describe, expect, it } from 'vitest';
import { isCardInEditor } from '../../src/ha/editor';
import { createLitElement } from '../test-utils';

// @vitest-environment jsdom
describe('isCardInEditor', () => {
  it('returns true if card is in a ShadowRoot with correct tag name', () => {
    const card = createLitElement();

    const parent = document.createElement('hui-card-preview');
    parent.attachShadow({ mode: 'open' });
    parent.shadowRoot?.append(card);

    expect(isCardInEditor(card)).toBe(true);
  });

  it('returns false if card is in a ShadowRoot with incorrect tag name', () => {
    const card = createLitElement();

    const parent = document.createElement('another-view');
    parent.attachShadow({ mode: 'open' });
    parent.shadowRoot?.append(card);

    expect(isCardInEditor(card)).toBe(false);
  });

  it('returns false if card is not in a ShadowRoot', () => {
    const card = createLitElement();
    expect(isCardInEditor(card)).toBe(false);
  });
});
