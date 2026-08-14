import { cloneDeep, get, isEqual, set, unset } from 'lodash-es';

import { arrayify, arrayMove, isRecord } from '../utils/basic';
import {
  CONF_AUTOMATIONS,
  CONF_CAMERAS,
  CONF_CAMERAS_GLOBAL_DIMENSIONS_LAYOUT,
  CONF_CAMERAS_GLOBAL_PTZ,
  CONF_DIMENSIONS_HEIGHT,
  CONF_ELEMENTS,
  CONF_OVERRIDES,
  CONF_PROFILES,
  CONF_STATUS_BAR,
  CONF_UPGRADE_FAILURE,
  CONF_VIEW_DEFAULT_CYCLE_CAMERA,
  CONF_VIEW_DEFAULT_RESET_ENTITIES,
  CONF_VIEW_DEFAULT_RESET_EVERY_SECONDS,
  CONF_VIEW_DEFAULT_RESET_INTERACTION_MODE,
  CONF_VIEW_DIM,
  CONF_VIEW_INTERACTION_SECONDS,
  CONF_VIEW_TRIGGERS,
  CONF_VIEW_TRIGGERS_ACTIONS_TRIGGER,
  CONF_VIEW_TRIGGERS_ACTIONS_UNTRIGGER,
  CONF_VIEW_TRIGGERS_FILTER_SELECTED_CAMERA,
  CONF_VIEW_TRIGGERS_UNTRIGGER_DELAY_SECONDS,
} from './const';
import type {
  RawAdvancedCameraCardConfig,
  RawAdvancedCameraCardConfigArray,
} from './types';

// *************************************************************************
//                  General Config Management Functions
// *************************************************************************

/**
 * Set a configuration value.
 * @param obj The configuration.
 * @param keys The key to the property to set.
 * @param value The value to set.
 */
export const setConfigValue = (
  obj: RawAdvancedCameraCardConfig,
  keys: string | (string | number)[],
  value: unknown,
): void => {
  set(obj, keys, value);
};

/**
 * Get a configuration value.
 * @param obj The configuration.
 * @param keys The key to the property to retrieve.
 * @param def Default if key not found.
 * @returns The property or undefined if not found.
 */
export const getConfigValue = (
  obj: RawAdvancedCameraCardConfig,
  keys: string | (string | number)[],
  def?: unknown,
): unknown => {
  return get(obj, keys, def);
};

/**
 * Delete a configuration value.
 * @param obj The configuration.
 * @param key The key to the property to delete.
 */
export const deleteConfigValue = (
  obj: RawAdvancedCameraCardConfig,
  path: string | (string | number)[],
): void => {
  unset(obj, path);
};

/**
 * Copy a configuration.
 * @param obj Configuration to copy.
 * @returns A new deeply-copied configuration.
 */
export const copyConfig = <T>(obj: T): T => {
  return cloneDeep(obj);
};

// Apply an in-place mutation to the array at `arrayPath`, returning whether the
// mutation reported a change.
const mutateConfigArray = (
  obj: RawAdvancedCameraCardConfig,
  arrayPath: string | (string | number)[],
  mutator: (array: unknown[]) => boolean,
): boolean => {
  const array = getConfigValue(obj, arrayPath);
  return Array.isArray(array) && mutator(array);
};

/**
 * Append an item to a configuration array. The array is created when the
 * configuration does not have one at that path yet.
 * @param obj The configuration to modify.
 * @param arrayPath The configuration path of the array.
 * @param item The item to append.
 * @returns `true` if the configuration was modified.
 */
export const addConfigArrayItem = (
  obj: RawAdvancedCameraCardConfig,
  arrayPath: string | (string | number)[],
  item: unknown,
): boolean => {
  const array = getConfigValue(obj, arrayPath);
  if (!Array.isArray(array)) {
    setConfigValue(obj, arrayPath, [item]);
    return true;
  }
  array.push(item);
  return true;
};

/**
 * Move an item within a configuration array.
 * @param obj The configuration to modify.
 * @param arrayPath The configuration path of the array.
 * @param fromIndex The index of the item to move.
 * @param toIndex The index to move the item to.
 * @returns `true` if the configuration was modified.
 */
export const moveConfigArrayItem = (
  obj: RawAdvancedCameraCardConfig,
  arrayPath: string | (string | number)[],
  fromIndex: number,
  toIndex: number,
): boolean =>
  mutateConfigArray(obj, arrayPath, (array) => {
    if (
      !Number.isInteger(fromIndex) ||
      !Number.isInteger(toIndex) ||
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= array.length ||
      toIndex >= array.length
    ) {
      return false;
    }
    arrayMove(array, fromIndex, toIndex);
    return true;
  });

/**
 * Delete an item from a configuration array.
 * @param obj The configuration to modify.
 * @param arrayPath The configuration path of the array.
 * @param index The index of the item to delete.
 * @returns `true` if the configuration was modified.
 */
export const deleteConfigArrayItem = (
  obj: RawAdvancedCameraCardConfig,
  arrayPath: string | (string | number)[],
  index: number,
): boolean =>
  mutateConfigArray(obj, arrayPath, (array) => {
    if (!Number.isInteger(index) || index < 0 || index >= array.length) {
      return false;
    }
    array.splice(index, 1);
    return true;
  });

// *************************************************************************
//                  Upgrade Related Functions
// *************************************************************************

/**
 * Upgrade a configuration.
 * @param obj The configuration to upgrade.
 * @returns `true` if the configuration is modified.
 */
export const upgradeConfig = function (obj: RawAdvancedCameraCardConfig): boolean {
  let upgraded = false;
  for (let i = 0; i < UPGRADES.length; i++) {
    upgraded = UPGRADES[i](obj) || upgraded;
  }
  return upgraded;
};

/**
 * Determine if a configuration is automatically upgradeable.
 * @param obj The configuration. It is not modified.
 * @returns `true` if the configuration is upgradeable.
 */
export const isConfigUpgradeable = function (obj: RawAdvancedCameraCardConfig): boolean {
  return upgradeConfig(copyConfig(obj));
};

/**
 * Move a property from one location to another.
 * @param obj The configuration object in which the property resides.
 * @param oldPath The old property path.
 * @param newPath The new property path.
 * @param transform An optional transform for the value.
 * @returns `true` if the configuration was modified.
 */
export const moveConfigValue = (
  obj: RawAdvancedCameraCardConfig,
  oldPath: string,
  newPath: string,
  options?: {
    transform?: (valueIn: unknown) => unknown;
    keepOriginal?: boolean;
  },
): boolean => {
  const inValue = getConfigValue(obj, oldPath);
  if (inValue === undefined) {
    return false;
  }
  const outValue = options?.transform ? options.transform(inValue) : inValue;
  if (oldPath === newPath && isEqual(inValue, outValue)) {
    return false;
  }
  if (outValue === null) {
    if (!options?.keepOriginal) {
      deleteConfigValue(obj, oldPath);
      return true;
    }
    return false;
  }
  if (outValue !== undefined) {
    if (!options?.keepOriginal) {
      deleteConfigValue(obj, oldPath);
    }
    setConfigValue(obj, newPath, outValue);
    return true;
  }
  return false;
};

/**
 * Upgrade by moving a property from one location to another.
 * @param oldPath The old property path.
 * @param newPath The new property path.
 * @param transform An optional transform for the value.
 * @returns `true` if the configuration was modified.
 */
export const upgradeMoveTo = function (
  oldPath: string,
  newPath: string,
  options?: {
    transform?: (valueIn: unknown) => unknown;
    keepOriginal?: boolean;
  },
): (obj: RawAdvancedCameraCardConfig) => boolean {
  return function (obj: RawAdvancedCameraCardConfig): boolean {
    return moveConfigValue(obj, oldPath, newPath, options);
  };
};

