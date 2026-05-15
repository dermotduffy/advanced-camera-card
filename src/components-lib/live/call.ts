import { ViewModifier } from '../../card-controller/view/types';
import { View } from '../../view/view';

// =============================================================================
// Call lifecycle view context + modifiers.
//
// Presence of `view.context.call` means a call is in progress; absence means
// idle. The call always runs on the camera the user is viewing. The actual
// streaming source (`callCameraID`) may be the same camera or a
// 2-way-audio-capable dependency engaged via the substream
// override mechanism.
//
// Co-located with `LiveViewContext` in ./types.ts and the substream
// modifiers in ./substream.ts because the call lifecycle reuses the
// substream override mechanism.
// =============================================================================

export interface CallViewContext {
  // The camera the call is anchored on: the camera the user was viewing when
  // `call_start` fired. Drives overlay placement in grid views.
  cameraID: string;

  // The camera whose stream is actually carrying the 2-way audio. May equal
  // `cameraID` (no override needed) or be a different camera (engaged via
  // substream override on `cameraID`).
  callCameraID: string;

  // The substream override that was active on `cameraID` before the call
  // started. Restored when the call ends. Unset when no override was active
  // pre-call, in which case end-call clears any override (rather than restoring
  // one).
  preCallSubstream?: string;
}

declare module 'view' {
  interface ViewContext {
    call?: CallViewContext;
  }
}

// A call is in progress iff the view carries a `call` context entry.
export const isCallActive = (view: View | null): boolean => !!view?.context?.call;

export class CallSetViewModifier implements ViewModifier {
  private _context: CallViewContext;

  constructor(context: CallViewContext) {
    this._context = context;
  }

  public modify(view: View): void {
    view.mergeInContext({ call: this._context });

    // Ensure the engaged stream on `cameraID` matches `callCameraID`. If
    // they're the same, no override is needed — delete any that's in place.
    // Otherwise write the override so the live tile renders the call's
    // streaming source.
    if (this._context.callCameraID === this._context.cameraID) {
      view.context?.live?.overrides?.delete(this._context.cameraID);
    } else {
      const overrides = view.context?.live?.overrides ?? new Map<string, string>();
      overrides.set(this._context.cameraID, this._context.callCameraID);
      view.mergeInContext({ live: { overrides } });
    }
  }
}

export class CallClearViewModifier implements ViewModifier {
  public modify(view: View): void {
    const callCtx = view.context?.call;
    if (!callCtx) {
      return;
    }

    // Restore the pre-call override (or clear, if there wasn't one).
    if (callCtx.preCallSubstream !== undefined) {
      const overrides = view.context?.live?.overrides ?? new Map<string, string>();
      overrides.set(callCtx.cameraID, callCtx.preCallSubstream);
      view.mergeInContext({ live: { overrides } });
    } else {
      view.context?.live?.overrides?.delete(callCtx.cameraID);
    }

    view.removeContext('call');
  }
}
