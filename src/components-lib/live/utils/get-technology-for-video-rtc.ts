import { VideoRTC } from '../../../components/live/providers/go2rtc/video-rtc';
import { MediaTechnology } from '../../../types';

export const getTechnologyForVideoRTC = (
  element: VideoRTC,
): MediaTechnology[] | undefined => {
  const tech = [
    ...(!!element.pc ? ['webrtc' as const] : []),
    ...(!element.pc && element.mseCodecs ? ['mse' as const, 'hls' as const] : []),
  ];
  return tech.length ? tech : undefined;
};
