import { Severity } from './severity';

export enum QuerySource {
  // Camera queries are handled by CameraManager.
  Camera = 'camera',

  // Folder queries are handled by FolderManager.
  Folder = 'folder',
}

export interface BaseQuery {
  source: QuerySource;
}

/**
 * Filter properties that can be applied to queries.
 * Not all query types support all filters -- engines reject unsupported ones.
 */
export interface QueryFilters {
  favorite?: boolean;
  tags?: Set<string>;
  what?: Set<string>;
  where?: Set<string>;
  reviewed?: boolean;
  severity?: Set<Severity>;
}

/**
 * Declares which filters a query handler supports.
 * Used by hasUnsupportedFilters() to check compatibility.
 */
interface SupportedFilters {
  favorite?: boolean;
  tags?: boolean;
  what?: boolean;
  where?: boolean;
  reviewed?: boolean;
  severity?: boolean;
}

/**
 * Check if a query has filters that aren't supported.
 * Returns true if the query has any filter that isn't in the supported set.
 */
export const hasUnsupportedFilters = (
  query: QueryFilters,
  supported: SupportedFilters = {},
): boolean => {
  return (
    (!supported.favorite && query.favorite !== undefined) ||
    (!supported.tags && !!query.tags?.size) ||
    (!supported.what && !!query.what?.size) ||
    (!supported.where && !!query.where?.size) ||
    (!supported.reviewed && query.reviewed !== undefined) ||
    (!supported.severity && !!query.severity?.size)
  );
};
