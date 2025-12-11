import { describe, expect, it, vi } from 'vitest';
import { AudioProperties, mayHaveAudio } from '../../src/utils/audio';

// @vitest-environment jsdom
describe('mayHaveAudio', () => {
  it('should detect audio when mozHasAudio true', () => {
    const element: HTMLVideoElement & AudioProperties = document.createElement('video');
    element.mozHasAudio = true;
    expect(mayHaveAudio(element)).toBeTruthy();
  });

  it('should not detect audio when mozHasAudio undefined', () => {
    const element: HTMLVideoElement & AudioProperties = document.createElement('video');
    element.mozHasAudio = undefined;
    expect(mayHaveAudio(element)).toBeFalsy();
  });

  it('should detect audio when audioTracks has length', () => {
    // Workaround: "Cannot set property audioTracks of #<HTMLMediaElement> which has only a getter"
    const element = {} as HTMLVideoElement & AudioProperties;
    element.audioTracks = [1, 2, 3];
    expect(mayHaveAudio(element)).toBeTruthy();
  });

  it('should not detect audio when audioTracks has no length', () => {
    // Workaround: "Cannot set property audioTracks of #<HTMLMediaElement> which has only a getter"
    const element = {} as HTMLVideoElement & AudioProperties;
    element.audioTracks = [];
    expect(mayHaveAudio(element)).toBeFalsy();
  });

  it('should detect audio when srcObject MediaStream has audio tracks', () => {
    // Mock MediaStream for jsdom environment
    const MockMediaStream = class MediaStream {};
    vi.stubGlobal('MediaStream', MockMediaStream);

    const element = {} as HTMLVideoElement & AudioProperties;
    const mockStream = new MockMediaStream();
    (mockStream as unknown as { getAudioTracks: () => unknown[] }).getAudioTracks =
      () => [{}];
    element.srcObject = mockStream as unknown as MediaStream;
    expect(mayHaveAudio(element)).toBeTruthy();

    vi.unstubAllGlobals();
  });

  it('should not detect audio when srcObject MediaStream has no audio tracks', () => {
    // Mock MediaStream for jsdom environment
    const MockMediaStream = class MediaStream {};
    vi.stubGlobal('MediaStream', MockMediaStream);

    const element = {} as HTMLVideoElement & AudioProperties;
    const mockStream = new MockMediaStream();
    (mockStream as unknown as { getAudioTracks: () => unknown[] }).getAudioTracks =
      () => [];
    element.srcObject = mockStream as unknown as MediaStream;
    expect(mayHaveAudio(element)).toBeFalsy();

    vi.unstubAllGlobals();
  });

  it('should detect audio when no evidence to the contrary', () => {
    const element = {} as HTMLVideoElement & AudioProperties;
    expect(mayHaveAudio(element)).toBeTruthy();
  });
});
