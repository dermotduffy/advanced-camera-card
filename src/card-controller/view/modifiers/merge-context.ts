import type { ViewContext } from 'view';

import type { View } from '../../../view/view';
import type { ViewModifier } from '../types';

export class MergeContextViewModifier implements ViewModifier {
  private _context?: ViewContext | null;

  constructor(context?: ViewContext | null) {
    this._context = context;
  }

  public modify(view: View): void {
    view.mergeInContext(this._context);
  }
}
