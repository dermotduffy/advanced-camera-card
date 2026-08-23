import { isFormFieldSchema, type HAFormSchema } from '../../ha/types';
import { localize } from '../../localize/localize';
import { getFormContainerPath, stripArrayIndices } from './paths';
import {
  findBinding,
  isComputedFieldBinding,
  type ConfigPath,
  type EditorForm,
} from './types';

/**
 * Get the localization key for a configuration path.
 * @param path The configuration path segments.
 * @returns The localization key.
 */
export const getLocalizationKeyForPath = (path: ConfigPath): string =>
  ['config', ...stripArrayIndices(path)].join('.');

/**
 * Compute the label for a form field. Intended for use as an `ha-form`
 * `computeLabel` callback. A field is named for the setting it edits, which for
 * a bound field is wherever that setting is stored rather than where the field
 * sits in the form. Container nodes are labeled by their explicit title, never
 * by configuration path (their headers already render the title).
 * @param form The form the field belongs to.
 * @param schema The field's schema.
 * @param options Path context provided by `ha-form` for fields nested inside
 * containers.
 * @returns A localized label.
 */
export const computeFormLabel = (
  form: EditorForm,
  schema: HAFormSchema,
  options?: { path?: string[] },
): string => {
  if (schema.label !== undefined) {
    return schema.label;
  }
  if (!isFormFieldSchema(schema)) {
    // Only an expandable has a title: a grid lays out fields that are labeled
    // individually, and shows nothing of its own.
    return (schema.type === 'expandable' ? schema.title : null) ?? schema.name ?? '';
  }

  const formPath = [...getFormContainerPath(options), schema.name];
  const binding = findBinding(form, formPath);

  // A field standing for more than one setting has no single name to take, and
  // so carries its own label.
  return localize(
    getLocalizationKeyForPath(
      binding && !isComputedFieldBinding(binding)
        ? binding.configPath
        : [...form.basePath, ...formPath],
    ),
  );
};
