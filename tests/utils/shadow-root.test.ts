import { describe, expect, it } from 'vitest';

import { getShadowRootHost } from '../../src/utils/shadow-root';

// @vitest-environment jsdom
describe('getShadowRootHost', () => {
  it('should return the host of the shadow root the element lives in', () => {
    const host = document.createElement('div');
    host.attachShadow({ mode: 'open' });

    const element = document.createElement('span');
    host.shadowRoot?.append(element);

    expect(getShadowRootHost(element)).toBe(host);
  });

  it('should return null for an element in the light DOM', () => {
    const element = document.createElement('span');
    document.body.append(element);
    try {
      expect(getShadowRootHost(element)).toBeNull();
    } finally {
      element.remove();
    }
  });

  it('should return null for an element that is not connected', () => {
    expect(getShadowRootHost(document.createElement('span'))).toBeNull();
  });
});
