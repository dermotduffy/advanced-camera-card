import { ViewContext } from 'view';
import { View } from '../../../view/view';
import { ViewModifier } from '../types';

export class MergeContextViewModifier implements ViewModifier {
  private _context?: ViewContext | null;

  constructor(context?: ViewContext | null) {
    this._context = context;
  }

  public modify(view: View): void {
    view.mergeInContext(this._context);
  }
}
