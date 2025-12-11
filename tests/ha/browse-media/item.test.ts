import { format } from 'date-fns';
import { describe, expect, it } from 'vitest';
import {
  BrowseMediaEventViewMedia,
  BrowseMediaViewFolder,
} from '../../../src/ha/browse-media/item';
import { formatDateAndTime } from '../../../src/utils/basic';
import { VideoContentType, ViewMediaType } from '../../../src/view/item';
import {
  createBrowseMedia,
  createFolder,
  createRichBrowseMedia,
} from '../../test-utils';

describe('BrowseMediaEventViewMedia', () => {
  describe('should set cameraID', () => {
    it('should set cameraID from the metadata', () => {
      const browseMedia = createRichBrowseMedia({
        media_content_id: 'media_content_id',
        _metadata: {
          startDate: new Date('2025-05-05T07:46:00Z'),
          endDate: new Date('2025-05-05T07:48:00Z'),
          cameraID: 'camera.office',
        },
      });

      const viewMedia = new BrowseMediaEventViewMedia(ViewMediaType.Clip, browseMedia);
      expect(viewMedia.getCameraID()).toBe('camera.office');
    });

    it('should set cameraID from the options', () => {
      const browseMedia = createRichBrowseMedia({
        media_content_id: 'media_content_id',
        _metadata: {
          startDate: new Date('2025-05-05T07:46:00Z'),
          endDate: new Date('2025-05-05T07:48:00Z'),
          cameraID: 'camera.office',
        },
      });

      const viewMedia = new BrowseMediaEventViewMedia(ViewMediaType.Clip, browseMedia, {
        cameraID: 'camera.kitchen',
      });
      expect(viewMedia.getCameraID()).toBe('camera.kitchen');
    });
  });

  describe('should set ID', () => {
    it('should set id from metadata', () => {
      const startDate = new Date('2025-05-05T07:46:00Z');
      const browseMedia = createRichBrowseMedia({
        media_content_id: 'media_content_id',
        _metadata: {
          startDate,
          endDate: new Date('2025-05-05T07:48:00Z'),
          cameraID: 'camera.office',
        },
      });

      const viewMedia = new BrowseMediaEventViewMedia(ViewMediaType.Clip, browseMedia);

      // The ID is formatted using local time, so we use format() to generate expected value
      const expectedId = `camera.office/${format(startDate, 'yyyy-MM-dd HH:mm:ss')}`;
      expect(viewMedia.getID()).toBe(expectedId);
    });

    it('should set id from media_content_id from the options', () => {
      const browseMedia = createBrowseMedia({
        media_content_id: 'media_content_id',
      });

      const viewMedia = new BrowseMediaEventViewMedia(ViewMediaType.Clip, browseMedia, {
        cameraID: 'camera.kitchen',
      });
      expect(viewMedia.getID()).toBe('media_content_id');
    });
  });

  describe('should get start and end time', () => {
    it('should get start and end time from metadata', () => {
      const browseMedia = createRichBrowseMedia({
        media_content_id: 'media_content_id',
        _metadata: {
          startDate: new Date('2025-05-05T07:46:00Z'),
          endDate: new Date('2025-05-05T07:48:00Z'),
          cameraID: 'camera.office',
        },
      });

      const viewMedia = new BrowseMediaEventViewMedia(ViewMediaType.Clip, browseMedia);
      expect(viewMedia.getStartTime()).toEqual(new Date('2025-05-05T07:46:00Z'));
      expect(viewMedia.getEndTime()).toEqual(new Date('2025-05-05T07:48:00Z'));
    });

    it('should return null start and end time without metadata', () => {
      const browseMedia = createBrowseMedia({
        media_content_id: 'media_content_id',
      });

      const viewMedia = new BrowseMediaEventViewMedia(ViewMediaType.Clip, browseMedia);
      expect(viewMedia.getStartTime()).toBeNull();
      expect(viewMedia.getEndTime()).toBeNull();
    });
  });

  describe('should get video content type', () => {
    it('should get video content type for clip', () => {
      const browseMedia = createRichBrowseMedia();
      const viewMedia = new BrowseMediaEventViewMedia(ViewMediaType.Clip, browseMedia);
      expect(viewMedia.getVideoContentType()).toBe(VideoContentType.MP4);
    });

    it('should get null for snapshot', () => {
      const browseMedia = createBrowseMedia();
      const viewMedia = new BrowseMediaEventViewMedia(
        ViewMediaType.Snapshot,
        browseMedia,
      );
      expect(viewMedia.getVideoContentType()).toBeNull();
    });
  });

  it('should get content ID', () => {
    const browseMedia = createBrowseMedia({
      media_content_id: 'media_content_id',
    });

    const viewMedia = new BrowseMediaEventViewMedia(ViewMediaType.Clip, browseMedia);
    expect(viewMedia.getContentID()).toEqual('media_content_id');
  });

  describe('should get title', () => {
    it('should get title from metadata start time', () => {
      const startDate = new Date('2025-05-05T07:46:00Z');
      const browseMedia = createRichBrowseMedia({
        _metadata: {
          startDate: startDate,
          endDate: new Date('2025-05-05T07:48:00Z'),
          cameraID: 'camera.office',
        },
      });

      const viewMedia = new BrowseMediaEventViewMedia(ViewMediaType.Clip, browseMedia);

      // The title is formatted using local time via formatDateAndTime
      expect(viewMedia.getTitle()).toEqual(formatDateAndTime(startDate));
    });

    it('should get title without metadata', () => {
      const browseMedia = createBrowseMedia({
        title: 'Test Title',
      });

      const viewMedia = new BrowseMediaEventViewMedia(ViewMediaType.Clip, browseMedia);
      expect(viewMedia.getTitle()).toEqual('Test Title');
    });
  });

  it('should get thumbnail', () => {
    const browseMedia = createRichBrowseMedia({
      thumbnail: 'thumbnail.jpg',
    });

    const viewMedia = new BrowseMediaEventViewMedia(ViewMediaType.Clip, browseMedia);
    expect(viewMedia.getThumbnail()).toEqual('thumbnail.jpg');
  });

  describe('should get what', () => {
    it('should get what from metadata', () => {
      const browseMedia = createRichBrowseMedia({
        _metadata: {
          startDate: new Date('2025-05-05T07:46:00Z'),
          endDate: new Date('2025-05-05T07:48:00Z'),
          cameraID: 'camera.office',
          what: ['car'],
        },
      });

      const viewMedia = new BrowseMediaEventViewMedia(ViewMediaType.Clip, browseMedia);
      expect(viewMedia.getWhat()).toEqual(['car']);
    });

    it('should return null without metadata', () => {
      const browseMedia = createBrowseMedia();

      const viewMedia = new BrowseMediaEventViewMedia(ViewMediaType.Clip, browseMedia);
      expect(viewMedia.getWhat()).toBeNull();
    });
  });

  it('should return null for score', () => {
    const browseMedia = createBrowseMedia();
    const viewMedia = new BrowseMediaEventViewMedia(ViewMediaType.Clip, browseMedia);
    expect(viewMedia.getScore()).toBeNull();
  });

  it('should return null for tags', () => {
    const browseMedia = createBrowseMedia();
    const viewMedia = new BrowseMediaEventViewMedia(ViewMediaType.Clip, browseMedia);
    expect(viewMedia.getTags()).toBeNull();
  });

  describe('should determine what is groupable', () => {
    it('should return true when groupable', () => {
      const browseMedia_1 = createRichBrowseMedia({
        _metadata: {
          startDate: new Date('2025-05-05T07:46:00Z'),
          endDate: new Date('2025-05-05T07:48:00Z'),
          cameraID: 'camera.office',
          what: ['car'],
        },
      });

      const browseMedia_2 = createRichBrowseMedia({
        _metadata: {
          startDate: new Date('2025-05-05T07:48:00Z'),
          endDate: new Date('2025-05-05T07:50:00Z'),
          cameraID: 'camera.office',
          what: ['car'],
        },
      });

      const viewMedia_1 = new BrowseMediaEventViewMedia(
        ViewMediaType.Clip,
        browseMedia_1,
      );
      const viewMedia_2 = new BrowseMediaEventViewMedia(
        ViewMediaType.Clip,
        browseMedia_2,
      );
      expect(viewMedia_1.isGroupableWith(viewMedia_2)).toBe(true);
    });

    it('should return false when media types are different', () => {
      const browseMedia_1 = createRichBrowseMedia({
        _metadata: {
          startDate: new Date('2025-05-05T07:46:00Z'),
          endDate: new Date('2025-05-05T07:48:00Z'),
          cameraID: 'camera.office',
          what: ['car'],
        },
      });

      const browseMedia_2 = createRichBrowseMedia({
        _metadata: {
          startDate: new Date('2025-05-05T07:48:00Z'),
          endDate: new Date('2025-05-05T07:50:00Z'),
          cameraID: 'camera.office',
          what: ['car'],
        },
      });

      const viewMedia_1 = new BrowseMediaEventViewMedia(
        ViewMediaType.Clip,
        browseMedia_1,
      );
      const viewMedia_2 = new BrowseMediaEventViewMedia(
        ViewMediaType.Snapshot,
        browseMedia_2,
      );
      expect(viewMedia_1.isGroupableWith(viewMedia_2)).toBe(false);
    });
  });

  describe('should set icon', () => {
    it('should set icon from known  media class', () => {
      const browseMedia = createBrowseMedia({
        media_class: 'channel',
      });

      const media = new BrowseMediaEventViewMedia(ViewMediaType.Snapshot, browseMedia);

      expect(media.getIcon()).toBe('mdi:television-classic');
    });

    it('should set null icon from unknown media class', () => {
      const browseMedia = createBrowseMedia({
        media_class: 'unknown',
      });

      const viewMedia = new BrowseMediaEventViewMedia(
        ViewMediaType.Snapshot,
        browseMedia,
      );
      expect(viewMedia.getIcon()).toBeNull();
    });

    it('should set null icon from null media class', () => {
      const browseMedia = createBrowseMedia({
        media_class: undefined,
      });

      const viewMedia = new BrowseMediaEventViewMedia(
        ViewMediaType.Snapshot,
        browseMedia,
      );
      expect(viewMedia.getIcon()).toBeNull();
    });
  });
});

describe('BrowseMediaViewFolder', () => {
  it('should set folder', () => {
    const folder = createFolder();
    const browseMedia = createBrowseMedia();

    const viewMedia = new BrowseMediaViewFolder(folder, browseMedia);
    expect(viewMedia.getFolder()).toEqual(folder);
  });

  describe('should set icon', () => {
    it('should set icon from known children media class', () => {
      const browseMedia = createBrowseMedia({
        children_media_class: 'album',
      });

      const viewMedia = new BrowseMediaViewFolder(createFolder(), browseMedia);
      expect(viewMedia.getIcon()).toBe('mdi:album');
    });

    it('should set null icon from unknown children media class', () => {
      const browseMedia = createBrowseMedia({
        children_media_class: 'unknown',
      });

      const viewMedia = new BrowseMediaViewFolder(createFolder(), browseMedia);
      expect(viewMedia.getIcon()).toBeNull();
    });
  });
});
