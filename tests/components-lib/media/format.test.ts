import { describe, expect, it } from 'vitest';

import {
  getMediaCameraTitle,
  getMediaDuration,
  getMediaLabel,
  getMediaSeverity,
  getMediaTags,
  getMediaWhere,
  isMediaReviewed,
  joinValues,
} from '../../../src/components-lib/media/format';
import { ViewFolder, ViewMediaType } from '../../../src/view/item';
import { createCameraManagerWithMetadata } from '../../camera-manager/test-utils';
import { createFolder } from '../../test-utils';
import { TestViewMedia } from '../../view/test-utils';

const createCameraManager = (title = 'Office') =>
  createCameraManagerWithMetadata({ title, icon: { icon: 'mdi:cctv' } });

const createFolderItem = (): ViewFolder => new ViewFolder(createFolder(), []);

describe('joinValues', () => {
  it('should join the values with a separator', () => {
    expect(joinValues('41s', 'Office')).toBe('41s · Office');
  });

  it('should leave out the values the media does not have', () => {
    expect(joinValues('41s', null, undefined, 'Office')).toBe('41s · Office');
  });

  it('should give nothing where there are no values', () => {
    expect(joinValues(null, undefined)).toBeNull();
  });
});

describe('getMediaCameraTitle', () => {
  it('should give the title the camera manager holds', () => {
    expect(
      getMediaCameraTitle(createCameraManager(), new TestViewMedia({ cameraID: 'id' })),
    ).toBe('Office');
  });

  it('should give nothing without a camera manager to ask', () => {
    expect(
      getMediaCameraTitle(undefined, new TestViewMedia({ cameraID: 'id' })),
    ).toBeNull();
  });

  it('should give nothing for media that names no camera', () => {
    expect(
      getMediaCameraTitle(createCameraManager(), new TestViewMedia({ cameraID: null })),
    ).toBeNull();
  });

  it('should give nothing for a folder, which has no camera', () => {
    expect(getMediaCameraTitle(createCameraManager(), createFolderItem())).toBeNull();
  });
});

describe('isMediaReviewed', () => {
  it.each([[true], [false]])('should say a review is %s', (reviewed) => {
    expect(
      isMediaReviewed(new TestViewMedia({ mediaType: ViewMediaType.Review, reviewed })),
    ).toBe(reviewed);
  });

  it('should say nothing about media that cannot be reviewed', () => {
    expect(isMediaReviewed(new TestViewMedia())).toBeNull();
  });
});

describe('getMediaSeverity', () => {
  it('should give the severity of a review', () => {
    expect(
      getMediaSeverity(
        new TestViewMedia({ mediaType: ViewMediaType.Review, severity: 'high' }),
      ),
    ).toBe('high');
  });

  it('should give no severity for media that is not a review', () => {
    expect(getMediaSeverity(new TestViewMedia())).toBeNull();
  });
});

describe('getMediaTags', () => {
  it('should prettify the tags of an event', () => {
    expect(getMediaTags(new TestViewMedia({ tags: ['delivery', 'front_door'] }))).toBe(
      'Delivery, Front Door',
    );
  });

  it('should give nothing for an event with no tags', () => {
    expect(getMediaTags(new TestViewMedia())).toBeNull();
  });

  it('should give nothing for a folder, which has no tags', () => {
    expect(getMediaTags(createFolderItem())).toBeNull();
  });
});

describe('getMediaWhere', () => {
  it('should prettify where the media happened', () => {
    expect(getMediaWhere(new TestViewMedia({ where: ['driveway', 'front_door'] }))).toBe(
      'Driveway, Front Door',
    );
  });

  it('should give nothing for media that says nothing about where', () => {
    expect(getMediaWhere(new TestViewMedia())).toBeNull();
  });

  it('should give nothing for a folder, which has no where', () => {
    expect(getMediaWhere(createFolderItem())).toBeNull();
  });
});

describe('getMediaDuration', () => {
  it('should give how long the media lasted', () => {
    expect(
      getMediaDuration(
        new TestViewMedia({
          startTime: new Date('2026-09-08T16:55:47'),
          endTime: new Date('2026-09-08T16:56:28'),
        }),
      ),
    ).toBe('41s');
  });

  it('should say media the camera is still writing is in progress', () => {
    expect(
      getMediaDuration(
        new TestViewMedia({
          startTime: new Date('2026-09-08T16:55:47'),
          inProgress: true,
        }),
      ),
    ).toBe('In progress...');
  });

  it('should give both where the media has a duration and is still being written', () => {
    expect(
      getMediaDuration(
        new TestViewMedia({
          startTime: new Date('2026-09-08T16:55:47'),
          endTime: new Date('2026-09-08T16:56:28'),
          inProgress: true,
        }),
      ),
    ).toBe('41s In progress...');
  });

  it('should give nothing for media with no times at all', () => {
    expect(getMediaDuration(new TestViewMedia())).toBeNull();
  });

  it('should give nothing for a folder, which has no times', () => {
    expect(getMediaDuration(createFolderItem())).toBeNull();
  });
});

describe('getMediaLabel', () => {
  it('should name what an event detected', () => {
    expect(
      getMediaLabel(createCameraManager(), new TestViewMedia({ what: ['person'] })),
    ).toBe('Person');
  });

  it('should give the score of an event that has one', () => {
    expect(
      getMediaLabel(
        createCameraManager(),
        new TestViewMedia({ what: ['person'], score: 0.876 }),
      ),
    ).toBe('Person 88%');
  });

  it('should give the title of a review, which only the engine names', () => {
    expect(
      getMediaLabel(
        createCameraManager(),
        new TestViewMedia({ mediaType: ViewMediaType.Review, title: 'Person, Car' }),
      ),
    ).toBe('Person, Car');
  });

  it('should fall back to the camera title where the media says nothing', () => {
    expect(
      getMediaLabel(createCameraManager(), new TestViewMedia({ cameraID: 'id' })),
    ).toBe('Office');
  });

  it('should fall back to the full name where there is no camera title', () => {
    expect(
      getMediaLabel(
        undefined,
        new TestViewMedia({ cameraID: null, title: 'Full name' }),
      ),
    ).toBe('Full name');
  });

  it('should give nothing for media that says nothing about itself', () => {
    expect(getMediaLabel(undefined, new TestViewMedia({ cameraID: null }))).toBeNull();
  });
});
