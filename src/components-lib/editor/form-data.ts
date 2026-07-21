import { isEqual } from 'lodash-es';

import {
  copyConfig,
  deleteConfigValue,
  getConfigValue,
  setConfigValue,
} from '../../config/management';
import type { RawAdvancedCameraCardConfig } from '../../config/types';
import type { HAFormSchema, HAFormSelectorSchema } from '../../ha/types';
import { isRecord } from '../../utils/basic';
import {
  isComputedFieldBinding,
  type ConfigChange,
  type ConfigPath,
  type EditorForm,
  type FieldBinding,
} from './types';

/**
 * Call a callback for every selector-based (leaf) field in a form schema, with
 * the field's path relative to the form data (named expandable containers nest
 * their contents).
 * @param schema The form schema.
 * @param callback The callback to call with the relative path and field.
 */
export const forEachFieldRecursively = (
  schema: readonly HAFormSchema[],
  callback: (path: string[], field: HAFormSelectorSchema) => void,
): void => {
  const recurse = (items: readonly HAFormSchema[], prefix: string[]): void => {
    for (const item of items) {
      if ('selector' in item) {
        callback([...prefix, item.name], item);
      } else {
        // A nameless expandable is a visual-only grouping, so it is not added
        // to the path.
        recurse(item.schema, !item.name ? prefix : [...prefix, item.name]);
      }
    }
  };
  recurse(schema, []);
};

const findBinding = (form: EditorForm, formPath: string[]): FieldBinding | undefined =>
  form.bindings?.find((binding) => isEqual(binding.formPath, formPath));

// The value to show for a bound field. A computed binding works its own value
// out; otherwise the configured value is shown, and only a missing value falls
// back to the default. A field set to null is shown as null.
const readBoundFieldValue = (
  binding: FieldBinding,
  config: RawAdvancedCameraCardConfig,
  defaults: RawAdvancedCameraCardConfig,
): unknown => {
  if (isComputedFieldBinding(binding)) {
    return binding.read(config, defaults);
  }
  const configured = getConfigValue(config, binding.configPath);
  return configured === undefined
    ? getConfigValue(defaults, binding.configPath)
    : configured;
};

/**
 * Compute the data object a form displays: the raw configuration values, with
 * each absent field filled in from the (profile-adjusted) configuration
 * defaults, so the form shows the effective value of every field.
 * @param form The form.
 * @param config The whole raw (possibly invalid) configuration.
 * @param defaults The whole configuration defaults.
 * @returns A new data object for the form to display.
 */
export const computeDisplayedData = (
  form: EditorForm,
  config: RawAdvancedCameraCardConfig,
  defaults: RawAdvancedCameraCardConfig,
): RawAdvancedCameraCardConfig => {
  const raw = form.basePath.length ? getConfigValue(config, form.basePath) : config;
  const formDefaults = form.basePath.length
    ? getConfigValue(defaults, form.basePath)
    : defaults;

  const data: RawAdvancedCameraCardConfig = isRecord(raw) ? copyConfig(raw) : {};

  forEachFieldRecursively(form.schema, (path) => {
    const binding = findBinding(form, path);
    if (binding) {
      // A bound field is stored elsewhere in the configuration, so anything
      // the copy above holds at this path belongs to a different setting and
      // is replaced.
      const value = readBoundFieldValue(binding, config, defaults);
      setConfigValue(data, path, value === undefined ? undefined : copyConfig(value));
      return;
    }

    if (getConfigValue(data, path) !== undefined) {
      return;
    }
    // The configuration does not set this field, so show its default (looked
    // up by path since the defaults object mirrors the configuration shape).
    const defaultValue = isRecord(formDefaults)
      ? getConfigValue(formDefaults, path)
      : undefined;
    if (defaultValue !== undefined) {
      // Copied so no mutation of the data can reach into the defaults.
      setConfigValue(data, path, copyConfig(defaultValue));
    }
  });
  return data;
};

/**
 * Compute the configuration changes a form edit represents, by comparing the
 * data the form emitted against the data it was displaying. Only schema-declared
 * leaf fields are compared, so any other content the emitted object carries
 * (including display defaults the user did not touch) never produces a change.
 * String values are trimmed, and a field the user emptied requests deletion of
 * the underlying configuration key. Paths are absolute, so a caller applies
 * them without needing to know where the form sits.
 * @param form The form.
 * @param displayed The data the form was displaying.
 * @param emitted The data object the form emitted.
 * @param config The whole raw configuration (needed by bound fields).
 * @param defaults The whole configuration defaults (likewise).
 * @returns The list of configuration changes.
 */
export const computeConfigChanges = (
  form: EditorForm,
  displayed: RawAdvancedCameraCardConfig,
  emitted: unknown,
  config: RawAdvancedCameraCardConfig,
  defaults: RawAdvancedCameraCardConfig = {},
): ConfigChange[] => {
  const changes: ConfigChange[] = [];
  if (!isRecord(emitted)) {
    return changes;
  }
  forEachFieldRecursively(form.schema, (path) => {
    const before = getConfigValue(displayed, path);
    let after = getConfigValue(emitted, path);
    if (typeof after === 'string') {
      after = after.trim();
    }
    if (isEqual(before, after)) {
      return;
    }

    const binding = findBinding(form, path);
    if (binding && isComputedFieldBinding(binding)) {
      changes.push(...binding.write(after, config, defaults));
      return;
    }

    const configPath: ConfigPath = binding
      ? binding.configPath
      : [...form.basePath, ...path];
    if (after === undefined || after === '') {
      changes.push({ path: configPath, type: 'delete' });
    } else {
      changes.push({ path: configPath, type: 'set', value: after });
    }
  });
  return changes;
};

/**
 * Apply configuration changes to a raw configuration. Changes are applied onto
 * a copy of the existing configuration, so configuration content the schema
 * does not know about is left untouched.
 * @param config The raw configuration (not modified).
 * @param changes The changes to apply, at absolute paths.
 * @returns A new configuration with the changes applied, or null if the
 * changes leave the configuration unmodified.
 */
export const applyConfigChanges = (
  config: RawAdvancedCameraCardConfig,
  changes: readonly ConfigChange[],
): RawAdvancedCameraCardConfig | null => {
  if (!changes.length) {
    return null;
  }
  const newConfig = copyConfig(config);
  for (const change of changes) {
    if (change.type === 'delete') {
      deleteConfigValue(newConfig, change.path);
    } else {
      // Copied so no mutation of the form data can reach into the returned
      // configuration.
      setConfigValue(newConfig, change.path, copyConfig(change.value));
    }
  }
  return isEqual(newConfig, config) ? null : newConfig;
};
