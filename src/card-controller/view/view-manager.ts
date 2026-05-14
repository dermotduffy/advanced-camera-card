import { ViewContext } from 'view';
import { getStreamCameraID } from '../../components-lib/live/substream';
import { log } from '../../utils/debug';
import { getViewTargetID } from '../../view/target-id';
import { View } from '../../view/view';
import { InitializationAspect } from '../initialization-manager';
import { CardViewAPI } from '../types';
import { ViewFactory } from './factory';
import { applyViewModifiers } from './modifiers';
import {
  QueryExecutorOptions,
  ViewFactoryOptions,
  ViewManagerEpoch,
  ViewManagerInterface,
  ViewModifier,
} from './types';
import { ViewQueryExecutor } from './view-query-executor';

export class ViewManager implements ViewManagerInterface {
  private _view: View | null = null;
  private _viewFactory: ViewFactory;
  private _viewQueryExecutor: ViewQueryExecutor;
  private _api: CardViewAPI;
  private _epoch: ViewManagerEpoch = this._createEpoch();

  // Used to mark as a view as "loading" with a given index. Each subsequent
  // async update will use a higher index.
  private _loadingIndex = 1;

  constructor(
    api: CardViewAPI,
    options?: {
      viewFactory?: ViewFactory;
      viewQueryExecutor?: ViewQueryExecutor;
    },
  ) {
    this._api = api;
    this._viewFactory = options?.viewFactory ?? new ViewFactory(api);
    this._viewQueryExecutor = options?.viewQueryExecutor ?? new ViewQueryExecutor(api);
  }

  public getEpoch(): ViewManagerEpoch {
    return this._epoch;
  }
  private _createEpoch(oldView?: View | null): ViewManagerEpoch {
    return {
      manager: this,
      ...(oldView && { oldView }),
    };
  }

  public getView(): View | null {
    return this._view;
  }
  public hasView(): boolean {
    return !!this.getView();
  }
  public reset(): void {
    if (this._view) {
      this._setView(null);
    }
  }

  setViewDefault = (options?: ViewFactoryOptions): void =>
    this._setViewGeneric(
      this._viewFactory.getViewDefault.bind(this._viewFactory),
      options,
    );

  setViewByParameters = (options?: ViewFactoryOptions): void =>
    this._setViewGeneric(
      this._viewFactory.getViewByParameters.bind(this._viewFactory),
      options,
    );

  setViewDefaultWithNewQuery = async (options?: ViewFactoryOptions): Promise<void> =>
    await this._setViewThenModifyAsync(
      this._viewFactory.getViewDefault.bind(this._viewFactory),
      this._viewQueryExecutor.getNewQueryModifiers.bind(this._viewQueryExecutor),
      options,
    );

  setViewByParametersWithNewQuery = async (
    options?: ViewFactoryOptions,
  ): Promise<void> =>
    await this._setViewThenModifyAsync(
      this._viewFactory.getViewByParameters.bind(this._viewFactory),
      this._viewQueryExecutor.getNewQueryModifiers.bind(this._viewQueryExecutor),
      options,
    );

  setViewByParametersWithExistingQuery = async (
    options?: ViewFactoryOptions,
  ): Promise<void> =>
    await this._setViewThenModifyAsync(
      this._viewFactory.getViewByParameters.bind(this._viewFactory),
      this._viewQueryExecutor.getExistingQueryModifiers.bind(this._viewQueryExecutor),
      options,
    );

  private _setViewGeneric(
    viewFactoryFunc: (options?: ViewFactoryOptions) => View | null,
    options?: ViewFactoryOptions,
  ): void {
    if (!this._isAllowedToProposeView()) {
      return;
    }

    let view: View | null = null;
    try {
      view = viewFactoryFunc({
        baseView: this._view,
        ...options,
      });
      // A non-throwing factory call clears any prior view_incompatible /
      // media_query state — ensures a previously-dismissed mid-session popup
      // does not linger invisibly and re-pop on the next evaluation cycle,
      // and that a stale media_query failure from an abandoned gallery /
      // viewer doesn't follow the user into an unrelated view.
      this._api.getIssueManager().reset('view_incompatible');
      this._api.getIssueManager().reset('media_query');
    } catch (e) {
      if (!this._view) {
        view = this._getFailSafeView(viewFactoryFunc);
      }
      this._api.getIssueManager().trigger('view_incompatible', { error: e });
    }
    if (view && !this._isAllowedToSetView(view, options)) {
      return;
    }
    if (view) {
      this._setView(view);
    }
  }

