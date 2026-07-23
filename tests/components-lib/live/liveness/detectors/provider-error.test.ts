import { describe, expect, it, vi } from 'vitest';

import { ProviderErrorDetector } from '../../../../../src/components-lib/live/liveness/detectors/provider-error';
import { dispatchLiveErrorEvent } from '../../../../../src/components-lib/live/utils/dispatch-live-error';

const LIVE_ERROR_EVENT = 'advanced-camera-card:live:error';

const createHostInDocument = (): HTMLElement => {
  const host = document.createElement('div');
  document.body.append(host);
  return host;
};

// @vitest-environment jsdom
describe('ProviderErrorDetector', () => {
  it('should start unknown', () => {
    const detector = new ProviderErrorDetector(document.createElement('div'), vi.fn());

    expect(detector.getVerdict()).toEqual({ state: 'unknown' });
  });

  it('should report not live on a provider error, leaving the provider mounted', () => {
    const host = createHostInDocument();
    const onChange = vi.fn();
    const detector = new ProviderErrorDetector(host, onChange);
    detector.subscribe();

    dispatchLiveErrorEvent(host);

    // not_live but no renderPlaceholder: the provider renders its own error.
    expect(detector.getVerdict()).toEqual({
      state: 'not_live',
      authority: 'hard',
      reason: 'playback_error',
    });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('should adopt the specific reason and description carried on the event', () => {
    const host = createHostInDocument();
    const detector = new ProviderErrorDetector(host, vi.fn());
    detector.subscribe();

    dispatchLiveErrorEvent(host, {
      reason: 'unsupported',
      detail: 'Codec not supported',
    });

    expect(detector.getVerdict()).toEqual({
      state: 'not_live',
      authority: 'hard',
      reason: 'unsupported',
      description: 'Codec not supported',
    });
  });

  it('should notify only on the transition to not live', () => {
    const host = createHostInDocument();
    const onChange = vi.fn();
    const detector = new ProviderErrorDetector(host, onChange);
    detector.subscribe();

    dispatchLiveErrorEvent(host);
    dispatchLiveErrorEvent(host);

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('should stop the error from propagating past the host', () => {
    const host = createHostInDocument();
    const parentListener = vi.fn();
    document.body.addEventListener(LIVE_ERROR_EVENT, parentListener);
    const detector = new ProviderErrorDetector(host, vi.fn());
    detector.subscribe();

    dispatchLiveErrorEvent(host);

    expect(parentListener).not.toHaveBeenCalled();

    document.body.removeEventListener(LIVE_ERROR_EVENT, parentListener);
  });

  it('should discard the verdict on reset', () => {
    const host = createHostInDocument();
    const detector = new ProviderErrorDetector(host, vi.fn());
    detector.subscribe();
    dispatchLiveErrorEvent(host);
    expect(detector.getVerdict().state).toBe('not_live');

    detector.reset();

    expect(detector.getVerdict()).toEqual({ state: 'unknown' });
  });

  it('should ignore errors after unsubscribe', () => {
    const host = createHostInDocument();
    const onChange = vi.fn();
    const detector = new ProviderErrorDetector(host, onChange);
    detector.subscribe();
    detector.unsubscribe();

    dispatchLiveErrorEvent(host);

    expect(detector.getVerdict().state).toBe('unknown');
    expect(onChange).not.toHaveBeenCalled();
  });
});
