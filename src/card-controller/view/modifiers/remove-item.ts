import type { ViewItem } from '../../../view/item';
import type { View } from '../../../view/view';
import type { ViewModifier } from '../types';

// Removes item(s) from the results.
export class RemoveItemViewModifier implements ViewModifier {
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
    matches.forEach((result) => queryResults.removeItem(result));
    return true;
  }
}