  private _getFailSafeView(
    viewFactoryFunc: (options?: ViewFactoryOptions) => View | null,
  ): View | null {
    try {
      return viewFactoryFunc({ baseView: null, failSafe: true });
    } catch {
      return null;
    }
  }

  private _markViewLoadingQuery(view: View, index: number): void {
    view.mergeInContext({ loading: { query: index } });
  }
  private _markViewAsNotLoadingQuery(view: View): void {
    view.removeContextProperty('loading', 'query');
  }

  // Pre-computation gate: whether we should even attempt to build a candidate
  // view. Skipped here for race conditions that would otherwise generate a
  // spurious `view_incompatible` issue.
  private _isAllowedToProposeView(): boolean {
    // It is possible to have a race condition where the view is being set at
    // the same time as the cameras being initialized. Test case: Open
    // folder-based media in the media viewer carousel, then attempt to edit the
    // card -- this causes the cameras to re-initialize at the same time as
    // folder media is reporting observed zoom settings in the view context.
    // Without this check, that will result in a "No cameras support this view"
    // message.
    return this._api
      .getInitializationManager()
      .isInitialized(InitializationAspect.CAMERAS);
  }

  // Post-computation gate: given a freshly proposed view, whether we should
  // actually commit it. Respects the lock state by potentially rejecting
  // changes that would disrupt the active session (camera, view name, or
  // substream).
  private _isAllowedToSetView(
    proposedView: View,
    options?: ViewFactoryOptions,
  ): boolean {
    if (options?.force || !this._api.getLockManager().isLocked()) {
      return true;
    }
    return !this.hasMajorMediaChange(this._view, proposedView);
  }

  private async _setViewThenModifyAsync(
    viewFactoryFunc: (options?: ViewFactoryOptions) => View | null,
    viewModifiersFunc: (
      view: View,
      queryExecutorOptions?: QueryExecutorOptions,
    ) => Promise<ViewModifier[] | null>,
    options?: ViewFactoryOptions,
  ): Promise<void> {
    if (!this._isAllowedToProposeView()) {
      return;
    }

    let initialView: View | null = null;
    try {
      initialView = viewFactoryFunc({
        baseView: this._view,
        ...options,
        params: {
          query: null,
          queryResults: null,
          ...options?.params,
        },
      });
      this._api.getIssueManager().reset('view_incompatible');
      // A new query is about to run, so any stale media_query error from a
      // previous attempt is no longer meaningful. If this new query also
      // fails, it will re-trigger below.
      this._api.getIssueManager().reset('media_query');
    } catch (e) {
      if (!this._view) {
        initialView = this._getFailSafeView(viewFactoryFunc);
      }
      this._api.getIssueManager().trigger('view_incompatible', { error: e });
    }

    if (!initialView || !this._isAllowedToSetView(initialView, options)) {
      return;
    }

    if (this._view && this._shouldAdoptQueryAndResults(initialView)) {
      initialView.query = this._view.query;
      initialView.queryResults = this._view.queryResults;
      this._markViewAsNotLoadingQuery(initialView);
      this._setView(initialView);
      return;
    }

    // Mark the view as loading with the current value of _updateIndex. This is
    // used to ensure that the loading state is subsequently only removed for
    // _this_ async update.
    const loadingIndex = this._loadingIndex++;
    this._markViewLoadingQuery(initialView, loadingIndex);

    this._setView(initialView);

    let viewModifiers: ViewModifier[] | null = null;
    let error: Error | null = null;
    try {
      viewModifiers = await viewModifiersFunc(
        initialView,
        options?.queryExecutorOptions,
      );
    } catch (e) {
      error = e as Error;
    }

    if (this._view && this.hasMajorMediaChange(this._view, initialView)) {
      // If there has been a major media change in the time async operations
      // have occurred, ignore the result. For example: A slow Reolink query is
      // dispatched, the user changes the view in the interim, then the query
      // returns -- it should not be applied, nor should any errors be shown. On
      // the contrary, small changes such as the user zooming in are fine to
      // merge into the resultant view.
      if (this._view.context?.loading?.query === loadingIndex) {
        const view = this._view.clone();
        this._markViewAsNotLoadingQuery(view);
        this._setView(view);
      }
      return;
    }

    if (error) {
      // Clear the loading flag before surfacing the error. Otherwise the
      // view stays marked in-flight and components (gallery, viewer) keep
      // rendering "Awaiting media" on top of the error notification.
      if (this._view?.context?.loading?.query === loadingIndex) {
        const view = this._view.clone();
        this._markViewAsNotLoadingQuery(view);
        this._setView(view);
      }
      this._api.getIssueManager().trigger('media_query', { error });
      return;
    }

    /* istanbul ignore if: the if path cannot be reached as the view is set
    above -- @preserve */
    if (!this._view) {
      return;
    }

    this._api.getIssueManager().reset('media_query');

    const newView = this._view.clone();
    if (this._view.context?.loading?.query === loadingIndex) {
      this._markViewAsNotLoadingQuery(newView);
    }
    applyViewModifiers(newView, viewModifiers);
    this._setView(newView);
  }

