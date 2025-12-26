import { DateType, IdType, Timeline, TimelineWindow } from 'vis-timeline';
import { CameraManager } from '../../camera-manager/manager';
import { ViewItemManager } from '../../card-controller/view/item-manager';
import { ViewManagerEpoch } from '../../card-controller/view/types';
import { CameraConfig } from '../../config/schema/cameras';
import { FolderConfig } from '../../config/schema/folders';
import { HomeAssistant } from '../../ha/types';
import { ViewMedia } from '../../view/item';
import { QueryType } from '../../view/query-classifier';

// An event used to fetch data required for thumbnail rendering. See special
// note in AdvancedCameraCardTimelineThumbnail on why this is necessary.
export interface ThumbnailDataRequest {
  item: IdType;
  hass?: HomeAssistant;
  cameraManager?: CameraManager;
  cameraConfig?: CameraConfig;
  media?: ViewMedia;
  viewManagerEpoch?: ViewManagerEpoch;
  viewItemManager?: ViewItemManager;
}

export class ThumbnailDataRequestEvent extends CustomEvent<ThumbnailDataRequest> {}

export type TimelineKeys =
  | {
      type: 'camera';
      cameraIDs: Set<string>;
      queryType: Exclude<QueryType, 'folder'>;
    }
  | {
      type: 'folder';
      folder: FolderConfig;
    };

export interface ExtendedTimeline extends Timeline {
  // setCustomTimeMarker currently missing from Timeline types.
  setCustomTimeMarker?(time: DateType, id?: IdType): void;
}

export interface TimelineRangeChange extends TimelineWindow {
  event: Event & { additionalEvent?: string };
  byUser: boolean;
}

export type TimelineItemClickAction = 'play' | 'select';

interface TimelineViewContext {
  window?: TimelineWindow;
}

declare module 'view' {
  interface ViewContext {
    timeline?: TimelineViewContext;
  }
}
