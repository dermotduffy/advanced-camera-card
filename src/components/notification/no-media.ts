import { TemplateResult } from 'lit';
import { CameraManager } from '../../camera-manager/manager.js';
import { localize } from '../../localize/localize.js';
import { renderNotificationBlock } from './block.js';

interface NoMediaOptions {
  cameraID: string | null;
  cameraManager: CameraManager | null;
  loading?: boolean;
}

export function renderNoMedia(options: NoMediaOptions): TemplateResult {
  const cameraID =
    options.cameraID ?? options.cameraManager?.getStore().getDefaultCameraID() ?? null;
  const cameraTitle = cameraID
    ? options.cameraManager?.getCameraMetadata(cameraID)?.title ?? cameraID
    : null;

  return renderNotificationBlock({
    heading: {
      text: options.loading
        ? localize('error.awaiting_media')
        : localize('common.no_media'),
      icon: 'mdi:multimedia',
    },
    in_progress: options.loading,
    ...(cameraTitle && {
      metadata: [{ text: cameraTitle, icon: 'mdi:cctv' }],
    }),
  });
}
