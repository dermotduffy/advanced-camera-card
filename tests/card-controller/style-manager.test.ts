import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StyleManager } from '../../src/card-controller/style-manager';
import { AdvancedCameraCardView } from '../../src/config/schema/common/const';
import { ThemeName } from '../../src/config/schema/view';
import { createCardAPI, createConfig, createView } from '../test-utils';

// @vitest-environment jsdom
describe('StyleManager', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('should set dimmable', () => {
    it('should be dimmable when dim is true', () => {
      const api = createCardAPI();
      const element = document.createElement('div');
      vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          view: {
            dim: true,
          },
        }),
      );
      const manager = new StyleManager(api);

      manager.updateFromConfig();

      expect(element.getAttribute('dimmable')).not.toBeNull();
    });

    it('should not be dimmable when dim is false', () => {
      const api = createCardAPI();
      const element = document.createElement('div');
      vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          view: {
            dim: false,
          },
        }),
      );
      const manager = new StyleManager(api);

      manager.updateFromConfig();

      expect(element.getAttribute('dimmable')).toBeNull();
    });
  });

  describe('should set expanded mode', () => {
    it('with no view or known media', () => {
      const api = createCardAPI();
      const element = document.createElement('div');
      vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
      vi.mocked(api.getMediaLoadedInfoManager().getLastKnown).mockReturnValue(null);
      const manager = new StyleManager(api);

      manager.setExpandedMode();

      expect(
        element.style.getPropertyValue('--advanced-camera-card-expand-aspect-ratio'),
      ).toBe('unset');
      expect(element.style.getPropertyValue('--advanced-camera-card-expand-width')).toBe(
        'var(--advanced-camera-card-expand-max-width)',
      );
      expect(
        element.style.getPropertyValue('--advanced-camera-card-expand-height'),
      ).toBe('var(--advanced-camera-card-expand-max-height)');
    });

    it('with view but without media', () => {
      const api = createCardAPI();
      const element = document.createElement('div');
      vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
      const view = createView({ view: 'media', displayMode: 'single' });
      vi.mocked(api.getViewManager().getView).mockReturnValue(view);
      vi.mocked(api.getMediaLoadedInfoManager().getLastKnown).mockReturnValue(null);
      const manager = new StyleManager(api);

      manager.setExpandedMode();

      expect(
        element.style.getPropertyValue('--advanced-camera-card-expand-aspect-ratio'),
      ).toBe('unset');
      expect(element.style.getPropertyValue('--advanced-camera-card-expand-width')).toBe(
        'none',
      );
      expect(
        element.style.getPropertyValue('--advanced-camera-card-expand-height'),
      ).toBe('none');
    });

    it('with view and media', () => {
      const api = createCardAPI();
      const element = document.createElement('div');
      vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
      const view = createView({ view: 'media', displayMode: 'single' });
      vi.mocked(api.getViewManager().getView).mockReturnValue(view);
      vi.mocked(api.getMediaLoadedInfoManager().getLastKnown).mockReturnValue({
        width: 800,
        height: 600,
      });
      const manager = new StyleManager(api);

      manager.setExpandedMode();

      expect(
        element.style.getPropertyValue('--advanced-camera-card-expand-aspect-ratio'),
      ).toBe('800 / 600');
      expect(element.style.getPropertyValue('--advanced-camera-card-expand-width')).toBe(
        'none',
      );
      expect(
        element.style.getPropertyValue('--advanced-camera-card-expand-height'),
      ).toBe('none');
    });

    it('with view and grid display mode', () => {
      const api = createCardAPI();
      const element = document.createElement('div');
      vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
      const view = createView({ view: 'media', displayMode: 'grid' });
      vi.mocked(api.getViewManager().getView).mockReturnValue(view);
      vi.mocked(api.getMediaLoadedInfoManager().getLastKnown).mockReturnValue({
        width: 800,
        height: 600,
      });
      const manager = new StyleManager(api);

      manager.setExpandedMode();

      expect(
        element.style.getPropertyValue('--advanced-camera-card-expand-aspect-ratio'),
      ).toBe('800 / 600');
      expect(element.style.getPropertyValue('--advanced-camera-card-expand-width')).toBe(
        'var(--advanced-camera-card-expand-max-width)',
      );
      expect(
        element.style.getPropertyValue('--advanced-camera-card-expand-height'),
      ).toBe('var(--advanced-camera-card-expand-max-height)');
    });
  });

  describe('should set min and max height', () => {
    it('without a config', () => {
      const api = createCardAPI();
      const element = document.createElement('div');
      vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
      const manager = new StyleManager(api);

      manager.updateFromConfig();

      expect(
        element.style.getPropertyValue('--advanced-camera-card-max-height'),
      ).toBeFalsy();
      expect(
        element.style.getPropertyValue('--advanced-camera-card-expand-height'),
      ).toBeFalsy();
    });

    it('with a config', () => {
      const api = createCardAPI();
      const element = document.createElement('div');
      vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          dimensions: {
            height: '800px',
          },
        }),
      );
      const manager = new StyleManager(api);

      manager.updateFromConfig();

      expect(element.style.getPropertyValue('--advanced-camera-card-height')).toBe(
        '800px',
      );
    });
  });

  describe('should set performance', () => {
    it('no styles set', () => {
      const api = createCardAPI();
      const element = document.createElement('div');
      vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
      vi.mocked(api.getConfigManager().getCardWideConfig).mockReturnValue({});
      const manager = new StyleManager(api);

      manager.updateFromConfig();

      expect(
        element.style.getPropertyValue('--advanced-camera-card-css-box-shadow'),
      ).toBeFalsy();
      expect(
        element.style.getPropertyValue('--advanced-camera-card-css-border-radius'),
      ).toBeFalsy();
    });

    it('valid styles set', () => {
      const api = createCardAPI();
      const element = document.createElement('div');
      vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
      vi.mocked(api.getConfigManager().getCardWideConfig).mockReturnValue(
        createConfig({
          performance: {
            style: {
              box_shadow: false,
              border_radius: true,
            },
          },
        }),
      );
      const manager = new StyleManager(api);

      manager.updateFromConfig();

      expect(
        element.style.getPropertyValue('--advanced-camera-card-css-box-shadow'),
      ).toEqual('none');
      expect(
        element.style.getPropertyValue('--advanced-camera-card-css-border-radius'),
      ).toBeFalsy();
    });
  });

  describe('getAspectRatioStyle', () => {
    it('without config or view', () => {
      const api = createCardAPI();
      const manager = new StyleManager(api);
      expect(manager.getAspectRatioStyle()).toEqual({ 'aspect-ratio': '16 / 9' });
    });

    it('should be auto with unconstrained aspect ratio', () => {
      const api = createCardAPI();
      const view = createView({ view: 'media' });
      vi.mocked(api.getViewManager().getView).mockReturnValue(view);
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          dimensions: {
            aspect_ratio_mode: 'unconstrained',
          },
        }),
      );
      const manager = new StyleManager(api);
      expect(manager.getAspectRatioStyle()).toEqual({ 'aspect-ratio': 'auto' });
    });

    it('should be auto in fullscreen', () => {
      const api = createCardAPI();
      const view = createView({ view: 'media' });
      vi.mocked(api.getViewManager().getView).mockReturnValue(view);
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());
      vi.mocked(api.getFullscreenManager().isInFullscreen).mockReturnValue(true);
      const manager = new StyleManager(api);

      expect(manager.getAspectRatioStyle()).toEqual({ 'aspect-ratio': 'auto' });
    });

    it('should be auto when expanded', () => {
      const api = createCardAPI();
      const view = createView({ view: 'media' });
      vi.mocked(api.getViewManager().getView).mockReturnValue(view);
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());
      vi.mocked(api.getExpandManager().isExpanded).mockReturnValue(true);
      const manager = new StyleManager(api);

      expect(manager.getAspectRatioStyle()).toEqual({ 'aspect-ratio': 'auto' });
    });

    it('should be auto when there is yet to be a view', () => {
      const api = createCardAPI();
      vi.mocked(api.getViewManager().getView).mockReturnValue(null);
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());
      const manager = new StyleManager(api);

      expect(manager.getAspectRatioStyle()).toEqual({ 'aspect-ratio': 'auto' });
    });

    describe('should be auto when dynamic in certain views', () => {
      it.each([
        ['clip' as const],
        ['diagnostics' as const],
        ['image' as const],
        ['media' as const],
        ['live' as const],
        ['recording' as const],
        ['snapshot' as const],
        ['timeline' as const],
      ])('%s', (viewName: AdvancedCameraCardView) => {
        const api = createCardAPI();
        const view = createView({ view: viewName });
        vi.mocked(api.getViewManager().getView).mockReturnValue(view);
        vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
          createConfig({
            dimensions: {
              aspect_ratio_mode: 'dynamic',
            },
          }),
        );
        const manager = new StyleManager(api);

        expect(manager.getAspectRatioStyle()).toEqual({ 'aspect-ratio': 'auto' });
      });
    });

    describe('should be enforced when dynamic in certain views', () => {
      it.each([['clips' as const], ['recordings' as const], ['snapshots' as const]])(
        '%s',
        (viewName: AdvancedCameraCardView) => {
          const api = createCardAPI();
          const view = createView({ view: viewName });
          vi.mocked(api.getViewManager().getView).mockReturnValue(view);
          vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
            createConfig({
              dimensions: {
                aspect_ratio_mode: 'dynamic',
              },
            }),
          );
          const manager = new StyleManager(api);

          expect(manager.getAspectRatioStyle()).toEqual({ 'aspect-ratio': '16 / 9' });
        },
      );
    });

    describe('should use media dimensions in dynamic', () => {
      it.each([['clips' as const], ['recordings' as const], ['snapshots' as const]])(
        '%s',
        (viewName: AdvancedCameraCardView) => {
          const api = createCardAPI();
          const view = createView({ view: viewName });
          vi.mocked(api.getViewManager().getView).mockReturnValue(view);
          vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
            createConfig({
              dimensions: {
                aspect_ratio_mode: 'dynamic',
              },
            }),
          );
          vi.mocked(api.getMediaLoadedInfoManager().getLastKnown).mockReturnValue({
            width: 800,
            height: 600,
          });
          const manager = new StyleManager(api);

          expect(manager.getAspectRatioStyle()).toEqual({
            'aspect-ratio': '800 / 600',
          });
        },
      );
    });

    it('should respect default aspect ratio', () => {
      const api = createCardAPI();
      const view = createView({ view: 'clips' });
      vi.mocked(api.getViewManager().getView).mockReturnValue(view);
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          dimensions: {
            aspect_ratio_mode: 'dynamic',
            aspect_ratio: '4:3',
          },
        }),
      );
      const manager = new StyleManager(api);

      expect(manager.getAspectRatioStyle()).toEqual({ 'aspect-ratio': '4 / 3' });
    });
  });

  describe('should apply themes', () => {
    it('should not apply themes without a config', () => {
      const api = createCardAPI();
      const element = document.createElement('div');
      vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);

      const manager = new StyleManager(api);

      manager.applyTheme();

      expect(element.getAttribute('themes')).toBeNull();
    });

    describe('should apply named theme', () => {
      it.each([
        ['light' as const],
        ['dark' as const],
        ['traditional' as const],
        ['ha' as const],
      ])('%s', (theme: ThemeName) => {
        const api = createCardAPI();
        const element = document.createElement('div');
        vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
        vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
          createConfig({
            view: {
              theme: {
                themes: [theme],
              },
            },
          }),
        );

        const manager = new StyleManager(api);

        manager.applyTheme();

        expect(element.getAttribute('themes')).toBe(theme);
      });
    });

    it('should apply multiple themes', () => {
      const api = createCardAPI();
      const element = document.createElement('div');
      vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          view: {
            theme: {
              themes: ['light', 'traditional'],
            },
          },
        }),
      );

      const manager = new StyleManager(api);

      manager.applyTheme();

      expect(element.getAttribute('themes')).toBe('light traditional');
    });

    it('should treat empty themes list as default', () => {
      const api = createCardAPI();
      const element = document.createElement('div');
      vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          view: {
            theme: {
              themes: [],
            },
          },
        }),
      );

      const manager = new StyleManager(api);

      manager.applyTheme();

      expect(element.getAttribute('themes')).toBe('traditional');
    });

    it('should apply overrides', () => {
      const api = createCardAPI();
      const element = document.createElement('div');
      vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          view: {
            theme: {
              overrides: {
                '--test-key': 'test-value',
              },
            },
          },
        }),
      );

      const manager = new StyleManager(api);

      manager.applyTheme();

      expect(element.style.getPropertyValue('--test-key')).toBe('test-value');
    });
  });
});
