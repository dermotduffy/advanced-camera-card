import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import {
  generateScreenshotFilename,
  screenshotImage,
  screenshotVideo,
} from '../../src/utils/screenshot';
import { QueryResults } from '../../src/view/query-results';
import { View } from '../../src/view/view';
import { TestViewMedia, createView } from '../test-utils';

// @vitest-environment jsdom
describe('screenshotVideo', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should not screenshot without context', () => {
    const video = document.createElement('video');

    const canvas = document.createElement('canvas');
    const getContext = vi.fn().mockReturnValue(null);
    canvas.getContext = getContext;
    vi.spyOn(document, 'createElement').mockReturnValue(canvas);

    expect(screenshotVideo(video)).toBeNull();
  });

  it('should screenshot', () => {
    const video = document.createElement('video');

    const canvas = document.createElement('canvas');
    const getContext = vi.fn().mockReturnValue(mock<CanvasRenderingContext2D>());
    canvas.getContext = getContext;
    canvas.toDataURL = vi.fn().mockReturnValue('data:image/jpeg;base64');
    vi.spyOn(document, 'createElement').mockReturnValue(canvas);

    expect(screenshotVideo(video)).toBe('data:image/jpeg;base64');
  });
});

describe('screenshotImage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should not screenshot without context', () => {
    const image = document.createElement('img');

    const canvas = document.createElement('canvas');
    const getContext = vi.fn().mockReturnValue(null);
    canvas.getContext = getContext;
    vi.spyOn(document, 'createElement').mockReturnValue(canvas);

    expect(screenshotImage(image)).toBeNull();
  });

  it('should screenshot', () => {
    const image = document.createElement('img');

    const canvas = document.createElement('canvas');
    const getContext = vi.fn().mockReturnValue(mock<CanvasRenderingContext2D>());
    canvas.getContext = getContext;
    canvas.toDataURL = vi.fn().mockReturnValue('data:image/jpeg;base64');
    vi.spyOn(document, 'createElement').mockReturnValue(canvas);

    expect(screenshotImage(image)).toBe('data:image/jpeg;base64');
  });
});

describe('generateScreenshotTitle', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2023-06-13T21:54:01'));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it('should get title without view', () => {
    expect(generateScreenshotFilename()).toBe('screenshot.jpg');
  });

  it('should get title for live view', () => {
    expect(
      generateScreenshotFilename(new View({ view: 'live', camera: 'camera-1' })),
    ).toBe('live_camera-1_2023-06-13-21-54-01.jpg');
  });

  it('should get title for image view', () => {
    expect(
      generateScreenshotFilename(new View({ view: 'image', camera: 'camera-1' })),
    ).toBe('image_camera-1_2023-06-13-21-54-01.jpg');
  });

  it('should get title for media viewer view with id', () => {
    const media = new TestViewMedia({
      id: 'id1',
      startTime: new Date('2023-06-16T18:52'),
      cameraID: 'camera-1',
    });
    const view = createView({
      view: 'media',
      camera: 'camera-1',
      queryResults: new QueryResults({ results: [media], selectedIndex: 0 }),
    });

    expect(generateScreenshotFilename(view)).toBe('media_camera-1_id1.jpg');
  });

  it('should get title for media viewer view without id', () => {
    const media = new TestViewMedia({
      id: null,
      startTime: new Date('2023-06-16T18:52'),
      cameraID: 'camera-1',
    });
    const view = createView({
      view: 'media',
      camera: 'camera-1',
      queryResults: new QueryResults({ results: [media], selectedIndex: 0 }),
    });

    expect(generateScreenshotFilename(view)).toBe('media_camera-1.jpg');
  });

  it('should get title for live view without camera', () => {
    expect(generateScreenshotFilename(createView({ view: 'live', camera: null }))).toBe(
      'live_2023-06-13-21-54-01.jpg',
    );
  });

  it('should get title for viewer view without camera', () => {
    expect(generateScreenshotFilename(createView({ view: 'media', camera: null }))).toBe(
      'media.jpg',
    );
  });
});
