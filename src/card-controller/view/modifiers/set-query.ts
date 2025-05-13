import { Query } from '../../../view/query';
import { QueryResults } from '../../../view/query-results';
import { View } from '../../../view/view';
import { ViewModifier } from '../types';

export class SetQueryViewModifier implements ViewModifier {
  protected _query?: Query | null;
  protected _queryResults?: QueryResults | null;

  constructor(options?: { query?: Query | null; queryResults?: QueryResults | null }) {
    this._query = options?.query;
    this._queryResults = options?.queryResults;
  }

  public modify(view: View): void {
    if (this._query !== undefined) {
      view.query = this._query;
    }
    if (this._queryResults !== undefined) {
      view.queryResults = this._queryResults;
    }
  }
}
