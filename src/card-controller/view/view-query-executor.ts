import { sub } from 'date-fns';
import { CapabilitySearchKeys } from '../../camera-manager/types';
import { MEDIA_CHUNK_SIZE_DEFAULT } from '../../const';
import { ClipsOrSnapshotsOrAll } from '../../types';
import { findBestMediaTimeIndex } from '../../utils/find-best-media-time-index';
import { Capabilities } from '../../camera-manager/capabilities';
import { LiveMediaType } from '../../config/schema/live';
import { QueryResults } from '../../view/query-results';
import { UnifiedQuery } from '../../view/unified-query';
import { UnifiedQueryBuilder } from '../../view/unified-query-builder';
import { UnifiedQueryRunner } from '../../view/unified-query-runner';
import { View } from '../../view/view';
import { CardViewAPI } from '../types';
import { MergeContextViewModifier } from './modifiers/merge-context';
import { RemoveContextPropertyViewModifier } from './modifiers/remove-context-property';
import { SetQueryViewModifier } from './modifiers/set-query';
import { QueryExecutorOptions, ViewModifier } from './types';

export type MediaQueryMode = 'clips' | 'snapshots' | 'recordings' | 'reviews' | 'all';

/**
 * This class executes media queries and returns an array of ViewModifiers that
 * can be applied to a view. This allows a view to be set when the user acts,
 * and if a query is made as part of this view the result can be applied later.
 */
export class ViewQueryExecutor {
  private _api: CardViewAPI;
  private _builder: UnifiedQueryBuilder;
  private _runner: UnifiedQueryRunner;

  constructor(api: CardViewAPI) {
    this._api = api;
    this._builder = new UnifiedQueryBuilder(api.getCameraManager());
    this._runner = new UnifiedQueryRunner(
      api.getCameraManager(),
      api.getFoldersManager(),
      api.getConditionStateManager(),
    );
  }

  public async getExistingQueryModifiers(
    view: View,
    queryExecutorOptions?: QueryExecutorOptions,
  ): Promise<ViewModifier[] | null> {
    if (!view.query) {
      return null;
    }

    const items = await this._runner.execute(view.query, {
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

    const executeMediaQuery = async (
      mode: MediaQueryMode,
      cameraID?: string,
    ): Promise<ViewModifier[]> => {
      const cameraManager = this._api.getCameraManager();

      // Determine capability based on mode
      const capability: CapabilitySearchKeys = this._modeToCapability(mode);

      const cameraIDs = cameraID
        ? cameraManager.getStore().getAllDependentCameras(cameraID, capability)
        : cameraManager.getStore().getCameraIDsWithCapability(capability);

      const query = this._buildQueryForMode(mode, cameraIDs);

      if (!query) {
        return [];
      }

      const items = await this._runner.execute(query, {
        useCache: queryExecutorOptions?.useCache,
      });

      return [
        new SetQueryViewModifier({
          query,
          queryResults: new QueryResults({ results: items }),
        }),
      ];
    };

    const executeFolderQuery = async (): Promise<ViewModifier[]> => {
      const folder = this._api
        .getFoldersManager()
        .getFolder(queryExecutorOptions?.folder);
      if (!folder) {
        return [];
      }

      const folderQuery = this._api
        .getFoldersManager()
        .getDefaultQueryParameters(folder);
      if (!folderQuery) {
        return [];
      }

      const query = this._builder.buildFolderQuery(
        folderQuery.folder,
        folderQuery.path,
        { limit: this._getLimit() },
      );

      const items = await this._runner.execute(query, {
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
          const mode = this._resolveConfigToMode(
            config.live.controls.thumbnails.media_type,
            config.live.controls.thumbnails.events_media_type,
            this._api.getCameraManager()?.getCameraCapabilities(view.camera),
          );

          if (mode) {
            viewModifiers.push(
              ...(await executeMediaQuery(
                mode,
                view.isGrid() ? undefined : view.camera,
              )),
            );
          }
        }
        break;

      case 'media':
      // If the user is looking at media in the `media` view and then
      // changes camera (via the menu) it should default to showing clips
      // for the new camera.
      case 'clip':
      case 'clips':
        viewModifiers.push(...(await executeMediaQuery('clips', cameraForQuery)));
        break;

      case 'snapshot':
      case 'snapshots':
        viewModifiers.push(...(await executeMediaQuery('snapshots', cameraForQuery)));
        break;

      case 'recording':
      case 'recordings':
        viewModifiers.push(...(await executeMediaQuery('recordings', cameraForQuery)));
        break;

      case 'review':
      case 'reviews':
        viewModifiers.push(...(await executeMediaQuery('reviews', cameraForQuery)));
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

  private _modeToCapability(mode: MediaQueryMode): CapabilitySearchKeys {
    switch (mode) {
      case 'all':
        return { anyCapabilities: ['clips', 'snapshots'] as const };
      default:
        return mode;
    }
  }

  private _buildQueryForMode(
    mode: MediaQueryMode,
    cameraIDs: Set<string>,
  ): UnifiedQuery | null {
    const options = { limit: this._getLimit() };

    switch (mode) {
      case 'clips':
        return this._builder.buildClipsQuery(cameraIDs, options);
      case 'snapshots':
        return this._builder.buildSnapshotsQuery(cameraIDs, options);
      case 'all':
        return this._builder.buildEventsQuery(cameraIDs, options);
      case 'recordings':
        return this._builder.buildRecordingsQuery(cameraIDs, options);
      case 'reviews':
        return this._builder.buildReviewsQuery(cameraIDs, options);
    }
  }

  private _resolveConfigToMode(
    mediaType: LiveMediaType,
    eventsMediaType?: ClipsOrSnapshotsOrAll,
    capabilities?: Capabilities | null,
  ): MediaQueryMode | null {
    const resolved =
      mediaType === 'auto' ? this._autoResolveMediaType(capabilities) : mediaType;

    switch (resolved) {
      case 'events':
        return eventsMediaType === 'clips'
          ? 'clips'
          : eventsMediaType === 'snapshots'
            ? 'snapshots'
            : 'all';
      case 'recordings':
      case 'reviews':
        return resolved;
      default:
        return null;
    }
  }

  private _autoResolveMediaType(
    capabilities?: Capabilities | null,
  ): Exclude<LiveMediaType, 'auto'> | null {
    if (capabilities?.has('reviews')) {
      return 'reviews';
    }
    if (capabilities?.has('clips') || capabilities?.has('snapshots')) {
      return 'events';
    }
    if (capabilities?.has('recordings')) {
      return 'recordings';
    }
    return null;
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
