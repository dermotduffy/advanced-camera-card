import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  VideoContentType,
  ViewFolder,
  ViewMedia,
  ViewMediaType,
} from '../../src/view/item';
import { createFolder, TestViewMedia } from '../test-utils';

describe('VideoContentType', () => {
  it('MP4', () => {
    expect(VideoContentType.MP4).toBe('mp4');
  });
  it('HLS', () => {
    expect(VideoContentType.HLS).toBe('hls');
  });
});

describe('ViewMedia', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('should construct', () => {
    const media = new ViewMedia(ViewMediaType.Clip, {
      cameraID: 'camera',
    });
    expect(media.getCameraID()).toBe('camera');
    expect(media.getMediaType()).toBe('clip');
    expect(media.getVideoContentType()).toBeNull();
    expect(media.getID()).toBeNull();
    expect(media.getStartTime()).toBeNull();
    expect(media.getEndTime()).toBeNull();
    expect(media.getUsableEndTime()).toBeNull();
    expect(media.inProgress()).toBeNull();
    expect(media.getContentID()).toBeNull();
    expect(media.getTitle()).toBeNull();
    expect(media.getDescription()).toBeNull();
    expect(media.getThumbnail()).toBeNull();
    expect(media.getTitle()).toBeNull();
    expect(media.includesTime(new Date())).toBeFalsy();
    expect(media.getWhere()).toBeNull();
    expect(media.setFavorite(true)).toBeUndefined();
    expect(media.isFavorite()).toBeNull();
    expect(media.isReviewed()).toBeNull();
    expect(media.getIcon()).toBeNull();
    expect(media.getSeverity()).toBeNull();
    expect(media.getFolder()).toBeNull();
  });

  it('should construct without options', () => {
    const media = new ViewMedia(ViewMediaType.Clip);
    expect(media.getCameraID()).toBeNull();
  });

  it('should clone', () => {
    const media = new ViewMedia(ViewMediaType.Clip, {
      cameraID: 'camera',
    });

    const clone = media.clone();

    expect(clone).not.toBe(media);
    expect(clone).toBeInstanceOf(ViewMedia);
    expect(clone.getCameraID()).toBe('camera');
  });

  it('should correctly determine if a media item includes a time', () => {
    const media = new TestViewMedia({
      startTime: new Date('2023-08-08T17:00:00'),
      endTime: new Date('2023-08-08T17:59:59'),
    });
    expect(media.includesTime(new Date('2023-08-08T17:30:30'))).toBeTruthy();
    expect(media.includesTime(new Date('2023-08-08T18:00:00'))).toBeFalsy();
  });

  it('should correctly get usable end time for in-progress event', () => {
    const media = new TestViewMedia({
      startTime: new Date('2023-08-08T17:00:00'),
      inProgress: true,
    });

    vi.useFakeTimers();
    const fakeNow = new Date('2023-08-08T17:15:00');
    vi.setSystemTime(fakeNow);

    expect(media.getUsableEndTime()).toEqual(fakeNow);
  });
});

describe('ViewFolder', () => {
  it('should construct', () => {
    const folder = createFolder();
    const item = new ViewFolder(folder, [], {
      icon: 'icon',
      id: 'id',
      title: 'title',
      thumbnail: 'thumbnail',
    });

    expect(item.getFolder()).toEqual(folder);
    expect(item.getID()).toBe('id');
    expect(item.getTitle()).toBe('title');
    expect(item.getDescription()).toBeNull();
    expect(item.getThumbnail()).toBe('thumbnail');
    expect(item.getIcon()).toBe('icon');
    expect(item.isFavorite()).toBeNull();
    expect(item.getSeverity()).toBeNull();
  });

  it('should clone', () => {
    const folder = createFolder();
    const item = new ViewFolder(folder, []);

    const clone = item.clone();

    expect(clone).not.toBe(item);
    expect(clone).toBeInstanceOf(ViewFolder);
    expect(clone.getFolder()).toEqual(folder);
    expect(clone.getPath()).toEqual([]);
  });
});
