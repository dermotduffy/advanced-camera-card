import { NonEmptyTuple } from 'type-fest';
import { FolderPathComponent, FolderQuery } from '../card-controller/folders/types';
import { ViewManagerEpoch, ViewModifier } from '../card-controller/view/types';
import { ViewFolder, ViewMedia } from '../view/item';
import { UnifiedQuery } from '../view/unified-query';
import { UnifiedQueryBuilder } from '../view/unified-query-builder';

export interface FolderNavigationParamaters {
  viewManagerEpoch: ViewManagerEpoch;
  builder: UnifiedQueryBuilder;

  limit?: number;
}

export interface MediaNavigationParamaters {
  viewManagerEpoch: ViewManagerEpoch;

  modifiers?: ViewModifier[];
}

/**
 * Get a navigable-up folder query from a UnifiedQuery. Returns the query only
 * if there's exactly one folder query and it has depth > 1.
 */
const getSingleNavigableUpFolderQuery = (
  query?: UnifiedQuery | null,
): FolderQuery | null => {
  const folderQueries = query?.getFolderQueries();
  if (folderQueries?.length !== 1) {
    return null;
  }
  const folderQuery = folderQueries[0];
  return folderQuery.path.length > 1 ? folderQuery : null;
};

export const navigateUp = (options?: FolderNavigationParamaters | null): void => {
  const folderQuery = getSingleNavigableUpFolderQuery(
    options?.viewManagerEpoch.manager.getView()?.query,
  );
  if (!folderQuery || folderQuery.path.length < 2) {
    return;
  }

  const parentPath = folderQuery.path.slice(0, -1);
  const nonEmptyPath: NonEmptyTuple<FolderPathComponent> = [
    parentPath[0],
    ...parentPath.slice(1),
  ];
  const query = options?.builder.buildFolderQuery(folderQuery.folder, nonEmptyPath, {
    limit: options?.limit,
  });

  options?.viewManagerEpoch.manager.setViewByParametersWithExistingQuery({
    params: { query },
  });
};

export const navigateToFolder = (
  item: ViewFolder,
  options?: FolderNavigationParamaters | null,
): void => {
  const newPath = [...item.getPath(), { folder: item }];
  const nonEmptyPath: NonEmptyTuple<FolderPathComponent> = [
    newPath[0],
    ...newPath.slice(1),
  ];
  const query = options?.builder.buildFolderQuery(item.getFolder(), nonEmptyPath, {
    limit: options?.limit,
  });

  options?.viewManagerEpoch?.manager.setViewByParametersWithExistingQuery({
    params: { query },
  });
};

export const navigateToMedia = (
  media: ViewMedia,
  options?: MediaNavigationParamaters | null,
): void => {
  const manager = options?.viewManagerEpoch.manager;
  const view = manager?.getView();

  if (!manager || !view?.queryResults || !options) {
    return;
  }

  const newResults = view.queryResults
    .clone()
    .selectResultIfFound((result) => result === media);

  const cameraID = media.getCameraID();
  manager.setViewByParameters({
    params: {
      view: 'media',
      queryResults: newResults,
      ...(cameraID && { camera: cameraID }),
    },
    modifiers: options?.modifiers,
  });
};

/**
 * Get up-folder item for display. Returns a ViewFolder if there's exactly one
 * folder query and it's navigable-up.
 */
export const getUpFolderItem = (query?: UnifiedQuery | null): ViewFolder | null => {
  const folderQuery = getSingleNavigableUpFolderQuery(query);
  return folderQuery
    ? new ViewFolder(folderQuery.folder, folderQuery.path, {
        icon: 'mdi:arrow-up-left',
      })
    : null;
};
