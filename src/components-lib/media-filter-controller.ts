import {
  endOfDay,
  endOfMonth,
  endOfToday,
  endOfYesterday,
  format,
  parse,
  startOfDay,
  startOfToday,
  startOfYesterday,
  sub,
} from 'date-fns';
import { LitElement } from 'lit';
import { isEqual, orderBy, uniqWith } from 'lodash-es';
import { CameraManager } from '../camera-manager/manager';
import { DateRange, PartialDateRange } from '../camera-manager/range';
import { CameraQuery, MediaMetadata, QueryType } from '../camera-manager/types';
import { ViewManagerInterface } from '../card-controller/view/types';
import { SelectOption, SelectValues } from '../components/select';
import { CardWideConfig } from '../config/schema/types';
import { localize } from '../localize/localize';
import { errorToConsole, formatDate, prettifyTitle } from '../utils/basic';
import { EventMediaQuery, RecordingMediaQuery } from '../view/query';
import { QueryClassifier } from '../view/query-classifier';

interface MediaFilterControls {
  events: boolean;
  recordings: boolean;
  favorites: boolean;
}

export interface MediaFilterCoreDefaults {
  cameraIDs?: string[];
  favorite?: MediaFilterCoreFavoriteSelection;
  mediaType?: MediaFilterMediaType;
  what?: string[];
  when?: string;
  where?: string[];
  tags?: string[];
}

export enum MediaFilterCoreFavoriteSelection {
  Favorite = 'favorite',
  NotFavorite = 'not-favorite',
}

export enum MediaFilterCoreWhen {
  Today = 'today',
  Yesterday = 'yesterday',
  PastWeek = 'past-week',
  PastMonth = 'past-month',
  Custom = 'custom',
}

export enum MediaFilterMediaType {
  Clips = 'clips',
  Snapshots = 'snapshots',
  Recordings = 'recordings',
}

export class MediaFilterController {
  protected _host: LitElement;

  protected _mediaTypeOptions: SelectOption[];
  protected _cameraOptions: SelectOption[] = [];

  protected _whenOptions: SelectOption[] = [];
  protected _staticWhenOptions: SelectOption[];
  protected _metaDataWhenOptions: SelectOption[] = [];

  protected _whatOptions: SelectOption[] = [];
  protected _whereOptions: SelectOption[] = [];
  protected _tagsOptions: SelectOption[] = [];
  protected _favoriteOptions: SelectOption[];

  protected _defaults: MediaFilterCoreDefaults | null = null;
  protected _viewManager: ViewManagerInterface | null = null;

  constructor(host: LitElement) {
    this._host = host;

    this._favoriteOptions = [
      {
        value: MediaFilterCoreFavoriteSelection.Favorite,
        label: localize('media_filter.favorite'),
      },
      {
        value: MediaFilterCoreFavoriteSelection.NotFavorite,
        label: localize('media_filter.not_favorite'),
      },
    ];
    this._mediaTypeOptions = [
      {
        value: MediaFilterMediaType.Clips,
        label: localize('media_filter.media_types.clips'),
      },
      {
        value: MediaFilterMediaType.Snapshots,
        label: localize('media_filter.media_types.snapshots'),
      },
      {
        value: MediaFilterMediaType.Recordings,
        label: localize('media_filter.media_types.recordings'),
      },
    ];
    this._staticWhenOptions = [
      {
        value: MediaFilterCoreWhen.Today,
        label: localize('media_filter.whens.today'),
      },
      {
        value: MediaFilterCoreWhen.Yesterday,
        label: localize('media_filter.whens.yesterday'),
      },
      {
        value: MediaFilterCoreWhen.PastWeek,
        label: localize('media_filter.whens.past_week'),
      },
      {
        value: MediaFilterCoreWhen.PastMonth,
        label: localize('media_filter.whens.past_month'),
      },
      {
        value: MediaFilterCoreWhen.Custom,
        label: localize('media_filter.whens.custom'),
      },
    ];
    this._computeWhenOptions();
  }

