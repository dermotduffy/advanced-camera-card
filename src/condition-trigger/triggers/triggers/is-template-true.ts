// Whether a rendered template result counts as true for a TRIGGER. Mirrors HA's
// `result_as_boolean`: a non-zero number, or `1`/`true`/`yes`/`on`/`enable`
// (case-insensitive), is truthy -- more permissive than a condition.
export const isTemplateTrue = (value: unknown): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    return ['1', 'true', 'yes', 'on', 'enable'].includes(value.toLowerCase());
  }
  return false;
};
