import { setSubstream } from '../../../utils/substream';
import { View } from '../../../view/view';
import { ViewModifier } from '../types';

export class SubstreamSelectViewModifier implements ViewModifier {
  private _substreamID: string;

  constructor(substreamID: string) {
    this._substreamID = substreamID;
  }

  public modify(view: View): void {
    setSubstream(view, this._substreamID);
  }
}
