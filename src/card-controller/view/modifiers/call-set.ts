import { CallViewContext, setCallContext } from '../../../utils/call';
import { View } from '../../../view/view';
import { ViewModifier } from '../types';

export class CallSetViewModifier implements ViewModifier {
  protected _callContext: CallViewContext;

  constructor(callContext: CallViewContext) {
    this._callContext = callContext;
  }

  public modify(view: View): void {
    setCallContext(view, this._callContext);
  }
}