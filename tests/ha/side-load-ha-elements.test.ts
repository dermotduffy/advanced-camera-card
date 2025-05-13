import { LitElement } from 'lit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sideLoadHomeAssistantElements } from '../../src/ha/side-load-ha-elements';

describe('sideLoadHomeAssistantElements', () => {
  beforeEach(() => {
    vi.stubGlobal('customElements', {
      get: vi.fn(),
      whenDefined: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns true if all elements already registered', async () => {
    vi.mocked(customElements.get).mockResolvedValue(LitElement);
    expect(await sideLoadHomeAssistantElements()).toBe(true);
  });

  it('returns false when the picture glance card cannot be found', async () => {
    vi.mocked(customElements.get).mockReturnValue(undefined);

    const createCardElement = vi.fn();
    vi.stubGlobal('window', {
      loadCardHelpers: vi.fn().mockReturnValue({
        createCardElement,
      }),
    });

    expect(await sideLoadHomeAssistantElements()).toBe(false);
  });

  it('returns true when elements are loaded', async () => {
    vi.mocked(customElements.get).mockImplementation((name: string) => {
      if (name === 'hui-picture-glance-card') {
        const result = LitElement;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (result as any).getConfigElement = vi.fn();
        return LitElement;
      }
      return undefined;
    });

    const createCardElement = vi.fn();
    vi.stubGlobal('window', {
      loadCardHelpers: vi.fn().mockReturnValue({
        createCardElement,
      }),
    });

    expect(await sideLoadHomeAssistantElements()).toBe(true);

    expect(customElements.whenDefined).toHaveBeenCalledWith('hui-picture-glance-card');
    expect(createCardElement).toHaveBeenCalledWith({
      type: 'picture-glance',
      entities: [],
      camera_image: 'dummy-to-load-editor-components',
    });
  });
});
