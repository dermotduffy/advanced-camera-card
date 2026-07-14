import { describe, expect, it } from 'vitest';

import { LiveEdgeTracker } from '../../../../../../../src/components-lib/live/providers/go2rtc-experimental/utils/live-edge-tracker';
import { createStatus } from './test-utils';

describe('LiveEdgeTracker', () => {
  it('should use the seek strategy on WebKit', () => {
    const tracker = new LiveEdgeTracker({ webkit: true });
    // Far behind: the WebKit strategy seeks to the default 3s hold-back.
    expect(tracker.next(createStatus(20, 13))).toEqual({ action: 'seek', seconds: 17 });
  });

  it('should use the playback-rate strategy on other browsers', () => {
    const tracker = new LiveEdgeTracker({ webkit: false });
    expect(tracker.next(createStatus(20, 18))).toEqual({ action: 'rate', rate: 1 });
  });
});
