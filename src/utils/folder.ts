import { FolderConfig } from '../config/schema/folders';
import { RawAdvancedCameraCardConfig } from '../config/types';

/**
 * Get a folder id.
 * @param config The folder config (either parsed or raw).
 * @param index The index of the folder in the config array (used for default ID).
 * @returns A folder id.
 */
export function getFolderID(
  config?: FolderConfig | RawAdvancedCameraCardConfig | null,
  index?: number,
): string {
  return (
    (typeof config?.id === 'string' && config.id) || `folder/${(index ?? 0).toString()}`
  );
}
