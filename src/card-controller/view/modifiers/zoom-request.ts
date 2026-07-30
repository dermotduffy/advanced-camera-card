import type { PartialZoomSettings } from '../../../components-lib/zoom/types';
import { generateViewContextForZoom } from '../../../components-lib/zoom/zoom-view-context';
import type { View } from '../../../view/view';
import type { ViewModifier } from '../types';

// The single write path for a zoom request. The settings are *assigned* rather than
// *merged*, so a new request always replaces the one before it. This is
// necessary as a request to reset to default is expressed as an empty object,
// and a deep merge cannot use that to *erase* the values of an earlier request.
export class ZoomRequestViewModifier implements ViewModifier {
  private _targetID: string;
  private _requested: PartialZoomSettings;

  constructor(targetID: string, requested: PartialZoomSettings) {
    this._targetID = targetID;
    this._requested = requested;
  }

  public modify(view: View): void {
    const target = view.context?.zoom?.[this._targetID];
    if (target) {
      target.requested = this._requested;
      return;
    }

    view.mergeInContext(
      generateViewContextForZoom(this._targetID, { requested: this._requested }),
    );
  }
}
