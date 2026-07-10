import { describe, expect, it } from 'vitest';

import { BoundedBufferQueue } from '../../../../../../src/components-lib/live/providers/go2rtc-experimental/utils/bounded-buffer-queue';

describe('BoundedBufferQueue', () => {
  it('should start empty', () => {
    expect(new BoundedBufferQueue(10).isEmpty).toBe(true);
  });

  it('should accept a chunk within the byte cap', () => {
    const queue = new BoundedBufferQueue(10);
    expect(queue.push(new ArrayBuffer(4))).toBe(true);
    expect(queue.isEmpty).toBe(false);
  });

  it('should accept a chunk that fills the cap exactly', () => {
    expect(new BoundedBufferQueue(10).push(new ArrayBuffer(10))).toBe(true);
  });

  it('should reject a chunk that would exceed the byte cap and stage nothing', () => {
    const queue = new BoundedBufferQueue(10);
    expect(queue.push(new ArrayBuffer(8))).toBe(true);
    expect(queue.push(new ArrayBuffer(3))).toBe(false);

    // The rejected chunk left the byte total unchanged, so a smaller one fits.
    expect(queue.push(new ArrayBuffer(2))).toBe(true);
  });

  it('should return staged chunks oldest first', () => {
    const queue = new BoundedBufferQueue(10);
    const first = new ArrayBuffer(2);
    const second = new ArrayBuffer(3);
    queue.push(first);
    queue.push(second);

    expect(queue.shift()).toBe(first);
    expect(queue.shift()).toBe(second);
    expect(queue.isEmpty).toBe(true);
  });

  it('should return null when shifting an empty queue', () => {
    expect(new BoundedBufferQueue(10).shift()).toBeNull();
  });

  it('should free the shifted chunk bytes back toward the cap', () => {
    const queue = new BoundedBufferQueue(10);
    queue.push(new ArrayBuffer(8));
    expect(queue.push(new ArrayBuffer(4))).toBe(false);

    queue.shift();
    expect(queue.push(new ArrayBuffer(4))).toBe(true);
  });

  it('should reset the chunks and the byte total on clear', () => {
    const queue = new BoundedBufferQueue(10);
    queue.push(new ArrayBuffer(8));
    queue.clear();

    expect(queue.isEmpty).toBe(true);

    // The byte total reset too, so the full cap is available again.
    expect(queue.push(new ArrayBuffer(10))).toBe(true);
  });
});
