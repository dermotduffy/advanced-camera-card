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
