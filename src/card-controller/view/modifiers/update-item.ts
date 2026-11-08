import type { ViewItem } from '../../../view/item';
import type { View } from '../../../view/view';
import type { ViewModifier } from '../types';

// Replaces an item in the results with a new copy of itself, so that a
// component comparing by object identity re-renders it.
export class UpdateItemViewModifier implements ViewModifier {
  private _item: ViewItem;

  constructor(item: ViewItem) {
    this._item = item;
  }

  public modify(view: View): boolean {
    const matches = view.queryResults
      ?.getResults()
      ?.filter((result) => this._item.isSameAs(result));
    if (!view.queryResults || !matches?.length) {
      return false;
    }

    const queryResults = view.queryResults;
    matches.forEach((result) => queryResults.replaceItem(result, result.clone()));
    return true;
  }
}
