import { StyleInfo } from 'lit/directives/style-map';
import { AdvancedCameraCardConfig, configDefaults } from '../config/schema/types';
import { ThemeConfig, ThemeName } from '../config/schema/view';
import { aspectRatioToStyle, setOrRemoveAttribute } from '../utils/basic';
import { View } from '../view/view';
import { CardStyleAPI } from './types';

export class StyleManager {
  protected _api: CardStyleAPI;

  constructor(api: CardStyleAPI) {
    this._api = api;
  }

  public setExpandedMode(): void {
    const card = this._api.getCardElementManager().getElement();
    const view = this._api.getViewManager().getView();

    // When a new media loads, set the aspect ratio for when the card is
    // expanded/popped-up. This is based exclusively on last media content,
    // as dimension configuration does not apply in fullscreen or expanded mode.
    const lastKnown = this._api.getMediaLoadedInfoManager().getLastKnown();
    card.style.setProperty(
      '--advanced-camera-card-expand-aspect-ratio',
      view?.isAnyMediaView() && lastKnown
        ? `${lastKnown.width} / ${lastKnown.height}`
        : 'unset',
    );
    // Non-media may have no intrinsic dimensions (or multiple media items in a
    // grid) and so we need to explicit request the dialog to use all available
    // space.
    const isGrid = view?.isGrid();
    card.style.setProperty(
      '--advanced-camera-card-expand-width',
      !isGrid && view?.isAnyMediaView()
        ? 'none'
        : 'var(--advanced-camera-card-expand-max-width)',
    );
    card.style.setProperty(
      '--advanced-camera-card-expand-height',
      !isGrid && view?.isAnyMediaView()
        ? 'none'
        : 'var(--advanced-camera-card-expand-max-height)',
    );
  }

  public updateFromConfig(): void {
    this.applyTheme();
    this._setMinMaxHeight();
    this._setPerformance();
    this._setDimmable();
  }

  public applyTheme() {
    const themeConfig = this._api.getConfigManager().getConfig()?.view.theme;
    if (!themeConfig) {
      return;
    }

    const element = this._api.getCardElementManager().getElement();
    const themes = this._getThemeNames(themeConfig);

    setOrRemoveAttribute(element, !!themes, 'themes', themes?.join(' '));

    if (themeConfig.overrides) {
      for (const [key, value] of Object.entries(themeConfig.overrides)) {
        element.style.setProperty(key, value);
      }
    }
  }

  protected _getThemeNames(themeConfig: ThemeConfig): ThemeName[] | null {
    return themeConfig.themes.length
      ? themeConfig.themes
      : configDefaults.view.theme.themes;
  }

  protected _setDimmable(): void {
    const config = this._api.getConfigManager().getConfig();
    setOrRemoveAttribute(
      this._api.getCardElementManager().getElement(),
      !!config?.view.dim,
      'dimmable',
    );
  }

  protected _setMinMaxHeight(): void {
    const config = this._api.getConfigManager().getConfig();
    if (config) {
      const card = this._api.getCardElementManager().getElement();
      card.style.setProperty('--advanced-camera-card-height', config.dimensions.height);
    }
  }

  protected _setPerformance(): void {
    const STYLE_DISABLE_MAP = {
      box_shadow: 'none',
      border_radius: '0px',
    };
    const element = this._api.getCardElementManager().getElement();
    const performance = this._api.getConfigManager().getCardWideConfig()?.performance;

    const styles = performance?.style ?? {};
    for (const configKey of Object.keys(styles)) {
      const CSSKey = `--advanced-camera-card-css-${configKey.replaceAll('_', '-')}`;
      if (styles[configKey] === false) {
        element.style.setProperty(CSSKey, STYLE_DISABLE_MAP[configKey]);
      } else {
        element.style.removeProperty(CSSKey);
      }
    }
  }

  protected _isAspectRatioEnforced(
    config: AdvancedCameraCardConfig,
    view?: View | null,
  ): boolean {
    const aspectRatioMode = config.dimensions.aspect_ratio_mode;

    // Do not artifically constrain aspect ratio if:
    // - It's fullscreen.
    // - It's in expanded mode.
    // - Aspect ratio enforcement is disabled.
    // - Aspect ratio enforcement is dynamic and it's a media view (i.e. not the
    //   gallery) or diagnostics / timeline.
    return !(
      this._api.getFullscreenManager().isInFullscreen() ||
      this._api.getExpandManager().isExpanded() ||
      aspectRatioMode === 'unconstrained' ||
      (aspectRatioMode === 'dynamic' &&
        (!view ||
          view?.isAnyMediaView() ||
          view?.is('timeline') ||
          view?.is('diagnostics')))
    );
  }

  /**
   * Get the aspect ratio padding required to enforce the aspect ratio (if it is
   * required).
   * @returns A padding percentage.
   */
  public getAspectRatioStyle(): StyleInfo {
    const config = this._api.getConfigManager().getConfig();
    const view = this._api.getViewManager().getView();

    if (config) {
      if (!this._isAspectRatioEnforced(config, view)) {
        return aspectRatioToStyle();
      }

      const aspectRatioMode = config.dimensions.aspect_ratio_mode;

      const lastKnown = this._api.getMediaLoadedInfoManager().getLastKnown();
      if (lastKnown && aspectRatioMode === 'dynamic') {
        return aspectRatioToStyle({ ratio: [lastKnown.width, lastKnown.height] });
      }
      return aspectRatioToStyle({ ratio: config.dimensions.aspect_ratio });
    }
    return aspectRatioToStyle({ defaultStatic: true });
  }
}
