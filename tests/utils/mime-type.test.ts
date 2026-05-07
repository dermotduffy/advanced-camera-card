import { describe, expect, it } from 'vitest';
import { classifyMimeType } from '../../src/utils/mime-type';

describe('classifyMimeType', () => {
  it('classifies undefined as neither video nor HLS', () => {
    expect(classifyMimeType(undefined)).toEqual({ isHLS: false, isVideo: false });
  });

  it('classifies an empty string as neither video nor HLS', () => {
    expect(classifyMimeType('')).toEqual({ isHLS: false, isVideo: false });
  });

  it('classifies application/vnd.apple.mpegurl as HLS and video', () => {
    expect(classifyMimeType('application/vnd.apple.mpegurl')).toEqual({
      isHLS: true,
      isVideo: true,
    });
  });

  it('classifies application/x-mpegurl as HLS and video', () => {
    expect(classifyMimeType('application/x-mpegurl')).toEqual({
      isHLS: true,
      isVideo: true,
    });
  });

  it('treats HLS mime types as case-insensitive', () => {
    expect(classifyMimeType('application/x-mpegURL')).toEqual({
      isHLS: true,
      isVideo: true,
    });
    expect(classifyMimeType('APPLICATION/VND.APPLE.MPEGURL')).toEqual({
      isHLS: true,
      isVideo: true,
    });
  });

  it('classifies video/* as video but not HLS', () => {
    expect(classifyMimeType('video/mp4')).toEqual({ isHLS: false, isVideo: true });
    expect(classifyMimeType('VIDEO/WEBM')).toEqual({ isHLS: false, isVideo: true });
  });

  it('classifies non-video mime types as neither', () => {
    expect(classifyMimeType('image/jpeg')).toEqual({ isHLS: false, isVideo: false });
    expect(classifyMimeType('application/json')).toEqual({
      isHLS: false,
      isVideo: false,
    });
  });
});
