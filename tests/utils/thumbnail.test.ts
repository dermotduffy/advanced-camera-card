import { Task, type TaskConfig, type TaskFunctionOptions } from '@lit/task';
import type { ReactiveControllerHost } from 'lit';
import { afterEach, assert, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { resolveMedia } from '../../src/ha/resolved-media';
import {
  createFetchThumbnailTask,
  type FetchThumbnailTaskArgs,
} from '../../src/utils/thumbnail';
import { createHASS, flushPromises } from '../test-utils';

vi.mock('@lit/task');
vi.mock('../../src/ha/resolved-media');

// The Task constructor accepts either (host, config) or (host, taskFunction,
// argsFunction). When the tests read the constructor arguments back from the
// mock, TypeScript types them using only the last of those overloads, so the
// second argument appears to be a task function even though
// createFetchThumbnailTask always passes a config object. This check narrows it
// back to the config type.
const isTaskConfig = (
  value: unknown,
): value is TaskConfig<FetchThumbnailTaskArgs, string | null> =>
  typeof value === 'object' && value !== null && 'task' in value;

const createTaskFunctionOptions = (): TaskFunctionOptions => ({
  signal: new AbortController().signal,
});

describe('thumbnail utilities', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('should handle absolute thumbnail URL', async () => {
    const host = mock<ReactiveControllerHost>();
    const hass = createHASS();
    const thumbnailURL = 'http://example.com/thumb.jpg';

    createFetchThumbnailTask(
      host,
      () => hass,
      () => thumbnailURL,
    );
    const call = vi.mocked(Task).mock.calls[0];
    assert(call);

    const options = call[1];
    assert(isTaskConfig(options));
    const result = await options.task([true, thumbnailURL], createTaskFunctionOptions());

    expect(result).toBe(thumbnailURL);
    expect(hass.fetchWithAuth).not.toHaveBeenCalled();
  });

  it('should handle data thumbnail URL', async () => {
    const host = mock<ReactiveControllerHost>();
    const hass = createHASS();
    const thumbnailURL = 'data:image/jpeg;base64,...';

    createFetchThumbnailTask(
      host,
      () => hass,
      () => thumbnailURL,
    );
    const call = vi.mocked(Task).mock.calls[0];
    assert(call);

    const options = call[1];
    assert(isTaskConfig(options));
    const result = await options.task([true, thumbnailURL], createTaskFunctionOptions());

    expect(result).toBe(thumbnailURL);
  });

  it('should fetch relative thumbnail URL', async () => {
    const host = mock<ReactiveControllerHost>();
    const hass = createHASS();
    const thumbnailURL = '/api/frigate/thumb.jpg';
    const dataURL = 'data:image/jpeg;base64,encoded';

    const mockResponse = mock<Response>();
    Object.defineProperty(mockResponse, 'ok', { value: true });

    const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
    mockResponse.blob.mockResolvedValue(mockBlob);
    vi.mocked(hass.fetchWithAuth).mockResolvedValue(mockResponse);

    const mockFileReader = mock<FileReader>({
      result: dataURL,
    });
    vi.stubGlobal(
      'FileReader',
      // The source calls `new FileReader()`, and a mock implementation must be
      // callable with `new`, so it cannot be an arrow function.
      vi.fn(function () {
        return mockFileReader;
      }),
    );

    createFetchThumbnailTask(
      host,
      () => hass,
      () => thumbnailURL,
    );

    const call = vi.mocked(Task).mock.calls[0];
    assert(call);

    const options = call[1];
    assert(isTaskConfig(options));
    const runPromise = options.task([true, thumbnailURL], createTaskFunctionOptions());

    await flushPromises();
    mockFileReader.onload?.(mock<ProgressEvent<FileReader>>());

    const result = await runPromise;
    expect(result).toBe(dataURL);
    expect(hass.fetchWithAuth).toHaveBeenCalledWith(thumbnailURL);
  });

  it('should handle fetch failure', async () => {
    const host = mock<ReactiveControllerHost>();
    const hass = createHASS();
    const thumbnailURL = '/api/thumb.jpg';

    const mockResponse = mock<Response>();
    Object.defineProperty(mockResponse, 'ok', { value: false });
    Object.defineProperty(mockResponse, 'statusText', { value: 'Not Found' });
    vi.mocked(hass.fetchWithAuth).mockResolvedValue(mockResponse);

    createFetchThumbnailTask(
      host,
      () => hass,
      () => thumbnailURL,
    );
    const call = vi.mocked(Task).mock.calls[0];
    assert(call);

    const options = call[1];
    assert(isTaskConfig(options));
    await expect(
      options.task([true, thumbnailURL], createTaskFunctionOptions()),
    ).rejects.toThrow('Not Found');
  });

  it('should handle reader error', async () => {
    const host = mock<ReactiveControllerHost>();
    const hass = createHASS();
    const thumbnailURL = '/api/thumb.jpg';

    const mockResponse = mock<Response>();
    Object.defineProperty(mockResponse, 'ok', { value: true });
    mockResponse.blob.mockResolvedValue(new Blob());
    vi.mocked(hass.fetchWithAuth).mockResolvedValue(mockResponse);

    const mockFileReader = mock<FileReader>();
    vi.stubGlobal(
      'FileReader',
      vi.fn(function () {
        return mockFileReader;
      }),
    );

    createFetchThumbnailTask(
      host,
      () => hass,
      () => thumbnailURL,
    );
    const call = vi.mocked(Task).mock.calls[0];
    assert(call);

    const options = call[1];
    assert(isTaskConfig(options));
    const runPromise = options.task([true, thumbnailURL], createTaskFunctionOptions());

    await flushPromises();
    mockFileReader.onerror?.(
      new Error('Reader error') as unknown as ProgressEvent<FileReader>,
    );

    await expect(runPromise).rejects.toThrow('Reader error');
  });

  it('should handle non-string reader result', async () => {
    const host = mock<ReactiveControllerHost>();
    const hass = createHASS();
    const thumbnailURL = '/api/thumb.jpg';

    const mockResponse = mock<Response>();
    Object.defineProperty(mockResponse, 'ok', { value: true });
    mockResponse.blob.mockResolvedValue(new Blob());
    vi.mocked(hass.fetchWithAuth).mockResolvedValue(mockResponse);

    const mockFileReader = mock<FileReader>({
      result: null as unknown as string, // Non-string result
    });
    vi.stubGlobal(
      'FileReader',
      vi.fn(function () {
        return mockFileReader;
      }),
    );

    createFetchThumbnailTask(
      host,
      () => hass,
      () => thumbnailURL,
    );
    const call = vi.mocked(Task).mock.calls[0];
    assert(call);

    const options = call[1];
    assert(isTaskConfig(options));
    const runPromise = options.task([true, thumbnailURL], createTaskFunctionOptions());

    await flushPromises();
    mockFileReader.onload?.(mock<ProgressEvent<FileReader>>());

    const result = await runPromise;
    expect(result).toBeNull();
  });

  it('should return null if no hass or no url', async () => {
    const host = mock<ReactiveControllerHost>();
    createFetchThumbnailTask(
      host,
      () => undefined,
      () => undefined,
    );
    const call = vi.mocked(Task).mock.calls[0];
    assert(call);

    const options = call[1];
    assert(isTaskConfig(options));
    const result = await options.task([false, undefined], createTaskFunctionOptions());
    expect(result).toBeNull();
  });

  it('should have correct task arguments', () => {
    const host = mock<ReactiveControllerHost>();
    const hass = createHASS();
    const thumbnailURL = 'http://example.com/thumb.jpg';

    createFetchThumbnailTask(
      host,
      () => hass,
      () => thumbnailURL,
    );
    const call = vi.mocked(Task).mock.calls[0];
    assert(call);

    const options = call[1];
    assert(isTaskConfig(options) && options.args);

    const args = options.args();
    expect(args).toEqual([true, thumbnailURL]);

    vi.mocked(Task).mockClear();

    createFetchThumbnailTask(
      host,
      () => undefined,
      () => undefined,
    );
    const call2 = vi.mocked(Task).mock.calls[0];
    assert(call2);

    const options2 = call2[1];
    assert(isTaskConfig(options2) && options2.args);

    const args2 = options2.args();
    expect(args2).toEqual([false, undefined]);
  });
});

