import { removeCallState } from '../../../utils/call';
import { View } from '../../../view/view';
import { ViewModifier } from '../types';

export class CallClearStateViewModifier implements ViewModifier {
  public modify(view: View): void {
    removeCallState(view);
  }
}