  private _shouldAdoptQueryAndResults(newView: View): boolean {
    // If the user is currently using the viewer, and then switches to the
    // gallery we make an attempt to keep the query/queryResults the same so
    // the gallery can be used to click back and forth to the viewer, and the
    // selected media can be centered in the gallery.
    //
    // See: https://github.com/dermotduffy/advanced-camera-card/issues/885

    if (!this._view?.isViewerView() || !newView?.isGalleryView()) {
      return false;
    }

    // Check if the viewer came from this gallery type. If they did, we preserve
    // the query/results to ensure consistency in navigation between media &
    // gallery.
    const originView = this._view?.context?.gallery?.originView;
    return originView === newView.view;
  }

  public setViewWithMergedContext(context: ViewContext | null): void {
    if (this._view) {
      return this._setView(this._view?.clone().mergeInContext(context));
    }
  }

  /**
   * Detect if the current view has a major "media change" for the given previous view.
   * @param oldView The previous view.
   * @returns True if the view change is a real media change.
   */
  public hasMajorMediaChange(oldView?: View | null, newView?: View | null): boolean {
    const compareView = newView ?? this._view;

    return (
      !!oldView !== !!compareView ||
      oldView?.view !== compareView?.view ||
      oldView?.camera !== compareView?.camera ||
      // When in live mode, take overrides (substreams) into account in deciding
      // if this is a major media change.
      (compareView?.view === 'live' &&
        oldView &&
        getStreamCameraID(oldView) !== getStreamCameraID(compareView)) ||
      // When in the live view, the queryResults contain the events that
      // happened in the past -- not reflective of the actual live media viewer
      // the user is seeing.
      (compareView?.view !== 'live' &&
        oldView?.queryResults !== compareView?.queryResults)
    );
  }

  public initialize = async (): Promise<void> => {
    // If the query string contains a view related action, we don't set any view
    // here and allow that action to be triggered by the next call of to execute
    // query actions (called at least once per render cycle).
    // Related: https://github.com/dermotduffy/advanced-camera-card/issues/1200
    if (!this._api.getQueryStringManager().hasViewRelatedActionsToRun()) {
      // This is not awaited to allow the initialization to complete before the
      // query is answered.
      this.setViewDefaultWithNewQuery({ failSafe: true });
    }
  };

  private _setView(view: Readonly<View> | null): void {
    const oldView = this._view;

    log(
      this._api.getConfigManager().getCardWideConfig(),
      `Advanced Camera Card view change: `,
      view,
    );

    this._view = view;
    this._epoch = this._createEpoch(oldView);

    this._api
      .getMediaLoadedInfoManager()
      .setSelected(view ? getViewTargetID(view) : null);

    if (oldView?.view !== view?.view) {
      this._api.getCardElementManager().scrollReset();
    }

    this._api.getStyleManager().setExpandedMode();

    this._api.getConditionStateManager()?.setState({
      view: view?.view,
      camera: view?.camera ?? undefined,
      displayMode: view?.displayMode ?? undefined,
      targetID: view ? getViewTargetID(view) ?? undefined : undefined,
    });

    this._api.getCardElementManager().update();
  }
}
