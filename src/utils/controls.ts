import { Timer } from './timer';

// The number of seconds to hide the video controls for after loading (in order
// to give a cleaner UI appearance, see:
// https://github.com/dermotduffy/advanced-camera-card/issues/856
export const MEDIA_LOAD_CONTROLS_HIDE_SECONDS = 2;
const MEDIA_SEEK_CONTROLS_HIDE_SECONDS = 1;

export type AdvancedCameraCardHTMLVideoElement = HTMLVideoElement & {
  _controlsHideTimer?: Timer;
  _controlsOriginalValue?: boolean;
};

/**
 * Sets the controls on a video and removes a timer that may have been added by
 * hideMediaControlsTemporarily.
 * @param video
 * @param value
 */
export const setControlsOnVideo = (
  video: AdvancedCameraCardHTMLVideoElement,
  value: boolean,
): void => {
  if (video._controlsHideTimer) {
    video._controlsHideTimer.stop();
    delete video._controlsHideTimer;
    delete video._controlsOriginalValue;
  }
  video.controls = value;
};

/**
 * Temporarily hide media controls.
 * @param element Any HTMLElement that has a controls property (e.g.
 * HTMLVideoElement, AdvancedCameraCardHaHlsPlayer)
 * @param seconds The number of seconds to hide the controls for.
 */
export const hideMediaControlsTemporarily = (
  video: AdvancedCameraCardHTMLVideoElement,
  seconds = MEDIA_SEEK_CONTROLS_HIDE_SECONDS,
): void => {
  const oldValue = video._controlsOriginalValue ?? video.controls;
  setControlsOnVideo(video, false);
  video._controlsHideTimer ??= new Timer();
  video._controlsOriginalValue = oldValue;

  // LitElement may change the src attribute of the video element during
  // rendering, so we need to ensure that the controls are reset on the 'old'
  // video. See:
  // https://github.com/dermotduffy/advanced-camera-card/issues/1310
  const resetIfReloaded = () => {
    setControlsOnVideo(video, oldValue);
    video.removeEventListener('loadstart', resetIfReloaded);
  };
  video.addEventListener('loadstart', resetIfReloaded);

  video._controlsHideTimer.start(seconds, () => {
    setControlsOnVideo(video, oldValue);
  });
};
