import type { HAFormSchema } from '../../ha/types';
import { localize } from '../../localize/localize';
import { getFormContainerPath, stripArrayIndices } from './paths';

/**
 * Get the localization key for a configuration path.
 * @param path The configuration path segments.
 * @returns The localization key.
 */
export const getLocalizationKeyForPath = (path: (string | number)[]): string =>
  ['config', ...stripArrayIndices(path)].join('.');

/**
 * Compute the label for a form field. Intended for use as an `ha-form`
 * `computeLabel` callback, bound to the path of the form's data within the
 * configuration. Container nodes are labelled by their explicit title, never
 * by configuration path (their headers already render the title).
 * @param basePath The path of the form's data within the configuration.
 * @param schema The field's schema.
 * @param options Path context provided by `ha-form` for fields nested inside
 * containers.
 * @returns A localized label.
 */
export const computeFormLabel = (
  basePath: (string | number)[],
  schema: HAFormSchema,
  options?: { path?: string[] },
): string => {
  if (schema.label !== undefined) {
    return schema.label;
  }
  if (!('selector' in schema)) {
    return schema.title ?? schema.name ?? '';
  }
  return localize(
    getLocalizationKeyForPath([
      ...basePath,
      ...getFormContainerPath(options),
      schema.name,
    ]),
  );
};