/**
 * Upgrade by moving a property from one location to another, and moving a
 * property specified in a top-level overrides object.
 * @param oldPath The old property path.
 * @param newPath The new property path.
 * @param transform An optional transform for the value.
 * @returns A function that returns `true` if the configuration was modified.
 */
export const upgradeMoveToWithOverrides = function (
  oldPath: string,
  newPath: string,
  options?: {
    transform?: (valueIn: unknown) => unknown;
    keepOriginal?: boolean;
  },
): (obj: RawAdvancedCameraCardConfig) => boolean {
  return function (obj: RawAdvancedCameraCardConfig): boolean {
    let modified = upgradeMoveTo(oldPath, newPath, options)(obj);
    modified =
      upgradeArrayOfObjects(
        CONF_OVERRIDES,
        upgradeMoveTo(oldPath, newPath, options),
        (obj) =>
          obj.merge && typeof obj.merge === 'object'
            ? (obj.merge as RawAdvancedCameraCardConfig | undefined)
            : undefined,
      )(obj) || modified;
    modified =
      upgradeArrayOfObjects(
        CONF_OVERRIDES,
        upgradeMoveTo(oldPath, newPath, options),
        (obj) =>
          obj.set && typeof obj.set === 'object'
            ? (obj.set as RawAdvancedCameraCardConfig | undefined)
            : undefined,
      )(obj) || modified;
    return modified;
  };
};

/**
 * Upgrade a property in place with overrides.
 * @param path The old property path.
 * @param transform An optional transform for the value.
 * @returns A function that returns `true` if the configuration was modified.
 */
export const upgradeWithOverrides = function (
  path: string,
  transform: (valueIn: unknown) => unknown,
): (obj: RawAdvancedCameraCardConfig) => boolean {
  return upgradeMoveToWithOverrides(path, path, { transform: transform });
};

/**
 * Delete a property in place with overrides.
 * @param path The property path.
 * @returns A function that returns `true` if the configuration was modified.
 */
export const deleteWithOverrides = function (
  path: string,
): (obj: RawAdvancedCameraCardConfig) => boolean {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return upgradeMoveToWithOverrides(path, path, { transform: (_) => null });
};

/**
 * Given a path to an array, apply an upgrade to each object in the array.
 * @param arrayPath The path to the array to upgrade.
 * @param upgrade A function that applies an upgrade to an object.
 * @param getObject A optional function that takes an item in the array and
 * returns the object to modify within it.
 * @returns A function that returns `true` if the configuration was modified.
 */
export const upgradeArrayOfObjects = function (
  arrayPath: string,
  upgrade: (obj: RawAdvancedCameraCardConfig) => boolean,
  getObject?: (
    obj: RawAdvancedCameraCardConfig,
  ) => RawAdvancedCameraCardConfig | undefined,
): (obj: RawAdvancedCameraCardConfig) => boolean {
  return function (obj: RawAdvancedCameraCardConfig): boolean {
    let modified = false;
    const array = getConfigValue(obj, arrayPath);
    if (Array.isArray(array)) {
      array.forEach((item) => {
        const object = getObject ? getObject(item) : item;
        if (object && typeof object === 'object') {
          modified = upgrade(object) || modified;
        }
      });
    }
    return modified;
  };
};

/**
 * Recursively upgrade an object.
 * @param transform A transform applied to each object recursively.
 * @param getObject A function to get the object to be upgraded.
 * @returns An upgrade function.
 */
export const upgradeObjectRecursively = (
  transform: (data: RawAdvancedCameraCardConfig) => boolean,
  getObject?: (
    data: RawAdvancedCameraCardConfig,
  ) => RawAdvancedCameraCardConfig | undefined | null,
): ((data: RawAdvancedCameraCardConfig) => boolean) => {
  const recurse = (data: RawAdvancedCameraCardConfig): boolean => {
    let result = false;
    if (data && typeof data === 'object') {
      const object = getObject ? getObject(data) : data;
      if (object) {
        result = transform(object) || result;
      }
      if (Array.isArray(data)) {
        data.forEach((item: RawAdvancedCameraCardConfig) => {
          result = recurse(item) || result;
        });
      } else {
        Object.keys(data).forEach((key) => {
          result = recurse(data[key] as RawAdvancedCameraCardConfig) || result;
        });
      }
    }
    return result;
  };
  return recurse;
};

// *************************************************************************
//              Upgrade Related Functions: Generic Transforms
// *************************************************************************

/**
 * Create a transform that will cap a numeric value.
 * @param value The value.
 * @returns A number or null.
 */
export const createRangedTransform = function (
  transform: (value: unknown) => unknown,
  min?: number,
  max?: number,
): (valueIn: unknown) => unknown {
  return (value: unknown): unknown => {
    let transformed = transform(value);
    if (typeof transformed !== 'number') {
      return transformed;
    }
    transformed = min !== undefined ? Math.max(min, transformed as number) : transformed;
    transformed = max !== undefined ? Math.min(max, transformed as number) : transformed;
    return transformed;
  };
};

/**
 * Request a property be deleted.
 * @param _value Inbound value (not required).
 * @returns `null` to request the property be deleted.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const deleteTransform = function (_value: unknown): number | null | undefined {
  return null;
};

// *************************************************************************
//        Upgrade Related Functions: Specific Transforms / Upgraders
// *************************************************************************

/**
 * Transform a single object with multiple conditions to multiple objects with
 * single conditions
 * @param data Input data.
 * @returns `true` if the configuration was modified.
 */
const conditionToConditionsTransform = (data: unknown): boolean => {
  if (!isRecord(data) || !isRecord(data['conditions'])) {
    return false;
  }

  const oldConditions = data['conditions'];

  // The legacy values are copied across unvalidated; the schema rejects
  // anything malformed when the migrated configuration is later parsed.
  const newConditions: RawAdvancedCameraCardConfig[] = [];

  if (oldConditions['view'] !== undefined) {
    newConditions.push({
      condition: 'view' as const,
      views: oldConditions['view'],
    });
  }
  if (oldConditions['fullscreen'] !== undefined) {
    newConditions.push({
      condition: 'fullscreen' as const,
      fullscreen: oldConditions['fullscreen'],
    });
  }
  if (oldConditions['expand'] !== undefined) {
    newConditions.push({
      condition: 'expand' as const,
      expand: oldConditions['expand'],
    });
  }
  if (oldConditions['camera'] !== undefined) {
    newConditions.push({
      condition: 'camera' as const,
      cameras: oldConditions['camera'],
    });
  }
  if (oldConditions['media_loaded'] !== undefined) {
    newConditions.push({
      condition: 'media_loaded' as const,
      media_loaded: oldConditions['media_loaded'],
    });
  }
  if (oldConditions['state'] !== undefined && Array.isArray(oldConditions['state'])) {
    for (const stateCondition of oldConditions['state']) {
      if (
        isRecord(stateCondition) &&
        (stateCondition['state'] !== undefined ||
          stateCondition['state_not'] !== undefined ||
          stateCondition['entity'] !== undefined)
      ) {
        newConditions.push({
          condition: 'state' as const,
          ...(!!stateCondition['state'] && { state: stateCondition['state'] }),
          ...(!!stateCondition['state_not'] && {
            state_not: stateCondition['state_not'],
          }),
          ...(!!stateCondition['entity'] && { entity_id: stateCondition['entity'] }),
        });
      }
    }
  }
  if (oldConditions['media_query'] !== undefined) {
    newConditions.push({
      condition: 'screen' as const,
      media_query: oldConditions['media_query'],
    });
  }

  // These conditions did not exist prior to v6.0.0 and so are not converted:
  // - display_mode
  // - triggered
  // - interaction
  // - microphone

  if (newConditions.length) {
    data['conditions'] = newConditions;
    return true;
  }
  return false;
};

