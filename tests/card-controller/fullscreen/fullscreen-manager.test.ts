import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { FullscreenProviderFactory } from '../../../src/card-controller/fullscreen/factory';
import { FullscreenManager } from '../../../src/card-controller/fullscreen/fullscreen-manager';
import type { FullscreenProvider } from '../../../src/card-controller/fullscreen/types';
import { createCardAPI } from '../../test-utils';

vi.mock('../../../src/card-controller/fullscreen/factory');

describe('FullscreenManager', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize', () => {
    const api = createCardAPI();
    const manager = new FullscreenManager(api, mock<FullscreenProvider>());

    manager.initialize();
    expect(api.getConditionStateManager().setState).toBeCalledWith({
      fullscreen: false,
    });
  });

  it('should correctly determine whether in fullscreen', () => {
    const provider = mock<FullscreenProvider>();
    const manager = new FullscreenManager(createCardAPI(), provider);

    provider.isInFullscreen.mockReturnValue(true);

    expect(manager.isInFullscreen()).toBeTruthy();

    provider.isInFullscreen.mockReturnValue(false);

    expect(manager.isInFullscreen()).toBeFalsy();
  });

  describe('describe toggle fullscreen', () => {
    it.each([
      [true, false],
      [false, true],
    ])('%s -> %s', async (state: boolean, expected: boolean) => {
      const provider = mock<FullscreenProvider>();
      provider.isInFullscreen.mockReturnValue(state);

      const manager = new FullscreenManager(createCardAPI(), provider);

      manager.toggleFullscreen();

      expect(provider.setFullscreen).toBeCalledWith(expected);
    });
  });

  describe('describe set fullscreen', () => {
    it.each([[true], [false]])('%s', async (fullscreen: boolean) => {
      const provider = mock<FullscreenProvider>();
      const manager = new FullscreenManager(createCardAPI(), provider);

      manager.setFullscreen(fullscreen);

      expect(provider.setFullscreen).toBeCalledWith(fullscreen);
    });
  });

  it('should connect', () => {
    const provider = mock<FullscreenProvider>();
    const manager = new FullscreenManager(createCardAPI(), provider);

    manager.connect();

    expect(provider.connect).toBeCalled();
  });

  it('should disconnect', () => {
    const provider = mock<FullscreenProvider>();
    const manager = new FullscreenManager(createCardAPI(), provider);

    manager.disconnect();

    expect(provider.disconnect).toBeCalled();
  });

  describe('should confirm whether fullscreen is supported', () => {
    beforeEach(() => {
      vi.stubGlobal('navigator', { userAgent: 'foo' });
    });
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('when being casted', () => {
      vi.stubGlobal('navigator', { userAgent: 'CrKey/' });

      const api = createCardAPI();
      const provider = mock<FullscreenProvider>();
      provider.isSupported.mockReturnValue(true);

      const manager = new FullscreenManager(api, provider);

      expect(manager.isSupported()).toBeFalsy();
    });

    describe('should return provider support', () => {
      it.each([[true], [false]])('%s', async (support: boolean) => {
        const api = createCardAPI();
        const provider = mock<FullscreenProvider>();
        provider.isSupported.mockReturnValue(support);
        const manager = new FullscreenManager(api, provider);

        expect(manager.isSupported()).toBe(support);
      });
    });

    it('without a provider', () => {
      vi.mocked(FullscreenProviderFactory).create.mockReturnValue(null);

      const manager = new FullscreenManager(createCardAPI());

      expect(manager.isSupported()).toBeFalsy();
    });
  });

  describe('should handle state change', () => {
    it.each([[true], [false]])('%s', async (fullscreen: boolean) => {
      const api = createCardAPI();

      const provider = mock<FullscreenProvider>();
      vi.mocked(FullscreenProviderFactory.create).mockReturnValue(provider);

      new FullscreenManager(api);

      const handler = vi.mocked(FullscreenProviderFactory.create).mock.calls[0][1];

      provider.isInFullscreen.mockReturnValue(fullscreen);

      handler();

      expect(api.getConditionStateManager().setState).toBeCalledWith({
        fullscreen: fullscreen,
      });
    });
  });

  it('should create provider from factory', () => {
    const api = createCardAPI();

    new FullscreenManager(api);

    expect(FullscreenProviderFactory.create).toBeCalledWith(api, expect.anything());
  });
});
