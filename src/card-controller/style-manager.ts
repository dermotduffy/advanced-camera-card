import type { StyleInfo } from 'lit/directives/style-map.js';

import { configDefaults, type AdvancedCameraCardConfig } from '../config/schema/types';
import type { ThemeConfig, ThemeName } from '../config/schema/view';
import {
  aspectRatioToStyle,
  setOrRemoveAttribute,
  setOrRemoveStyleProperty,
} from '../utils/basic';
import type { View } from '../view/view';
import type { CardStyleAPI } from './types';

export class StyleManager {
  private _api: CardStyleAPI;

  constructor(api: CardStyleAPI) {
    this._api = api;
  }

  public setExpandedMode(): void {
    const card = this._api.getCardElementManager().getElement();
    const view = this._api.getViewManager().getView();

    // A grid shows several media items at once, so no single item describes it.
    const isSingleMediaView = !view?.isGrid() && !!view?.isAnyMediaView();

    // When a new media loads, set the aspect ratio for when the card is
    // expanded/popped-up. This is based exclusively on last media content,
    // as dimension configuration does not apply in fullscreen or expanded mode.
    const lastKnown = this._api.getMediaLoadedInfoManager().getLastKnown();
    card.style.setProperty(
      '--advanced-camera-card-expand-aspect-ratio',
      isSingleMediaView && lastKnown
        ? `${lastKnown.width} / ${lastKnown.height}`
        : 'unset',
    );
    // Non-media and grids have no intrinsic width, so the dialog is asked to
    // use all the width available.
    card.style.setProperty(
      '--advanced-camera-card-expand-width',
      isSingleMediaView ? 'none' : 'var(--advanced-camera-card-expand-max-width)',
    );
    // Non-media (e.g. the gallery) has no intrinsic height and fills the
    // dialog. Media sizes the dialog to itself, up to the maximum height. A
    // grid is media: it is as tall as the items it packs.
    card.style.setProperty(
      '--advanced-camera-card-expand-height',
      view?.isAnyMediaView() ? 'none' : 'var(--advanced-camera-card-expand-max-height)',
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

  private _getThemeNames(themeConfig: ThemeConfig): ThemeName[] | null {
    return themeConfig.themes.length
      ? themeConfig.themes
      : configDefaults.view.theme.themes;
  }

  private _setDimmable(): void {
    const config = this._api.getConfigManager().getConfig();
    this._api
      .getCardElementManager()
      .getElement()
      .toggleAttribute('dimmable', !!config?.view.dim);
  }

  private _setMinMaxHeight(): void {
    const config = this._api.getConfigManager().getConfig();
    if (config) {
      const card = this._api.getCardElementManager().getElement();
      card.style.setProperty('--advanced-camera-card-height', config.dimensions.height);
    }
  }

  private _setPerformance(): void {
    const STYLE_DISABLE_MAP = {
      box_shadow: {
        cssKey: '--advanced-camera-card-box-shadow-override',
        value: 'none',
      },
      border_radius: {
        cssKey: '--advanced-camera-card-border-radius-override',
        value: '0px',
      },
    };
    const element = this._api.getCardElementManager().getElement();
    const performance = this._api.getConfigManager().getCardWideConfig()?.performance;

    const styles = performance?.style ?? {};
    for (const configKey of Object.keys(styles)) {
      const mapping = STYLE_DISABLE_MAP[configKey];
      setOrRemoveStyleProperty(
        element,
        !styles[configKey],
        mapping.cssKey,
        mapping.value,
      );
    }
  }

  private _isAspectRatioEnforced(
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
