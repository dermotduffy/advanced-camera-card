import type { FoldersManager } from '../card-controller/folders/manager';
import type { FolderQuery } from '../card-controller/folders/types';
import type { ViewManagerEpoch, ViewModifier } from '../card-controller/view/types';
import { localize } from '../localize/localize';
import { ViewFolder, type ViewMedia } from '../view/item';
import type { UnifiedQuery } from '../view/unified-query';
import type { UnifiedQueryBuilder } from '../view/unified-query-builder';

export interface FolderNavigationParamaters {
  viewManagerEpoch: ViewManagerEpoch;
  foldersManager: FoldersManager;
  builder: UnifiedQueryBuilder;
}

export interface MediaNavigationParamaters {
  viewManagerEpoch: ViewManagerEpoch;

  modifiers?: ViewModifier[];
}

/**
 * The view's folder query, or null if it does not have exactly one.
 */
const getSingleFolderQuery = (query?: UnifiedQuery | null): FolderQuery | null => {
  const folderQueries = query?.getFolderQueries();
  return folderQueries?.length === 1 ? folderQueries[0] : null;
};

const getUpQuery = (options: FolderNavigationParamaters): FolderQuery | null => {
  const folderQuery = getSingleFolderQuery(
    options.viewManagerEpoch.manager.getView()?.query,
  );
  return folderQuery ? options.foldersManager.getUpQuery(folderQuery) : null;
};

const setFolderView = (
  folderQuery: FolderQuery,
  options: FolderNavigationParamaters,
): void => {
  options.viewManagerEpoch.manager
    .setViewByParametersWithExistingQuery({
      params: { query: options.builder.buildFolderQuery(folderQuery) },
    })
    .catch(() => {});
};

export const navigateUp = (options?: FolderNavigationParamaters | null): void => {
  if (!options) {
    return;
  }

  const upQuery = getUpQuery(options);
  if (!upQuery) {
    return;
  }

  setFolderView(upQuery, options);
};

export const navigateDownIntoFolder = (
  item: ViewFolder,
  options?: FolderNavigationParamaters | null,
): void => {
  if (!options) {
    return;
  }

  const downQuery = options.foldersManager.getDownQuery(item);
  if (!downQuery) {
    return;
  }

  setFolderView(downQuery, options);
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
    .selectResultIfFound((result) => media.isSameAs(result));

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

export const getUpFolderItem = (
  options?: FolderNavigationParamaters | null,
): ViewFolder | null => {
  if (!options) {
    return null;
  }

  const upQuery = getUpQuery(options);

  return upQuery
    ? new ViewFolder(upQuery.folder, upQuery.path, {
        icon: 'mdi:arrow-up-left',
        title: localize('common.up'),
      })
    : null;
};
