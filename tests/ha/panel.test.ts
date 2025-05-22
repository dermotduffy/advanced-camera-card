import { describe, expect, it } from 'vitest';
import { isCardInPanel } from '../../src/ha/panel';
import { createLitElement } from '../test-utils';

// @vitest-environment jsdom
describe('isCardInPanel', () => {
  it('returns true if card is in a ShadowRoot with correct tag name"', () => {
    const card = createLitElement();

    const parent = document.createElement('HUI-PANEL-VIEW');
    parent.attachShadow({ mode: 'open' });
    parent.shadowRoot?.append(card);

    expect(isCardInPanel(card)).toBe(true);
  });

  it('returns false if card is in a ShadowRoot with incorrect tag name"', () => {
    const card = createLitElement();

    const parent = document.createElement('ANOTHER-VIEW');
    parent.attachShadow({ mode: 'open' });
    parent.shadowRoot?.append(card);

    expect(isCardInPanel(card)).toBe(false);
  });
});