  public getMediaTypeOptions(): SelectOption[] {
    return this._mediaTypeOptions;
  }
  public getCameraOptions(): SelectOption[] {
    return this._cameraOptions;
  }
  public getWhenOptions(): SelectOption[] {
    return this._whenOptions;
  }
  public getWhatOptions(): SelectOption[] {
    return this._whatOptions;
  }
  public getWhereOptions(): SelectOption[] {
    return this._whereOptions;
  }
  public getTagsOptions(): SelectOption[] {
    return this._tagsOptions;
  }
  public getFavoriteOptions(): SelectOption[] {
    return this._favoriteOptions;
  }
  public getDefaults(): MediaFilterCoreDefaults | null {
    return this._defaults;
  }
  public setViewManager(viewManager: ViewManagerInterface | null): void {
    this._viewManager = viewManager;
  }

  public async valueChangeHandler(
    cameraManager: CameraManager,
    cardWideConfig: CardWideConfig,
    values: {
      camera?: string | string[];
      mediaType?: MediaFilterMediaType;
      when: {
        selected?: string | string[];
        from?: Date | null;
        to?: Date | null;
      };
      favorite?: MediaFilterCoreFavoriteSelection;
      where?: string | string[];
      what?: string | string[];
      tags?: string | string[];
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _ev?: unknown,
  ): Promise<void> {
    const getArrayValueAsSet = (val?: SelectValues): Set<string> | null => {
      // The reported value may be '' if the field is clearable (i.e. the user
      // can click 'x').
      if (val && Array.isArray(val) && val.length && !val.includes('')) {
        return new Set([...val]);
      }
      return null;
    };

    const cameraIDs =
      getArrayValueAsSet(values.camera) ?? this._getAllCameraIDs(cameraManager);
    if (!cameraIDs.size || !values.mediaType) {
      return;
    }

    const when = this._getWhen(values.when);
    const favorite = values.favorite
      ? values.favorite === MediaFilterCoreFavoriteSelection.Favorite
      : null;

    // A note on views:
    // - In the below, if the user selects a camera to view media for, the main
    //   view camera is also set to that value (e.g. a user browsing the
    //   gallery, chooses a different camera in the media filter, then
    //   subsequently chooses the live button -- they would expect the live view
    //   for that filtered camera not the prior camera).
    // - Similarly, if the user chooses clips or snapshots, set the actual view
    //   to 'clips' or 'snapshots' in order to ensure the right icon is shown as
    //   selected in the menu.
    const limit = cardWideConfig.performance?.features.media_chunk_size;

    if (
      values.mediaType === MediaFilterMediaType.Clips ||
      values.mediaType === MediaFilterMediaType.Snapshots
    ) {
      const where = getArrayValueAsSet(values.where);
      const what = getArrayValueAsSet(values.what);
      const tags = getArrayValueAsSet(values.tags);

      const queries = new EventMediaQuery([
        {
          type: QueryType.Event,
          cameraIDs: cameraIDs,
          ...(tags && { tags: tags }),
          ...(what && { what: what }),
          ...(where && { where: where }),
          ...(favorite !== null && { favorite: favorite }),
          ...(when && {
            ...(when.start && { start: when.start }),
            ...(when.end && { end: when.end }),
          }),
          ...(limit && { limit: limit }),
          ...(values.mediaType === MediaFilterMediaType.Clips && { hasClip: true }),
          ...(values.mediaType === MediaFilterMediaType.Snapshots && {
            hasSnapshot: true,
          }),
        },
      ]);

      this._viewManager?.setViewByParametersWithExistingQuery({
        params: {
          query: queries,

          // See 'A note on views' above for these two arguments
          ...(cameraIDs.size === 1 && { camera: [...cameraIDs][0] }),
          view: values.mediaType === MediaFilterMediaType.Clips ? 'clips' : 'snapshots',
        },
      });
    } else {
      const queries = new RecordingMediaQuery([
        {
          type: QueryType.Recording,
          cameraIDs: cameraIDs,
          ...(limit && { limit: limit }),
          ...(when && {
            ...(when.start && { start: when.start }),
            ...(when.end && { end: when.end }),
          }),
          ...(favorite !== null && { favorite: favorite }),
        },
      ]);

      this._viewManager?.setViewByParametersWithExistingQuery({
        params: {
          query: queries,

          // See 'A note on views' above for these two arguments
          ...(cameraIDs.size === 1 && { camera: [...cameraIDs][0] }),
          view: 'recordings',
        },
      });
    }

    // Need to ensure we update the element as the date-picker selections may
    // have changed, and we need to un/set the selected class.
    this._host.requestUpdate();
  }

  protected _getAllCameraIDs(cameraManager: CameraManager): Set<string> {
    return cameraManager.getStore().getCameraIDsWithCapability({
      anyCapabilities: ['clips', 'snapshots', 'recordings'],
    });
  }

  public computeInitialDefaultsFromView(cameraManager: CameraManager): void {
    const view = this._viewManager?.getView();
    const query = view?.query;
    const allCameraIDs = this._getAllCameraIDs(cameraManager);
    if (!view || !QueryClassifier.isMediaQuery(query) || !allCameraIDs.size) {
      return;
    }

    const queries = query.getQuery();
    if (!queries) {
      return;
    }

    let mediaType: MediaFilterMediaType | undefined;
    let cameraIDs: string[] | undefined;
    let what: string[] | undefined;
    let where: string[] | undefined;
    let favorite: MediaFilterCoreFavoriteSelection | undefined;
    let tags: string[] | undefined;

    const cameraIDSets = uniqWith(
      queries.map((query: CameraQuery) => query.cameraIDs),
      isEqual,
    );
    // Special note: If all visible cameras are selected, this is the same as no
    // selector at all.
    if (cameraIDSets.length === 1 && !isEqual(queries[0].cameraIDs, allCameraIDs)) {
      cameraIDs = [...queries[0].cameraIDs];
    }

    const favoriteValues = uniqWith(
      queries.map((query) => query.favorite),
      isEqual,
    );
    if (favoriteValues.length === 1 && queries[0].favorite !== undefined) {
      favorite = queries[0].favorite
        ? MediaFilterCoreFavoriteSelection.Favorite
        : MediaFilterCoreFavoriteSelection.NotFavorite;
    }

    /* istanbul ignore else: the else path cannot be reached -- @preserve */
    if (QueryClassifier.isEventQuery(view.query)) {
      const queries = view.query.getQuery();

      /* istanbul ignore if: the if path cannot be reached -- @preserve */
      if (!queries) {
        return;
      }

      const hasClips = uniqWith(
        queries.map((query) => query.hasClip),
        isEqual,
      );
      const hasSnapshots = uniqWith(
        queries.map((query) => query.hasSnapshot),
        isEqual,
      );
      if (hasClips.length === 1 && hasSnapshots.length === 1) {
        mediaType = !!hasClips[0]
          ? MediaFilterMediaType.Clips
          : !!hasSnapshots[0]
            ? MediaFilterMediaType.Snapshots
            : undefined;
      }

      const whatSets = uniqWith(
        queries.map((query) => query.what),
        isEqual,
      );
      if (whatSets.length === 1 && queries[0].what?.size) {
        what = [...queries[0].what];
      }
      const whereSets = uniqWith(
        queries.map((query) => query.where),
        isEqual,
      );
      if (whereSets.length === 1 && queries[0].where?.size) {
        where = [...queries[0].where];
      }
      const tagsSets = uniqWith(
        queries.map((query) => query.tags),
        isEqual,
      );
      if (tagsSets.length === 1 && queries[0].tags?.size) {
        tags = [...queries[0].tags];
      }
    } else if (QueryClassifier.isRecordingQuery(view.query)) {
      mediaType = MediaFilterMediaType.Recordings;
    }

    this._defaults = {
      ...(mediaType && { mediaType: mediaType }),
      ...(cameraIDs && { cameraIDs: cameraIDs }),
      ...(what && { what: what }),
      ...(where && { where: where }),
      ...(favorite !== undefined && { favorite: favorite }),
      ...(tags && { tags: tags }),
    };
  }

  public computeCameraOptions(cameraManager: CameraManager): void {
    this._cameraOptions = [...this._getAllCameraIDs(cameraManager)].map((cameraID) => ({
      value: cameraID,
      label: cameraManager.getCameraMetadata(cameraID)?.title ?? cameraID,
    }));
  }

  public async computeMetadataOptions(cameraManager: CameraManager): Promise<void> {
    let metadata: MediaMetadata | null = null;
    try {
      metadata = await cameraManager.getMediaMetadata();
    } catch (e) {
      errorToConsole(e as Error);
    }
    if (!metadata) {
      return;
    }

    if (metadata.what) {
      this._whatOptions = [...metadata.what]
        .sort()
        .map((what) => ({ value: what, label: prettifyTitle(what) }));
    }
    if (metadata.where) {
      this._whereOptions = [...metadata.where]
        .sort()
        .map((where) => ({ value: where, label: prettifyTitle(where) }));
    }
    if (metadata.tags) {
      this._tagsOptions = [...metadata.tags]
        .sort()
        .map((tag) => ({ value: tag, label: prettifyTitle(tag) }));
    }
    if (metadata.days) {
      const yearMonths: Set<string> = new Set();
      [...metadata.days].forEach((day) => {
        // An efficient conversion: "2023-01-26" -> "2023-01"
        yearMonths.add(day.substring(0, 7));
      });

      const monthStarts: Date[] = [];
      yearMonths.forEach((yearMonth) => {
        monthStarts.push(parse(yearMonth, 'yyyy-MM', new Date()));
      });

      this._metaDataWhenOptions = orderBy(
        monthStarts,
        (date) => date.getTime(),
        'desc',
      ).map((monthStart) => ({
        label: format(monthStart, 'MMMM yyyy'),
        value: this._dateRangeToString({
          start: monthStart,
          end: endOfMonth(monthStart),
        }),
      }));
      this._computeWhenOptions();
    }

    this._host.requestUpdate();
  }

  public getControlsToShow(cameraManager: CameraManager): MediaFilterControls {
    const view = this._viewManager?.getView();
    const events = QueryClassifier.isEventQuery(view?.query);
    const recordings = QueryClassifier.isRecordingQuery(view?.query);
    const managerCapabilities = cameraManager.getAggregateCameraCapabilities();

    return {
      events: events,
      recordings: recordings,
      favorites: events
        ? managerCapabilities?.has('favorite-events')
        : recordings
          ? managerCapabilities?.has('favorite-recordings')
          : false,
    };
  }

  protected _computeWhenOptions(): void {
    this._whenOptions = [...this._staticWhenOptions, ...this._metaDataWhenOptions];
  }

  protected _dateRangeToString(when: DateRange): string {
    return `${formatDate(when.start)},${formatDate(when.end)}`;
  }

  protected _stringToDateRange(input: string): DateRange {
    const dates = input.split(',');
    return {
      start: parse(dates[0], 'yyyy-MM-dd', new Date()),
      end: endOfDay(parse(dates[1], 'yyyy-MM-dd', new Date())),
    };
  }

  protected _getWhen(values: {
    selected?: string | string[];
    from?: Date | null;
    to?: Date | null;
  }): PartialDateRange | null {
    if (values.from || values.to) {
      return {
        ...(values.from && { start: values.from }),
        ...(values.to && { end: values.to }),
      };
    }

    if (!values.selected || Array.isArray(values.selected)) {
      return null;
    }

    const now = new Date();
    switch (values.selected) {
      case MediaFilterCoreWhen.Custom:
        return null;
      case MediaFilterCoreWhen.Today:
        return { start: startOfToday(), end: endOfToday() };
      case MediaFilterCoreWhen.Yesterday:
        return { start: startOfYesterday(), end: endOfYesterday() };
      case MediaFilterCoreWhen.PastWeek:
        return { start: startOfDay(sub(now, { days: 7 })), end: endOfDay(now) };
      case MediaFilterCoreWhen.PastMonth:
        return { start: startOfDay(sub(now, { months: 1 })), end: endOfDay(now) };
      default:
        return this._stringToDateRange(values.selected);
    }
  }
}
