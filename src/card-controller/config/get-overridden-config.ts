import { merge } from 'lodash-es';
import { ZodType as ZodSchema } from 'zod';
import { ConditionsManagerReadonlyInterface } from '../../conditions/types';
import {
  copyConfig,
  deleteConfigValue,
  getConfigValue,
  setConfigValue,
} from '../../config/management';
import { Overrides } from '../../config/schema/overrides';
import { RawAdvancedCameraCardConfig } from '../../config/types';
import { localize } from '../../localize/localize';
import { AdvancedCameraCardError } from '../../types';
import { desparsifyArrays } from '../../utils/basic';

class OverrideConfigurationError extends AdvancedCameraCardError {}

export function getOverriddenConfig<RT extends RawAdvancedCameraCardConfig>(
  manager: ConditionsManagerReadonlyInterface,
  config: Readonly<RT>,
  options?: {
    configOverrides?: Readonly<Overrides>;
    schema?: ZodSchema;
  },
): RT {
  if (!options?.configOverrides) {
    return config;
  }

  let output = copyConfig(config);
  let overridden = false;
  for (const override of options.configOverrides) {
    if (manager.getEvaluation()?.result) {
      override.delete?.forEach((deletionKey) => {
        deleteConfigValue(output, deletionKey);
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
    return config;
  }

  if (options?.configOverrides?.some((override) => override.delete?.length)) {
    // If anything was deleted during this override, empty undefined slots may
    // be left in arrays where values were unset. Desparsify them.
    output = desparsifyArrays(output);
  }

  if (options?.schema) {
    const parseResult = options.schema.safeParse(output);
    if (!parseResult.success) {
      throw new OverrideConfigurationError(
        localize('error.invalid_configuration_override'),
        [parseResult.error.errors, output],
      );
    }
    return parseResult.data;
  }
  return output;
}
