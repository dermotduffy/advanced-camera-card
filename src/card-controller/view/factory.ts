import { AdvancedCameraCardView } from '../../config/schema/common/const';
import { ViewDisplayMode } from '../../config/schema/common/display';
import { AdvancedCameraCardConfig } from '../../config/schema/types';
import { localize } from '../../localize/localize';
import { resolveViewName } from '../../view/utils/resolve-default';
import { View, ViewParameters } from '../../view/view';
import {
  doesViewRequireCamera,
  getCameraIDsWithCapabilityForView,
  isViewSupportedByCamera,
} from '../../view/view-support';
import { CardViewAPI } from '../types';
import { applyViewModifiers } from './modifiers';
import { ViewFactoryOptions, ViewIncompatible } from './types';

interface ResolvedViewTarget {
  viewName: AdvancedCameraCardView;
  cameraID: string | null;
}

export class ViewFactory {
  protected _api: CardViewAPI;

  constructor(api: CardViewAPI) {
    this._api = api;
  }

  public getViewDefault(options?: ViewFactoryOptions): View | null {
    const config = this._api.getConfigManager().getConfig();
    if (!config) {
      return null;
    }

    const viewName = this._getDefaultViewName(config);

    return this.getViewByParameters({
      params: {
        ...options?.params,
        view: viewName,
        camera: this._getDefaultCameraID(config, viewName, options),
      },
      baseView: options?.baseView,
    });
  }

  protected _getDefaultViewName = (
    config: AdvancedCameraCardConfig,
  ): AdvancedCameraCardView =>
    resolveViewName(
      config.view.default,
      this._api.getCameraManager(),
      this._api.getFoldersManager(),
    );

  protected _getDefaultCameraID(
    config: AdvancedCameraCardConfig,
    viewName: AdvancedCameraCardView,
    options?: ViewFactoryOptions,
  ): string | null {
    if (options?.params?.camera) {
      return options.params.camera;
    }

    const cameraIDs = [
      ...getCameraIDsWithCapabilityForView(
        viewName,
        this._api.getCameraManager(),
        this._api.getFoldersManager(),
      ),
    ];

    if (
      cameraIDs.length &&
      options?.baseView?.camera &&
      config.view.default_cycle_camera
    ) {
      const currentIndex = cameraIDs.indexOf(options.baseView.camera);
      const targetIndex = currentIndex + 1 >= cameraIDs.length ? 0 : currentIndex + 1;
      return cameraIDs[targetIndex];
    }

    return cameraIDs[0] ?? null;
  }

  public getViewByParameters(options?: ViewFactoryOptions): View | null {
    const config = this._api.getConfigManager().getConfig();
    if (!config) {
      return null;
    }

    let viewName = this._resolveViewName(config, options);
    let cameraID = this._resolveCameraID(viewName, options);
    ({ viewName, cameraID } = this._ensureViewCompatibility(
      viewName,
      cameraID,
      config,
      options,
    ));
    const displayMode = this._resolveDisplayMode(viewName, config, options);

    const viewParameters: ViewParameters = {
      ...options?.params,
      view: viewName,
      camera: cameraID,
      displayMode: displayMode,
    };

    const view = options?.baseView
      ? options.baseView.evolve(viewParameters)
      : new View(viewParameters);

    applyViewModifiers(view, options?.modifiers);

    return view;
  }

  protected _resolveViewName(
    config: AdvancedCameraCardConfig,
    options?: ViewFactoryOptions,
  ): AdvancedCameraCardView {
    if (options?.params?.view !== undefined) {
      return resolveViewName(
        options.params.view,
        this._api.getCameraManager(),
        this._api.getFoldersManager(),
      );
    }
    return options?.baseView?.view ?? this._getDefaultViewName(config);
  }

