import { expect, it, vi } from 'vitest';

import { dispatchLiveErrorEvent } from '../../../../src/components-lib/live/utils/dispatch-live-error';

// @vitest-environment jsdom
it('should dispatch live error event with an empty error when none is given', () => {
  const element = document.createElement('div');
  const handler = vi.fn();
  element.addEventListener('advanced-camera-card:live:error', handler);

  dispatchLiveErrorEvent(element);
  expect(handler).toHaveBeenCalledWith(expect.objectContaining({ detail: {} }));
});

it('should forward the reason and detail as the event detail', () => {
  const element = document.createElement('div');
  const handler = vi.fn();
  element.addEventListener('advanced-camera-card:live:error', handler);

  dispatchLiveErrorEvent(element, {
    reason: 'unsupported',
    detail: 'Codec not supported',
  });
  expect(handler).toHaveBeenCalledWith(
    expect.objectContaining({
      detail: { reason: 'unsupported', detail: 'Codec not supported' },
    }),
  );
});
