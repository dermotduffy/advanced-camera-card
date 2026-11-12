import { describe, expect, it } from 'vitest';

import { classifyMimeType, resolveImageMimeType } from '../../src/utils/mime-type';

describe('classifyMimeType', () => {
  it('classifies undefined as neither video nor HLS', () => {
    expect(classifyMimeType(undefined)).toEqual({
      isHLS: false,
      isImage: false,
      isVideo: false,
    });
  });

  it('classifies an empty string as neither video nor HLS', () => {
    expect(classifyMimeType('')).toEqual({
      isHLS: false,
      isImage: false,
      isVideo: false,
    });
  });

  it('classifies application/vnd.apple.mpegurl as HLS and video', () => {
    expect(classifyMimeType('application/vnd.apple.mpegurl')).toEqual({
      isHLS: true,
      isImage: false,
      isVideo: true,
    });
  });

  it('classifies application/x-mpegurl as HLS and video', () => {
    expect(classifyMimeType('application/x-mpegurl')).toEqual({
      isHLS: true,
      isImage: false,
      isVideo: true,
    });
  });

  it('treats HLS mime types as case-insensitive', () => {
    expect(classifyMimeType('application/x-mpegURL')).toEqual({
      isHLS: true,
      isImage: false,
      isVideo: true,
    });
    expect(classifyMimeType('APPLICATION/VND.APPLE.MPEGURL')).toEqual({
      isHLS: true,
      isImage: false,
      isVideo: true,
    });
  });

  it('classifies video/* as video but not HLS', () => {
    expect(classifyMimeType('video/mp4')).toEqual({
      isHLS: false,
      isImage: false,
      isVideo: true,
    });
    expect(classifyMimeType('VIDEO/WEBM')).toEqual({
      isHLS: false,
      isImage: false,
      isVideo: true,
    });
  });

  it('classifies non-video mime types', () => {
    expect(classifyMimeType('image/jpeg')).toEqual({
      isHLS: false,
      isImage: true,
      isVideo: false,
    });
    expect(classifyMimeType('application/json')).toEqual({
      isHLS: false,
      isImage: false,
      isVideo: false,
    });
  });
});

describe('classifyMimeType images', () => {
  it.each([
    ['image/webp', true],
    ['IMAGE/PNG', true],
    ['video/mp4', false],
    ['application/octet-stream', false],
    [undefined, false],
  ])('classifies %s', (mimeType: string | undefined, isImage: boolean) => {
    expect(classifyMimeType(mimeType).isImage).toBe(isImage);
  });
});

describe('resolveImageMimeType', () => {
  it.each([
    ['/clips/review/thumb-front-1.webp', 'image/webp'],
    ['/thumb.JPG', 'image/jpeg'],
    ['/thumb.jpeg', 'image/jpeg'],
    ['/thumb.png?width=100', 'image/png'],
    ['/thumb.gif', 'image/gif'],
    ['/video.mp4', 'application/octet-stream'],
    ['/thumb', 'application/octet-stream'],
  ])('derives the type of unidentified %s', (url: string, expected: string) => {
    expect(resolveImageMimeType('application/octet-stream', url)).toBe(expected);
  });

  it('should keep a type the server identified', () => {
    expect(resolveImageMimeType('video/mp4', '/thumb.webp')).toBe('video/mp4');
  });
});
