import { merge } from 'lodash-es';
import { ViewContext } from 'view';
import { AdvancedCameraCardView } from '../config/schema/common/const';
import { ViewDisplayMode } from '../config/schema/common/display';
import { ViewMediaType } from '../types';
import { QueryResults } from './query-results';
import { UnifiedQuery } from './unified-query';

declare module 'view' {
  interface ViewContext {
    // Per-target media retry epoch. Keyed by the universal target ID returned
    // by `getViewTargetID` (camera ID / media ID / image sentinel). When bumped
    // for a target, consumers rendering that target tear down and recreate
    // their media element to retry loading.
    mediaEpoch?: Record<string, number>;

    loading?: {
      query?: unknown;
    };
  }
}

interface ViewEvolveParameters {
  view?: AdvancedCameraCardView;
  camera?: string | null;
  query?: UnifiedQuery | null;
  queryResults?: QueryResults | null;
  context?: ViewContext | null;
  displayMode?: ViewDisplayMode | null;
}

export interface ViewParameters extends ViewEvolveParameters {
  view: AdvancedCameraCardView;
}

export const mergeViewContext = (
  a?: ViewContext | null,
  b?: ViewContext | null,
): ViewContext => {
  return merge({}, a, b);
};

const VIEWER_VIEW_NAMES: readonly AdvancedCameraCardView[] = [
  'folder',
  'media',
  'clip',
  'snapshot',
  'recording',
  'review',
];

const GALLERY_VIEW_NAMES: readonly AdvancedCameraCardView[] = [
  'clips',
  'folders',
  'gallery',
  'snapshots',
  'recordings',
  'reviews',
];

const FOLDER_VIEW_NAMES: readonly AdvancedCameraCardView[] = ['folder', 'folders'];

const isViewerViewName = (view?: AdvancedCameraCardView): boolean =>
  !!view && VIEWER_VIEW_NAMES.includes(view);

const isGalleryViewName = (view?: AdvancedCameraCardView): boolean =>
  !!view && GALLERY_VIEW_NAMES.includes(view);

const isAnyFolderViewName = (view?: AdvancedCameraCardView): boolean =>
  !!view && FOLDER_VIEW_NAMES.includes(view);

export const isAnyMediaViewName = (view?: AdvancedCameraCardView): boolean =>
  isViewerViewName(view) || view === 'live' || view === 'image';

export class View {
  public view: AdvancedCameraCardView;
  public camera: string | null;
  public query: UnifiedQuery | null;
  public queryResults: QueryResults | null;
  public context: ViewContext | null;
  public displayMode: ViewDisplayMode | null;

  constructor(params: ViewParameters) {
    this.view = params.view;
    this.camera = params.camera ?? null;
    this.query = params.query ?? null;
    this.queryResults = params.queryResults ?? null;
    this.context = params.context ?? null;
    this.displayMode = params.displayMode ?? null;
  }

  public clone(): View {
    return new View({
      view: this.view,
      camera: this.camera,
      query: this.query?.clone() ?? null,
      queryResults: this.queryResults?.clone() ?? null,
      context: this.context,
      displayMode: this.displayMode,
    });
  }

  /**
   * Evolve this view by changing parameters and returning a new view.
   * @param params Parameters to change.
   * @returns A new evolved view.
   */
  public evolve(params: ViewEvolveParameters): View {
    return new View({
      view: params.view !== undefined ? params.view : this.view,
      camera: params.camera !== undefined ? params.camera : this.camera,
      query: params.query !== undefined ? params.query : this.query?.clone() ?? null,
      queryResults:
        params.queryResults !== undefined
          ? params.queryResults
          : this.queryResults?.clone() ?? null,
      context: params.context !== undefined ? params.context : this.context,
      displayMode:
        params.displayMode !== undefined ? params.displayMode : this.displayMode,
    });
  }

  /**
   * Merge view contexts.
   * @param context The context to merge in.
   * @returns This view.
   */
  public mergeInContext(context?: ViewContext | null): View {
    this.context = mergeViewContext(this.context, context);
    return this;
  }

  /**
   * Remove a context key.
   * @param key The key to remove.
   * @returns This view.
   */
  public removeContext(key: keyof ViewContext): View {
    if (this.context) {
      delete this.context[key];
    }
    return this;
  }

  public removeContextProperty(
    contextKey: keyof ViewContext,
    removeKey: PropertyKey,
  ): View {
    const contextObj = this.context?.[contextKey];
    if (contextObj) {
      delete contextObj[removeKey];
    }
    return this;
  }

  /**
   * Determine if current view matches a named view.
   */
  public is(view: AdvancedCameraCardView): boolean {
    return this.view == view;
  }

  /**
   * Determine if a view is a gallery.
   */
  public isGalleryView(): boolean {
    return isGalleryViewName(this.view);
  }

  /**
   * Determine if a view is of a piece of media (including the media viewer,
   * live view, image view -- anything that can create a MediaLoadedInfo event).
   */
  public isAnyMediaView(): boolean {
    return isAnyMediaViewName(this.view);
  }

  public isAnyFolderView(): boolean {
    return isAnyFolderViewName(this.view);
  }

  /**
   * Determine if a view is for the media viewer.
   */
  public isViewerView(): boolean {
    return isViewerViewName(this.view);
  }

  public supportsMultipleDisplayModes(): boolean {
    return this.isViewerView() || this.is('live');
  }

  public getDefaultMediaType(): ViewMediaType | null {
    if (['clip', 'clips'].includes(this.view)) {
      return 'clips';
    }
    if (['snapshot', 'snapshots'].includes(this.view)) {
      return 'snapshots';
    }
    if (['recording', 'recordings'].includes(this.view)) {
      return 'recordings';
    }
    if (['review', 'reviews'].includes(this.view)) {
      return 'reviews';
    }
    return null;
  }

  public isGrid(): boolean {
    return this.displayMode === 'grid';
  }
}
