import type {
  PTZAction,
  PTZActionPhase,
  PTZBaseAction,
} from '../../config/schema/actions/custom/ptz';
import type { ActionConfig } from '../../config/schema/actions/types';
import type { CameraConfig } from '../../config/schema/cameras';
import { PTZMovementType, type PTZCapabilities } from '../../types';

/**
 * Get the action configured for a named PTZ preset.
 * @param ptzConfig The camera's PTZ config.
 * @param preset The preset name.
 * @returns The configured action, or `null` if the preset is not configured.
 */
export const getConfiguredPTZPresetAction = (
  ptzConfig: CameraConfig['ptz'],
  preset: string,
): ActionConfig | null => {
  const presets = ptzConfig.presets;
  if (!presets) {
    return null;
  }

  const action = Object.entries(presets).find(([name]) => name === preset)?.[1];
  return typeof action === 'object' ? action : null;
};

export const getConfiguredPTZAction = (
  cameraConfig: CameraConfig,
  action: PTZAction,
  options?: {
    phase?: PTZActionPhase;
    preset?: string;
  },
): ActionConfig | ActionConfig[] | null => {
  if (action === 'preset') {
    return options?.preset
      ? getConfiguredPTZPresetAction(cameraConfig.ptz, options.preset)
      : null;
  }

  if (options?.phase) {
    return cameraConfig.ptz[`actions_${action}_${options.phase}`] ?? null;
  }

  return cameraConfig.ptz[`actions_${action}`] ?? null;
};

const hasConfiguredPTZAction = (
  cameraConfig: CameraConfig,
  action: PTZBaseAction,
  options?: {
    phase?: PTZActionPhase;
    preset?: string;
  },
): boolean => {
  return !!getConfiguredPTZAction(cameraConfig, action, options);
};

export const getConfiguredPTZMovementType = (
  cameraConfig: CameraConfig,
  action: PTZBaseAction,
): PTZMovementType[] | null => {
  const continuous =
    hasConfiguredPTZAction(cameraConfig, action, { phase: 'start' }) &&
    hasConfiguredPTZAction(cameraConfig, action, { phase: 'stop' });
  const relative = hasConfiguredPTZAction(cameraConfig, action);

  return continuous || relative
    ? [
        ...(continuous ? [PTZMovementType.Continuous] : []),
        ...(relative ? [PTZMovementType.Relative] : []),
      ]
    : null;
};

// Combine engine-detected and configured PTZ capabilities. Configured movement
// actions override their engine equivalents, but presets from both sources are
// kept (configured first) so that configuring a preset does not erase the
// auto-detected ones.
export const mergePTZCapabilities = (
  enginePTZ: PTZCapabilities | null,
  configPTZ: PTZCapabilities | null,
): PTZCapabilities | null => {
  if (!enginePTZ && !configPTZ) {
    return null;
  }

  const presets = [
    ...(configPTZ?.presets ?? []),
    ...(enginePTZ?.presets ?? []).filter(
      (preset) => !configPTZ?.presets?.includes(preset),
    ),
  ];

  return {
    ...enginePTZ,
    ...configPTZ,
    ...(presets.length ? { presets } : {}),
  };
};

export const getPTZCapabilitiesFromCameraConfig = (
  cameraConfig: CameraConfig,
): PTZCapabilities | null => {
  const left = getConfiguredPTZMovementType(cameraConfig, 'left');
  const right = getConfiguredPTZMovementType(cameraConfig, 'right');
  const up = getConfiguredPTZMovementType(cameraConfig, 'up');
  const down = getConfiguredPTZMovementType(cameraConfig, 'down');
  const zoomIn = getConfiguredPTZMovementType(cameraConfig, 'zoom_in');
  const zoomOut = getConfiguredPTZMovementType(cameraConfig, 'zoom_out');
  const presets = cameraConfig.ptz.presets
    ? Object.keys(cameraConfig.ptz.presets)
    : undefined;

  return left?.length ||
    right?.length ||
    up?.length ||
    down?.length ||
    zoomIn?.length ||
    zoomOut?.length ||
    presets?.length
    ? {
        // Only return keys with some capability (to aid with action merging
        // later).
        ...(left ? { left } : {}),
        ...(right ? { right } : {}),
        ...(up ? { up } : {}),
        ...(down ? { down } : {}),
        ...(zoomIn ? { zoomIn } : {}),
        ...(zoomOut ? { zoomOut } : {}),
        ...(presets ? { presets } : {}),
      }
    : null;
};
