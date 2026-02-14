import { isEqual } from 'lodash-es';
import { CameraManager } from '../camera-manager/manager';
import { StatusBarItem } from '../config/schema/actions/types';
import { StatusBarConfig } from '../config/schema/status-bar';
import { MediaLoadedInfo } from '../types';
import { View } from '../view/view';
import { CardStatusBarAPI } from './types';

const RESOLUTION_TOLERANCE_PCT = 0.01;

export class StatusBarItemManager {
  protected _api: CardStatusBarAPI;

  constructor(api: CardStatusBarAPI) {
    this._api = api;
  }

  protected _items: StatusBarItem[] = [];
  protected _dynamicItems: StatusBarItem[] = [];

  public addDynamicStatusBarItem(item: StatusBarItem): void {
    if (!this._dynamicItems.includes(item)) {
      this._dynamicItems.push(item);
    }
    this._api.getCardElementManager().update();
  }

  public removeDynamicStatusBarItem(item: StatusBarItem): void {
    this._dynamicItems = this._dynamicItems.filter(
      (existingItem) => !isEqual(existingItem, item),
    );
    this._api.getCardElementManager().update();
  }

  public removeAllDynamicStatusBarItems(): void {
    this._dynamicItems = [];
    this._api.getCardElementManager().update();
  }

  public calculateItems(options?: {
    statusConfig?: StatusBarConfig | null;
    cameraManager?: CameraManager | null;
    view?: View | null;
    mediaLoadedInfo?: MediaLoadedInfo | null;
  }): StatusBarItem[] {
    const cameraMetadata = options?.view?.camera
      ? options?.cameraManager?.getCameraMetadata(options.view.camera)
      : null;
    const engineIcon = cameraMetadata?.engineIcon ?? null;
    const selectedResult = options?.view?.queryResults?.getSelectedResult();
    const severity = selectedResult?.getSeverity() ?? null;
    const title = options?.view?.is('live')
      ? cameraMetadata?.title ?? null
      : options?.view?.isViewerView()
        ? selectedResult?.getTitle() ?? null
        : null;
    const resolution = options?.mediaLoadedInfo
      ? this._calculateResolution(options?.mediaLoadedInfo)
      : null;
    const technology = options?.mediaLoadedInfo?.technology?.length
      ? options?.mediaLoadedInfo.technology[0]
      : null;

    return [
      ...(severity
        ? [
            {
              type: 'custom:advanced-camera-card-status-bar-icon' as const,
              icon: 'mdi:circle-medium',
              severity,
              ...options?.statusConfig?.items.severity,
            },
          ]
        : []),

      ...(title
        ? [
            {
              type: 'custom:advanced-camera-card-status-bar-string' as const,
              string: title,
              expand: true,
              sufficient: true,
              ...options?.statusConfig?.items.title,
            },
          ]
        : []),

      ...(resolution
        ? [
            {
              type: 'custom:advanced-camera-card-status-bar-string' as const,
              string: resolution,
              ...options?.statusConfig?.items.resolution,
            },
          ]
        : []),

      ...(technology && technology === 'webrtc'
        ? [
            {
              type: 'custom:advanced-camera-card-status-bar-icon' as const,
              icon: 'mdi:webrtc',
              ...options?.statusConfig?.items.technology,
            },
          ]
        : !!technology
          ? [
              {
                type: 'custom:advanced-camera-card-status-bar-string' as const,
                string: technology.toUpperCase(),
                ...options?.statusConfig?.items.technology,
              },
            ]
          : []),

      ...(engineIcon
        ? [
            {
              type: 'custom:advanced-camera-card-status-bar-icon' as const,
              icon: engineIcon,
              ...options?.statusConfig?.items.engine,
            },
          ]
        : []),
      ...this._dynamicItems,
    ];
  }

  protected _matchesWidthHeight(
    mediaLoadedInfo: MediaLoadedInfo | null,
    width: number,
    height: number,
  ): boolean {
    const widthMin = width * (1 - RESOLUTION_TOLERANCE_PCT);
    const widthMax = width * (1 + RESOLUTION_TOLERANCE_PCT);
    const heightMin = height * (1 - RESOLUTION_TOLERANCE_PCT);
    const heightMax = height * (1 + RESOLUTION_TOLERANCE_PCT);

    const matchesDimension = (val: number, min: number, max: number): boolean => {
      return val >= min && val <= max;
    };

    // Allows matching the resolution width and height in either orientation,
    // and within RESOLUTION_TOLERANCE_PCT of the resolution.
    return (
      !!mediaLoadedInfo &&
      ((matchesDimension(mediaLoadedInfo.width, widthMin, widthMax) &&
        matchesDimension(mediaLoadedInfo.height, heightMin, heightMax)) ||
        (matchesDimension(mediaLoadedInfo.height, widthMin, widthMax) &&
          matchesDimension(mediaLoadedInfo.width, heightMin, heightMax)))
    );
  }

  protected _calculateResolution(mediaLoadedInfo: MediaLoadedInfo): string {
    // Ordered roughly by a guess at most common towards the top.
    if (this._matchesWidthHeight(mediaLoadedInfo, 1920, 1080)) {
      return '1080p';
    } else if (this._matchesWidthHeight(mediaLoadedInfo, 1280, 720)) {
      return '720p';
    } else if (this._matchesWidthHeight(mediaLoadedInfo, 640, 480)) {
      return 'VGA';
    } else if (this._matchesWidthHeight(mediaLoadedInfo, 3840, 2160)) {
      return '4K';
    } else if (this._matchesWidthHeight(mediaLoadedInfo, 720, 480)) {
      return '480p';
    } else if (this._matchesWidthHeight(mediaLoadedInfo, 720, 576)) {
      return '576p';
    } else if (this._matchesWidthHeight(mediaLoadedInfo, 7680, 4320)) {
      return '8K';
    } else {
      return `${mediaLoadedInfo.width}x${mediaLoadedInfo.height}`;
    }
  }
}
