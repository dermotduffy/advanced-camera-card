import { removeCallContext } from '../../../utils/call';
import { View } from '../../../view/view';
import { ViewModifier } from '../types';

export class CallClearViewModifier implements ViewModifier {
  public modify(view: View): void {
    removeCallContext(view);
  }
}