const isCompositeCondition = (condition: unknown): boolean => {
  if (!isRecord(condition)) {
    return false;
  }
  const kind = condition['condition'];
  return typeof kind === 'string' && ['or', 'and', 'not'].includes(kind);
};

// Triggers are a flat OR list with no composites, so a composite condition is
// reduced to its leaf conditions for the trigger list (the composite itself is
// retained on the `conditions:` side).
const flattenConditionLeaves = (condition: unknown): unknown[] => {
  if (!isCompositeCondition(condition) || !isRecord(condition)) {
    return [condition];
  }
  const inner = condition['conditions'];
  return Array.isArray(inner) ? inner.flatMap(flattenConditionLeaves) : [];
};

// A condition that fired on a *change* rather than describing an ongoing state
// was really a trigger (the legacy "conditions-as-triggers" model). Migration
// promotes it to a trigger and drops it from the retained `conditions:`.
//
// Note: `config` is no longer a condition; and although the current schema
// reads a valueless `camera` as "any camera selected", a *legacy* valueless
// `camera` meant the change, so it is still trigger-only here).
const isTriggerOnlyCondition = (condition: unknown): boolean => {
  if (!isRecord(condition)) {
    return false;
  }
  const kind = condition['condition'];
  if (kind === 'config') {
    // `config` is no longer a condition at all.
    return true;
  }
  if (kind === 'camera') {
    return !(Array.isArray(condition['cameras']) && condition['cameras'].length);
  }
  if (kind === 'view') {
    return !(Array.isArray(condition['views']) && condition['views'].length);
  }
  if (kind === 'state' || kind === undefined) {
    return condition['state'] === undefined && condition['state_not'] === undefined;
  }
  return false;
};

// Drop trigger-only conditions from a retained `conditions:` list, recursing
// into composites and discarding any that become empty.
const dropTriggerOnlyConditions = (conditions: unknown[]): unknown[] => {
  const kept: unknown[] = [];
  for (const condition of conditions) {
    if (
      isCompositeCondition(condition) &&
      isRecord(condition) &&
      Array.isArray(condition['conditions'])
    ) {
      const inner = dropTriggerOnlyConditions(condition['conditions']);
      if (inner.length) {
        kept.push({ ...condition, conditions: inner });
      }
    } else if (!isTriggerOnlyCondition(condition)) {
      kept.push(condition);
    }
  }
  return kept;
};

const rewriteConditionAsTrigger = (condition: unknown): unknown => {
  if (!isRecord(condition)) {
    return condition;
  }
  const kind = condition['condition'];

  // Only the renamed fields are consumed; anything else the condition carries
  // (`enabled`, and the fields it already shares with its trigger) is preserved,
  // so promoting never silently discards user configuration.
  const withoutKeys = (...keys: string[]): RawAdvancedCameraCardConfig => {
    const rest = { ...condition };
    for (const key of keys) {
      delete rest[key];
    }
    return rest;
  };

  // A `state` condition maps onto the HA state trigger (`state` -> `to`,
  // `state_not` -> `not_to`). A discriminator-less condition is the bare
  // picture-element state form -- the only condition that may omit `condition`.
  if (kind === 'state' || kind === undefined) {
    const entityId = condition['entity_id'] ?? condition['entity'];
    return {
      trigger: 'state',
      ...withoutKeys('condition', 'entity', 'entity_id', 'state', 'state_not'),
      ...(entityId !== undefined && { entity_id: entityId }),
      ...(condition['state'] !== undefined && { to: condition['state'] }),
      ...(condition['state_not'] !== undefined && { not_to: condition['state_not'] }),
    };
  }

  // A `call` condition describes a phase; as a trigger it is the arrival at
  // that phase.
  if (kind === 'call') {
    return {
      trigger: 'call',
      ...withoutKeys('condition', 'call'),
      ...(condition['call'] !== undefined && { to: condition['call'] }),
    };
  }

  // Every other condition -- the stock `numeric_state`/`template` and all the
  // card-specific kinds -- shares its field names with the matching trigger
  // (only `state` and `call` involve internal field renames), so promoting is
  // just a discriminator swap.
  return { trigger: kind, ...withoutKeys('condition') };
};

/**
 * Promote an automation's `conditions:` into HA-native `triggers:`.
 *
 * A single simple condition becomes one trigger and the `conditions:` block is
 * dropped. Multiple conditions (or a composite) become one trigger per leaf,
 * while the original `conditions:` are retained as an ongoing predicate
 * (dual-list) -- minus any trigger-only forms, which would no longer be valid
 * conditions. Idempotent: an automation that already has `triggers:` is left
 * untouched.
 */
const promoteConditionsToTriggersTransform = (data: unknown): boolean => {
  if (!isRecord(data) || 'triggers' in data) {
    return false;
  }
  const conditions = data['conditions'];
  if (!Array.isArray(conditions) || !conditions.length) {
    return false;
  }

  if (conditions.length === 1 && !isCompositeCondition(conditions[0])) {
    data['triggers'] = [rewriteConditionAsTrigger(conditions[0])];
    delete data['conditions'];
  } else {
    data['triggers'] = conditions
      .flatMap(flattenConditionLeaves)
      .map(rewriteConditionAsTrigger);
    const ongoing = dropTriggerOnlyConditions(conditions);
    if (ongoing.length) {
      data['conditions'] = ongoing;
    } else {
      delete data['conditions'];
    }
  }
  return true;
};

/**
 * Whether the upgrade recorded any config it could not faithfully convert,
 * under {@link CONF_UPGRADE_FAILURE} (only ever written non-empty). The config
 * is not modified.
 * @param obj The configuration.
 * @returns `true` if any failures remain.
 */
export const hasConfigUpgradeFailures = (
  obj: RawAdvancedCameraCardConfig | null,
): boolean => {
  const failures = obj?.[CONF_UPGRADE_FAILURE];
  return isRecord(failures) && Object.keys(failures).length > 0;
};

/**
 * Record entries the upgrade could not faithfully convert under
 * `__UPGRADE_FAILURE__.<path>` (the namespace shadows the main config -- see
 * {@link CONF_UPGRADE_FAILURE}), appending to any already recorded there.
 * @param data The configuration, modified in place.
 * @param path The config path the entries came from (e.g. `automations`).
 * @param failures The original entries, recorded untouched.
 */
const addUpgradeFailures = (
  data: RawAdvancedCameraCardConfig,
  path: string,
  failures: unknown[],
): void => {
  const upgradeFailures = isRecord(data[CONF_UPGRADE_FAILURE])
    ? data[CONF_UPGRADE_FAILURE]
    : {};
  const existing = upgradeFailures[path];
  upgradeFailures[path] = [...(Array.isArray(existing) ? existing : []), ...failures];
  data[CONF_UPGRADE_FAILURE] = upgradeFailures;
};

// `template`/`screen` conditions have no "any change" trigger -- their only
// trigger fires on the rising edge alone (HA's own template/numeric_state
// triggers behave identically, and HA has no `screen` trigger at all). An
// automation resting on one cannot re-fire when it stops matching, so its
// migrated `else` will not run on that falling edge.
const RISING_EDGE_ONLY_CONDITIONS = ['template', 'screen'];

