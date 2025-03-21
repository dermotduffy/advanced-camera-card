import merge from 'lodash-es/merge';
import { ViewContext } from 'view';
import { AdvancedCameraCardView } from '../config/schema/common/const';
import { ViewDisplayMode } from '../config/schema/common/display';
import { MediaQueries } from './media-queries';
import { MediaQueriesResults } from './media-queries-results';

declare module 'view' {
  interface ViewContext {
    loading?: {
      query?: unknown;
    };
  }
}

interface ViewEvolveParameters {
  view?: AdvancedCameraCardView;
  camera?: string;
  query?: MediaQueries | null;
  queryResults?: MediaQueriesResults | null;
  context?: ViewContext | null;
  displayMode?: ViewDisplayMode | null;
}

export interface ViewParameters extends ViewEvolveParameters {
  view: AdvancedCameraCardView;
  camera: string;
}

export const mergeViewContext = (
  a?: ViewContext | null,
  b?: ViewContext | null,
): ViewContext => {
  return merge({}, a, b);
};

export class View {
  public view: AdvancedCameraCardView;
  public camera: string;
  public query: MediaQueries | null;
  public queryResults: MediaQueriesResults | null;
  public context: ViewContext | null;
  public displayMode: ViewDisplayMode | null;

  constructor(params: ViewParameters) {
    this.view = params.view;
    this.camera = params.camera;
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
    return ['clips', 'snapshots', 'recordings'].includes(this.view);
  }

  /**
   * Determine if a view is of a piece of media (including the media viewer,
   * live view, image view -- anything that can create a MediaLoadedInfo event).
   */
  public isAnyMediaView(): boolean {
    return this.isViewerView() || this.is('live') || this.is('image');
  }

  /**
   * Determine if a view is for the media viewer.
   */
  public isViewerView(): boolean {
    return ['media', 'clip', 'snapshot', 'recording'].includes(this.view);
  }

  public supportsMultipleDisplayModes(): boolean {
    return this.isViewerView() || this.is('live');
  }

  /**
   * Get the default media type for this view if available.
   * @returns Whether the default media is `clips`, `snapshots`, `recordings` or unknown
   * (`null`).
   */
  public getDefaultMediaType(): 'clips' | 'snapshots' | 'recordings' | null {
    if (['clip', 'clips'].includes(this.view)) {
      return 'clips';
    }
    if (['snapshot', 'snapshots'].includes(this.view)) {
      return 'snapshots';
    }
    if (['recording', 'recordings'].includes(this.view)) {
      return 'recordings';
    }
    return null;
  }

  public isGrid(): boolean {
    return this.displayMode === 'grid';
  }
}
