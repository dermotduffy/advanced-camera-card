import { ViewContext } from 'view';
import { View } from '../../../view/view';
import { ViewModifier } from '../types';

export class RemoveContextViewModifier implements ViewModifier {
  private _keys: (keyof ViewContext)[];

  constructor(keys: (keyof ViewContext)[]) {
    this._keys = keys;
  }

  public modify(view: View): void {
    this._keys.forEach((key) => view.removeContext(key));
  }
}
