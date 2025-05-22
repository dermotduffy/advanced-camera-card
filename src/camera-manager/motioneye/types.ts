import { BrowseMediaMetadata, RichBrowseMedia } from '../../ha/browse-media/types';
import { Engine, EventQueryResults } from '../types';

// ================================
// MotionEye concrete query results
// ================================

export interface MotionEyeEventQueryResults extends EventQueryResults {
  engine: Engine.MotionEye;
  browseMedia: RichBrowseMedia<BrowseMediaMetadata>[];
}