// Build the "fire on any change" trigger that drives a migrated `if`/`then`/
// `else` for a single condition leaf, plus whether that trigger only sees the
// rising edge. Returns a null trigger for conditions that cannot change at
// runtime (`user`/`user_agent`), which therefore contribute none.
const synthesizeAnyChangeTrigger = (
  leaf: unknown,
): { trigger: RawAdvancedCameraCardConfig | null; risingEdgeOnly: boolean } => {
  if (!isRecord(leaf)) {
    return { trigger: null, risingEdgeOnly: false };
  }
  const kind = leaf['condition'] ?? 'state';

  // Static within a session: no runtime change, so no trigger.
  if (kind === 'user' || kind === 'user_agent') {
    return { trigger: null, risingEdgeOnly: false };
  }

  // Entity-backed: a plain `state` watch (no `to`) fires on every change of the
  // entity, so the wrapped `if(state)`/`if(numeric_state)` re-evaluates on both
  // edges -- the same trigger a user would hand-write in Home Assistant.
  if (kind === 'state' || kind === 'numeric_state') {
    const entityId = leaf['entity_id'] ?? leaf['entity'];
    if (entityId !== undefined) {
      return {
        trigger: { trigger: 'state', entity_id: entityId },
        risingEdgeOnly: false,
      };
    }
  }

  // `config` is trigger-only; its `paths` scope a config-change watch (still any
  // change), so they are preserved rather than dropped like a match value.
  if (kind === 'config') {
    const paths = leaf['paths'];
    return {
      trigger: { trigger: 'config', ...(paths !== undefined && { paths }) },
      risingEdgeOnly: false,
    };
  }

  // Rising-edge-only kinds (and a `numeric_state` with only a `value_template`,
  // which has no entity to watch): best-effort reuse of their own trigger.
  if (
    (typeof kind === 'string' && RISING_EDGE_ONLY_CONDITIONS.includes(kind)) ||
    kind === 'numeric_state'
  ) {
    const rest = { ...leaf };
    delete rest['condition'];
    return { trigger: { trigger: kind, ...rest }, risingEdgeOnly: true };
  }

  // Card-state kinds: the valueless trigger fires on any change.
  return { trigger: { trigger: kind }, risingEdgeOnly: false };
};

// Synthesize the deduplicated set of "any change" triggers for the condition
// leaves. Conditions that are all static never change after startup, so a
// single `initialized` evaluation is faithful.
const synthesizeAnyChangeTriggers = (
  conditions: unknown[],
): RawAdvancedCameraCardConfig[] => {
  const triggers: RawAdvancedCameraCardConfig[] = [];
  for (const leaf of conditions.flatMap(flattenConditionLeaves)) {
    const { trigger } = synthesizeAnyChangeTrigger(leaf);
    if (trigger && !triggers.some((existing) => isEqual(existing, trigger))) {
      triggers.push(trigger);
    }
  }
  if (!triggers.length) {
    triggers.push({ trigger: 'initialized' });
  }
  return triggers;
};

// A condition leaf whose only trigger fires on the rising edge (`template`/
// `screen`, or a `numeric_state` with no entity to watch) cannot drive the
// `else` branch when it stops matching, so such an automation cannot be
// faithfully converted.
const hasRisingEdgeOnlyCondition = (conditions: unknown[]): boolean =>
  conditions
    .flatMap(flattenConditionLeaves)
    .some((leaf) => synthesizeAnyChangeTrigger(leaf).risingEdgeOnly);

/**
 * Convert one legacy `actions_not` automation in place to an HA-native
 * `if`/`then`/`else` action, or report that it failed to convert.
 *
 * `{ conditions: C, actions: A, actions_not: B }` becomes `{ triggers:
 * <any-change for each leaf of C>, actions: [{ if: C, then: A, else: B }] }`:
 * the `if` retains both branches and the synthesized triggers re-evaluate it on
 * every change of the conditions. When `C` has no ongoing predicate for the
 * `if` to test -- it is absent, or holds only trigger-only conditions (legacy
 * change-detectors such as a bare `camera` or a `config` condition) -- the
 * `else` branch could never run, so `actions_not` is dropped rather than
 * wrapped. Conditions with a rising-edge-only leaf are returned as `'failed'`,
 * untouched, because their `else` cannot be reproduced faithfully. Idempotent:
 * a converted automation has no `actions_not` left to reconvert.
 */
const convertActionsNotAutomation = (
  automation: RawAdvancedCameraCardConfig,
): 'converted' | 'failed' => {
  const conditions = automation['conditions'];

  if (!Array.isArray(conditions) || !conditions.length) {
    // No conditions -- `actions_not` could never have run; it is simply dropped.
    delete automation['actions_not'];
    return 'converted';
  }

  if (hasRisingEdgeOnlyCondition(conditions)) {
    return 'failed';
  }

  const actionsNot = automation['actions_not'];
  const actions = Array.isArray(automation['actions']) ? automation['actions'] : [];

  automation['triggers'] = synthesizeAnyChangeTriggers(conditions);
  delete automation['actions_not'];

  // `conditions` move *into* the `if` below; they must not also remain as a
  // top-level ongoing condition, which would block the automation (and so the
  // `else` branch) whenever they fail -- exactly the case `else` exists to handle.
  delete automation['conditions'];

  // The `if` tests only the ongoing predicates; dropping the trigger-only
  // conditions can leave nothing, in which case `else` could never run.
  const ongoing = dropTriggerOnlyConditions(conditions);
  if (!ongoing.length) {
    automation['actions'] = actions;
    return 'converted';
  }

  automation['actions'] = [
    {
      if: ongoing,
      then: actions,
      ...(Array.isArray(actionsNot) && { else: actionsNot }),
    },
  ];
  return 'converted';
};

/**
 * Migrate every legacy `actions_not` automation: convert the faithful ones in
 * place to `if`/`then`/`else`, and record the rest -- conditions with a
 * rising-edge-only leaf, whose `else` cannot be reproduced -- as failures,
 * untouched, under `__UPGRADE_FAILURE__.automations` for the user to migrate by
 * hand. Runs before
 * the conditions->triggers promotion, which then skips the converted ones (they
 * now have `triggers:`) and never sees the failed ones.
 */
const migrateActionsNotTransform = (data: unknown): boolean => {
  if (!isRecord(data) || !Array.isArray(data[CONF_AUTOMATIONS])) {
    return false;
  }
  const kept: unknown[] = [];
  const failed: unknown[] = [];
  let modified = false;
  for (const automation of data[CONF_AUTOMATIONS]) {
    if (isRecord(automation) && 'actions_not' in automation) {
      modified = true;
      if (convertActionsNotAutomation(automation) === 'failed') {
        failed.push(automation);
        continue;
      }
    }
    kept.push(automation);
  }
  if (!modified) {
    return false;
  }
  data[CONF_AUTOMATIONS] = kept;
  if (failed.length) {
    addUpgradeFailures(data, CONF_AUTOMATIONS, failed);
  }
  return true;
};

// Picture-element conditional wrapper types (shared with upgradePTZElementsToLive).
const CONDITIONAL_ELEMENT_TYPES = [
  'conditional',
  'custom:advanced-camera-card-conditional',
];

const isConditionalElementType = (type: unknown): boolean =>
  typeof type === 'string' && CONDITIONAL_ELEMENT_TYPES.includes(type);

// Strip the trigger-only conditions from a single entry's `conditions:`, in
// place. `keep` is false when stripping emptied a non-empty `conditions:`,
// meaning the entry has no meaningful conditions left and the caller should drop
// it; an already-empty `conditions:` (or an entry with none) is the user's and
// left untouched.
const stripTriggerOnlyConditionsFromEntry = (
  entry: RawAdvancedCameraCardConfig,
): { keep: boolean; modified: boolean } => {
  const original = entry['conditions'];
  if (!Array.isArray(original)) {
    return { keep: true, modified: false };
  }
  const stripped = dropTriggerOnlyConditions(original);
  if (original.length && !stripped.length) {
    return { keep: false, modified: true };
  }
  if (!isEqual(stripped, original)) {
    entry['conditions'] = stripped;
    return { keep: true, modified: true };
  }
  return { keep: true, modified: false };
};

