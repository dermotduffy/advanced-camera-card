import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { FoldersManager } from '../../src/card-controller/folders/manager';
import { AdvancedCameraCardView } from '../../src/config/schema/common/const';
import { CapabilityKey } from '../../src/types';
import {
  getCameraIDsForViewName,
  isViewSupportedByCamera,
} from '../../src/view/view-support';
import {
  createCameraConfig,
  createCameraManager,
  createCapabilities,
  createFolder,
  createStore,
} from '../test-utils';

describe('getCameraIDsForViewName', () => {
  describe('views that are always supported', () => {
    it.each([['diagnostics' as const], ['image' as const], ['media' as const]])(
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

        expect(getCameraIDsForViewName(viewName, cameraManager, foldersManager)).toEqual(
          new Set(['camera-1', 'camera-2']),
        );
        expect(
          getCameraIDsForViewName(viewName, cameraManager, foldersManager, 'camera-1'),
        ).toEqual(new Set(['camera-1', 'camera-2']));
        expect(
          getCameraIDsForViewName(viewName, cameraManager, foldersManager, 'camera-2'),
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

      expect(getCameraIDsForViewName(viewName, cameraManager, foldersManager)).toEqual(
        new Set(['camera-2']),
      );
    });

    it.each([
      ['clip' as const, 'clips' as const],
      ['clips' as const, 'clips' as const],
      ['snapshot' as const, 'snapshots' as const],
      ['snapshots' as const, 'snapshots' as const],
      ['recording' as const, 'recordings' as const],
      ['recordings' as const, 'recordings' as const],
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

      expect(getCameraIDsForViewName(viewName, cameraManager, foldersManager)).toEqual(
        new Set(['camera-1', 'camera-2']),
      );
      expect(
        getCameraIDsForViewName(viewName, cameraManager, foldersManager, 'camera-1'),
      ).toEqual(new Set(['camera-1', 'camera-2']));
      expect(
        getCameraIDsForViewName(viewName, cameraManager, foldersManager, 'camera-2'),
      ).toEqual(new Set(['camera-2']));
    });
  });

  describe('views that respect a folder', () => {
    describe('should return cameras when a folder is present', () => {
      it.each([['folder' as const], ['folders' as const], ['timeline' as const]])(
        '%s',
        (viewName: AdvancedCameraCardView) => {
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
          vi.mocked(foldersManager.getFolder).mockReturnValue(createFolder());

          expect(
            getCameraIDsForViewName(viewName, cameraManager, foldersManager),
          ).toEqual(new Set(['camera-1', 'camera-2']));
          expect(
            getCameraIDsForViewName(viewName, cameraManager, foldersManager, 'camera-1'),
          ).toEqual(new Set(['camera-1', 'camera-2']));
          expect(
            getCameraIDsForViewName(viewName, cameraManager, foldersManager, 'camera-2'),
          ).toEqual(new Set(['camera-1', 'camera-2']));
        },
      );
    });

    describe('should not return cameras when a folder is absent', () => {
      it.each([['folder' as const], ['folders' as const], ['timeline' as const]])(
        '%s',
        (viewName: AdvancedCameraCardView) => {
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
          vi.mocked(foldersManager.getFolder).mockReturnValue(null);

          expect(
            getCameraIDsForViewName(viewName, cameraManager, foldersManager),
          ).toEqual(new Set());
          expect(
            getCameraIDsForViewName(viewName, cameraManager, foldersManager, 'camera-1'),
          ).toEqual(new Set());
          expect(
            getCameraIDsForViewName(viewName, cameraManager, foldersManager, 'camera-2'),
          ).toEqual(new Set());
        },
      );
    });
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
