import { afterAll, describe, expect, it, vi } from 'vitest';

import { log } from '../../src/utils/debug.js';

describe('log', () => {
  const spy = vi.spyOn(global.console, 'debug').mockReturnValue(undefined);
  afterAll(() => {
    vi.restoreAllMocks();
  });
  it('should do nothing without debug logging set', () => {
    log({}, 'foo');
    expect(spy).not.toBeCalled();
  });
  it('should log debug when appropriately configured', () => {
    log({ debug: { logging: true } }, 'foo');
    expect(spy).toBeCalledWith('foo');
  });
});
