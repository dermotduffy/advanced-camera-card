import { z } from 'zod';

/**
 * Get configuration parse errors.
 * @param error The ZodError object from parsing.
 * @returns A set of string error paths.
 */
export const getParseErrorPaths = <T>(error: z.ZodError<T>): Set<string> => {
  /* Zod errors involving unions are complex, as Zod may not be able to tell
   * where the 'real' error is vs simply a union option not matching. This
   * function recursively extracts all error paths from all branches of a union.
   * It returns a Set of dot-notation strings. If no paths are found, it suggests
   * the configuration has an error but Zod cannot tell exactly why (usually an
   * entirely incorrect type name). */
  const contenders = new Set<string>();
  if (error.issues.length) {
    for (const issue of error.issues) {
      if (issue.code === 'invalid_union') {
        const unionErrors = (issue as z.core.$ZodIssueInvalidUnion).errors;
        for (const issues of unionErrors) {
          const nestedPaths = getParseErrorPaths(new z.ZodError(issues));
          const prefix = z.core.toDotPath(issue.path);
          nestedPaths.forEach((path) => {
            contenders.add(prefix ? `${prefix}.${path}` : path);
          });
        }
      } else {
        contenders.add(z.core.toDotPath(issue.path));
      }
    }
  }
  return contenders;
};

/**
 * Get configuration parse errors.
 * @param error The ZodError object from parsing.
 * @returns A string error message or null.
 */
export const getParseError = <T>(error: z.ZodError<T>): string | null => {
  const paths = getParseErrorPaths(error);
  return paths.size === 0 ? null : JSON.stringify([...paths], null, ' ');
};