  protected _resolveCameraID(
    viewName: AdvancedCameraCardView,
    options?: ViewFactoryOptions,
  ): string | null {
    const cameraID = options?.params?.camera ?? options?.baseView?.camera ?? null;
    const allCameraIDs = this._api.getCameraManager().getStore().getCameraIDs();

    if (cameraID && allCameraIDs.has(cameraID)) {
      return cameraID;
    }

    const viewCameraIDs = getCameraIDsWithCapabilityForView(
      viewName,
      this._api.getCameraManager(),
      this._api.getFoldersManager(),
    );

    return viewCameraIDs?.keys().next().value ?? null;
  }

  protected _ensureViewCompatibility(
    viewName: AdvancedCameraCardView,
    cameraID: string | null,
    config: AdvancedCameraCardConfig,
    options?: ViewFactoryOptions,
  ): ResolvedViewTarget {
    if (!cameraID && doesViewRequireCamera(viewName)) {
      return this._handleNoCameraForView(viewName, config, options);
    }

    if (
      cameraID &&
      !isViewSupportedByCamera(
        viewName,
        this._api.getCameraManager(),
        this._api.getFoldersManager(),
        cameraID,
      )
    ) {
      return this._handleUnsupportedView(viewName, cameraID, config, options);
    }

    return { viewName, cameraID };
  }

  protected _handleNoCameraForView(
    viewName: AdvancedCameraCardView,
    config: AdvancedCameraCardConfig,
    options?: ViewFactoryOptions,
  ): ResolvedViewTarget {
    const defaultViewName = this._getDefaultViewName(config);
    if (options?.failSafe && !doesViewRequireCamera(defaultViewName)) {
      return { viewName: defaultViewName, cameraID: null };
    }
    if (options?.failSafe) {
      return {
        viewName: defaultViewName,
        cameraID: this._api.getCameraManager().getStore().getDefaultCameraID(),
      };
    }
    throw new ViewIncompatible(localize('error.no_supported_cameras'), {
      view: viewName,
      camera: null,
      default_view: defaultViewName,
    });
  }

  protected _handleUnsupportedView(
    viewName: AdvancedCameraCardView,
    cameraID: string,
    config: AdvancedCameraCardConfig,
    options?: ViewFactoryOptions,
  ): ResolvedViewTarget {
    const defaultViewName = this._getDefaultViewName(config);
    if (
      options?.failSafe &&
      isViewSupportedByCamera(
        defaultViewName,
        this._api.getCameraManager(),
        this._api.getFoldersManager(),
        cameraID,
      )
    ) {
      return { viewName: defaultViewName, cameraID };
    }

    const capabilities = this._api
      .getCameraManager()
      .getStore()
      .getCamera(cameraID)
      ?.getCapabilities()
      ?.getRawCapabilities();

    throw new ViewIncompatible(localize('error.no_supported_camera'), {
      view: viewName,
      camera: cameraID,
      default_view: defaultViewName,
      ...(capabilities && { camera_capabilities: capabilities }),
    });
  }

  protected _resolveDisplayMode(
    viewName: AdvancedCameraCardView,
    config: AdvancedCameraCardConfig,
    options?: ViewFactoryOptions,
  ): ViewDisplayMode {
    const configuredDisplayMode = this._getConfiguredDisplayMode(viewName, config);

    // Prioritize the configured display mode (if present).
    // See: https://github.com/dermotduffy/advanced-camera-card/issues/1812
    return (
      (viewName !== options?.baseView?.view ? configuredDisplayMode : null) ??
      options?.params?.displayMode ??
      options?.baseView?.displayMode ??
      configuredDisplayMode ??
      'single'
    );
  }

  protected _getConfiguredDisplayMode(
    viewName: AdvancedCameraCardView,
    config: AdvancedCameraCardConfig,
  ): ViewDisplayMode | null {
    switch (viewName) {
      case 'media':
      case 'clip':
      case 'recording':
      case 'snapshot':
        return config.media_viewer.display?.mode ?? null;
      case 'live':
        return config.live.display?.mode ?? null;
      default:
        return null;
    }
  }
}
