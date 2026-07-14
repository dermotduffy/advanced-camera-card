import { describe, expect, it } from 'vitest';

import { GOP_SAMPLE_WINDOW_SIZE } from '../../../../../../../src/components-lib/live/providers/go2rtc-experimental/utils/live-edge-tracker/gop-cadence-estimator';
import { WebKitLiveEdgeStrategy } from '../../../../../../../src/components-lib/live/providers/go2rtc-experimental/utils/live-edge-tracker/webkit';
import { createStatus } from './test-utils';

describe('WebKitLiveEdgeStrategy', () => {
  // With no measured cadence the GOP defaults to 1s, so the hold-back is 3s.
  it('should do nothing within the hold-back band', () => {
    const strategy = new WebKitLiveEdgeStrategy();
    expect(strategy.next(createStatus(20, 18))).toEqual({ action: 'none' });
  });

  it('should seek back to the hold-back when starving within a GOP of the edge', () => {
    const strategy = new WebKitLiveEdgeStrategy();
    expect(strategy.next(createStatus(20, 19.5))).toEqual({
      action: 'seek',
      seconds: 17,
    });
  });

  it('should seek forward to the hold-back when far behind', () => {
    const strategy = new WebKitLiveEdgeStrategy();
    expect(strategy.next(createStatus(20, 13))).toEqual({ action: 'seek', seconds: 17 });
  });

  it('should not seek forward again within the cooldown', () => {
    const strategy = new WebKitLiveEdgeStrategy();
    strategy.next(createStatus(20, 13, { now: new Date(0) }));
    expect(strategy.next(createStatus(20, 13, { now: new Date(2000) }))).toEqual({
      action: 'none',
    });
  });

  it('should seek forward again after the cooldown', () => {
    const strategy = new WebKitLiveEdgeStrategy();
    strategy.next(createStatus(20, 13, { now: new Date(0) }));
    expect(strategy.next(createStatus(20, 13, { now: new Date(6000) }))).toEqual({
      action: 'seek',
      seconds: 17,
    });
  });

  it('should widen the hold-back to the measured GOP cadence', () => {
    const strategy = new WebKitLiveEdgeStrategy();

    // Buffer advances 2s apart -> GOP ~2s -> hold-back 6s. Runs past the sample
    // window so the oldest samples are evicted. (Sampling happens before the
    // action, so intermediate seeks do not affect the estimate.)
    let end = 20;
    for (let i = 1; i <= GOP_SAMPLE_WINDOW_SIZE + 2; ++i) {
      end = 20 + i * 2;
      strategy.next(createStatus(end, end - 4, { now: new Date(i * 2000) }));
    }

    // A far-behind sample now seeks to bufferedEnd - 6, not - 3.
    expect(
      strategy.next(createStatus(end, end - 12, { now: new Date(100000) })),
    ).toEqual({
      action: 'seek',
      seconds: end - 6,
    });
  });

  it('should clamp the widened hold-back to the maximum', () => {
    const strategy = new WebKitLiveEdgeStrategy();

    // Buffer advances 5s apart -> GOP 5s -> 15s, clamped to 8s.
    let end = 0;
    for (let i = 1; i <= GOP_SAMPLE_WINDOW_SIZE + 1; ++i) {
      end = i * 5;
      strategy.next(createStatus(end, end - 2, { now: new Date(i * 5000) }));
    }

    expect(
      strategy.next(createStatus(end, end - 19, { now: new Date(100000) })),
    ).toEqual({
      action: 'seek',
      seconds: end - 8,
    });
  });

  it('should clamp the shrunken hold-back to the minimum', () => {
    const strategy = new WebKitLiveEdgeStrategy();

    // Buffer advances 0.3s apart -> GOP 0.3s -> 0.9s, clamped to 1.5s.
    let end = 20;
    for (let i = 1; i <= GOP_SAMPLE_WINDOW_SIZE + 1; ++i) {
      end = 20 + i * 0.3;
      strategy.next(createStatus(end, end - 0.1, { now: new Date(i * 300) }));
    }

    expect(strategy.next(createStatus(end, end - 3, { now: new Date(100000) }))).toEqual(
      {
        action: 'seek',
        seconds: end - 1.5,
      },
    );
  });
});