describe('media source thumbnails', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should resolve a media source ID before fetching', async () => {
    const host = mock<ReactiveControllerHost>();
    const hass = createHASS();
    const thumbnail = 'media-source://media_source/local/folder/clip.jpg';
    const dataURL = 'data:image/jpeg;base64,encoded';

    vi.mocked(resolveMedia).mockResolvedValue({
      url: '/media/local/folder/clip.jpg',
      mime_type: 'image/jpeg',
    });

    const mockResponse = mock<Response>();
    Object.defineProperty(mockResponse, 'ok', { value: true });
    mockResponse.blob.mockResolvedValue(new Blob(['test'], { type: 'image/jpeg' }));
    vi.mocked(hass.fetchWithAuth).mockResolvedValue(mockResponse);

    const mockFileReader = mock<FileReader>({ result: dataURL });
    vi.stubGlobal(
      'FileReader',
      vi.fn(function () {
        return mockFileReader;
      }),
    );

    createFetchThumbnailTask(
      host,
      () => hass,
      () => thumbnail,
    );
    const call = vi.mocked(Task).mock.calls[0];
    assert(call);

    const options = call[1];
    assert(isTaskConfig(options));
    const runPromise = options.task([true, thumbnail], createTaskFunctionOptions());

    await flushPromises();
    mockFileReader.onload?.(mock<ProgressEvent<FileReader>>());

    expect(await runPromise).toBe(dataURL);
    expect(resolveMedia).toHaveBeenCalledWith(hass, thumbnail);
    expect(hass.fetchWithAuth).toHaveBeenCalledWith('/media/local/folder/clip.jpg');
  });

  it('should throw when a media source ID cannot be resolved', async () => {
    const host = mock<ReactiveControllerHost>();
    const hass = createHASS();
    const thumbnail = 'media-source://media_source/local/folder/does-not-exist.jpg';

    vi.mocked(resolveMedia).mockResolvedValue(null);

    createFetchThumbnailTask(
      host,
      () => hass,
      () => thumbnail,
    );
    const call = vi.mocked(Task).mock.calls[0];
    assert(call);

    const options = call[1];
    assert(isTaskConfig(options));

    await expect(
      options.task([true, thumbnail], createTaskFunctionOptions()),
    ).rejects.toThrow(/Could not resolve thumbnail/);
    expect(hass.fetchWithAuth).not.toHaveBeenCalled();
  });
});
