import { sub } from 'date-fns';
import { ClipsOrSnapshotsOrAll } from '../../types';
import { View } from '../../view/view';
import { CardViewAPI } from '../types';
import { MergeContextViewModifier } from './modifiers/merge-context';
import { RemoveContextPropertyViewModifier } from './modifiers/remove-context-property';
import { SetQueryViewModifier } from './modifiers/set-query';
import { QueryExecutor } from './query-executor';
import { QueryExecutorOptions, ViewModifier } from './types';

/**
 * This class executes media queries and returns an array of ViewModifiers that
 * can be applied to a view. This allows a view to be set when the user acts,
 * and if a query is made as part of this view the result can be applied later.
 */
export class ViewQueryExecutor {
  protected _api: CardViewAPI;
  protected _executor: QueryExecutor;

  constructor(api: CardViewAPI, executor?: QueryExecutor) {
    this._api = api;
    this._executor = executor ?? new QueryExecutor(api);
  }

  public async getExistingQueryModifiers(
    view: View,
    queryExecutorOptions?: QueryExecutorOptions,
  ): Promise<ViewModifier[] | null> {
    return view.query
      ? [
          new SetQueryViewModifier({
            queryResults: (
              await this._executor.executeQuery(view.query, queryExecutorOptions)
            )?.queryResults,
          }),
        ]
      : [];
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

  protected async _executeNewQuery(
    view: View,
    queryExecutorOptions?: QueryExecutorOptions,
  ): Promise<ViewModifier[] | null> {
    const config = this._api.getConfigManager().getConfig();
    if (!config) {
      return null;
    }

    const mediaType = view?.getDefaultMediaType();
    const viewModifiers: ViewModifier[] = [];

    const executeMediaQuery = async (
      mediaType: ClipsOrSnapshotsOrAll | 'recordings' | null,
    ): Promise<ViewModifier[]> => {
      /* istanbul ignore if: this path cannot be reached -- @preserve */
      if (!mediaType) {
        return [];
      }

      const results =
        mediaType === 'recordings'
          ? await this._executor.executeDefaultRecordingQuery({
              ...(!view.isGrid() && { cameraID: view.camera }),
              executorOptions: queryExecutorOptions,
            })
          : mediaType === 'clips' || mediaType === 'snapshots' || mediaType === 'all'
            ? await this._executor.executeDefaultEventQuery({
                ...(!view.isGrid() && { cameraID: view.camera }),
                eventsMediaType: mediaType,
                executorOptions: queryExecutorOptions,
              })
            : /* istanbul ignore next -- @preserve */
              null;

      return results ? [new SetQueryViewModifier(results)] : [];
    };

    const executeFolderQuery = async (): Promise<ViewModifier[]> => {
      const results = await this._executor.executeFolderQuery(queryExecutorOptions);
      return results ? [new SetQueryViewModifier(results)] : [];
    };

    switch (view.view) {
      case 'live':
        if (config.live.controls.thumbnails.mode !== 'none') {
          viewModifiers.push(
            ...(await executeMediaQuery(
              config.live.controls.thumbnails.media_type === 'recordings'
                ? 'recordings'
                : config.live.controls.thumbnails.events_media_type,
            )),
          );
        }
        break;

      case 'media':
        // If the user is looking at media in the `media` view and then
        // changes camera (via the menu) it should default to showing clips
        // for the new camera.
        viewModifiers.push(...(await executeMediaQuery('clips')));
        break;

      case 'clip':
      case 'clips':
      case 'snapshot':
      case 'snapshots':
      case 'recording':
      case 'recordings':
        viewModifiers.push(...(await executeMediaQuery(mediaType)));
        break;
      case 'folder':
      case 'folders':
        viewModifiers.push(...(await executeFolderQuery()));
        break;
    }

    viewModifiers.push(...this._getTimelineWindowViewModifier(view));
    viewModifiers.push(
      ...this._getSeekTimeModifier(queryExecutorOptions?.selectResult?.time?.time),
    );
    return viewModifiers;
  }

  protected _getTimelineWindowViewModifier(view: View): ViewModifier[] {
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

  protected _getSeekTimeModifier(time?: Date): ViewModifier[] {
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
}
