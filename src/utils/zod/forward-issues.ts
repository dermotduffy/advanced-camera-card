import type { z } from 'zod';

/**
 * Validate `value` against `schema` and copy any issues it produces into a
 * refinement context, prefixing each issue's path with `path`. Use inside a
 * `.superRefine` to delegate a value to another schema while preserving Zod's
 * own error messages -- e.g. when the outer schema widened a field (to
 * `z.unknown()`) and needs to re-apply the original, narrower schema
 * conditionally. Adds nothing when `value` satisfies `schema`.
 * @param ctx The refinement context to add issues to.
 * @param value The value to validate.
 * @param schema The schema to validate `value` against.
 * @param path A path prefix prepended to each forwarded issue's path.
 */
export const forwardIssues = (
  ctx: z.RefinementCtx,
  value: unknown,
  schema: z.ZodType,
  path: readonly PropertyKey[] = [],
): void => {
  const result = schema.safeParse(value);
  if (!result.success) {
    for (const issue of result.error.issues) {
      ctx.addIssue({ ...issue, path: [...path, ...issue.path] });
    }
  }
};
