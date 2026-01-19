import { Task } from '@lit-labs/task';
import { ReactiveControllerHost } from '@lit/reactive-element';
import { afterEach, assert, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { createFetchThumbnailTask } from '../../src/utils/thumbnail';
import { createHASS, flushPromises } from '../test-utils';

vi.mock('@lit-labs/task');

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
    const result = await options.task([true, thumbnailURL]);

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
    const result = await options.task([true, thumbnailURL]);

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
      vi.fn(() => mockFileReader),
    );

    createFetchThumbnailTask(
      host,
      () => hass,
      () => thumbnailURL,
    );

    const call = vi.mocked(Task).mock.calls[0];
    assert(call);

    const options = call[1];
    const runPromise = options.task([true, thumbnailURL]);

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
    await expect(options.task([true, thumbnailURL])).rejects.toThrow('Not Found');
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
      vi.fn(() => mockFileReader),
    );

    createFetchThumbnailTask(
      host,
      () => hass,
      () => thumbnailURL,
    );
    const call = vi.mocked(Task).mock.calls[0];
    assert(call);

    const options = call[1];
    const runPromise = options.task([true, thumbnailURL]);

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
      vi.fn(() => mockFileReader),
    );

    createFetchThumbnailTask(
      host,
      () => hass,
      () => thumbnailURL,
    );
    const call = vi.mocked(Task).mock.calls[0];
    assert(call);

    const options = call[1];
    const runPromise = options.task([true, thumbnailURL]);

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
    const result = await options.task([false, undefined]);
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
    assert(call && call[1].args);

    const args = call[1].args();
    expect(args).toEqual([true, thumbnailURL]);

    vi.mocked(Task).mockClear();

    createFetchThumbnailTask(
      host,
      () => undefined,
      () => undefined,
    );
    const call2 = vi.mocked(Task).mock.calls[0];
    assert(call2 && call2[1].args);

    const args2 = call2[1].args();
    expect(args2).toEqual([false, undefined]);
  });
});
