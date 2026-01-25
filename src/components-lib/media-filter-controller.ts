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
import { isEqual, orderBy } from 'lodash-es';
import { CameraManager, CameraQueryClassifier } from '../camera-manager/manager';
import { DateRange, PartialDateRange } from '../camera-manager/range';
import {
  EventQuery,
  MediaMetadata,
  QueryType,
  ReviewQuery,
} from '../camera-manager/types';
import { FoldersManager } from '../card-controller/folders/manager';
import { ViewManagerInterface } from '../card-controller/view/types';
import { SelectOption, SelectValues } from '../components/select';
import { CardWideConfig } from '../config/schema/types';
import { localize } from '../localize/localize';
import { SEVERITIES, Severity } from '../severity';
import { ViewMediaType } from '../types';
import { errorToConsole, formatDate, prettifyTitle } from '../utils/basic';
import { UnifiedQueryBuilder } from '../view/unified-query-builder';

export interface MediaFilterCoreDefaults {
  cameraIDs?: string[];
  favorite?: MediaFilterCoreFavoriteSelection;
  reviewed?: MediaFilterCoreReviewedSelection;
  mediaTypes?: MediaFilterMediaType[];
  what?: string[];
  when?: string;
  where?: string[];
  tags?: string[];
  severity?: Severity[];
}

export enum MediaFilterCoreFavoriteSelection {
  Favorite = 'favorite',
  NotFavorite = 'not-favorite',
}

