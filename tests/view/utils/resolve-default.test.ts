import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { CameraManager } from '../../../src/camera-manager/manager';
import { FoldersManager } from '../../../src/card-controller/folders/manager';
import { resolveViewName } from '../../../src/view/utils/resolve-default';
import { createStore } from '../../test-utils';

describe('resolveViewName', () => {
  it('should return the view name directly if not auto', () => {
    expect(resolveViewName('live', mock<CameraManager>(), mock<FoldersManager>())).toBe(
      'live',
    );
  });

  it('should return live if auto and cameras are present', () => {
    const cameraManager = mock<CameraManager>();
    vi.mocked(cameraManager.getStore).mockReturnValue(
      createStore([{ cameraID: 'camera-1' }]),
    );
    const foldersManager = mock<FoldersManager>();

    expect(resolveViewName('auto', cameraManager, foldersManager)).toBe('live');
  });

  it('should return folders if auto, no cameras, but folders are present', () => {
    const cameraManager = mock<CameraManager>();
    vi.mocked(cameraManager.getStore).mockReturnValue(createStore([]));
    const foldersManager = mock<FoldersManager>();
    vi.mocked(foldersManager.hasFolders).mockReturnValue(true);

    expect(resolveViewName('auto', cameraManager, foldersManager)).toBe('folders');
  });

  it('should return image if auto and nothing is present', () => {
    const cameraManager = mock<CameraManager>();
    vi.mocked(cameraManager.getStore).mockReturnValue(createStore([]));
    const foldersManager = mock<FoldersManager>();
    vi.mocked(foldersManager.hasFolders).mockReturnValue(false);

    expect(resolveViewName('auto', cameraManager, foldersManager)).toBe('image');
  });
});
