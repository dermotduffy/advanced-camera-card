import type { DateType, IdType, Timeline, TimelineWindow } from 'vis-timeline';

import type { CameraManager } from '../../camera-manager/manager';
import type { ViewItemManager } from '../../card-controller/view/item-manager';
import type { ViewManagerEpoch } from '../../card-controller/view/types';
import type { CameraConfig } from '../../config/schema/cameras';
import type { HomeAssistant } from '../../ha/types';
import type { ViewMedia } from '../../view/item';

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
