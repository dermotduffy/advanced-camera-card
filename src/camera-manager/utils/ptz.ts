import { PTZAction, PTZBaseAction } from '../../config/ptz';
import { ActionConfig, ActionPhase, CameraConfig } from '../../config/types';
import { PTZCapabilities, PTZMovementType } from '../../types';

export const getConfiguredPTZAction = (
  cameraConfig: CameraConfig,
  action: PTZAction,
  options?: {
    phase?: ActionPhase;
    preset?: string;
  },
): ActionConfig | ActionConfig[] | null => {
  if (action === 'preset') {
    return (options?.preset ? cameraConfig.ptz.presets?.[options.preset] : null) ?? null;
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
    phase?: ActionPhase;
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
        ...(continuous ? ['continuous' as const] : []),
        ...(relative ? ['relative' as const] : []),
      ]
    : null;
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