// Strip trigger-only conditions from the conditional elements in a picture-
// element tree, recursing into the kept conditionals. Conditional elements
// nest, so this is recursive; overrides are a flat list handled inline by the
// parent transform.
const stripTriggerOnlyConditionsFromElements = (
  elements: RawAdvancedCameraCardConfigArray,
): { elements: RawAdvancedCameraCardConfigArray; modified: boolean } => {
  let modified = false;
  const kept: RawAdvancedCameraCardConfigArray = [];
  for (const element of elements) {
    if (
      typeof element === 'object' &&
      element &&
      isConditionalElementType(element['type'])
    ) {
      const { keep, modified: entryModified } =
        stripTriggerOnlyConditionsFromEntry(element);
      modified = entryModified || modified;
      if (!keep) {
        continue;
      }
      if (Array.isArray(element['elements'])) {
        const inner = stripTriggerOnlyConditionsFromElements(element['elements']);
        modified = inner.modified || modified;
        element['elements'] = inner.elements;
      }
    }
    kept.push(element);
  }
  return { elements: kept, modified };
};

/**
 * Drop the now-invalid trigger-only conditions (including the removed `config`
 * condition) from the `conditions:` of overrides and conditional elements. An
 * entry whose conditions become empty has no meaningful conditions left, so it
 * is dropped entirely. Automations are handled by the promote transform.
 */
const stripTriggerOnlyConditionsFromOverridesElementsTransform = (
  data: unknown,
): boolean => {
  if (!isRecord(data)) {
    return false;
  }
  let modified = false;

  const overrides = data[CONF_OVERRIDES];
  if (Array.isArray(overrides)) {
    let overridesModified = false;
    const kept: RawAdvancedCameraCardConfigArray = [];
    for (const override of overrides) {
      if (typeof override === 'object' && override) {
        const { keep, modified: entryModified } =
          stripTriggerOnlyConditionsFromEntry(override);
        overridesModified = entryModified || overridesModified;
        if (!keep) {
          continue;
        }
      }
      kept.push(override);
    }
    if (overridesModified) {
      data[CONF_OVERRIDES] = kept;
      modified = true;
    }
  }

  const elements = data[CONF_ELEMENTS];
  if (Array.isArray(elements)) {
    const result = stripTriggerOnlyConditionsFromElements(elements);
    if (result.modified) {
      modified = true;
      if (result.elements.length) {
        data[CONF_ELEMENTS] = result.elements;
      } else {
        delete data[CONF_ELEMENTS];
      }
    }
  }

  return modified;
};

// Legacy nested trigger template paths -> the HA-native top-level `trigger.*`.
const TRIGGER_TEMPLATE_PATH_REWRITES: { suffix: string; modern: string }[] = [
  { suffix: 'trigger.state.entity', modern: 'trigger.entity_id' },
  { suffix: 'trigger.state.from', modern: 'trigger.from_state.state' },
  { suffix: 'trigger.state.to', modern: 'trigger.to_state.state' },
  { suffix: 'trigger.camera.from', modern: 'trigger.from_acc.camera' },
  { suffix: 'trigger.camera.to', modern: 'trigger.to_acc.camera' },
  { suffix: 'trigger.view.from', modern: 'trigger.from_acc.view' },
  { suffix: 'trigger.view.to', modern: 'trigger.to_acc.view' },
  { suffix: 'trigger.config.from', modern: 'trigger.from_acc.config' },
  { suffix: 'trigger.config.to', modern: 'trigger.to_acc.config' },
];

// Both the released `acc` alias and the full `advanced_camera_card` namespace are
// migrated.
const TRIGGER_TEMPLATE_PREFIXES = ['acc.', 'advanced_camera_card.'];

const rewriteTriggerTemplatePaths = (value: string): string => {
  let result = value;
  for (const prefix of TRIGGER_TEMPLATE_PREFIXES) {
    for (const { suffix, modern } of TRIGGER_TEMPLATE_PATH_REWRITES) {
      result = result.replaceAll(prefix + suffix, modern);
    }
  }
  return result;
};

// Apply a string rewrite to every template-string value of a single object, in
// place. Only touches values containing a nunjucks delimiter (`{{` expression
// or `{%` statement), i.e. template strings.
const rewriteTemplateStrings = (
  data: RawAdvancedCameraCardConfig,
  rewrite: (value: string) => string,
): boolean => {
  let modified = false;
  for (const key of Object.keys(data)) {
    const value = data[key];
    if (typeof value === 'string' && (value.includes('{{') || value.includes('{%'))) {
      const rewritten = rewrite(value);
      if (rewritten !== value) {
        data[key] = rewritten;
        modified = true;
      }
    }
  }
  return modified;
};

/**
 * Rewrite the legacy nested `acc.trigger.*` / `advanced_camera_card.trigger.*`
 * template paths to the top-level `trigger.*` surface, in place on a single
 * object's string values. Idempotent (a migrated path matches no legacy
 * pattern).
 *
 * @returns `true` if any value was rewritten.
 */
const migrateTriggerTemplatePathsTransform = (
  data: RawAdvancedCameraCardConfig,
): boolean => rewriteTemplateStrings(data, rewriteTriggerTemplatePaths);

/**
 * Retire the ambient `advanced_camera_card.*` template namespace in favour of its
 * shorter `acc` alias (the only spelling the trigger surface uses), rewriting the
 * prefix in a single object's string values. Idempotent.
 *
 * @returns `true` if any value was rewritten.
 */
const migrateAmbientTemplateNamespaceTransform = (
  data: RawAdvancedCameraCardConfig,
): boolean =>
  rewriteTemplateStrings(data, (value) =>
    value.replaceAll('advanced_camera_card.', 'acc.'),
  );

const callServiceToPerformActionTransform = (data: unknown): boolean => {
  if (
    !isRecord(data) ||
    data['action'] !== 'call-service' ||
    typeof data['service'] !== 'string'
  ) {
    return false;
  }
  data['action'] = 'perform-action';
  data['perform_action'] = data['service'];
  delete data['service'];
  return true;
};

/**
 * Transform service_data -> data
 * See: https://github.com/dermotduffy/advanced-camera-card/issues/1103
 * @param data Input data.
 * @returns `true` if the configuration was modified.
 */
const serviceDataToDataTransform = (data: unknown): boolean => {
  if (
    isRecord(data) &&
    data['action'] === 'call-service' &&
    data['service'] !== undefined &&
    data['service_data'] !== undefined &&
    data['data'] === undefined
  ) {
    data['data'] = data['service_data'];
    delete data['service_data'];
    return true;
  }
  return false;
};

/**
 * Transform element PTZ to native live PTZ.
 * @param data Input data.
 * @returns `true` if the configuration was modified.
 */
const upgradePTZElementsToLive = function (): (data: unknown) => boolean {
  return function (data: unknown): boolean {
    if (
      !isRecord(data) ||
      !(CONF_ELEMENTS in data) ||
      !Array.isArray(data[CONF_ELEMENTS])
    ) {
      return false;
    }

    let foundPTZ = false;
    const movePTZ = (element: RawAdvancedCameraCardConfig): void => {
      if (!foundPTZ) {
        if (!get(data, 'live.controls.ptz')) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { type: _, ...newPTZ } = element;
          set(data, 'live.controls.ptz', newPTZ);
        }
        foundPTZ = true;
      }
    };

    const processElements = (
      elements: RawAdvancedCameraCardConfigArray,
    ): RawAdvancedCameraCardConfigArray => {
      const newElements: RawAdvancedCameraCardConfigArray = [];
      for (const element of elements) {
        if (element['type'] === 'custom:advanced-camera-card-ptz') {
          movePTZ(element);
        } else if (
          isConditionalElementType(element['type']) &&
          Array.isArray(element['elements'])
        ) {
          const newConditionalElements = processElements(element['elements']);
          if (newConditionalElements.length) {
            element['elements'] = newConditionalElements;
            newElements.push(element);
          }
        } else {
          newElements.push(element);
        }
      }
      return newElements;
    };

    const newElements = processElements(data[CONF_ELEMENTS]);

    if (foundPTZ) {
      if (newElements.length) {
        data[CONF_ELEMENTS] = newElements;
      } else {
        delete data[CONF_ELEMENTS];
      }
    }
    return foundPTZ;
  };
};

