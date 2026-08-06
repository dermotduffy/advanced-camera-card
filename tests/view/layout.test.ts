import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { CameraManager } from '../../src/camera-manager/manager';
import type { CameraManagerReadOnlyConfigStore } from '../../src/camera-manager/store';
import {
  getDisplayedTargetIDs,
  getLiveGridCameraIDs,
  getViewerGridCameraIDs,
} from '../../src/view/layout';
import { QueryResults } from '../../src/view/query-results';
import { IMAGE_VIEW_TARGET_ID_SENTINEL } from '../../src/view/target-id';
import { createView, generateViewMediaArray } from './test-utils';

// A camera manager whose store reports the given live-capable cameras.
const createCameraManager = (cameraIDs: string[]): CameraManager => {
  const cameraManager = mock<CameraManager>();
  const store = mock<CameraManagerReadOnlyConfigStore>();
  store.getCameraIDsWithCapability.mockReturnValue(new Set(cameraIDs));
  cameraManager.getStore.mockReturnValue(store);
  return cameraManager;
};

// Query results spanning `cameraIDs`, each camera with its own media.
const createQueryResults = (cameraIDs: string[]): QueryResults =>
  new QueryResults({
    results: generateViewMediaArray({ cameraIDs, count: 1 }),
    selectedIndex: 0,
  });

describe('getLiveGridCameraIDs', () => {
  it('should return every live camera when laid out as a grid', () => {
    const view = createView({ view: 'live', displayMode: 'grid' });

    expect(
      getLiveGridCameraIDs(view, createCameraManager(['kitchen', 'office'])),
    ).toEqual(new Set(['kitchen', 'office']));
  });

  it('should return null when not laid out as a grid', () => {
    const view = createView({ view: 'live', displayMode: 'single' });

    expect(
      getLiveGridCameraIDs(view, createCameraManager(['kitchen', 'office'])),
    ).toBeNull();
  });

  it('should return null for a view that inherited a grid it cannot use', () => {
    const view = createView({ view: 'image', displayMode: 'grid' });

    expect(
      getLiveGridCameraIDs(view, createCameraManager(['kitchen', 'office'])),
    ).toBeNull();
  });
});

describe('getViewerGridCameraIDs', () => {
  it('should return every camera with media when laid out as a grid', () => {
    const view = createView({
      view: 'media',
      displayMode: 'grid',
      queryResults: createQueryResults(['kitchen', 'office']),
    });

    expect(getViewerGridCameraIDs(view)).toEqual(new Set(['kitchen', 'office']));
  });

  it('should return null when not laid out as a grid', () => {
    const view = createView({
      view: 'media',
      displayMode: 'single',
      queryResults: createQueryResults(['kitchen', 'office']),
    });

    expect(getViewerGridCameraIDs(view)).toBeNull();
  });

  it('should return null for a view that inherited a grid it cannot use', () => {
    const view = createView({
      view: 'image',
      displayMode: 'grid',
      queryResults: createQueryResults(['kitchen', 'office']),
    });

    expect(getViewerGridCameraIDs(view)).toBeNull();
  });
});

describe('getDisplayedTargetIDs', () => {
  it('should return every camera of a live grid', () => {
    const view = createView({ view: 'live', displayMode: 'grid' });

    expect(
      getDisplayedTargetIDs(view, createCameraManager(['kitchen', 'office'])),
    ).toEqual(new Set(['kitchen', 'office']));
  });

  it('should return the selected camera of a live carousel', () => {
    const view = createView({
      view: 'live',
      camera: 'kitchen',
      displayMode: 'single',
    });

    expect(
      getDisplayedTargetIDs(view, createCameraManager(['kitchen', 'office'])),
    ).toEqual(new Set(['kitchen']));
  });

  it('should return the selected media of every camera of a viewer grid', () => {
    const view = createView({
      view: 'media',
      displayMode: 'grid',
      queryResults: createQueryResults(['kitchen', 'office']),
    });

    expect(getDisplayedTargetIDs(view, createCameraManager([]))).toEqual(
      new Set(['id-kitchen-0', 'id-office-0']),
    );
  });

  it('should return the selected media of a viewer carousel', () => {
    const view = createView({
      view: 'media',
      displayMode: 'single',
      queryResults: createQueryResults(['kitchen', 'office']),
    });

    expect(getDisplayedTargetIDs(view, createCameraManager([]))).toEqual(
      new Set(['id-kitchen-0']),
    );
  });

  it('should skip a viewer grid camera without a selected media', () => {
    const queryResults = createQueryResults(['kitchen', 'office']);
    queryResults.resetSelectedResult('office');
    const view = createView({
      view: 'media',
      displayMode: 'grid',
      queryResults,
    });

    expect(getDisplayedTargetIDs(view, createCameraManager([]))).toEqual(
      new Set(['id-kitchen-0']),
    );
  });

  it('should return the lone camera of a live grid that needs no layout', () => {
    const view = createView({
      view: 'live',
      camera: 'kitchen',
      displayMode: 'grid',
    });

    expect(getDisplayedTargetIDs(view, createCameraManager(['kitchen']))).toEqual(
      new Set(['kitchen']),
    );
  });

  it('should return the lone media of a viewer grid that needs no layout', () => {
    const view = createView({
      view: 'media',
      displayMode: 'grid',
      queryResults: createQueryResults(['kitchen']),
    });

    expect(getDisplayedTargetIDs(view, createCameraManager([]))).toEqual(
      new Set(['id-kitchen-0']),
    );
  });

  it('should return nothing for a viewer grid without query results', () => {
    const view = createView({ view: 'media', displayMode: 'grid' });

    expect(getDisplayedTargetIDs(view, createCameraManager([]))).toEqual(new Set());
  });

  it('should return the sentinel for the image view', () => {
    const view = createView({ view: 'image' });

    expect(getDisplayedTargetIDs(view, createCameraManager([]))).toEqual(
      new Set([IMAGE_VIEW_TARGET_ID_SENTINEL]),
    );
  });

  it('should return nothing for a view that displays no media', () => {
    const view = createView({ view: 'timeline' });

    expect(getDisplayedTargetIDs(view, createCameraManager([]))).toEqual(new Set());
  });
});
