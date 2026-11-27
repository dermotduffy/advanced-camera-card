import { sub } from 'date-fns';

import { MEDIA_CHUNK_SIZE_DEFAULT } from '../../const';
import type { DateRange } from '../../utils/date/range';
import { findBestMediaTimeIndex } from '../../utils/find-best-media-time-index';
import { QueryResults } from '../../view/query-results';
import { getTimelineQueryRange } from '../../view/timeline-window';
import type { UnifiedQuery } from '../../view/unified-query';
import { UnifiedQueryBuilder } from '../../view/unified-query-builder';
import { UnifiedQueryRunner } from '../../view/unified-query-runner';
import type { View } from '../../view/view';
import { doesViewRequireCamera, isViewSupported } from '../../view/view-support';
import type { CardViewAPI } from '../types';
import { MergeContextViewModifier } from './modifiers/merge-context';
import { RemoveContextPropertyViewModifier } from './modifiers/remove-context-property';
import { SetQueryViewModifier } from './modifiers/set-query';
import type { QueryExecutorOptions, ViewModifier } from './types';

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
      allowCached: queryExecutorOptions?.allowCached,
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
      allowCached: false,
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
        allowCached: queryExecutorOptions?.allowCached,
      });

      return [
        new SetQueryViewModifier({
          query,
          queryResults: new QueryResults({ results: items }),
        }),
      ];
    };

    // Don't query if the view is not supported (e.g. a camera-based view with
    // no cameras).
    if (
      !isViewSupported(
        view.view,
        this._api.getCameraManager(),
        this._api.getFoldersManager(),
        view.camera,
      )
    ) {
      return null;
    }

    // Don't query if the view requires a camera, if it's not in grid mode, but
    // no camera is provided.
    if (!view.isGrid() && !view.camera && doesViewRequireCamera(view.view)) {
      return null;
    }

    const cameraForQuery = view.isGrid() ? undefined : view.camera ?? undefined;

    const getDefaultQueryModifiers = async () => {
      const options = { limit: this._getLimit() };
      return await executeQuery(
        cameraForQuery
          ? builder.buildDefaultCameraQuery(cameraForQuery, options)
          : builder.buildDefaultQuery(options),
      );
    };

    // Timeline opens on "now".
    //  - See: https://github.com/dermotduffy/advanced-camera-card/issues/1301
    const now = new Date();
    const getWindowEndingNow = (windowSeconds: number): DateRange => ({
      start: sub(now, { seconds: windowSeconds }),
      end: now,
    });
    let timelineWindow: DateRange | null = null;

    switch (view.view) {
      case 'live':
        timelineWindow = getWindowEndingNow(
          config.live.controls.timeline.window_seconds,
        );
        if (config.live.controls.thumbnails.mode !== 'none') {
          viewModifiers.push(...(await getDefaultQueryModifiers()));
        }
        break;
      case 'timeline':
        timelineWindow = getWindowEndingNow(config.timeline.window_seconds);
        viewModifiers.push(
          ...(await executeQuery(
            builder.buildDefaultQuery(getTimelineQueryRange(timelineWindow)),
          )),
        );
        break;
      case 'gallery':
      case 'media':
        // If the user is looking at media in the `media` view and then changes
        // camera (via the menu) it should default to the default camera media
        // type.
        viewModifiers.push(...(await getDefaultQueryModifiers()));
        break;
      case 'clip':
      case 'clips':
        viewModifiers.push(
          ...(await executeQuery(
            builder.buildCameraMediaQuery('events', {
              cameraID: cameraForQuery,
              eventsSubtype: 'clips',
              limit: this._getLimit(),
            }),
          )),
        );

        break;

      case 'snapshot':
      case 'snapshots':
        viewModifiers.push(
          ...(await executeQuery(
            builder.buildCameraMediaQuery('events', {
              cameraID: cameraForQuery,
              eventsSubtype: 'snapshots',
              limit: this._getLimit(),
            }),
          )),
        );
        break;

      case 'recording':
      case 'recordings':
        viewModifiers.push(
          ...(await executeQuery(
            builder.buildCameraMediaQuery('recordings', {
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
            builder.buildCameraMediaQuery('reviews', {
              cameraID: cameraForQuery,
              limit: this._getLimit(),
            }),
          )),
        );
        break;

      case 'folder':
      case 'folders': {
        const folder = this._api
          .getFoldersManager()
          .getFolder(queryExecutorOptions?.folder);
        viewModifiers.push(
          ...(await executeQuery(folder && builder.buildDefaultFolderQuery(folder.id))),
        );
        break;
      }
    }

    viewModifiers.push(...this._getTimelineWindowViewModifier(timelineWindow));
    viewModifiers.push(
      ...this._getSeekTimeModifier(queryExecutorOptions?.selectResult?.time?.time),
    );
    return viewModifiers;
  }

  private _getTimelineWindowViewModifier(window: DateRange | null): ViewModifier[] {
    return window
      ? [new MergeContextViewModifier({ timeline: { window } })]
      : // Without a window, the timeline itself uses the selected media's time.
        [new RemoveContextPropertyViewModifier('timeline', 'window')];
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
