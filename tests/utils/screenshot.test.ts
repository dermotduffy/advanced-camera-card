import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import {
  captureVideoFrame,
  generateScreenshotFilename,
  screenshotImage,
  screenshotVideo,
} from '../../src/utils/screenshot';
import { QueryResults } from '../../src/view/query-results';
import { View } from '../../src/view/view';
import { createView, TestViewMedia } from '../view/test-utils';

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

describe('captureVideoFrame', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const setup = (options?: {
    toBlob?: (callback: BlobCallback, type?: string, quality?: number) => void;
    context?: boolean;
  }) => {
    const video = document.createElement('video');
    Object.defineProperty(video, 'videoWidth', { value: 1920 });
    Object.defineProperty(video, 'videoHeight', { value: 1080 });
    const canvas = document.createElement('canvas');
    const context = mock<CanvasRenderingContext2D>();
    canvas.getContext = vi
      .fn()
      .mockReturnValue(options?.context === false ? null : context);
    canvas.toBlob = vi.fn(
      options?.toBlob ??
        ((callback: BlobCallback) =>
          callback(new Blob(['frame'], { type: 'image/jpeg' }))),
    );
    vi.spyOn(document, 'createElement').mockReturnValue(canvas);
    return { canvas, context, video };
  };

  it("should draw the frame at once at the video's own size, then encode it", async () => {
    const { canvas, context, video } = setup();

    const result = captureVideoFrame(video);
    expect(context.drawImage).toHaveBeenCalledWith(video, 0, 0, 1920, 1080);
    expect([canvas.width, canvas.height]).toEqual([1920, 1080]);
    expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.8);

    expect(result?.canvas).toBe(canvas);
    expect(await result?.url).toBe('data:image/jpeg;base64,ZnJhbWU=');
  });

  it('should be null without a canvas context', async () => {
    const { video } = setup({ context: false });
    expect(captureVideoFrame(video)).toBeNull();
  });

  it('should be null when the browser refuses a tainted canvas', async () => {
    const { video } = setup({
      toBlob: () => {
        throw new DOMException('tainted', 'SecurityError');
      },
    });
    expect(await captureVideoFrame(video)?.url).toBeNull();
  });

  it('should be null when the browser gives no picture', async () => {
    const { video } = setup({ toBlob: (callback: BlobCallback) => callback(null) });
    expect(await captureVideoFrame(video)?.url).toBeNull();
  });

  it('should be null when the picture cannot be read', async () => {
    const { video } = setup();
    vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (
      this: FileReader,
    ) {
      this.onerror?.(new ProgressEvent('error') as ProgressEvent<FileReader>);
    });
    expect(await captureVideoFrame(video)?.url).toBeNull();
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
