import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ViewFolder, ViewMedia, ViewMediaType } from '../../src/view/item';
import { createFolder } from '../test-utils';
import { TestViewMedia } from './test-utils';

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
    expect(media.getID()).toBeNull();
    expect(media.getStartTime()).toBeNull();
    expect(media.getPlaybackStartTime()).toBeNull();
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

  describe('should match by identifier', () => {
    it('should match a copy of itself', () => {
      const media = new TestViewMedia({ id: 'id' });

      expect(media.isSameAs(media.clone())).toBeTruthy();
    });

    it('should match an object with the same identifier', () => {
      const clip = new TestViewMedia({ id: 'id', mediaType: ViewMediaType.Clip });
      const snapshot = new TestViewMedia({
        id: 'id',
        mediaType: ViewMediaType.Snapshot,
      });

      expect(clip.isSameAs(snapshot)).toBeTruthy();
    });

    it('should not match a different identifier', () => {
      const media = new TestViewMedia({ id: 'id-1' });

      expect(media.isSameAs(new TestViewMedia({ id: 'id-2' }))).toBeFalsy();
    });

    it('should match itself when it has no identifier', () => {
      const media = new TestViewMedia({ id: null });

      expect(media.isSameAs(media)).toBeTruthy();
    });

    it('should not match when neither has an identifier', () => {
      const media = new TestViewMedia({ id: null });

      expect(media.isSameAs(new TestViewMedia({ id: null }))).toBeFalsy();
    });

    it('should not match an object without an identifier', () => {
      const media = new TestViewMedia({ id: 'id' });

      expect(media.isSameAs(new TestViewMedia({ id: null }))).toBeFalsy();
    });

    it('should not match a folder', () => {
      const media = new TestViewMedia({ id: 'id' });
      const folder = new ViewFolder(createFolder(), [], { id: 'id' });

      expect(media.isSameAs(folder)).toBeFalsy();
      expect(folder.isSameAs(media)).toBeFalsy();
    });
  });

  it('should correctly determine if a media item includes a time', () => {
    const media = new TestViewMedia({
      startTime: new Date('2023-08-08T17:00:00'),
      endTime: new Date('2023-08-08T17:59:59'),
    });
    expect(media.includesTime(new Date('2023-08-08T17:30:30'))).toBeTruthy();
    expect(media.includesTime(new Date('2023-08-08T18:00:00'))).toBeFalsy();
  });

  it('should use the media start time as the playback start time by default', () => {
    const startTime = new Date('2023-08-08T17:00:00');
    const media = new TestViewMedia({ startTime });

    expect(media.getPlaybackStartTime()).toEqual(startTime);
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

  it('should match by identifier', () => {
    const item = new ViewFolder(createFolder(), [], { id: 'id' });
    const withoutID = new ViewFolder(createFolder(), []);

    expect(item.isSameAs(item)).toBeTruthy();
    expect(item.isSameAs(new ViewFolder(createFolder(), [], { id: 'id' }))).toBeTruthy();
    expect(
      item.isSameAs(new ViewFolder(createFolder(), [], { id: 'other' })),
    ).toBeFalsy();
    expect(withoutID.isSameAs(withoutID)).toBeTruthy();
    expect(withoutID.isSameAs(new ViewFolder(createFolder(), []))).toBeFalsy();
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
