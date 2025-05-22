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
  if (!rawQuery?.path || rawQuery?.path.length <= 1) {
    return;
  }

  const path = rawQuery.path.slice(0, -1);

  viewManagerEpoch?.manager.setViewByParametersWithExistingQuery({
    params: {
      query: query.clone().setQuery({
        folder: rawQuery.folder,
        path: [path[0], ...path.slice(1)],
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
  if (!rawQuery?.folder || !rawQuery?.path || rawQuery.path.length <= 1) {
    return null;
  }

  return new ViewFolder(rawQuery.folder, {
    icon: 'mdi:arrow-up-left',
  });
};
