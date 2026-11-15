import { afterEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import {
  getCanvasFrameDataURL,
  getImageFrameDataURL,
  getVideoFrameDataURL,
} from '../../src/utils/frame-data-url';

const DATA_URL = 'data:image/jpeg;base64,frame';

const createCanvas = (options?: {
  context?: boolean;
  blob?: Blob | null;
  throws?: boolean;
  url?: string;
}): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.getContext = vi
    .fn()
    .mockReturnValue(
      options?.context === false ? null : mock<CanvasRenderingContext2D>(),
    );
  canvas.toDataURL = vi.fn(() => {
    if (options?.throws) {
      throw new DOMException('Tainted', 'SecurityError');
    }
    return options?.url ?? DATA_URL;
  });
  canvas.toBlob = vi.fn((callback: BlobCallback) => {
    if (options?.throws) {
      throw new DOMException('Tainted', 'SecurityError');
    }
    callback(options?.blob === undefined ? new Blob(['frame']) : options.blob);
  });
  return canvas;
};

const createVideo = (options?: {
  readyState?: number;
  width?: number;
  height?: number;
}): HTMLVideoElement => {
  const video = document.createElement('video');
  Object.defineProperty(video, 'readyState', {
    value: options?.readyState ?? HTMLMediaElement.HAVE_CURRENT_DATA,
  });
  Object.defineProperty(video, 'videoWidth', { value: options?.width ?? 640 });
  Object.defineProperty(video, 'videoHeight', { value: options?.height ?? 480 });
  return video;
};

const createImage = (options?: {
  complete?: boolean;
  width?: number;
  height?: number;
}): HTMLImageElement => {
  const image = document.createElement('img');
  Object.defineProperty(image, 'complete', { value: options?.complete ?? true });
  Object.defineProperty(image, 'naturalWidth', { value: options?.width ?? 640 });
  Object.defineProperty(image, 'naturalHeight', { value: options?.height ?? 480 });
  return image;
};

const setVisibilityState = (state: DocumentVisibilityState): void => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
};

const stubFileReader = (result: string | null): void => {
  vi.stubGlobal(
    'FileReader',
    // The source calls `new FileReader()`, and a mock implementation must be
    // callable with `new`, so it cannot be an arrow function.
    vi.fn(function () {
      const reader = mock<FileReader>({ result });
      reader.readAsDataURL.mockImplementation(() => {
        reader.onload?.(mock<ProgressEvent<FileReader>>());
      });
      return reader;
    }),
  );
};

// @vitest-environment jsdom
describe('getCanvasFrameDataURL', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('should encode synchronously while the page is hidden', async () => {
    setVisibilityState('hidden');
    const canvas = createCanvas();

    expect(await getCanvasFrameDataURL(canvas)).toBe(DATA_URL);
    expect(canvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.8);
    expect(canvas.toBlob).not.toHaveBeenCalled();
  });

  it('should return null when the encode gives something other than a data URL', async () => {
    setVisibilityState('hidden');
    expect(
      await getCanvasFrameDataURL(createCanvas({ url: 'not-a-data-url' })),
    ).toBeNull();
  });

  it('should encode asynchronously while the page is visible', async () => {
    setVisibilityState('visible');
    stubFileReader(DATA_URL);
    const canvas = createCanvas();

    expect(await getCanvasFrameDataURL(canvas)).toBe(DATA_URL);
    expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.8);
    expect(canvas.toDataURL).not.toHaveBeenCalled();
  });

  it('should return null when the encode gives no blob', async () => {
    setVisibilityState('visible');
    expect(await getCanvasFrameDataURL(createCanvas({ blob: null }))).toBeNull();
  });

  it('should return null when the canvas cannot be read back', async () => {
    setVisibilityState('visible');
    expect(await getCanvasFrameDataURL(createCanvas({ throws: true }))).toBeNull();

    setVisibilityState('hidden');
    expect(await getCanvasFrameDataURL(createCanvas({ throws: true }))).toBeNull();
  });
});

describe('getVideoFrameDataURL', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should draw the frame at the size of the video', async () => {
    setVisibilityState('hidden');
    const canvas = createCanvas();
    vi.spyOn(document, 'createElement').mockReturnValue(canvas);
    const video = createVideo({ width: 1440, height: 2560 });

    expect(await getVideoFrameDataURL(video)).toBe(DATA_URL);
    expect(canvas.width).toBe(1440);
    expect(canvas.height).toBe(2560);
  });

  it('should return null without a current frame', async () => {
    expect(
      await getVideoFrameDataURL(
        createVideo({ readyState: HTMLMediaElement.HAVE_METADATA }),
      ),
    ).toBeNull();
  });

  it('should return null without dimensions', async () => {
    expect(await getVideoFrameDataURL(createVideo({ width: 0 }))).toBeNull();
    expect(await getVideoFrameDataURL(createVideo({ height: 0 }))).toBeNull();
  });

  it('should return null without a context', async () => {
    vi.spyOn(document, 'createElement').mockReturnValue(
      createCanvas({ context: false }),
    );
    expect(await getVideoFrameDataURL(createVideo())).toBeNull();
  });
});

describe('getImageFrameDataURL', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should draw the image at its natural size', async () => {
    setVisibilityState('hidden');
    const canvas = createCanvas();
    vi.spyOn(document, 'createElement').mockReturnValue(canvas);

    expect(await getImageFrameDataURL(createImage({ width: 800, height: 600 }))).toBe(
      DATA_URL,
    );
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(600);
  });

  it('should return null when the image has not loaded', async () => {
    expect(await getImageFrameDataURL(createImage({ complete: false }))).toBeNull();
  });

  it('should return null without dimensions', async () => {
    expect(await getImageFrameDataURL(createImage({ width: 0 }))).toBeNull();
    expect(await getImageFrameDataURL(createImage({ height: 0 }))).toBeNull();
  });
});
