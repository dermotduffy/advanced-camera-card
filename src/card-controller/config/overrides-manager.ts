import { merge } from 'lodash-es';
import { ConditionsManager } from '../../conditions/conditions-manager';
import { ConditionStateManagerReadonlyInterface } from '../../conditions/types';
import {
  copyConfig,
  deleteConfigValue,
  getConfigValue,
  setConfigValue,
} from '../../config/management';
import { Override } from '../../config/schema/overrides';
import {
  AdvancedCameraCardConfig,
  advancedCameraCardConfigSchema,
} from '../../config/schema/types';
import { localize } from '../../localize/localize';
import { AdvancedCameraCardError } from '../../types';
import { desparsifyArrays } from '../../utils/basic.js';

type OverridesCallback = () => void;

class OverrideConfigurationError extends AdvancedCameraCardError {}

export class OverridesManager {
  private _overrides = new Map<Override, ConditionsManager>();
  private _callback: OverridesCallback;

  constructor(callback: OverridesCallback) {
    this._callback = callback;
  }

  private _clear(): void {
    this._overrides.forEach((manager) => manager.destroy());
    this._overrides.clear();
  }

  public hasOverrides(): boolean {
    return !!this._overrides.size;
  }

  public set(
    stateManager: ConditionStateManagerReadonlyInterface,
    overrides?: Override[],
  ): void {
    this._clear();

    overrides?.forEach((override) => {
      const manager = new ConditionsManager(override.conditions, stateManager);
      manager.addListener(this._callback);
      this._overrides.set(override, manager);
    });
  }

  public getConfig(base: AdvancedCameraCardConfig): AdvancedCameraCardConfig {
    let output = copyConfig(base);
    let overridden = false;
    let desparsify = false;

    for (const [override, manager] of this._overrides.entries()) {
      if (manager.getEvaluation()?.result) {
        override.delete?.forEach((deletionKey) => {
          deleteConfigValue(output, deletionKey);
          desparsify = true;
        });

        Object.keys(override.set ?? {}).forEach((setKey) => {
          setConfigValue(output, setKey, override.set?.[setKey]);
        });

        Object.keys(override.merge ?? {}).forEach((mergeKey) => {
          setConfigValue(
            output,
            mergeKey,
            merge({}, getConfigValue(output, mergeKey), override.merge?.[mergeKey]),
          );
        });

        overridden = true;
      }
    }

    if (!overridden) {
      // Return the same configuration object if it has not been overridden (to
      // reduce re-renders for a configuration that has not changed).
      return base;
    }

    if (desparsify) {
      // If anything was deleted during this override, empty undefined slots may
      // be left in arrays where values were unset. Desparsify them.
      output = desparsifyArrays(output);
    }

    const parseResult = advancedCameraCardConfigSchema.safeParse(output);
    if (!parseResult.success) {
      throw new OverrideConfigurationError(
        localize('error.invalid_configuration_override'),
        [parseResult.error.errors, output],
      );
    }
    return parseResult.data;
  }
}
