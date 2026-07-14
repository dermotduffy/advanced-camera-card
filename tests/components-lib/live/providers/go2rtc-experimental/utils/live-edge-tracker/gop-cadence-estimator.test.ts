import { describe, expect, it } from 'vitest';

import {
  GOP_SAMPLE_WINDOW_SIZE,
  GOPCadenceEstimator,
} from '../../../../../../../src/components-lib/live/providers/go2rtc-experimental/utils/live-edge-tracker/gop-cadence-estimator';

describe('GOPCadenceEstimator', () => {
  it('should return the default GOP before any samples', () => {
    expect(new GOPCadenceEstimator().estimateSeconds()).toBe(1);
  });

  it('should average the interval between buffer advances', () => {
    const estimator = new GOPCadenceEstimator();
    estimator.sample(10, new Date(0));
    estimator.sample(12, new Date(2000));
    estimator.sample(14, new Date(4000));
    expect(estimator.estimateSeconds()).toBe(2);
  });

  it('should ignore updates that do not advance the buffer', () => {
    const estimator = new GOPCadenceEstimator();
    estimator.sample(10, new Date(0));
    estimator.sample(12, new Date(2000));
    // A trim: same buffered end, later time -> not a delivery interval, and it
    // must not reset the last-advance timestamp.
    estimator.sample(12, new Date(5000));
    estimator.sample(14, new Date(6000));
    // Intervals are 2s (0 -> 2000) and 4s (2000 -> 6000) -> average 3s.
    expect(estimator.estimateSeconds()).toBe(3);
  });

  it('should ignore advances with no elapsed time', () => {
    const estimator = new GOPCadenceEstimator();
    estimator.sample(10, new Date(1000));
    estimator.sample(12, new Date(1000));
    expect(estimator.estimateSeconds()).toBe(1);
  });

  it('should evict the oldest sample beyond the window', () => {
    const estimator = new GOPCadenceEstimator();
    // A slow 5s interval, then a full window of 1s intervals evicts it.
    estimator.sample(0, new Date(0));
    estimator.sample(5, new Date(5000));
    let time = 5000;
    let end = 5;
    for (let i = 0; i < GOP_SAMPLE_WINDOW_SIZE; ++i) {
      time += 1000;
      end += 1;
      estimator.sample(end, new Date(time));
    }
    expect(estimator.estimateSeconds()).toBe(1);
  });
});