// Upgrade old internal `data_*_stop` / `data_*_start` keys to
// WebRTC-compatible `data_end_*` / `data_start_*` ordering.
// WebRTC uses `data_start_left` / `data_end_left` (not `data_left_start` /
// `data_left_stop`).
// See: https://github.com/dermotduffy/advanced-camera-card/issues/2385
// See: https://github.com/AlexxIT/WebRTC/blob/master/custom_components/webrtc/www/webrtc-camera.js
const ptzIncorrectDataToWebRTCDataTransform = (data: unknown): unknown => {
  if (!isRecord(data)) {
    return undefined;
  }
  let modified = false;
  const out = { ...data };
  for (const key of Object.keys(out)) {
    const match = key.match(/^data_(.+)_(start|stop)$/);
    if (match) {
      const phase = match[2] === 'stop' ? 'end' : match[2];
      const webrtcKey = `data_${phase}_${match[1]}`;
      if (!(webrtcKey in out)) {
        out[webrtcKey] = out[key];
      }
      delete out[key];
      modified = true;
    }
  }
  return modified ? out : undefined;
};

const ptzActionsToCamerasGlobalTransform = (data: unknown): unknown => {
  if (!isRecord(data)) {
    return undefined;
  }

  const NON_PRESET_DATA_KEYS = [
    'data_left',
    'data_right',
    'data_up',
    'data_down',
    'data_zoom_in',
    'data_zoom_out',
    'service',
  ];

  const NON_PRESET_ACTION_KEYS = [
    // 'actions_' will overwrite 'data_*' if there's duplication.
    'actions_left',
    'actions_right',
    'actions_up',
    'actions_down',
    'actions_zoom_in',
    'actions_zoom_out',
  ];

  const PRESET_TRANSFORM_KEYS = ['data_home', 'actions_home'];
  const TRANSFORM_KEYS = [
    ...NON_PRESET_DATA_KEYS,
    ...NON_PRESET_ACTION_KEYS,
    ...PRESET_TRANSFORM_KEYS,
  ];

  const keys = Object.keys(data);
  const hasTransformable = keys.some((key) => TRANSFORM_KEYS.includes(key));
  if (!hasTransformable) {
    return undefined;
  }

  const output: RawAdvancedCameraCardConfig = {};

  NON_PRESET_DATA_KEYS.filter((key) => key in data).reduce((obj, key) => {
    obj[key] = data[key];
    return obj;
  }, output);

  NON_PRESET_ACTION_KEYS.filter((key) => key in data).reduce((obj, key) => {
    const action = data[key];
    if (isRecord(action) && 'tap_action' in action) {
      obj[key] = action['tap_action'];
    }
    return obj;
  }, output);

  // Returns the preset collection so callers can add to it after it is
  // attached to the output.
  const createPresets = (): RawAdvancedCameraCardConfig => {
    const existing = data['presets'];
    const presets = isRecord(existing) ? existing : {};
    output['presets'] = presets;
    return presets;
  };

  const actionsHome = data['actions_home'];
  const dataHome = data['data_home'];

  if (isRecord(actionsHome) && 'tap_action' in actionsHome) {
    createPresets()['home'] = actionsHome['tap_action'];
  } else if (isRecord(dataHome) && typeof data['service'] === 'string') {
    const presets = createPresets();
    presets['service'] = data['service'];
    presets['data_home'] = dataHome;
  }

  return output;
};

const ptzControlSettingsTransform = (data: unknown): unknown => {
  if (!isRecord(data)) {
    return data;
  }

  const TRANSFORM_KEYS = [
    'mode',
    'position',
    'orientation',
    'hide_pan_tilt',
    'hide_zoom',
    'hide_home',
    'hide_type',
    'style',
    'type',
  ];

  const keys = Object.keys(data);
  const hasSomethingToFilter = keys.some((key) => !TRANSFORM_KEYS.includes(key));
  if (!hasSomethingToFilter) {
    return undefined;
  }

  return keys
    .filter((key) => TRANSFORM_KEYS.includes(key))
    .reduce<RawAdvancedCameraCardConfig>((obj, key) => {
      obj[key] = data[key];
      return obj;
    }, {});
};

const titleControlTransform = (data: unknown): unknown => {
  if (!isRecord(data) || typeof data['mode'] !== 'string') {
    return null;
  }
  if (data['mode'] === 'none') {
    return {
      style: 'none',
    };
  }
  if (data['mode'].includes('bottom')) {
    return {
      position: 'bottom',
    };
  } else if (data['mode'].includes('top')) {
    return {
      position: 'top',
    };
  }
  return null;
};

const frigateCardToAdvancedCameraCardTransform = (
  data: RawAdvancedCameraCardConfig,
): boolean => {
  interface Substitution {
    oldKey: string;
    oldValue?: string;
    newKey?: string;
    newValue?: string;
  }

  const substitutions: Substitution[] = [
    {
      oldKey: 'type',
      oldValue: 'custom:frigate-card',
      newValue: 'custom:advanced-camera-card',
    },
    {
      oldKey: 'action',
      oldValue: 'custom:frigate-card-action',
      newValue: 'custom:advanced-camera-card-action',
    },
    {
      oldKey: 'type',
      oldValue: 'custom:frigate-card-menu-icon',
      newValue: 'custom:advanced-camera-card-menu-icon',
    },
    {
      oldKey: 'type',
      oldValue: 'custom:frigate-card-menu-state-icon',
      newValue: 'custom:advanced-camera-card-menu-state-icon',
    },
    {
      oldKey: 'type',
      oldValue: 'custom:frigate-card-menu-submenu',
      newValue: 'custom:advanced-camera-card-menu-submenu',
    },
    {
      oldKey: 'type',
      oldValue: 'custom:frigate-card-menu-submenu-select',
      newValue: 'custom:advanced-camera-card-menu-submenu-select',
    },
    {
      oldKey: 'type',
      oldValue: 'custom:frigate-card-status-bar-icon',
      newValue: 'custom:advanced-camera-card-status-bar-icon',
    },
    {
      oldKey: 'type',
      oldValue: 'custom:frigate-card-status-bar-image',
      newValue: 'custom:advanced-camera-card-status-bar-image',
    },
    {
      oldKey: 'type',
      oldValue: 'custom:frigate-card-status-bar-string',
      newValue: 'custom:advanced-camera-card-status-bar-string',
    },
    {
      oldKey: 'type',
      oldValue: 'custom:frigate-card-conditional',
      newValue: 'custom:advanced-camera-card-conditional',
    },
    {
      oldKey: 'type',
      oldValue: 'custom:frigate-card-conditional',
      newValue: 'custom:advanced-camera-card-conditional',
    },
    {
      oldKey: 'frigate_card_action',
      newKey: 'advanced_camera_card_action',
    },
  ];

  let modified = false;
  for (const substitution of substitutions) {
    if (
      substitution.oldValue &&
      substitution.newValue &&
      data[substitution.oldKey] === substitution.oldValue
    ) {
      data[substitution.newKey ?? substitution.oldKey] = substitution.newValue;
      modified = true;
    }
    if (substitution.oldKey in data && substitution.newKey) {
      data[substitution.newKey] = data[substitution.oldKey];
      delete data[substitution.oldKey];
      modified = true;
    }
  }
  return modified;
};

