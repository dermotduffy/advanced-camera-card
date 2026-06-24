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
