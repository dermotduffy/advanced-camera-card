/**
 * Extracts a substring from a string using a regular expression pattern, if
 * groupName / groupNumber is specified but not found in the result, the full
 * match is returned.
 */
export const regexpExtract = (
  pattern: string | RegExp,
  val: string,
  options?: {
    groupName?: string;
    groupNumber?: number;
  },
): string | null => {
  const match = val.match(pattern);
  if (options?.groupName && match?.groups?.[options.groupName]) {
    return match.groups[options.groupName];
  }
  if (options?.groupNumber !== undefined && match?.[options.groupNumber]) {
    return match[options.groupNumber];
  }
  return match ? match[0] : null;
};