// Unify the legacy trio `live_substream_{on,off,select}` into the new
// `substream_{on,off}` pair. `live_substream_select` carried the substream ID
// in its `camera` field; that field becomes `stream` on `substream_on`.
const substreamActionsUnifyTransform = (data: RawAdvancedCameraCardConfig): boolean => {
  if (
    data['action'] !== 'fire-dom-event' &&
    data['action'] !== 'custom:advanced-camera-card-action'
  ) {
    return false;
  }
  const action = data['advanced_camera_card_action'];
  if (action === 'live_substream_on') {
    data['advanced_camera_card_action'] = 'substream_on';
    return true;
  }
  if (action === 'live_substream_off') {
    data['advanced_camera_card_action'] = 'substream_off';
    return true;
  }
  if (action === 'live_substream_select') {
    data['advanced_camera_card_action'] = 'substream_on';
    if ('camera' in data) {
      data['stream'] = data['camera'];
      delete data['camera'];
    }
    return true;
  }
  return false;
};

const frigateCardToAdvancedCameraCardStyleTransform = (data: unknown): unknown => {
  if (!isRecord(data) || Array.isArray(data)) {
    return data;
  }

  const newStyleOverrides = { ...data };
  const frigateCardStyleRegexp = new RegExp(/^--frigate-card-/);

  for (const key of Object.keys(data)) {
    if (key.match(frigateCardStyleRegexp)) {
      const newKey = key.replace(frigateCardStyleRegexp, '--advanced-camera-card-');

      newStyleOverrides[newKey] = data[key];
      delete newStyleOverrides[key];
    }
  }

  return newStyleOverrides;
};

// Legacy `triggers.events: string[]` (Frigate engine media-availability filter)
// was renamed to `triggers.media_events` to free up `triggers.events` for the
// new HA-bus-event trigger list (object shape). Distinguish old from new by
// element type: an array holding at least one string is legacy; any non-string
// element marks the new shape and must not be touched. An empty list says
// nothing about which of the two it is, and is valid under the new schema, so
// it is left alone -- a user who deletes their last event trigger is not
// offered an upgrade that would rename the key underneath them. If
// `media_events` already exists we refuse to overwrite it -- but we still drop
// the legacy `events` (otherwise it would fail the new schema, which expects
// objects).
const triggersEventsToMediaEventsTransform = (triggers: unknown): unknown => {
  if (!isRecord(triggers)) {
    return undefined;
  }
  const events = triggers['events'];
  if (
    !Array.isArray(events) ||
    !events.length ||
    events.some((x) => typeof x !== 'string')
  ) {
    return undefined;
  }
  const result = { ...triggers };
  delete result['events'];
  if (!('media_events' in result)) {
    result['media_events'] = events;
  }
  return result;
};

const REMOVED_MICROPHONE_ACTIONS = ['microphone_connect', 'microphone_disconnect'];

// The properties that hold actions: the tap handlers of elements, menu buttons,
// notification controls and views (`actionsBaseSchema`), the actions of an
// automation, and the branches of an `if` action. Each holds either a single
// action or a list of them.
const ACTION_PROPERTIES = [
  'actions',
  'double_tap_action',
  'else',
  'end_tap_action',
  'hold_action',
  'start_tap_action',
  'tap_action',
  'then',
];

const isRemovedMicrophoneAction = (data: unknown): boolean =>
  isRecord(data) &&
  (data['action'] === 'fire-dom-event' ||
    data['action'] === 'custom:advanced-camera-card-action') &&
  typeof data['advanced_camera_card_action'] === 'string' &&
  REMOVED_MICROPHONE_ACTIONS.includes(data['advanced_camera_card_action']);

/**
 * Remove the `microphone_connect` / `microphone_disconnect` actions wherever
 * they appear. The whole tree is walked because card actions can appear
 * anywhere (menu buttons, elements, automations, view-action handlers, etc.),
 * but only the properties that hold actions are touched, so an object that
 * merely resembles an action -- the `data` of a `perform-action`, for
 * instance -- is left as the user wrote it.
 *
 * A property holding a single such action is deleted, since every one of those
 * is optional. A list keeps its property even when it empties: some are
 * required (`automations[].actions`, an `if` action's `then`) and an empty one
 * is valid everywhere.
 */
const removeMicrophoneActionsTransform = (data: unknown): boolean => {
  // Arrays are records too, so their entries are walked by the loop below.
  if (!isRecord(data)) {
    return false;
  }

  let modified = false;
  for (const key of Object.keys(data)) {
    if (ACTION_PROPERTIES.includes(key)) {
      const value = data[key];
      if (isRemovedMicrophoneAction(value)) {
        delete data[key];
        modified = true;
        continue;
      }
      if (Array.isArray(value)) {
        const kept = value.filter((item) => !isRemovedMicrophoneAction(item));
        if (kept.length !== value.length) {
          data[key] = kept;
          modified = true;
        }
      }
    }

    modified = removeMicrophoneActionsTransform(data[key]) || modified;
  }
  return modified;
};

/**
 * Remove a value from an array. The array is kept even when it empties: inside
 * an override, deleting it would restore whatever the base configuration says
 * rather than leaving nothing. An array that does not hold the value is left
 * alone.
 */
const removeFromArrayTransform = (removed: unknown): ((value: unknown) => unknown) => {
  return (value: unknown): unknown => {
    if (!Array.isArray(value) || !value.includes(removed)) {
      return undefined;
    }
    return value.filter((item) => item !== removed);
  };
};

