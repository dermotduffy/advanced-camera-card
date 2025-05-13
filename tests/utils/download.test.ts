import { afterEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { downloadURL } from '../../src/utils/download';

// @vitest-environment jsdom
describe('downloadURL', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should download same origin via link', () => {
    const location: Location & { origin: string } = mock<Location>();
    location.origin = 'http://foo';

    vi.spyOn(window, 'location', 'get').mockReturnValue(location);

    const link = document.createElement('a');
    link.click = vi.fn();
    link.setAttribute = vi.fn();
    vi.spyOn(document, 'createElement').mockReturnValue(link);

    downloadURL('http://foo/url.mp4');

    expect(link.href).toBe('http://foo/url.mp4');
    expect(link.setAttribute).toBeCalledWith('download', 'download');
    expect(link.click).toBeCalled();
  });

  it('should download data URL via link', () => {
    const link = document.createElement('a');
    link.click = vi.fn();
    link.setAttribute = vi.fn();
    vi.spyOn(document, 'createElement').mockReturnValue(link);

    downloadURL('data:text/plain;charset=utf-8;base64,VEhJUyBJUyBEQVRB');

    expect(link.href).toBe('data:text/plain;charset=utf-8;base64,VEhJUyBJUyBEQVRB');
    expect(link.setAttribute).toBeCalledWith('download', 'download');
    expect(link.click).toBeCalled();
  });

  it('should download different origin via window.open', () => {
    // Set the origin to the same.
    const location: Location & { origin: string } = mock<Location>();
    location.origin = 'http://foo';

    vi.spyOn(window, 'location', 'get').mockReturnValue(location);

    const windowSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    downloadURL('http://bar/url.mp4');
    expect(windowSpy).toBeCalledWith('http://bar/url.mp4', '_blank');
  });
});
