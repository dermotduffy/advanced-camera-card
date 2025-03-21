import { ViewContext } from 'view';
import { AdvancedCameraCardView } from '../../config/schema/common/const.js';
import { AdvancedCameraCardError } from '../../types.js';
import { MediaQueriesResults } from '../../view/media-queries-results.js';
import { MediaQueries } from '../../view/media-queries.js';
import { ViewMedia } from '../../view/media.js';
import { View, ViewParameters } from '../../view/view.js';

export interface ViewModifier {
  modify(view: View): void;
}

export interface QueryExecutorOptions {
  // Select the result of a query, based on time, an id match or an arbitrary
  // function. If no parameter is specified, the latest media will be selected
  // by default.
  selectResult?: {
    time?: {
      time: Date;
      favorCameraID?: string;
    };
    id?: string;
    func?: (media: ViewMedia) => boolean;
  };
  rejectResults?: (results: MediaQueriesResults) => boolean;
  useCache?: boolean;
}

export interface QueryExecutorResult {
  query: MediaQueries;
  queryResults: MediaQueriesResults;
}

export interface ViewFactoryOptions {
  // An existing view to evolve from.
  baseView?: View | null;

  // View parameters to set/evolve.
  params?: Partial<ViewParameters>;

  // Modifiers to the view once created.
  modifiers?: ViewModifier[];

  // When failSafe is true the view will be changed to the default view, or the
  // `live` view if the configured default view is not supported.
  failSafe?: boolean;

  // Options for the query executor that control how a query is executed and the
  // result selected.
  queryExecutorOptions?: QueryExecutorOptions;
}

export interface ViewManagerEpoch {
  manager: ViewManagerInterface;

  oldView?: View;
}

export interface ViewManagerInterface {
  getEpoch(): ViewManagerEpoch;

  getView(): View | null;
  hasView(): boolean;
  reset(): void;

  setViewDefault(options?: ViewFactoryOptions): void;
  setViewByParameters(options?: ViewFactoryOptions): void;

  setViewDefaultWithNewQuery(options?: ViewFactoryOptions): Promise<void>;
  setViewByParametersWithNewQuery(options?: ViewFactoryOptions): Promise<void>;
  setViewByParametersWithExistingQuery(options?: ViewFactoryOptions): Promise<void>;

  setViewWithMergedContext(context: ViewContext | null): void;

  isViewSupportedByCamera(cameraID: string, view: AdvancedCameraCardView): boolean;
  hasMajorMediaChange(oldView?: View | null, newView?: View | null): boolean;
}

export class ViewNoCameraError extends AdvancedCameraCardError {}
export class ViewIncompatible extends AdvancedCameraCardError {}
