import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { FoldersManager } from '../../src/card-controller/folders/manager';
import { AdvancedCameraCardView } from '../../src/config/schema/common/const';
import { CapabilityKey } from '../../src/types';
import {
  getCameraIDsWithCapabilityForView,
  isViewAvailable,
  isViewSupported,
  isViewSupportedByCamera,
} from '../../src/view/view-support';
import {
  createCameraConfig,
  createCameraManager,
  createCapabilities,
  createStore,
} from '../test-utils';

describe('getCameraIDsWithCapabilityForView', () => {
  describe('views that are always supported', () => {
    it.each([['diagnostics' as const], ['image' as const]])(
      '%s',
      (viewName: AdvancedCameraCardView) => {
        const cameraManager = createCameraManager();
        vi.mocked(cameraManager.getStore).mockReturnValue(
          createStore([
            {
              cameraID: 'camera-1',
              config: createCameraConfig({ dependencies: { cameras: ['camera-2'] } }),
            },
            { cameraID: 'camera-2' },
          ]),
        );
        const foldersManager = mock<FoldersManager>();

        expect(
          getCameraIDsWithCapabilityForView(viewName, cameraManager, foldersManager),
        ).toEqual(new Set(['camera-1', 'camera-2']));
        expect(
          getCameraIDsWithCapabilityForView(
            viewName,
            cameraManager,
            foldersManager,
            'camera-1',
          ),
        ).toEqual(new Set(['camera-1', 'camera-2']));
        expect(
          getCameraIDsWithCapabilityForView(
            viewName,
            cameraManager,
            foldersManager,
            'camera-2',
          ),
        ).toEqual(new Set(['camera-1', 'camera-2']));
      },
    );
  });

  describe('views that respect dependencies and need a capability', () => {
    it.each([
      ['live' as const, 'live' as const],
      ['timeline' as const, 'clips' as const],
      ['timeline' as const, 'recordings' as const],
      ['timeline' as const, 'snapshots' as const],
      ['timeline' as const, 'reviews' as const],
      ['media' as const, 'clips' as const],
      ['media' as const, 'recordings' as const],
      ['media' as const, 'snapshots' as const],
      ['media' as const, 'reviews' as const],
      ['gallery' as const, 'clips' as const],
      ['gallery' as const, 'recordings' as const],
      ['gallery' as const, 'snapshots' as const],
      ['gallery' as const, 'reviews' as const],
    ])('%s', (viewName: AdvancedCameraCardView, capabilityKey: CapabilityKey) => {
      const cameraManager = createCameraManager();
      vi.mocked(cameraManager.getStore).mockReturnValue(
        createStore([
          {
            cameraID: 'camera-1',
            config: createCameraConfig({ dependencies: { cameras: ['camera-2'] } }),
          },
          {
            cameraID: 'camera-2',
            capabilities: createCapabilities({ [capabilityKey]: true }),
          },
        ]),
      );
      const foldersManager = mock<FoldersManager>();

      expect(
        getCameraIDsWithCapabilityForView(viewName, cameraManager, foldersManager),
      ).toEqual(new Set(['camera-2']));
    });

    it.each([
      ['clip' as const, 'clips' as const],
      ['clips' as const, 'clips' as const],
      ['snapshot' as const, 'snapshots' as const],
      ['snapshots' as const, 'snapshots' as const],
      ['recording' as const, 'recordings' as const],
      ['recordings' as const, 'recordings' as const],
      ['review' as const, 'reviews' as const],
      ['reviews' as const, 'reviews' as const],
    ])('%s', (viewName: AdvancedCameraCardView, capabilityKey: CapabilityKey) => {
      const cameraManager = createCameraManager();
      vi.mocked(cameraManager.getStore).mockReturnValue(
        createStore([
          {
            cameraID: 'camera-1',
            config: createCameraConfig({ dependencies: { cameras: ['camera-2'] } }),
          },
          {
            cameraID: 'camera-2',
            capabilities: createCapabilities({ [capabilityKey]: true }),
          },
        ]),
      );
      const foldersManager = mock<FoldersManager>();

      expect(
        getCameraIDsWithCapabilityForView(viewName, cameraManager, foldersManager),
      ).toEqual(new Set(['camera-2', 'camera-1']));
    });
  });

  describe('folder views', () => {
    describe('should return all cameras when a folder is present', () => {
      it.each([
        ['folder' as const],
        ['folders' as const],
        ['timeline' as const],
        ['media' as const],
        ['gallery' as const],
      ])('%s', (viewName: AdvancedCameraCardView) => {
        const cameraManager = createCameraManager();
        vi.mocked(cameraManager.getStore).mockReturnValue(
          createStore([
            {
              cameraID: 'camera-1',
              config: createCameraConfig({ dependencies: { cameras: ['camera-2'] } }),
            },
            {
              cameraID: 'camera-2',
            },
          ]),
        );
        const foldersManager = mock<FoldersManager>();
        vi.mocked(foldersManager.hasFolders).mockReturnValue(true);

        expect(
          getCameraIDsWithCapabilityForView(viewName, cameraManager, foldersManager),
        ).toEqual(new Set(['camera-1', 'camera-2']));
      });
    });

    describe('should not return cameras when a folder is absent', () => {
      it.each([
        ['folder' as const],
        ['folders' as const],
        ['timeline' as const],
        ['media' as const],
        ['gallery' as const],
      ])('%s', (viewName: AdvancedCameraCardView) => {
        const cameraManager = createCameraManager();
        vi.mocked(cameraManager.getStore).mockReturnValue(
          createStore([
            {
              cameraID: 'camera-1',
              config: createCameraConfig({ dependencies: { cameras: ['camera-2'] } }),
            },
            {
              cameraID: 'camera-2',
            },
          ]),
        );
        const foldersManager = mock<FoldersManager>();
        vi.mocked(foldersManager.hasFolders).mockReturnValue(false);

        expect(
          getCameraIDsWithCapabilityForView(viewName, cameraManager, foldersManager),
        ).toEqual(new Set());
      });
    });
  });
});

