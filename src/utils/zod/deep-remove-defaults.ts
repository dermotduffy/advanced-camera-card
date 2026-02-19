import { z } from 'zod';

/**
 * This utility intentionally supports classic/full Zod schemas only
 * (i.e. schemas created via `import { z } from 'zod'`).
 * It does not target `zod/mini` schema instances.
 *
 * In Zod 4, internal accessors (.shape values, .unwrap() results, etc.)
 * return core.$ZodType instead of the classic ZodType.
 */
const toClassic = (schema: z.ZodType | z.core.$ZodType): z.ZodType => {
  if (schema instanceof z.ZodType) {
    return schema;
  }
  throw new TypeError('deepRemoveDefaults supports full zod schemas only');
};

/**
 * Check whether an object field originally had a default/prefault wrapper,
 * meaning it should become optional after stripping. Walks through
 * transparent wrappers (nullable, readonly, etc.) to find defaults.
 */
function fieldWasDefaulted(schema: z.ZodType, seen = new Set<z.ZodType>()): boolean {
  if (seen.has(schema)) {
    return false;
  }
  seen.add(schema);

  if (schema instanceof z.ZodDefault || schema instanceof z.ZodPrefault) {
    return true;
  }
  if (schema instanceof z.ZodOptional) {
    return false;
  }

  // Walk through transparent wrappers.
  if (schema instanceof z.ZodNullable) {
    return fieldWasDefaulted(toClassic(schema.unwrap()), seen);
  }
  if (schema instanceof z.ZodReadonly) {
    return fieldWasDefaulted(toClassic(schema.unwrap()), seen);
  }
  if (schema instanceof z.ZodNonOptional) {
    return fieldWasDefaulted(toClassic(schema.unwrap()), seen);
  }
  if (schema instanceof z.ZodLazy) {
    return fieldWasDefaulted(toClassic(schema.unwrap()), seen);
  }
  if (schema instanceof z.ZodPipe) {
    return fieldWasDefaulted(toClassic(schema.in), seen);
  }
  if (schema instanceof z.ZodUnion) {
    return [...schema.options].some((option) =>
      fieldWasDefaulted(toClassic(option), seen),
    );
  }
  return false;
}

/**
 * Core recursive implementation. Strips all default/prefault wrappers
 * and makes previously-defaulted object fields optional instead.
 */
function strip(schema: z.ZodType, cache: Map<z.ZodType, z.ZodType>): z.ZodType {
  const cached = cache.get(schema);
  if (cached) {
    return cached;
  }

  // Seed the cache with a forward reference before recursing so cycles
  // (including getter-based recursive objects) do not overflow the stack.
  const reference: { schema: z.ZodType } = { schema };
  const forward = z.lazy(() => reference.schema);
  cache.set(schema, forward);

  let result: z.ZodType;

  if (schema instanceof z.ZodDefault || schema instanceof z.ZodPrefault) {
    // Unwrap the default — don't cache the wrapper itself.
    result = strip(toClassic(schema.unwrap()), cache);
  } else if (schema instanceof z.ZodObject) {
    const newShape: Record<string, z.core.$ZodType> = {};
    for (const [key, field] of Object.entries(schema.shape)) {
      const classicField = toClassic(field);
      const stripped = strip(classicField, cache);
      const makeOptional =
        fieldWasDefaulted(classicField) && !(stripped instanceof z.ZodOptional);
      newShape[key] = makeOptional ? stripped.optional() : stripped;
    }
    result = z.clone(schema, { ...schema.def, shape: newShape });
  } else if (schema instanceof z.ZodArray) {
    result = z.clone(schema, {
      ...schema.def,
      element: strip(toClassic(schema.element), cache),
    });
  } else if (schema instanceof z.ZodTuple) {
    result = z.clone(schema, {
      ...schema.def,
      items: schema.def.items.map((item) => strip(toClassic(item), cache)),
      rest: schema.def.rest ? strip(toClassic(schema.def.rest), cache) : null,
    });
  } else if (schema instanceof z.ZodUnion) {
    const options = [...schema.options].map((opt) => strip(toClassic(opt), cache));
    result = z.clone(schema, { ...schema.def, options });
  } else if (schema instanceof z.ZodLazy) {
    result = z.lazy(() => strip(toClassic(schema.unwrap()), cache));
  } else if (schema instanceof z.ZodPipe) {
    result = z.clone(schema, {
      ...schema.def,
      in: strip(toClassic(schema.in), cache),
      out: strip(toClassic(schema.out), cache),
    });
  } else if (
    schema instanceof z.ZodOptional ||
    schema instanceof z.ZodNullable ||
    schema instanceof z.ZodReadonly ||
    schema instanceof z.ZodNonOptional ||
    schema instanceof z.ZodCatch ||
    schema instanceof z.ZodSuccess ||
    schema instanceof z.ZodPromise
  ) {
    // All of these are single-child wrappers with .unwrap().
    result = z.clone(schema, {
      ...schema.def,
      innerType: strip(toClassic(schema.unwrap()), cache),
    });
  } else {
    // Leaf types (string, number, boolean, enum, literal, etc.).
    result = schema;
  }

  reference.schema = result;
  cache.set(schema, result);
  return result;
}

/**
 * Recursively strips `z.default()` and `z.prefault()` wrappers from a schema.
 * Object fields that had defaults become optional instead.
 * Uses a cache to safely handle recursive (z.lazy) schemas.
 */
export function deepRemoveDefaults<T extends z.ZodType>(
  schema: T,
  cache = new Map<z.ZodType, z.ZodType>(),
): T {
  return strip(schema, cache) as T;
}
