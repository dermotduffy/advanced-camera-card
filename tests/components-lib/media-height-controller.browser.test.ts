import { describe, expect, it, onTestFinished, vi } from 'vitest';

import {
  FULLSCREEN_MAX_HEIGHT_PROPERTY,
  MediaHeightController,
} from '../../src/components-lib/media-height-controller';

describe('MediaHeightController', () => {
  it('should cap the host at the unscaled media height when an ancestor scales it', async () => {
    const scaler = document.createElement('div');
    scaler.style.transform = 'scale(0.5)';

    const host = document.createElement('div');
    const media = document.createElement('div');
    media.style.height = '300px';
    host.append(media);
    scaler.append(host);
    document.body.append(scaler);
    onTestFinished(() => scaler.remove());

    const controller = new MediaHeightController(host, 'div');
    onTestFinished(() => controller.destroy());
    controller.setRoot(host);
    controller.setSelected(0);

    await vi.waitFor(() =>
      expect(host.style.maxHeight).toBe(`var(${FULLSCREEN_MAX_HEIGHT_PROPERTY}, 300px)`),
    );
  });
});
