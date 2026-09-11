import { format, isToday, isYesterday } from 'date-fns';

import type { CameraManager } from '../../../camera-manager/manager';
import { localize } from '../../../localize/localize';
import { isTruthy } from '../../../utils/basic';
import type { ViewItem } from '../../../view/item';
import { ViewItemClassifier } from '../../../view/item-classifier';
import {
  getMediaCameraTitle,
  getMediaDuration,
  getMediaLabel,
  getMediaTags,
  getMediaWhere,
  joinValues,
} from '../../media/format';
import { getThumbnailTier, type ThumbnailTier } from '../tier';

// The lines the panel show, always smaller than the actual thumbnail.
const LINES_BY_TIER: Record<ThumbnailTier, number> = {
  compact: 3,
  standard: 4,
  comfortable: 7,
  poster: 7,
};

// Today and yesterday are named. Anything older needs its date.
const formatDay = (startTime: Date): string =>
  isToday(startTime)
    ? localize('common.today')
    : isYesterday(startTime)
      ? localize('common.yesterday')
      : format(startTime, 'yyyy-MM-dd');

export interface ThumbnailDetailsPanelOptions {
  cameraManager?: CameraManager;
  item?: ViewItem;
  seek?: Date;
  size?: number;
}

export interface ThumbnailDetailsPanelTime {
  hoursMinutes: string;
  seconds: string;
}

export class ThumbnailDetailsPanelController {
  private _tier: ThumbnailTier = 'standard';
  private _label: string | null = null;
  private _time: ThumbnailDetailsPanelTime | null = null;
  private _details: string[] = [];
  private _seekTime: string | null = null;
  private _hiddenDetailCount = 0;

  public calculate(options: ThumbnailDetailsPanelOptions): void {
    this._tier = getThumbnailTier(options.size);
    this._label = getMediaLabel(options.cameraManager, options.item);
    this._seekTime = options.seek ? format(options.seek, 'HH:mm:ss') : null;

    const startTime = ViewItemClassifier.isMedia(options.item)
      ? options.item.getStartTime()
      : null;
    this._time = startTime
      ? { hoursMinutes: format(startTime, 'HH:mm'), seconds: format(startTime, ':ss') }
      : null;

    const cameraTitle = getMediaCameraTitle(options.cameraManager, options.item);

    this._fitLines(
      this._groupLines({
        date: startTime ? formatDay(startTime) : null,
        duration: getMediaDuration(options.item),
        camera: cameraTitle === this._label ? null : cameraTitle,
        where: getMediaWhere(options.item),
        tags: getMediaTags(options.item),
      }),
    );
  }

  // Groups the values into the lines they are shown on. The compact panel has
  // room for two lines, every other panel for three.
  private _groupLines(values: {
    date: string | null;
    duration: string | null;
    camera: string | null;
    where: string | null;
    tags: string | null;
  }): string[][] {
    const { date, duration, camera, where, tags } = values;

    const lines =
      this._tier === 'compact'
        ? [
            [date, duration, camera],
            [where, tags],
          ]
        : [[date, duration], [camera, where], [tags]];

    return lines.map((line) => line.filter(isTruthy)).filter((line) => line.length);
  }

  private _fitLines(lines: string[][]): void {
    const available =
      LINES_BY_TIER[this._tier] - (this._label ? 1 : 0) - (this._seekTime ? 1 : 0);

    // The "More details" chip takes a line of its own.
    const kept =
      lines.length <= available ? lines : lines.slice(0, Math.max(available - 1, 0));

    this._details = kept.map((line) => joinValues(...line)).filter(isTruthy);

    // The chip counts the values the reader cannot see (not the lines they
    // would have taken).
    this._hiddenDetailCount = lines.slice(kept.length).flat().length;
  }

  public getTier(): ThumbnailTier {
    return this._tier;
  }

  public getLabel(): string | null {
    return this._label;
  }

  public getTime(): ThumbnailDetailsPanelTime | null {
    return this._time;
  }

  public getDetails(): string[] {
    return this._details;
  }

  // Kept separate from the details so it avoids truncation.
  public getSeekTime(): string | null {
    return this._seekTime;
  }

  /**
   * @returns How many values the panel had no room for, or `0` if they all
   * fit.
   */
  public getHiddenDetailCount(): number {
    return this._hiddenDetailCount;
  }
}
