import type { ViewContext } from 'view';

import type { View } from '../../../view/view';
import type { ViewModifier } from '../types';

export class RemoveContextPropertyViewModifier<T extends keyof ViewContext>
  implements ViewModifier
{
  private _key: T;
  private _property: keyof NonNullable<ViewContext[T]>;

  constructor(key: T, property: keyof NonNullable<ViewContext[T]>) {
    this._key = key;
    this._property = property;
  }

  public modify(view: View): void {
    view.removeContextProperty(this._key, this._property);
  }
}
