import { sub } from 'date-fns';
import { MEDIA_CHUNK_SIZE_DEFAULT } from '../../const';
import { findBestMediaTimeIndex } from '../../utils/find-best-media-time-index';
import { QueryResults } from '../../view/query-results';
import { UnifiedQuery } from '../../view/unified-query';
import { MediaTypeSpec, UnifiedQueryBuilder } from '../../view/unified-query-builder';
import { UnifiedQueryRunner } from '../../view/unified-query-runner';
import { View } from '../../view/view';
import { CardViewAPI } from '../types';
import { MergeContextViewModifier } from './modifiers/merge-context';
import { RemoveContextPropertyViewModifier } from './modifiers/remove-context-property';
import { SetQueryViewModifier } from './modifiers/set-query';
import { QueryExecutorOptions, ViewModifier } from './types';

/**
 * This class executes media queries and returns an array of ViewModifiers that
 * can be applied to a view. This allows a view to be set when the user acts,
 * and if a query is made as part of this view the result can be applied later.
 */
export class ViewQueryExecutor {
  private _api: CardViewAPI;

  constructor(api: CardViewAPI) {
    this._api = api;
  }

  public async getExistingQueryModifiers(
    view: View,
    queryExecutorOptions?: QueryExecutorOptions,
  ): Promise<ViewModifier[] | null> {
    if (!view.query) {
      return null;
    }

    const runner = new UnifiedQueryRunner(
      this._api.getCameraManager(),
      this._api.getFoldersManager(),
      this._api.getConditionStateManager(),
    );

    const items = await runner.execute(view.query, {
      useCache: queryExecutorOptions?.useCache,
    });

    const queryResults = this._applyResultSelection(
      new QueryResults({ results: items }),
      queryExecutorOptions,
    );

    return queryResults
      ? [
          new SetQueryViewModifier({
            queryResults,
          }),
        ]
      : null;
  }

  public async getNewQueryModifiers(
    view: View,
    queryExecutorOptions?: QueryExecutorOptions,
  ): Promise<ViewModifier[] | null> {
    return await this._executeNewQuery(view, {
      useCache: false,
      ...queryExecutorOptions,
    });
  }

  private async _executeNewQuery(
    view: View,
    queryExecutorOptions?: QueryExecutorOptions,
  ): Promise<ViewModifier[] | null> {
    const config = this._api.getConfigManager().getConfig();
    if (!config) {
      return null;
    }

    const viewModifiers: ViewModifier[] = [];
    const builder = new UnifiedQueryBuilder(
      this._api.getCameraManager(),
      this._api.getFoldersManager(),
    );
    const runner = new UnifiedQueryRunner(
      this._api.getCameraManager(),
      this._api.getFoldersManager(),
      this._api.getConditionStateManager(),
    );

    const executeQuery = async (query: UnifiedQuery | null): Promise<ViewModifier[]> => {
      if (!query) {
        return [];
      }

      const items = await runner.execute(query, {
        useCache: queryExecutorOptions?.useCache,
      });

      return [
        new SetQueryViewModifier({
          query,
          queryResults: new QueryResults({ results: items }),
        }),
      ];
    };

    const cameraForQuery = view.isGrid() ? undefined : view.camera;

    switch (view.view) {
      case 'live':
        if (config.live.controls.thumbnails.mode !== 'none') {
          const defaultQuery = builder.buildDefaultCameraQuery(cameraForQuery);
          if (defaultQuery) {
            viewModifiers.push(...(await executeQuery(defaultQuery)));
          }
        }
        break;
      case 'timeline':
        // Timeline view always queries all cameras with media capabilities.
        viewModifiers.push(...(await executeQuery(builder.buildDefaultCameraQuery())));
        break;
      case 'media':
      // If the user is looking at media in the `media` view and then
      // changes camera (via the menu) it should default to showing clips
      // for the new camera.
      case 'clip':
      case 'clips':
        viewModifiers.push(
          ...(await executeQuery(
            builder.buildCameraMediaQuery(MediaTypeSpec.clips(), {
              cameraID: cameraForQuery,
              limit: this._getLimit(),
            }),
          )),
        );

        break;

      case 'snapshot':
      case 'snapshots':
        viewModifiers.push(
          ...(await executeQuery(
            builder.buildCameraMediaQuery(MediaTypeSpec.snapshots(), {
              cameraID: cameraForQuery,
              limit: this._getLimit(),
            }),
          )),
        );
        break;

      case 'recording':
      case 'recordings':
        viewModifiers.push(
          ...(await executeQuery(
            builder.buildCameraMediaQuery(MediaTypeSpec.recordings(), {
              cameraID: cameraForQuery,
              limit: this._getLimit(),
            }),
          )),
        );
        break;

      case 'review':
      case 'reviews':
        viewModifiers.push(
          ...(await executeQuery(
            builder.buildCameraMediaQuery(MediaTypeSpec.reviews(), {
              cameraID: cameraForQuery,
              limit: this._getLimit(),
            }),
          )),
        );
        break;

      case 'folder':
      case 'folders':
        viewModifiers.push(
          ...(await executeQuery(
            builder.buildDefaultFolderQuery(queryExecutorOptions?.folder, {
              limit: this._getLimit(),
            }),
          )),
        );
        break;
    }

    viewModifiers.push(...this._getTimelineWindowViewModifier(view));
    viewModifiers.push(
      ...this._getSeekTimeModifier(queryExecutorOptions?.selectResult?.time?.time),
    );
    return viewModifiers;
  }

