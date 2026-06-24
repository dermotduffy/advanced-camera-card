import { compute as computeScroll } from 'compute-scroll-into-view';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { scrollIntoView } from '../../src/utils/scroll';

vi.mock('compute-scroll-into-view');

// @vitest-environment jsdom
describe('scrollIntoView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call computeScroll with the correct arguments', () => {
    const element = document.createElement('div');
    vi.mocked(computeScroll).mockReturnValue([
      {
        el: element,
        top: 42,
        left: 142,
      },
    ]);
    const options = { block: 'start' as const, inline: 'nearest' as const };

    expect(element.scrollTop).toBe(0);
    expect(element.scrollLeft).toBe(0);

    scrollIntoView(element, options);

    expect(computeScroll).toBeCalledWith(element, options);
    expect(element.scrollTop).toBe(42);
    expect(element.scrollLeft).toBe(142);
  });
});
