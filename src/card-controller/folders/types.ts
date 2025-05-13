import { FolderConfig } from '../../config/schema/folders';
import { ResolvedMediaCache } from '../../ha/resolved-media';
import { HomeAssistant } from '../../ha/types';
import { Endpoint } from '../../types';
import { AdvancedCameraCardError } from '../../types.js';
import { ViewItem } from '../../view/item';
import { ViewItemCapabilities } from '../../view/types';

// ====
// Base
// ====

export interface EngineOptions {
  useCache?: boolean;
}

export class FolderInitializationError extends AdvancedCameraCardError {}

// ============
// Folder Query
// ============

export interface FolderQuery {
  folder: FolderConfig;
  path?: string;

  // The path to navigate back to the "root". Not directly used by any current
  // engine, but used to navigate from one FolderQuery to the next.
  parentPaths?: string[];
}

// ===============
// Folders Engines
// ===============

export interface DownloadHelpers {
  resolvedMediaCache?: ResolvedMediaCache | null;
}

export interface FoldersEngine {
  expandFolder(
    hass: HomeAssistant,
    query: FolderQuery,
    engineOptions?: EngineOptions,
  ): Promise<ViewItem[] | null>;

  getItemCapabilities(item: ViewItem): ViewItemCapabilities | null;
  getDownloadPath(
    hass: HomeAssistant | null,
    item: ViewItem,
    options?: DownloadHelpers,
  ): Promise<Endpoint | null>;
  favorite(hass: HomeAssistant | null, item: ViewItem, favorite: boolean): Promise<void>;
}