  private _getTimelineWindowViewModifier(view: View): ViewModifier[] {
    if (view.is('live')) {
      // For live views, always force the timeline to now, regardless of
      // presence or not of events.
      const now = new Date();
      const liveConfig = this._api.getConfigManager().getConfig()?.live;

      /* istanbul ignore if: this if branch cannot be reached as if the config is
         empty this function is never called -- @preserve */
      if (!liveConfig) {
        return [];
      }

      return [
        new MergeContextViewModifier({
          // Force the window to start at the most recent time, not
          // necessarily when the most recent event/recording was:
          // https://github.com/dermotduffy/advanced-camera-card/issues/1301
          timeline: {
            window: {
              start: sub(now, {
                seconds: liveConfig.controls.timeline.window_seconds,
              }),
              end: now,
            },
          },
        }),
      ];
    } else {
      // For non-live views stick to default timeline behavior (will select and
      // scroll to event).
      return [new RemoveContextPropertyViewModifier('timeline', 'window')];
    }
  }

  private _getSeekTimeModifier(time?: Date): ViewModifier[] {
    if (time) {
      return [
        new MergeContextViewModifier({
          mediaViewer: {
            seek: time,
          },
        }),
      ];
    } else {
      return [new RemoveContextPropertyViewModifier('mediaViewer', 'seek')];
    }
  }

  private _applyResultSelection(
    queryResults: QueryResults,
    options?: QueryExecutorOptions,
  ): QueryResults | null {
    if (options?.rejectResults?.(queryResults)) {
      return null;
    }

    const timeSelection = options?.selectResult?.time;
    if (options?.selectResult?.id) {
      queryResults.selectBestResult((media) =>
        media.findIndex((m) => m.getID() === options.selectResult?.id),
      );
    } else if (options?.selectResult?.func) {
      queryResults.selectResultIfFound(options.selectResult.func);
    } else if (timeSelection) {
      queryResults.selectBestResult((itemArray) =>
        findBestMediaTimeIndex(
          itemArray,
          timeSelection.time,
          timeSelection.favorCameraID,
        ),
      );
    }

    return queryResults;
  }

  private _getLimit(): number {
    return (
      this._api.getConfigManager().getConfig()?.performance?.features
        ?.media_chunk_size ?? MEDIA_CHUNK_SIZE_DEFAULT
    );
  }
}
