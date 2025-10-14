import { describe, expect, it, vi } from 'vitest';
import { QueryType } from '../../src/camera-manager/types';
import { AdvancedCameraCardView } from '../../src/config/schema/common/const';
import { CapabilityKey } from '../../src/types';
import { EventMediaQuery } from '../../src/view/query';
import { QueryResults } from '../../src/view/query-results';
import {
  getCameraIDsForViewName,
  isViewSupportedByCamera,
  isViewSupportedByQueryOnly,
} from '../../src/view/view-support';
import {
  createCameraConfig,
  createCameraManager,
  createCapabilities,
  createStore,
  generateViewMediaArray,
} from '../test-utils';

describe('getCameraIDsForViewName', () => {
  describe('views that are always supported', () => {
    it.each([
      ['diagnostics' as const],
      ['folder' as const],
      ['folders' as const],
      ['image' as const],
      ['media' as const],
    ])('%s', (viewName: AdvancedCameraCardView) => {
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

      expect(getCameraIDsForViewName(viewName, cameraManager)).toEqual(
        new Set(['camera-1', 'camera-2']),
      );
      expect(getCameraIDsForViewName(viewName, cameraManager, 'camera-1')).toEqual(
        new Set(['camera-1', 'camera-2']),
      );
      expect(getCameraIDsForViewName(viewName, cameraManager, 'camera-2')).toEqual(
        new Set(['camera-1', 'camera-2']),
      );
    });
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

      expect(getCameraIDsForViewName(viewName, cameraManager)).toEqual(
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

      expect(getCameraIDsForViewName(viewName, cameraManager)).toEqual(
        new Set(['camera-1', 'camera-2']),
      );
      expect(getCameraIDsForViewName(viewName, cameraManager, 'camera-1')).toEqual(
        new Set(['camera-1', 'camera-2']),
      );
      expect(getCameraIDsForViewName(viewName, cameraManager, 'camera-2')).toEqual(
        new Set(['camera-2']),
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

    expect(isViewSupportedByCamera('live', cameraManager, 'camera-1')).toBe(true);
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

    expect(isViewSupportedByCamera('live', cameraManager, 'camera-1')).toBe(false);
  });
});

describe('isViewSupportedByQueryOnly', () => {
  it.each([
    ['live' as const],
    ['image' as const],
    ['diagnostics' as const],
    ['clip' as const],
    ['clips' as const],
    ['snapshot' as const],
    ['snapshots' as const],
    ['recording' as const],
    ['recordings' as const],
    ['media' as const],
  ])('%s', (viewName: AdvancedCameraCardView) => {
    expect(isViewSupportedByQueryOnly(viewName)).toBe(false);
  });

  it('should return false for timeline without query', () => {
    expect(isViewSupportedByQueryOnly('timeline')).toBe(false);
  });

  it('should return true for timeline with query and query results', () => {
    const query = new EventMediaQuery([
      {
        type: QueryType.Event,
        cameraIDs: new Set(['camera-1']),
      },
    ]);
    const queryResults = new QueryResults({
      results: generateViewMediaArray({ count: 5 }),
      selectedIndex: 0,
    });

    expect(isViewSupportedByQueryOnly('timeline', query, queryResults)).toBe(true);
  });
});
