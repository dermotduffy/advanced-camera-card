import type { BrowseMediaMetadata, RichBrowseMedia } from '../../ha/browse-media/types';
import type { Engine, EventQueryResults } from '../types';

export interface BrowseMediaReolinkCameraMetadata {
  configEntryID: string;
  channel: number;
}

// ==============================
// Reolink concrete query results
// ==============================

export interface ReolinkEventQueryResults extends EventQueryResults {
  engine: Engine.Reolink;
  browseMedia: RichBrowseMedia<BrowseMediaMetadata>[];
}

/**
 * How the Reolink integration refers to a camera: the device or NVR it belongs
 * to, the channel that device knows it by, and -- for a camera behind an NVR or
 * hub -- the camera's own identifier. Read from the camera entity.
 */
export interface ReolinkIdentity {
  hostID: string;
  channel: number;

  // Absent for a camera connected directly rather than through an NVR or hub.
  cameraUID?: string;
}
