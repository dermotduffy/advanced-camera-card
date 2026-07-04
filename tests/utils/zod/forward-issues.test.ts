import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { forwardIssues } from '../../../src/utils/zod/forward-issues';

// Parse `value` through a schema whose `superRefine` delegates to
// `forwardIssues`, returning the resulting error (or null on success).
const runThrough = (
  value: unknown,
  target: z.ZodType,
  path?: PropertyKey[],
): z.ZodError | null => {
  const result = z
    .unknown()
    .superRefine((v, ctx) => forwardIssues(ctx, v, target, path))
    .safeParse(value);
  return result.success ? null : result.error;
};

describe('forwardIssues', () => {
  it('should add no issues when the value satisfies the schema', () => {
    expect(runThrough('on', z.string())).toBeNull();
  });

  it('should forward issues with the given path prefix', () => {
    const error = runThrough(5, z.string(), ['field']);
    expect(error?.issues).toHaveLength(1);
    expect(error?.issues[0].path).toEqual(['field']);
  });

  it('should forward at the issue path when no prefix is given', () => {
    const error = runThrough(5, z.string());
    expect(error?.issues[0].path).toEqual([]);
  });

  it('should prepend the prefix to nested issue paths', () => {
    const error = runThrough({ inner: 5 }, z.object({ inner: z.string() }), ['outer']);
    expect(error?.issues[0].path).toEqual(['outer', 'inner']);
  });
});
