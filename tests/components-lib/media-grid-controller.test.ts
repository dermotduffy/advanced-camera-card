import Masonry from 'masonry-layout';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import {
  ExtendedMasonry,
  MediaGridConstructorOptions,
  MediaGridController,
} from '../../src/components-lib/media-grid-controller';
import { MediaLoadedInfo } from '../../src/types';
import { dispatchExistingMediaLoadedInfoAsEvent } from '../../src/utils/media-info';
import {
  MutationObserverMock,
  ResizeObserverMock,
  createSlot,
  createSlotHost,
} from '../test-utils';

vi.mock('lodash-es/throttle', () => ({
  default: vi.fn((fn) => fn),
}));

const masonry = mock<ExtendedMasonry>();
vi.mock('masonry-layout', () => ({
  default: vi.fn().mockImplementation(() => {
    return masonry;
  }),
}));

const createChildren = (childIDs?: string[], idAttribute?: string): HTMLElement[] => {
  const children: HTMLElement[] = [];
  for (let i = 0; i < (childIDs?.length ?? 3); ++i) {
    const child = document.createElement('div');
    if (childIDs) {
      child.setAttribute(idAttribute ?? 'grid-id', childIDs[i]);
    }
    children.push(child);
  }
  return children;
};

const setElementWidth = (element: HTMLElement, width: number): void => {
  element.getBoundingClientRect = vi.fn().mockReturnValue({
    width: width,
  });
};

const createParent = (options?: {
  children?: HTMLElement[];
  width?: number;
}): HTMLElement => {
  const host = document.createElement('div');
  if (options?.children) {
    host.append(...options.children);
  }
  // Default Lovelace card width is 492.
  setElementWidth(host, options?.width ?? 492);
  return host;
};

const createController = (host: HTMLElement, options?: MediaGridConstructorOptions) => {
  return new MediaGridController(host, options);
};

const triggerMutationObserver = (hostOrCell: 'cell' | 'host'): void => {
  const mutationObserverTrigger = vi.mocked(global.MutationObserver).mock.calls[
    hostOrCell === 'host' ? 0 : 1
  ][0];
  mutationObserverTrigger([], mock<MutationObserver>());
};

const triggerResizeObserver = (hostOrCell: 'cell' | 'host'): void => {
  const resizeObserverTrigger = vi.mocked(global.ResizeObserver).mock.calls[
    hostOrCell === 'host' ? 0 : 1
  ][0];
  resizeObserverTrigger([], mock<ResizeObserver>());
};

