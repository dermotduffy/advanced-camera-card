import type { TemplateResult } from 'lit';

import type { CameraManager } from '../../camera-manager/manager.js';
import {
  createMediaNotification,
  type MediaNotificationOptions,
} from '../../components-lib/notification/media.js';
import { localize } from '../../localize/localize.js';
import { renderNotificationBlock } from './block.js';

// Render the standard media notification block: a short titled heading (with
// the camera name when there is one), an optional longer detail, a
// troubleshooting link, and a retry spinner. See `createMediaNotification`.
export function renderMediaNotification(
  options: MediaNotificationOptions,
): TemplateResult {
  return renderNotificationBlock(createMediaNotification(options));
}

interface NoMediaOptions {
  cameraID: string | null;
  inProgress?: boolean;
}

// The viewer/gallery no-media (or awaiting-media) state.
export function renderNoMediaNotification(
  options: NoMediaOptions,
  cameraManager?: CameraManager,
): TemplateResult {
  const cameraID =
    options.cameraID ?? cameraManager?.getStore().getDefaultCameraID() ?? null;
  const targetTitle = cameraID
    ? cameraManager?.getCameraMetadata(cameraID)?.title ?? cameraID
    : undefined;

  return renderMediaNotification({
    title: localize(options.inProgress ? 'error.awaiting_media' : 'common.no_media'),
    icon: 'mdi:multimedia',
    targetTitle,
    inProgress: !!options.inProgress,
    troubleshooting: false,
  });
}
