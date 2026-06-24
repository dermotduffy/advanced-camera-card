import type { ViewContext } from 'view';

import type { View } from '../../../view/view';
import type { ViewModifier } from '../types';

export class RemoveContextPropertyViewModifier implements ViewModifier {
  private _key: keyof ViewContext;
  private _property: PropertyKey;

  constructor(key: keyof ViewContext, property: PropertyKey) {
    this._key = key;
    this._property = property;
  }

  public modify(view: View): void {
    view.removeContextProperty(this._key, this._property);
  }
}
