import { describe, expect, it, vi } from 'vitest';
import { sleep } from '../../src/utils/sleep';

describe('sleep', () => {
  it('should sleep', async () => {
    const spy = vi
      .spyOn(global, 'setTimeout')
      // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
      .mockImplementation((func: () => unknown, _time?: number): any => {
        func();
      });
    sleep(10);
    expect(spy).toHaveBeenCalledWith(expect.anything(), 10000);
  });
});
