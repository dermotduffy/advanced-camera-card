import { ViewManagerEpoch } from '../../card-controller/view/types';
import { stopEventFromActivatingCardWideActions } from '../../utils/action';
import { ViewFolder, ViewItem } from '../../view/item';
import { QueryClassifier } from '../../view/query-classifier';
import { View } from '../../view/view';

export const upFolderClickHandler = (
  _item: ViewItem,
  ev: Event,
  viewManagerEpoch?: ViewManagerEpoch,
): void => {
  stopEventFromActivatingCardWideActions(ev);

  const query = viewManagerEpoch?.manager.getView()?.query;
  if (!query || !QueryClassifier.isFolderQuery(query)) {
    return;
  }
  const rawQuery = query?.getQuery();
  const parents = rawQuery?.parentPaths ?? [];
  if (!rawQuery || !parents.length) {
    return;
  }

  const newParents = parents.slice(0, parents.length - 1);
  const upPath: string | undefined = newParents[newParents.length - 1];

  viewManagerEpoch?.manager.setViewByParametersWithExistingQuery({
    params: {
      query: query.clone().setQuery({
        folder: rawQuery.folder,

        // At the root, upPath will be undefined.
        path: upPath,
        parentPaths: newParents,
      }),
    },
  });
};

export const getUpFolderMediaItem = (view?: View | null): ViewFolder | null => {
  const query = view?.query;
  if (!query || !QueryClassifier.isFolderQuery(query)) {
    return null;
  }

  const rawQuery = query.getQuery();
  if (!rawQuery?.folder) {
    return null;
  }

  return rawQuery?.parentPaths?.length
    ? new ViewFolder(rawQuery.folder, {
        icon: 'mdi:arrow-up-right',
      })
    : null;
};
