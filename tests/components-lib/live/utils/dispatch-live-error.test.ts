import { expect, it, vi } from 'vitest';

import { dispatchLiveErrorEvent } from '../../../../src/components-lib/live/utils/dispatch-live-error';

// @vitest-environment jsdom
it('should dispatch live error event', () => {
  const element = document.createElement('div');
  const handler = vi.fn();
  element.addEventListener('advanced-camera-card:live:error', handler);

  dispatchLiveErrorEvent(element);
  expect(handler).toBeCalled();
});

it('should forward the reason as the event detail', () => {
  const element = document.createElement('div');
  const handler = vi.fn();
  element.addEventListener('advanced-camera-card:live:error', handler);

  dispatchLiveErrorEvent(element, 'unsupported');
  expect(handler).toHaveBeenCalledWith(
    expect.objectContaining({ detail: 'unsupported' }),
  );
});