export enum MediaFilterCoreReviewedSelection {
  Reviewed = 'reviewed',
  NotReviewed = 'not-reviewed',
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
  Reviews = 'reviews',
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
  protected _reviewedOptions: SelectOption[];
  protected _severityOptions: SelectOption[];

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
      {
        value: MediaFilterMediaType.Reviews,
        label: localize('media_filter.media_types.reviews'),
      },
    ];
    this._reviewedOptions = [
      {
        value: MediaFilterCoreReviewedSelection.Reviewed,
        label: localize('media_filter.reviewed'),
      },
      {
        value: MediaFilterCoreReviewedSelection.NotReviewed,
        label: localize('media_filter.not_reviewed'),
      },
    ];
    this._severityOptions = SEVERITIES.map((severity) => ({
      value: severity,
      label: localize(`common.severities.${severity}`),
    }));
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
  public getReviewedOptions(): SelectOption[] {
    return this._reviewedOptions;
  }
  public getSeverityOptions(): SelectOption[] {
    return this._severityOptions;
  }
  public getDefaults(): MediaFilterCoreDefaults | null {
    return this._defaults;
  }
  public setViewManager(viewManager: ViewManagerInterface | null): void {
    this._viewManager = viewManager;
  }

  public async valueChangeHandler(
    cameraManager: CameraManager,
    foldersManager: FoldersManager,
    cardWideConfig: CardWideConfig,
    values: {
      camera?: SelectValues;
      mediaTypes?: SelectValues;
      when: {
        selected?: SelectValues;
        from?: Date | null;
        to?: Date | null;
      };
      favorite?: SelectValues;
      reviewed?: SelectValues;
      where?: SelectValues;
      what?: SelectValues;
      tags?: SelectValues;
      severity?: SelectValues;
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _ev?: unknown,
  ): Promise<void> {
    const getArrayValueAsSet = <T extends string>(val?: SelectValues): Set<T> | null => {
      // The reported value may be '' if the field is clearable (i.e. the user
      // can click 'x').
      if (val && Array.isArray(val) && val.length && !val.includes('')) {
        return new Set([...val]) as Set<T>;
      }
      return null;
    };

    const when = this._getWhen(values.when);
    const favorite = values.favorite
      ? values.favorite === MediaFilterCoreFavoriteSelection.Favorite
      : null;
    const reviewed = values.reviewed
      ? values.reviewed === MediaFilterCoreReviewedSelection.Reviewed
      : null;
    const where = getArrayValueAsSet(values.where);
    const what = getArrayValueAsSet(values.what);
    const tags = getArrayValueAsSet(values.tags);
    const severity = getArrayValueAsSet<Severity>(values.severity);
    const limit = cardWideConfig.performance?.features.media_chunk_size;

    const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
    const query = builder.buildFilterQuery(
      getArrayValueAsSet(values.camera),
      getArrayValueAsSet<ViewMediaType>(values.mediaTypes),
      {
        ...(when?.start && { start: when.start }),
        ...(when?.end && { end: when.end }),
        ...(limit && { limit }),
        ...(favorite !== null && { favorite }),
        ...(reviewed !== null && { reviewed }),
        ...(tags && { tags }),
        ...(what && { what }),
        ...(where && { where }),
        ...(severity && { severity }),
      },
    );

    if (!query) {
      return;
    }

    // Get camera IDs from the query (builder may have defaulted these)
    const queryCameraIDs = query.getAllCameraIDs();
    const cameraID = queryCameraIDs.size === 1 ? [...queryCameraIDs][0] : undefined;

    this._viewManager?.setViewByParametersWithExistingQuery({
      params: {
        query,
        // If single camera, set it as the active camera for menu navigation
        ...(cameraID && { camera: cameraID }),
      },
    });

    // Need to ensure we update the element as the date-picker selections may
    // have changed, and we need to un/set the selected class.
    this._host.requestUpdate();
  }

  public computeInitialDefaultsFromView(
    cameraManager: CameraManager,
    foldersManager: FoldersManager,
  ): void {
    const view = this._viewManager?.getView();
    const query = view?.query;
    const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
    const allCameraIDs = builder.getAllMediaCapableCameraIDs();
    if (!view || !query?.hasNodes() || !allCameraIDs.size) {
      return;
    }

    const mediaQueries = query.getMediaQueries();
    const mediaTypes: MediaFilterMediaType[] = [];
    let cameraIDs: string[] | undefined;
    let what: string[] | undefined;
    let where: string[] | undefined;
    let favorite: MediaFilterCoreFavoriteSelection | undefined;
    let reviewed: MediaFilterCoreReviewedSelection | undefined;
    let tags: string[] | undefined;
    let severity: Severity[] | undefined;

    const cameraIDsFromQuery = query.getAllCameraIDs();

    // Note: With folder filtering, selecting all cameras is NOT the same as
    // selecting none. "All cameras" means just camera media, while "none"
    // would include folder media too.
    if (cameraIDsFromQuery.size > 0) {
      cameraIDs = [...cameraIDsFromQuery];
    }

    // Extract favorite from all media queries (only if explicitly set to true/false)
    const favoriteValues = new Set(
      mediaQueries.map((mediaQuery) =>
        CameraQueryClassifier.isEventQuery(mediaQuery) ? mediaQuery.favorite : undefined,
      ),
    );
    if (favoriteValues.size === 1) {
      const fav = [...favoriteValues][0];
      if (fav !== undefined) {
        favorite = fav
          ? MediaFilterCoreFavoriteSelection.Favorite
          : MediaFilterCoreFavoriteSelection.NotFavorite;
      }
    }

    // Detect media types from queries
    const eventQueries = query.getMediaQueries<EventQuery>({ type: QueryType.Event });
    if (eventQueries.length > 0) {
      const hasClips = eventQueries.some((q) => q.hasClip);
      const hasSnapshots = eventQueries.some((q) => q.hasSnapshot);
      const hasNeither = !hasClips && !hasSnapshots;

      if (hasClips || hasNeither) {
        mediaTypes.push(MediaFilterMediaType.Clips);
      }
      if (hasSnapshots || hasNeither) {
        mediaTypes.push(MediaFilterMediaType.Snapshots);
      }
    }
    if (query.hasMediaQueriesOfType(QueryType.Recording)) {
      mediaTypes.push(MediaFilterMediaType.Recordings);
    }
    if (query.hasMediaQueriesOfType(QueryType.Review)) {
      mediaTypes.push(MediaFilterMediaType.Reviews);
    }

    const whatSets = eventQueries.map((q) => q.what);
    if (this._hasSingleUniqueValue(whatSets) && whatSets[0]?.size) {
      what = [...whatSets[0]];
    }

    const whereSets = eventQueries.map((q) => q.where);
    if (this._hasSingleUniqueValue(whereSets) && whereSets[0]?.size) {
      where = [...whereSets[0]];
    }

    const tagsSets = eventQueries.map((q) => q.tags);
    if (this._hasSingleUniqueValue(tagsSets) && tagsSets[0]?.size) {
      tags = [...tagsSets[0]];
    }

    // Extract reviewed from review queries (only if explicitly set to true/false)
    const reviewQueries = query.getMediaQueries<ReviewQuery>({ type: QueryType.Review });
    const reviewedValues = new Set(reviewQueries.map((q) => q.reviewed));
    if (reviewedValues.size === 1) {
      const rev = [...reviewedValues][0];
      if (rev !== undefined) {
        reviewed = rev
          ? MediaFilterCoreReviewedSelection.Reviewed
          : MediaFilterCoreReviewedSelection.NotReviewed;
      }
    }

    const severitySets = reviewQueries.map((q) => q.severity);
    if (this._hasSingleUniqueValue(severitySets) && severitySets[0]?.size) {
      severity = [...severitySets[0]];
    }

    this._defaults = {
      ...(mediaTypes.length && { mediaTypes }),
      ...(cameraIDs && { cameraIDs }),
      ...(what && { what }),
      ...(where && { where }),
      ...(favorite !== undefined && { favorite }),
      ...(reviewed !== undefined && { reviewed }),
      ...(tags && { tags }),
      ...(severity && { severity }),
    };
  }

  public computeCameraOptions(
    cameraManager: CameraManager,
    foldersManager: FoldersManager,
  ): void {
    const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
    this._cameraOptions = [...builder.getAllMediaCapableCameraIDs()].map((cameraID) => ({
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

  protected _hasSingleUniqueValue(sets: (Set<unknown> | undefined)[]): boolean {
    if (sets.length === 0) {
      return false;
    }
    return sets.every((s) => isEqual(s, sets[0]));
  }
}
