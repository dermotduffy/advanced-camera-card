import { afterEach, describe, expect, it, vi } from 'vitest';
import { MediaQueryWatcher } from '../../../src/condition-trigger/common/media-query-watcher';

// @vitest-environment jsdom
describe('MediaQueryWatcher', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should report whether the query matches', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
    } as unknown as MediaQueryList);

    expect(new MediaQueryWatcher('(orientation: landscape)').matches()).toBe(true);
  });

  it('should invoke the callback on a media-query change', () => {
    const addEventListener = vi.fn();
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      addEventListener,
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList);

    const onChange = vi.fn();
    new MediaQueryWatcher('(orientation: landscape)').subscribe(onChange);

    expect(addEventListener).toHaveBeenCalledWith('change', expect.anything());

    addEventListener.mock.calls[0][1]();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('should stop listening and ignore changes after teardown', () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      addEventListener,
      removeEventListener,
    } as unknown as MediaQueryList);

    const onChange = vi.fn();
    const teardown = new MediaQueryWatcher('(orientation: landscape)').subscribe(
      onChange,
    );
    const handler = addEventListener.mock.calls[0][1];

    teardown();
    expect(removeEventListener).toHaveBeenCalledWith('change', expect.anything());

    handler();
    expect(onChange).not.toHaveBeenCalled();
  });
});