// @vitest-environment jsdom
describe('MediaGridController', () => {
  const mediaLoadedInfo: MediaLoadedInfo = {
    width: 10,
    height: 20,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('MutationObserver', MutationObserverMock);
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);

    masonry.items = [];
  });

  it('should be constructable', () => {
    const controller = createController(createParent());
    expect(controller).toBeTruthy();
    expect(masonry.layout).toBeCalled();
  });

  it('should set grid contents correctly from regular elements', () => {
    const children = createChildren();
    const parent = createParent({ children: children });
    const controller = createController(parent);
    expect(controller.getGridContents()).toEqual(
      new Map([
        ['0', children[0]],
        ['1', children[1]],
        ['2', children[2]],
      ]),
    );
    expect(controller.getGridSize()).toBe(3);
    expect(masonry.layout).toBeCalled();
  });

  it('should set grid contents correctly from slotted elements', () => {
    const children = createChildren();
    const slot = createSlot();
    const host = createSlotHost({ slot: slot, children: children });
    const controller = createController(host);
    expect(controller.getGridContents()).toEqual(
      new Map([
        ['0', children[0]],
        ['1', children[1]],
        ['2', children[2]],
      ]),
    );
    expect(controller.getGridSize()).toBe(3);
  });

  it('should select element', () => {
    const children = createChildren();
    const slot = createSlot();
    createSlotHost({ slot: slot, children: children });

    const controller = createController(slot);

    // All children should be unselected.
    expect(controller.getSelected()).toBeNull();
    for (const child of children) {
      expect(child.getAttribute('selected')).toBeNull();
      expect(child.getAttribute('unselected')).toEqual('');
    }

    controller.selectCell('0');
    expect(controller.getSelected()).toBe('0');

    // 1st child should now be selected.
    expect(children[0].getAttribute('selected')).toEqual('');
    expect(children[0].getAttribute('unselected')).toBeNull();

    // 2nd and 3rd should be unselected.
    for (const child of children.slice(1)) {
      expect(child.getAttribute('selected')).toBeNull();
      expect(child.getAttribute('unselected')).toEqual('');
    }
  });

  it('should re-select element', () => {
    const children = createChildren();
    const slot = createSlot();
    createSlotHost({ slot: slot, children: children });
    const controller = createController(slot);

    // All children should be unselected.
    expect(controller.getSelected()).toBeNull();

    controller.selectCell('0');
    expect(controller.getSelected()).toBe('0');

    controller.selectCell('0');
    expect(controller.getSelected()).toBe('0');
  });

  it('should dispatch media loaded info on selection', () => {
    const children = createChildren();
    const slot = createSlot();
    const host = createSlotHost({ slot: slot, children: children });
    const controller = createController(slot);

    const mediaLoadedInfoHandler = vi.fn();
    host.addEventListener('advanced-camera-card:media:loaded', mediaLoadedInfoHandler);
    dispatchExistingMediaLoadedInfoAsEvent(children[0], mediaLoadedInfo);

    controller.selectCell('0');
    expect(mediaLoadedInfoHandler).toBeCalledWith(
      expect.objectContaining({
        detail: mediaLoadedInfo,
      }),
    );
  });

  it('should dispatch media loaded info when cell is selected', () => {
    const children = createChildren();
    const slot = createSlot();
    const host = createSlotHost({ slot: slot, children: children });
    const controller = createController(slot);

    controller.selectCell('0');

    const mediaLoadedInfoHandler = vi.fn();
    host.addEventListener('advanced-camera-card:media:loaded', mediaLoadedInfoHandler);
    dispatchExistingMediaLoadedInfoAsEvent(children[0], mediaLoadedInfo);

    expect(mediaLoadedInfoHandler).toBeCalledWith(
      expect.objectContaining({
        detail: mediaLoadedInfo,
      }),
    );
  });

  it('should not dispatch media loaded info when cell is not selected', () => {
    const children = createChildren();
    const slot = createSlot();
    const host = createSlotHost({ slot: slot, children: children });
    const controller = createController(host);

    controller.selectCell('1');

    const mediaLoadedInfoHandler = vi.fn();
    host.addEventListener('advanced-camera-card:media:loaded', mediaLoadedInfoHandler);
    dispatchExistingMediaLoadedInfoAsEvent(children[0], mediaLoadedInfo);

    // Another element is selected, so the event should not have propagated.
    expect(mediaLoadedInfoHandler).not.toBeCalled();
  });

  it('should unselect', () => {
    const children = createChildren();
    const slot = createSlot();
    const host = createSlotHost({ slot: slot, children: children });
    const controller = createController(host);

    const unselectedHandler = vi.fn();
    const unloadMediaHandler = vi.fn();
    host.addEventListener(
      'advanced-camera-card:media-grid:unselected',
      unselectedHandler,
    );
    host.addEventListener('advanced-camera-card:media:unloaded', unloadMediaHandler);

    controller.selectCell('0');
    expect(controller.getSelected()).toBe('0');

    // Unselect all elements.
    controller.unselectAll();

    // Expect selected to now be null.
    expect(controller.getSelected()).toBeNull();

    // Expect styles to have been updated.
    for (const child of children) {
      expect(child.getAttribute('selected')).toBeNull();
      expect(child.getAttribute('unselected')).toEqual('');
    }

    // Expect handlers to have been called.
    expect(unselectedHandler).toBeCalledTimes(1);
    expect(unloadMediaHandler).toBeCalledTimes(1);

    // Unselecting a second time should do nothing.
    controller.unselectAll();

    expect(unselectedHandler).toBeCalledTimes(1);
    expect(unloadMediaHandler).toBeCalledTimes(1);
  });

  it('should select in constructor', () => {
    const children = createChildren();
    const slot = createSlot();
    const host = createSlotHost({ slot: slot, children: children });
    const controller = createController(host, { selected: '2' });

    expect(controller.getSelected()).toBe('2');
  });

  it('should respect grid attribute option', () => {
    const children = createChildren(['one', 'two', 'three'], 'test-id');
    const slot = createSlot();
    const host = createSlotHost({ slot: slot, children: children });
    const controller = createController(host, { idAttribute: 'test-id' });
    expect(controller.getGridContents()).toEqual(
      new Map([
        ['one', children[0]],
        ['two', children[1]],
        ['three', children[2]],
      ]),
    );
  });

  it('should destroy with regular elements', () => {
    const children = createChildren();
    const parent = createParent({ children: children });
    const controller = createController(parent);
    expect(controller.getGridSize()).toBe(3);
    controller.destroy();
    expect(controller.getGridSize()).toBe(0);
  });

  it('should destroy with slotted elements', () => {
    const children = createChildren();
    const slot = createSlot();
    createSlotHost({ slot: slot, children: children });
    const controller = createController(slot);

    expect(controller.getGridSize()).toBe(3);
    controller.destroy();
    expect(controller.getGridSize()).toBe(0);
  });

  it('should replace children when they change', () => {
    const children = createChildren();
    const parent = createParent({ children: children });
    const controller = createController(parent, { selected: '1' });
    dispatchExistingMediaLoadedInfoAsEvent(children[0], mediaLoadedInfo);

    expect(controller.getSelected()).toBe('1');
    expect(controller.getGridSize()).toBe(3);

    children.forEach((child) => parent.removeChild(child));
    const newChildren = createChildren(['one', 'two', 'three']);
    newChildren.forEach((child) => parent.appendChild(child));

    triggerMutationObserver('host');

    expect(controller.getGridContents()).toEqual(
      new Map([
        ['one', newChildren[0]],
        ['two', newChildren[1]],
        ['three', newChildren[2]],
      ]),
    );
    expect(controller.getSelected()).toBeNull();
  });

  it('should re-calculate children when id attribute changes', () => {
    const children = createChildren(['one', 'two', 'three'], 'test-id');
    const parent = createParent({ children: children });
    const controller = createController(parent, {
      selected: 'one',
      idAttribute: 'test-id',
    });

    expect(controller.getSelected()).toBe('one');
    expect(controller.getGridSize()).toBe(3);

    children[0].setAttribute('test-id', 'alpha');
    children[1].setAttribute('test-id', 'beta');
    children[2].setAttribute('test-id', 'gamma');

    triggerMutationObserver('cell');

    expect(controller.getGridContents()).toEqual(
      new Map([
        ['alpha', children[0]],
        ['beta', children[1]],
        ['gamma', children[2]],
      ]),
    );
    expect(controller.getSelected()).toBeNull();
  });

  it('should replace children of a slot when they change', () => {
    const children = createChildren();
    const slot = createSlot();
    const host = createSlotHost({ slot: slot, children: children });

    const controller = createController(slot, { selected: '1' });

    expect(controller.getSelected()).toBe('1');
    expect(controller.getGridSize()).toBe(3);

    children.forEach((child) => host.removeChild(child));
    const newChildren = createChildren(['one', 'two', 'three']);
    newChildren.forEach((child) => host.append(child));

    slot.dispatchEvent(new Event('slotchange'));

    expect(controller.getGridContents()).toEqual(
      new Map([
        ['one', newChildren[0]],
        ['two', newChildren[1]],
        ['three', newChildren[2]],
      ]),
    );
    expect(controller.getSelected()).toBeNull();
  });

  it('should construct masonry correctly', () => {
    const children = createChildren();
    const parent = createParent({ children: children });
    createController(parent);
    expect(Masonry).toBeCalledWith(
      parent,
      expect.objectContaining({
        initLayout: false,
        percentPosition: true,
        transitionDuration: '0.2s',
      }),
    );
  });

  it('should set default column size correctly', () => {
    const parent = createParent({ children: createChildren() });
    createController(parent);
    expect(Masonry).toBeCalledWith(
      parent,
      expect.objectContaining({
        columnWidth: 245,
      }),
    );
    expect(
      parent.style.getPropertyValue('--advanced-camera-card-grid-column-size'),
    ).toBe('245px');
  });

  it('should respect exact columns', () => {
    const parent = createParent({ children: createChildren(), width: 3000 });
    const controller = createController(parent);
    controller.setDisplayConfig({ mode: 'grid', grid_columns: 2 });

    // Will have been called once on construction, and then again when the
    // number of columns changes.
    expect(Masonry).toBeCalledTimes(2);
    expect(Masonry).toBeCalledWith(
      parent,
      expect.objectContaining({
        columnWidth: 1499,
      }),
    );
    expect(
      parent.style.getPropertyValue('--advanced-camera-card-grid-column-size'),
    ).toBe('1499px');
  });

  it('should respect selected width factor', () => {
    const parent = createParent({ children: createChildren(), width: 2000 });
    const controller = createController(parent);
    controller.setDisplayConfig({ mode: 'grid', grid_selected_width_factor: 3 });
    expect(
      parent.style.getPropertyValue('--advanced-camera-card-grid-selected-width-factor'),
    ).toBe('3');

    // Setting the same config again should do nothing.
    controller.setDisplayConfig({ mode: 'grid', grid_selected_width_factor: 3 });
    expect(
      parent.style.getPropertyValue('--advanced-camera-card-grid-selected-width-factor'),
    ).toBe('3');
  });

  it('should select cell when interacted with', () => {
    const children = createChildren();
    const parent = createParent({ children: children, width: 2000 });
    const controller = createController(parent);

    expect(controller.getSelected()).toBeNull();

    const clickHandler = vi.fn();
    parent.addEventListener('click', clickHandler);

    children[1].click();

    // Click will not be allowed through.
    expect(clickHandler).not.toBeCalled();
    expect(controller.getSelected()).toBe('1');
  });

  it('should ignore interaction events on already selected cell', () => {
    const children = createChildren();
    const parent = createParent({ children: children, width: 2000 });
    const controller = createController(parent);
    controller.selectCell('1');

    const clickHandler = vi.fn();
    parent.addEventListener('click', clickHandler);
    children[1].click();

    // Click will be allowed through.
    expect(clickHandler).toBeCalled();
    expect(controller.getSelected()).toBe('1');
  });

  it('should re-layout when child size changes', () => {
    createController(createParent({ children: createChildren() }));

    vi.mocked(masonry.layout)?.mockClear();
    triggerResizeObserver('cell');
    expect(masonry.layout).toBeCalled();
  });

  it('should re-create masonry when host size changes', () => {
    const children = createChildren();
    const parent = createParent({ children: children });
    createController(parent);
    expect(Masonry).toBeCalledWith(
      parent,
      expect.objectContaining({
        columnWidth: 245,
      }),
    );
    expect(
      parent.style.getPropertyValue('--advanced-camera-card-grid-column-size'),
    ).toBe('245px');

    // Clear mock state.
    vi.mocked(Masonry).mockClear();
    vi.mocked(masonry.layout)?.mockClear();

    // Resize the host.
    setElementWidth(parent, 3000);
    triggerResizeObserver('host');

    // Masonry should be reconstructed, styles set and layout called.
    expect(Masonry).toBeCalledWith(
      parent,
      expect.objectContaining({
        columnWidth: 599,
      }),
    );
    expect(
      parent.style.getPropertyValue('--advanced-camera-card-grid-column-size'),
    ).toBe('599px');
    expect(masonry.layout).toBeCalled();

    // Clear mock state.
    vi.mocked(Masonry).mockClear();
    vi.mocked(masonry.layout)?.mockClear();

    // Triger with the same sizes.
    triggerResizeObserver('host');
    expect(Masonry).not.toBeCalled();
    expect(masonry.layout).not.toBeCalled();
  });

  describe('describe should sort grid elements correctly', () => {
    it('should respect placement when grid_selected_position is default', () => {
      const children = createChildren();
      const parent = createParent({ children: children });

      // Simulate wrapped children in masonry object.
      masonry.items = children.map((child) => ({ element: child }));

      const controller = createController(parent);
      controller.setDisplayConfig({ mode: 'grid', grid_selected_position: 'default' });

      controller.selectCell('1');

      expect(masonry.items).toEqual([
        { element: children[0] },
        { element: children[1] },
        { element: children[2] },
      ]);
    });

    it('should respect placement when grid_selected_position is first', () => {
      const children = createChildren(['0', '1', '2']);
      const parent = createParent({ children: children });

      // Simulate wrapped children in masonry object.
      masonry.items = children.map((child) => ({ element: child }));

      const controller = createController(parent);
      controller.setDisplayConfig({ mode: 'grid', grid_selected_position: 'first' });

      controller.selectCell('1');

      expect(masonry.items).toEqual([
        { element: children[1] },
        { element: children[0] },
        { element: children[2] },
      ]);
    });

    it('should respect placement when grid_selected_position is last', () => {
      const children = createChildren(['0', '1', '2']);
      const parent = createParent({ children: children });

      // Simulate wrapped children in masonry object.
      masonry.items = children.map((child) => ({ element: child }));

      const controller = createController(parent);
      controller.setDisplayConfig({ mode: 'grid', grid_selected_position: 'last' });

      controller.selectCell('1');

      expect(masonry.items).toEqual([
        { element: children[0] },
        { element: children[2] },
        { element: children[1] },
      ]);
    });
  });
});
