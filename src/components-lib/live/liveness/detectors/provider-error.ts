import type { LiveError } from '../../utils/dispatch-live-error';
import type { LivenessDetector, LivenessVerdict } from '../stream-liveness-controller';

const LIVE_ERROR_EVENT = 'advanced-camera-card:live:error';

/**
 * Detects a provider-reported stream failure: a live provider (or one of its
 * inner players) dispatches `live:error` when it cannot play. The listener sits
 * on the wrapper host and catches errors bubbling up from any descendant
 * provider.
 *
 * The provider is expected to render its own error, so no reconnecting
 * placeholder is asked for; the wrapper leaves the provider mounted (and
 * suppresses the load image).
 */
export class ProviderErrorDetector implements LivenessDetector {
  private _host: HTMLElement;
  private _onChange: () => void;
  private _verdict: LivenessVerdict = { state: 'unknown' };

  constructor(host: HTMLElement, onChange: () => void) {
    this._host = host;
    this._onChange = onChange;
  }

  public subscribe(): void {
    this._host.addEventListener(LIVE_ERROR_EVENT, this._handler);
  }

  public unsubscribe(): void {
    this._host.removeEventListener(LIVE_ERROR_EVENT, this._handler);
  }

  public reset(): void {
    this._verdict = { state: 'unknown' };
  }

  public getVerdict(): LivenessVerdict {
    return this._verdict;
  }

  private _handler = (ev: CustomEvent<LiveError>): void => {
    ev.stopPropagation();
    if (this._verdict.state !== 'not_live') {
      // Authoritative: an explicit provider error overrides even direct frame
      // evidence. No placeholder -- the provider renders its own error. The
      // provider may name the cause; otherwise it is a generic playback error.
      this._verdict = {
        state: 'not_live',
        authority: 'hard',
        reason: ev.detail.reason ?? 'playback_error',
        description: ev.detail.description,
      };
      this._onChange();
    }
  };
}