const UPGRADES = [
  // v5.2.0 -> v6.0.0
  (data: unknown): boolean => {
    return upgradeObjectRecursively(serviceDataToDataTransform)(
      isRecord(data) ? data : {},
    );
  },
  upgradePTZElementsToLive(),
  upgradeMoveToWithOverrides('view.timeout_seconds', CONF_VIEW_INTERACTION_SECONDS),
  upgradeWithOverrides('live.lazy_unload', (data) =>
    data === 'all' ? ['unselected', 'hidden'] : data === 'never' ? null : arrayify(data),
  ),
  upgradeWithOverrides('live.auto_play', (data) =>
    data === 'all' ? null : data === 'never' ? [] : arrayify(data),
  ),
  upgradeWithOverrides('live.auto_pause', (data) =>
    data === 'all' ? ['unselected', 'hidden'] : data === 'never' ? null : arrayify(data),
  ),
  upgradeWithOverrides('live.auto_mute', (data) =>
    data === 'all' ? null : data === 'never' ? [] : arrayify(data),
  ),
  upgradeWithOverrides('live.auto_unmute', (data) =>
    data === 'all'
      ? ['selected', 'visible', 'microphone']
      : data === 'never'
        ? null
        : arrayify(data),
  ),
  upgradeWithOverrides('media_viewer.auto_play', (data) =>
    data === 'all' ? null : data === 'never' ? [] : arrayify(data),
  ),
  upgradeWithOverrides('media_viewer.auto_pause', (data) =>
    data === 'all' ? null : data === 'never' ? [] : arrayify(data),
  ),
  upgradeWithOverrides('media_viewer.auto_mute', (data) =>
    data === 'all' ? null : data === 'never' ? [] : arrayify(data),
  ),
  upgradeWithOverrides('media_viewer.auto_unmute', (data) =>
    data === 'all' ? ['selected', 'visible'] : data === 'never' ? null : arrayify(data),
  ),

  upgradeMoveToWithOverrides(
    'live.controls.thumbnails.media',
    'live.controls.thumbnails.events_media_type',
  ),
  upgradeMoveToWithOverrides('timeline.media', 'timeline.events_media_type'),
  upgradeMoveToWithOverrides(
    'live.controls.timeline.media',
    'live.controls.timeline.events_media_type',
  ),
  upgradeMoveToWithOverrides(
    'media_viewer.controls.timeline.media',
    'media_viewer.controls.timeline.events_media_type',
  ),
  upgradeMoveToWithOverrides('view.scan', CONF_VIEW_TRIGGERS),
  upgradeMoveToWithOverrides(
    'view.triggers.enabled',
    CONF_VIEW_TRIGGERS_ACTIONS_TRIGGER,
    {
      transform: (data) => (data === true ? 'live' : null),
      // Keep it around, for the following transform.
      keepOriginal: true,
    },
  ),
  upgradeMoveToWithOverrides(
    'view.triggers.enabled',
    CONF_VIEW_TRIGGERS_FILTER_SELECTED_CAMERA,
    {
      transform: (data) => (data === true ? false : null),
    },
  ),
  upgradeMoveToWithOverrides(
    'view.triggers.untrigger_reset',
    CONF_VIEW_TRIGGERS_ACTIONS_UNTRIGGER,
    {
      // Delete the value if it's set to the default.
      transform: (val) => (val ? 'default' : null),
    },
  ),
  upgradeMoveToWithOverrides('live.layout', CONF_CAMERAS_GLOBAL_DIMENSIONS_LAYOUT),
  deleteWithOverrides('media_viewer.layout'),
  deleteWithOverrides('image.layout'),
  upgradeArrayOfObjects(CONF_OVERRIDES, conditionToConditionsTransform),
  (data: unknown): boolean => {
    const elements = isRecord(data) ? data[CONF_ELEMENTS] : null;
    return upgradeObjectRecursively(conditionToConditionsTransform)(
      isRecord(elements) ? elements : {},
    );
  },
  (data: unknown): boolean => {
    const automations = isRecord(data) ? data[CONF_AUTOMATIONS] : null;
    return upgradeObjectRecursively(conditionToConditionsTransform)(
      isRecord(automations) ? automations : {},
    );
  },
  upgradeArrayOfObjects(
    CONF_CAMERAS,
    upgradeMoveToWithOverrides('hide', 'capabilities', {
      transform: (val) => (val === true ? { disable_except: ['substream'] } : null),
    }),
  ),
  upgradeMoveToWithOverrides('performance.profile', CONF_PROFILES, {
    // Delete the value if it's set to the default.
    transform: (val) => (val === 'low' ? ['low-performance'] : null),
  }),
  upgradeArrayOfObjects(CONF_OVERRIDES, upgradeMoveTo('overrides', 'merge')),
  upgradeMoveToWithOverrides('live.controls.ptz', CONF_CAMERAS_GLOBAL_PTZ, {
    transform: ptzActionsToCamerasGlobalTransform,
    keepOriginal: true,
  }),
  upgradeWithOverrides('live.controls.ptz', ptzControlSettingsTransform),
  upgradeMoveToWithOverrides('view.update_cycle_camera', CONF_VIEW_DEFAULT_CYCLE_CAMERA),
  upgradeMoveToWithOverrides(
    'view.update_force',
    CONF_VIEW_DEFAULT_RESET_INTERACTION_MODE,
    {
      transform: (val) => (val === true ? 'all' : null),
    },
  ),
  upgradeMoveToWithOverrides(
    'view.update_seconds',
    CONF_VIEW_DEFAULT_RESET_EVERY_SECONDS,
  ),
  upgradeMoveToWithOverrides('view.update_entities', CONF_VIEW_DEFAULT_RESET_ENTITIES),
  upgradeMoveTo('live.controls.title', CONF_STATUS_BAR, {
    transform: titleControlTransform,
  }),
  deleteWithOverrides('live.controls.title'),
  deleteWithOverrides('media_viewer.controls.title'),

  // Upgrade call-service calls throughout the card config. They could show up
  // attached to any element, any automation, or any card/view action (i.e. very
  // broadly across the config), so it's challenging to better target this
  // upgrade. As written, this will convert things that look like call-service
  // calls recurseively throughout the whole card config, but this could
  // conceivably be an overreach if (e.g.) some totally unrelated object has {
  // action: 'call-service', service: '<any string>' } that means something
  // different.
  (data: unknown): boolean => {
    return upgradeObjectRecursively(callServiceToPerformActionTransform)(
      isRecord(data) ? data : {},
    );
  },
  upgradeMoveToWithOverrides('dimensions.max_height', CONF_DIMENSIONS_HEIGHT),
  deleteWithOverrides('dimensions.min_height'),

  // v6.1.2+
  upgradeMoveToWithOverrides('view.dark_mode', CONF_VIEW_DIM, {
    transform: (val) => val === 'on',
  }),

  // v7.0.0+
  (data: unknown): boolean => {
    return upgradeObjectRecursively(frigateCardToAdvancedCameraCardTransform)(
      isRecord(data) ? data : {},
    );
  },
  upgradeWithOverrides(
    'view.theme.overrides',
    frigateCardToAdvancedCameraCardStyleTransform,
  ),
  upgradeMoveToWithOverrides('menu.buttons.frigate', 'menu.buttons.iris'),

  // v8.0.0+
  upgradeMoveToWithOverrides(
    'live.controls.thumbnails.media_type',
    'cameras_global.media.type',
  ),
  upgradeMoveToWithOverrides(
    'live.controls.thumbnails.events_media_type',
    'cameras_global.media.events_type',
    {
      transform: (val) => {
        // 'all' is the default, delete it
        if (val === 'all') {
          return null;
        }
        return val;
      },
    },
  ),
  upgradeMoveToWithOverrides(
    'view.triggers.untrigger_seconds',
    CONF_VIEW_TRIGGERS_UNTRIGGER_DELAY_SECONDS,
  ),
  upgradeWithOverrides('cameras_global.ptz', ptzIncorrectDataToWebRTCDataTransform),
  upgradeArrayOfObjects(
    CONF_CAMERAS,
    upgradeWithOverrides('ptz', ptzIncorrectDataToWebRTCDataTransform),
  ),

  // Unify `live_substream_{on,off,select}` actions. Walked over the entire
  // tree because card actions can appear anywhere (menu buttons, elements,
  // automations, view-action handlers, etc.).
  (data: unknown): boolean => {
    return upgradeObjectRecursively(substreamActionsUnifyTransform)(
      isRecord(data) ? data : {},
    );
  },

  // Legacy `triggers.events: string[]` -> `triggers.media_events`. Targets the
  // two known places a camera config lives: `cameras_global` and `cameras[]`.
  // Mirrors the PTZ rename migration above.
  upgradeWithOverrides('cameras_global.triggers', triggersEventsToMediaEventsTransform),
  upgradeArrayOfObjects(
    CONF_CAMERAS,
    upgradeWithOverrides('triggers', triggersEventsToMediaEventsTransform),
  ),

  // Convert `actions_not` automations to an `if`/`then`/`else` action (or record
  // the unfaithful ones as failures). Runs before the promotion below, which
  // then skips the converted ones (they gain `triggers:`).
  migrateActionsNotTransform,

  // Promote automation `conditions:` into HA-native `triggers:`. Runs last so it
  // sees conditions in their final, fully-migrated form.
  upgradeArrayOfObjects(CONF_AUTOMATIONS, promoteConditionsToTriggersTransform),

  // Drop the now-invalid trigger-only conditions (incl. the removed `config`
  // condition) from overrides/elements, dropping any entry left ungated.
  stripTriggerOnlyConditionsFromOverridesElementsTransform,

  // Rewrite legacy nested trigger template paths to the top-level `trigger.*`.
  (data: unknown): boolean => {
    return upgradeObjectRecursively(migrateTriggerTemplatePathsTransform)(
      isRecord(data) ? data : {},
    );
  },

  // Rewrite the retired ambient `advanced_camera_card.*` namespace to `acc.*`.
  (data: unknown): boolean => {
    return upgradeObjectRecursively(migrateAmbientTemplateNamespaceTransform)(
      isRecord(data) ? data : {},
    );
  },

  // Retire microphone parameters/actions not needed with 'call'.
  // See: https://github.com/dermotduffy/advanced-camera-card/issues/2681
  deleteWithOverrides('live.microphone.disconnect_seconds'),
  upgradeWithOverrides('live.microphone.auto_mute', removeFromArrayTransform('call')),
  removeMicrophoneActionsTransform,
];
