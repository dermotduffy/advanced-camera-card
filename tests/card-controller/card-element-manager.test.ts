import { afterEach, assert, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { CardElementManager } from '../../src/card-controller/card-element-manager';
import { StateWatcher } from '../../src/card-controller/hass/state-watcher';
import { QueryResults } from '../../src/view/query-results';
import { View } from '../../src/view/view';
import {
  callStateWatcherCallback,
  createCardAPI,
  createCardHTMLElement,
  createConfig,
  createStateEntity,
  createView,
  TestViewMedia,
} from '../test-utils';

// @vitest-environment jsdom
describe('CardElementManager', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should get element', () => {
    const element = createCardHTMLElement();
    const manager = new CardElementManager(
      createCardAPI(),
      element,
      () => undefined,
      () => undefined,
    );

    expect(manager.getElement()).toBe(element);
  });

  it('should reset scroll', () => {
    const callback = vi.fn();
    const manager = new CardElementManager(
      createCardAPI(),
      createCardHTMLElement(),
      callback,
      () => undefined,
    );

    manager.scrollReset();

    expect(callback).toBeCalled();
  });

  it('should toggle menu', () => {
    const callback = vi.fn();
    const manager = new CardElementManager(
      createCardAPI(),
      createCardHTMLElement(),
      () => undefined,
      callback,
    );

    manager.toggleMenu();

    expect(callback).toBeCalled();
  });

  it('should update', () => {
    const element = createCardHTMLElement();
    const manager = new CardElementManager(
      createCardAPI(),
      element,
      () => undefined,
      () => undefined,
    );

    manager.update();
    expect(element.requestUpdate).toBeCalled();
  });

  it('should get hasUpdated', () => {
    const element = createCardHTMLElement();
    element.hasUpdated = true;
    const manager = new CardElementManager(
      createCardAPI(),
      element,
      () => undefined,
      () => undefined,
    );

    expect(manager.hasUpdated()).toBeTruthy();
  });

  it('should connect', () => {
    const windowAddEventListener = vi.spyOn(global.window, 'addEventListener');

    const addEventListener = vi.fn();
    const element = createCardHTMLElement();
    element.addEventListener = addEventListener;

    const api = createCardAPI();
    const manager = new CardElementManager(
      api,
      element,
      () => undefined,
      () => undefined,
    );

    manager.elementConnected();

    expect(element.getAttribute('panel')).toBeNull();
    expect(element.getAttribute('casted')).toBeNull();
    expect(api.getFullscreenManager().connect).toBeCalled();

    expect(addEventListener).toBeCalledWith(
      'mousemove',
      api.getInteractionManager().reportInteraction,
    );
    expect(addEventListener).toBeCalledWith(
      'll-custom',
      api.getActionsManager().handleCustomActionEvent,
    );
    expect(addEventListener).toBeCalledWith(
      'action',
      api.getActionsManager().handleInteractionEvent,
    );
    expect(addEventListener).toBeCalledWith(
      'action',
      api.getInteractionManager().reportInteraction,
    );
    expect(addEventListener).toBeCalledWith(
      'touchstart',
      api.getInteractionManager().reportInteraction,
    );
    expect(addEventListener).toBeCalledWith(
      'touchmove',
      api.getInteractionManager().reportInteraction,
    );
    expect(windowAddEventListener).toBeCalledWith('location-changed', expect.anything());
    expect(windowAddEventListener).toBeCalledWith('popstate', expect.anything());
    expect(windowAddEventListener).toBeCalledWith(
      'advanced-camera-card:editor:diagnostics',
      expect.anything(),
    );

    expect(api.getInteractionManager().initialize).toBeCalled();
    expect(api.getFullscreenManager().initialize).toBeCalled();
    expect(api.getExpandManager().initialize).toBeCalled();
    expect(api.getMediaLoadedInfoManager().initialize).toBeCalled();
    expect(api.getMicrophoneManager().initialize).toBeCalled();
  });

  it('should disconnect', () => {
    const windowRemoveEventListener = vi.spyOn(global.window, 'removeEventListener');

    const element = createCardHTMLElement();
    element.setAttribute('panel', '');
    element.setAttribute('casted', '');

    const removeEventListener = vi.fn();
    element.removeEventListener = removeEventListener;

    const api = createCardAPI();

    const manager = new CardElementManager(
      api,
      element,
      () => undefined,
      () => undefined,
    );

    manager.elementDisconnected();

    expect(element.getAttribute('panel')).toBeNull();
    expect(element.getAttribute('casted')).toBeNull();
    expect(api.getMediaLoadedInfoManager().clear).toBeCalled();
    expect(api.getFullscreenManager().disconnect).toBeCalled();

    expect(removeEventListener).toBeCalledWith(
      'mousemove',
      api.getInteractionManager().reportInteraction,
    );
    expect(removeEventListener).toBeCalledWith(
      'll-custom',
      api.getActionsManager().handleCustomActionEvent,
    );
    expect(removeEventListener).toBeCalledWith(
      'action',
      api.getActionsManager().handleInteractionEvent,
    );
    expect(removeEventListener).toBeCalledWith(
      'action',
      api.getInteractionManager().reportInteraction,
    );
    expect(removeEventListener).toBeCalledWith(
      'touchstart',
      api.getInteractionManager().reportInteraction,
    );
    expect(removeEventListener).toBeCalledWith(
      'touchmove',
      api.getInteractionManager().reportInteraction,
    );
    expect(windowRemoveEventListener).toBeCalledWith(
      'location-changed',
      expect.anything(),
    );
    expect(windowRemoveEventListener).toBeCalledWith('popstate', expect.anything());
    expect(windowRemoveEventListener).toBeCalledWith(
      'advanced-camera-card:editor:diagnostics',
      expect.anything(),
    );

    expect(api.getMediaLoadedInfoManager().clear).toBeCalled();
    expect(api.getFullscreenManager().disconnect).toBeCalled();
    expect(api.getKeyboardStateManager().uninitialize).toBeCalled();
    expect(api.getActionsManager().uninitialize).toBeCalled();
    expect(api.getInitializationManager().uninitialize).toBeCalledWith('cameras');
  });

  describe('should update card when', () => {
    it('render entity changes', () => {
      const api = createCardAPI();
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          view: {
            render_entities: ['sensor.force_update'],
          },
        }),
      );

      const stateWatcher = mock<StateWatcher>();
      vi.mocked(api.getHASSManager().getStateWatcher).mockReturnValue(stateWatcher);

      const element = createCardHTMLElement();
      const manager = new CardElementManager(
        api,
        element,
        () => undefined,
        () => undefined,
      );

      manager.elementConnected();

      const diff = {
        entityID: 'sensor.force_update',
        newState: createStateEntity({ state: 'off' }),
      };
      callStateWatcherCallback(stateWatcher, diff);

      expect(element.requestUpdate).toBeCalled();
    });

    it('media player entity changes', () => {
      const api = createCardAPI();
      vi.mocked(api.getMediaPlayerManager().getMediaPlayers).mockReturnValue([
        'media_player.foo',
      ]);

      const stateWatcher = mock<StateWatcher>();
      vi.mocked(api.getHASSManager().getStateWatcher).mockReturnValue(stateWatcher);

      const element = createCardHTMLElement();
      const manager = new CardElementManager(
        api,
        element,
        () => undefined,
        () => undefined,
      );

      manager.elementConnected();

      const diff = {
        entityID: 'sensor.force_update',
        newState: createStateEntity({ state: 'off' }),
      };
      callStateWatcherCallback(stateWatcher, diff);

      expect(element.requestUpdate).toBeCalled();
    });

    it('selected media review status changes', () => {
      const api = createCardAPI();
      const selectedMedia = new TestViewMedia({ id: 'media-1' });
      const queryResults = new QueryResults({
        results: [selectedMedia],
        selectedIndex: 0,
      });
      const view = createView({ queryResults });

      vi.mocked(api.getViewManager().getView).mockReturnValue(view);

      const element = createCardHTMLElement();
      const manager = new CardElementManager(
        api,
        element,
        () => undefined,
        () => undefined,
      );

      manager.elementConnected();

      // Clear any previous calls from elementConnected.
      vi.mocked(element.requestUpdate).mockClear();

      // Dispatch the media reviewed event with the selected media item.
      element.dispatchEvent(
        new CustomEvent('advanced-camera-card:media:reviewed', {
          detail: selectedMedia,
        }),
      );

      expect(element.requestUpdate).toBeCalled();
    });

    it('non-selected media review status changes does not update', () => {
      const api = createCardAPI();
      const selectedMedia = new TestViewMedia({ id: 'media-1' });
      const otherMedia = new TestViewMedia({ id: 'media-2' });
      const queryResults = new QueryResults({
        results: [selectedMedia, otherMedia],
        selectedIndex: 0,
      });
      const view = createView({ queryResults });

      vi.mocked(api.getViewManager().getView).mockReturnValue(view);

      const element = createCardHTMLElement();
      const manager = new CardElementManager(
        api,
        element,
        () => undefined,
        () => undefined,
      );

      manager.elementConnected();

      // Clear any previous calls from elementConnected.
      vi.mocked(element.requestUpdate).mockClear();

      // Dispatch the media reviewed event with a DIFFERENT media item.
      element.dispatchEvent(
        new CustomEvent('advanced-camera-card:media:reviewed', {
          detail: otherMedia,
        }),
      );

      // Should NOT update because the reviewed item is not the selected item.
      expect(element.requestUpdate).not.toBeCalled();
    });
  });

  describe('should handle diagnostics', () => {
    afterEach(() => {
      vi.clearAllMocks();
    });

    const createDialogWithCard = (element: HTMLElement) => {
      const dialog = document.createElement('hui-dialog-edit-card');
      dialog.attachShadow({ mode: 'open' });
      assert(dialog.shadowRoot);
      dialog.shadowRoot.append(element);
      return dialog;
    };

    const fireFromDialog = (dialog: HTMLElement) => {
      const editorDiv = document.createElement('div');
      assert(dialog.shadowRoot);
      dialog.shadowRoot.append(editorDiv);
      editorDiv.dispatchEvent(
        new CustomEvent('advanced-camera-card:editor:diagnostics', {
          bubbles: true,
          composed: true,
        }),
      );
    };

    it('sets view to diagnostics if card is in editor', () => {
      const api = createCardAPI();
      const element = createCardHTMLElement();
      const manager = new CardElementManager(
        api,
        element,
        () => undefined,
        () => undefined,
      );

      const dialog = createDialogWithCard(element);
      document.body.append(dialog);
      manager.elementConnected();

      fireFromDialog(dialog);

      expect(api.getViewManager().setViewByParameters).toBeCalledWith({
        params: { view: 'diagnostics' },
      });
    });

    it('resets to default view if already in diagnostics view', () => {
      const api = createCardAPI();
      const element = createCardHTMLElement();
      const manager = new CardElementManager(
        api,
        element,
        () => undefined,
        () => undefined,
      );

      vi.mocked(api.getViewManager().getView).mockReturnValue(
        new View({ view: 'diagnostics' }),
      );

      const dialog = createDialogWithCard(element);
      document.body.append(dialog);
      manager.elementConnected();

      fireFromDialog(dialog);

      expect(api.getViewManager().setViewDefault).toBeCalled();
    });

    it('does not set view to diagnostics if card is not in editor', () => {
      const api = createCardAPI();
      const element = createCardHTMLElement();
      const manager = new CardElementManager(
        api,
        element,
        () => undefined,
        () => undefined,
      );

      manager.elementConnected();

      // Event fired from a different dialog that does not contain the card
      const otherDialog = document.createElement('hui-dialog-edit-card');
      otherDialog.attachShadow({ mode: 'open' });
      document.body.append(otherDialog);
      fireFromDialog(otherDialog);

      expect(api.getViewManager().setViewByParameters).not.toBeCalled();
    });
  });
});
