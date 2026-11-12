import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { MergeContextViewModifier } from '../../../src/card-controller/view/modifiers/merge-context';
import type { ViewManager } from '../../../src/card-controller/view/view-manager';
import {
  generateViewContextForZoom,
  handleDigitalZoomHomeEvent,
  handleZoomSettingsObservedEvent,
} from '../../../src/components-lib/zoom/zoom-view-context';

vi.mock('../../../src/card-controller/view/modifiers/merge-context');

// @vitest-environment jsdom
describe('generateViewContextForZoom', () => {
  it('with observed', () => {
    expect(
      generateViewContextForZoom('target', {
        observed: {
          pan: { x: 1, y: 2 },
          zoom: 3,
          isDefault: true,
          unzoomed: true,
        },
      }),
    ).toEqual({
      zoom: {
        target: {
          observed: {
            pan: { x: 1, y: 2 },
            zoom: 3,
            isDefault: true,
            unzoomed: true,
          },
          requested: null,
        },
      },
    });
  });

  it('with requested', () => {
    expect(
      generateViewContextForZoom('target', {
        requested: {
          pan: { x: 1, y: 2 },
          zoom: 3,
        },
      }),
    ).toEqual({
      zoom: {
        target: {
          requested: {
            pan: { x: 1, y: 2 },
            zoom: 3,
          },
        },
      },
    });
  });
});

describe('handleZoomSettingsObservedEvent', () => {
  it('should reject observed zoom settings without viewManager ', () => {
    handleZoomSettingsObservedEvent(
      new CustomEvent('advanced-camera-card:zoom:change', {
        detail: {
          pan: { x: 1, y: 2 },
          zoom: 3,
          isDefault: true,
          unzoomed: true,
        },
      }),
    );

    // No observable effect.
  });

  it('should reject observed zoom settings without target ', () => {
    const viewManager = mock<ViewManager>();

    handleZoomSettingsObservedEvent(
      new CustomEvent('advanced-camera-card:zoom:change', {
        detail: {
          pan: { x: 1, y: 2 },
          zoom: 3,
          isDefault: true,
          unzoomed: true,
        },
      }),
      viewManager,
    );

    expect(viewManager.setViewByParameters).not.toHaveBeenCalled();
  });

  it('should handle observed zoom settings ', () => {
    const viewManager = mock<ViewManager>();

    handleZoomSettingsObservedEvent(
      new CustomEvent('advanced-camera-card:zoom:change', {
        detail: {
          pan: { x: 1, y: 2 },
          zoom: 3,
          isDefault: true,
          unzoomed: true,
        },
      }),
      viewManager,
      'target',
    );
    expect(viewManager.setViewByParameters).toHaveBeenCalledWith(
      expect.objectContaining({
        modifiers: [expect.any(MergeContextViewModifier)],
      }),
    );

    expect(MergeContextViewModifier).toHaveBeenCalledWith({
      zoom: {
        target: {
          observed: { pan: { x: 1, y: 2 }, zoom: 3, isDefault: true, unzoomed: true },
          requested: null,
        },
      },
    });
  });
});

describe('handleDigitalZoomHomeEvent', () => {
  it('should request the default zoom for the target', () => {
    const element = document.createElement('div');
    const handler = vi.fn();
    element.addEventListener('advanced-camera-card:action:execution-request', handler);

    handleDigitalZoomHomeEvent(element, 'target');

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: {
          actions: {
            action: 'fire-dom-event',
            advanced_camera_card_action: 'ptz_digital',
            target_id: 'target',
          },
        },
      }),
    );
  });

  it('should do nothing without a target', () => {
    const element = document.createElement('div');
    const handler = vi.fn();
    element.addEventListener('advanced-camera-card:action:execution-request', handler);

    handleDigitalZoomHomeEvent(element);

    expect(handler).not.toHaveBeenCalled();
  });
});
