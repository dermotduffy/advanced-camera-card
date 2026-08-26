import type { AdvancedCameraCardView } from '../../config/schema/common/const';
import type { ViewDisplayMode } from '../../config/schema/common/display';
import type { AdvancedCameraCardConfig } from '../../config/schema/types';
import { resolveViewName } from '../../view/utils/resolve-default';
import { View, type ViewParameters } from '../../view/view';
import {
  doesViewRequireCamera,
  getCameraIDsSupportingView,
  getCameraIDsWithCapabilityForView,
} from '../../view/view-support';
import type { CardViewAPI } from '../types';
import { applyViewModifiers } from './modifiers';
import { ViewDeferred, ViewIncompatible, type ViewFactoryOptions } from './types';

interface ResolvedViewTarget {
  viewName: AdvancedCameraCardView;
  cameraID: string | null;
}

export class ViewFactory {
  private _api: CardViewAPI;

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

  private _getDefaultViewName = (
    config: AdvancedCameraCardConfig,
  ): AdvancedCameraCardView =>
    resolveViewName(
      config.view.default,
      this._api.getCameraManager(),
      this._api.getFoldersManager(),
    );

  private _getDefaultCameraID(
    config: AdvancedCameraCardConfig,
    viewName: AdvancedCameraCardView,
    options?: ViewFactoryOptions,
  ): string | null {
    if (options?.params?.camera) {
      return options.params.camera;
    }

    const isCycling = !!options?.baseView?.camera && config.view.default_cycle_camera;
    const cameraIDs = this._getCandidateCameraIDs(viewName, isCycling);

    if (cameraIDs.length && isCycling && options?.baseView?.camera) {
      const currentIndex = cameraIDs.indexOf(options.baseView.camera);
      const targetIndex = currentIndex + 1 >= cameraIDs.length ? 0 : currentIndex + 1;
      return cameraIDs[targetIndex];
    }

    return cameraIDs[0] ?? null;
  }

  // Deterministic: config order, not initialization order. When `all` is
  // false, stops at the first camera that can serve the view.
  private _getCandidateCameraIDs(
    viewName: AdvancedCameraCardView,
    all: boolean,
  ): string[] {
    const cameraManager = this._api.getCameraManager();
    const candidateCameraIDs: string[] = [];

    for (const cameraID of cameraManager.getStore().getCameraIDs()) {
      const candidates = getCameraIDsSupportingView(
        viewName,
        cameraManager,
        this._api.getFoldersManager(),
        cameraID,
      );

      if (candidates === null) {
        throw new ViewDeferred({ view: viewName });
      }

      if (!candidates.size) {
        continue;
      }

      candidateCameraIDs.push(...candidates);

      if (!all) {
        break;
      }
    }

    return candidateCameraIDs;
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

  private _resolveViewName(
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

  private _resolveCameraID(
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

  private _ensureViewCompatibility(
    viewName: AdvancedCameraCardView,
    cameraID: string | null,
    config: AdvancedCameraCardConfig,
    options?: ViewFactoryOptions,
  ): ResolvedViewTarget {
    if (!cameraID && doesViewRequireCamera(viewName)) {
      return this._handleNoCameraForView(viewName, config, options);
    }

    if (cameraID) {
      const supported = getCameraIDsSupportingView(
        viewName,
        this._api.getCameraManager(),
        this._api.getFoldersManager(),
        cameraID,
      );
      if (!supported?.size) {
        return this._handleUnsupportedView(
          viewName,
          cameraID,
          config,
          options,
          supported,
        );
      }
    }

    return { viewName, cameraID };
  }

  private _handleNoCameraForView(
    viewName: AdvancedCameraCardView,
    config: AdvancedCameraCardConfig,
    options?: ViewFactoryOptions,
  ): ResolvedViewTarget {
    const defaultViewName = this._getDefaultViewName(config);
    if (options?.failSafe && !doesViewRequireCamera(defaultViewName)) {
      return { viewName: defaultViewName, cameraID: null };
    }
    const cameraID = this._api.getCameraManager().getStore().getDefaultCameraID();
    if (options?.failSafe) {
      return {
        viewName: defaultViewName,
        cameraID,
      };
    }
    throw new ViewIncompatible({
      view: viewName,
      camera: cameraID,
    });
  }

  private _handleUnsupportedView(
    viewName: AdvancedCameraCardView,
    cameraID: string,
    config: AdvancedCameraCardConfig,
    options?: ViewFactoryOptions,
    supported?: Set<string> | null,
  ): ResolvedViewTarget {
    if (supported === null) {
      throw new ViewDeferred({ camera: cameraID, view: viewName });
    }

    const defaultViewName = this._getDefaultViewName(config);
    if (
      options?.failSafe &&
      /* v8 ignore next: getCameraIDsSupportingView returns null only while a camera is
      initializing, and _ensureViewCompatibility defers before this path is reached in that
      case -- @preserve */
      !!getCameraIDsSupportingView(
        defaultViewName,
        this._api.getCameraManager(),
        this._api.getFoldersManager(),
        cameraID,
      )?.size
    ) {
      return { viewName: defaultViewName, cameraID };
    }

    const capabilities = this._api
      .getCameraManager()
      .getStore()
      .getCamera(cameraID)
      ?.getCapabilities()
      ?.getRawCapabilities();

    throw new ViewIncompatible({
      view: viewName,
      camera: cameraID,
      ...(capabilities && { camera_capabilities: capabilities }),
    });
  }

  private _resolveDisplayMode(
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

  private _getConfiguredDisplayMode(
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
