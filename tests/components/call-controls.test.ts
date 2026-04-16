import { afterEach, describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import '../../src/components/call-controls';
import { AdvancedCameraCardCallControls } from '../../src/components/call-controls';
import { MediaPlayerController } from '../../src/types';
import { createMediaLoadedInfo, flushPromises } from '../test-utils';

// @vitest-environment jsdom
describe('CallControls', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should toggle the active call speaker using the bound media info', async () => {
    const mediaPlayerController = mock<MediaPlayerController>();
    mediaPlayerController.isMuted.mockReturnValue(false);

    const element = document.createElement(
      'advanced-camera-card-call-controls',
    ) as AdvancedCameraCardCallControls;
    element.callState = {
      state: 'in_call',
      camera: 'camera-1',
      stream: 'doorbell',
      lockNavigation: true,
      autoEnableMicrophone: true,
      autoEnableSpeaker: true,
      resumeNormalStreamOnEnd: true,
      endCallOnViewChange: false,
    };
    element.mediaLoadedInfo = createMediaLoadedInfo({ mediaPlayerController });

    document.body.appendChild(element);
    await element.updateComplete;

    const buttons = element.shadowRoot?.querySelectorAll('ha-icon-button');
    expect(buttons).toHaveLength(3);

    (buttons?.[2] as HTMLElement).click();
    await flushPromises();

    expect(mediaPlayerController.mute).toBeCalled();
  });
});