describe('isViewAvailable', () => {
  it('should return true when cameras are present for camera view', () => {
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager.getStore).mockReturnValue(
      createStore([{ cameraID: 'camera-1' }]),
    );
    const foldersManager = mock<FoldersManager>();
    expect(isViewAvailable('live', cameraManager, foldersManager)).toBe(true);
  });

  it('should return false when cameras are missing for camera view', () => {
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager.getStore).mockReturnValue(createStore([]));
    const foldersManager = mock<FoldersManager>();
    expect(isViewAvailable('live', cameraManager, foldersManager)).toBe(false);
  });

  it('should return true when folders are present for folder view', () => {
    const cameraManager = createCameraManager();
    const foldersManager = mock<FoldersManager>();
    vi.mocked(foldersManager.hasFolders).mockReturnValue(true);
    expect(isViewAvailable('folder', cameraManager, foldersManager)).toBe(true);
  });

  it('should return false when folders are missing for folder view', () => {
    const cameraManager = createCameraManager();
    const foldersManager = mock<FoldersManager>();
    vi.mocked(foldersManager.hasFolders).mockReturnValue(false);
    expect(isViewAvailable('folder', cameraManager, foldersManager)).toBe(false);
  });

  it('should return true when either covers it', () => {
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager.getStore).mockReturnValue(createStore([]));
    const foldersManager = mock<FoldersManager>();
    vi.mocked(foldersManager.hasFolders).mockReturnValue(true);
    expect(isViewAvailable('gallery', cameraManager, foldersManager)).toBe(true);
  });

  it('should return true for diagnostics and image view', () => {
    const cameraManager = createCameraManager();
    const foldersManager = mock<FoldersManager>();
    expect(isViewAvailable('diagnostics', cameraManager, foldersManager)).toBe(true);
    expect(isViewAvailable('image', cameraManager, foldersManager)).toBe(true);
  });
});

describe('isViewSupportedByCamera', () => {
  it('should return true for supported view', () => {
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager.getStore).mockReturnValue(
      createStore([
        {
          cameraID: 'camera-1',
          capabilities: createCapabilities({ live: true }),
        },
      ]),
    );
    const foldersManager = mock<FoldersManager>();

    expect(
      isViewSupportedByCamera('live', cameraManager, foldersManager, 'camera-1'),
    ).toBe(true);
  });

  it('should return false for unsupported view', () => {
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager.getStore).mockReturnValue(
      createStore([
        {
          cameraID: 'camera-1',
          capabilities: createCapabilities({ live: false }),
        },
      ]),
    );
    const foldersManager = mock<FoldersManager>();

    expect(
      isViewSupportedByCamera('live', cameraManager, foldersManager, 'camera-1'),
    ).toBe(false);
  });
});

describe('isViewSupported', () => {
  it('should return true when view is available and camera is null', () => {
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager.getStore).mockReturnValue(
      createStore([{ cameraID: 'camera-1' }]),
    );
    const foldersManager = mock<FoldersManager>();

    expect(isViewSupported('live', cameraManager, foldersManager, null)).toBe(true);
  });

  it('should return true when view is available and camera is supported', () => {
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager.getStore).mockReturnValue(
      createStore([
        {
          cameraID: 'camera-1',
          capabilities: createCapabilities({ live: true }),
        },
      ]),
    );
    const foldersManager = mock<FoldersManager>();

    expect(isViewSupported('live', cameraManager, foldersManager, 'camera-1')).toBe(
      true,
    );
  });

  it('should return false when view is available but camera is not supported', () => {
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager.getStore).mockReturnValue(
      createStore([
        {
          cameraID: 'camera-1',
          capabilities: createCapabilities({ live: false }),
        },
      ]),
    );
    const foldersManager = mock<FoldersManager>();

    expect(isViewSupported('live', cameraManager, foldersManager, 'camera-1')).toBe(
      false,
    );
  });

  it('should return false when view is not available', () => {
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager.getStore).mockReturnValue(createStore([]));
    const foldersManager = mock<FoldersManager>();

    expect(isViewSupported('live', cameraManager, foldersManager, null)).toBe(false);
  });
});
