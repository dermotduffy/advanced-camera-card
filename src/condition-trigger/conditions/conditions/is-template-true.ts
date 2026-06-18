// Whether a rendered template result counts as true for a CONDITION. HA's
// `condition.py` `async_template` does `value.lower() == "true"`, so only
// `true` (case-insensitive) passes -- `yes`/`on`/`1` do NOT (unlike a trigger).
// The card's renderer returns native types, so the boolean a comparison
// template (e.g. `{{ a == b }}`) produces stringifies to "true" and also
// passes.
export const isTemplateTrue = (value: unknown): boolean =>
  String(value).toLowerCase() === 'true';
