import { afterEach, assert, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { CardElementManager } from '../../src/card-controller/card-element-manager';
import type { StateWatcher } from '../../src/card-controller/hass/state-watcher';
import { InitializationAspect } from '../../src/card-controller/initialization/initialization-manager';
import { QueryResults } from '../../src/view/query-results';
import { View } from '../../src/view/view';
import { createConfig } from '../config/test-utils';
import {
  callStateWatcherCallback,
  createCardAPI,
  createCardHTMLElement,
  createStateEntity,
} from '../test-utils';
import { createView, TestViewMedia } from '../view/test-utils';

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

  it('should report whether the element is connected', () => {
    const element = createCardHTMLElement();
    const manager = new CardElementManager(
      createCardAPI(),
      element,
      () => undefined,
      () => undefined,
    );

    expect(manager.isConnected()).toBe(false);

    document.body.append(element);
    expect(manager.isConnected()).toBe(true);

    element.remove();
    expect(manager.isConnected()).toBe(false);
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

    expect(callback).toHaveBeenCalled();
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

    expect(callback).toHaveBeenCalled();
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
    expect(element.requestUpdate).toHaveBeenCalled();
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
    expect(element.getAttribute('tabindex')).toBe('0');
    expect(api.getFullscreenManager().connect).toHaveBeenCalled();

    expect(addEventListener).toHaveBeenCalledWith(
      'mousemove',
      api.getInteractionManager().reportInteraction,
    );
    expect(addEventListener).toHaveBeenCalledWith(
      'll-custom',
      api.getActionsManager().handleCustomActionEvent,
    );
    expect(addEventListener).toHaveBeenCalledWith(
      'action',
      api.getActionsManager().handleInteractionEvent,
    );
    expect(addEventListener).toHaveBeenCalledWith(
      'action',
      api.getInteractionManager().reportInteraction,
    );
    expect(addEventListener).toHaveBeenCalledWith(
      'touchstart',
      api.getInteractionManager().reportInteraction,
    );
    expect(addEventListener).toHaveBeenCalledWith(
      'touchmove',
      api.getInteractionManager().reportInteraction,
    );
    expect(windowAddEventListener).toHaveBeenCalledWith(
      'location-changed',
      expect.anything(),
    );
    expect(windowAddEventListener).toHaveBeenCalledWith('popstate', expect.anything());
    expect(windowAddEventListener).toHaveBeenCalledWith(
      'advanced-camera-card:editor:diagnostics',
      expect.anything(),
    );

    expect(api.getInteractionManager().initialize).toHaveBeenCalled();
    expect(api.getFullscreenManager().initialize).toHaveBeenCalled();
    expect(api.getExpandManager().initialize).toHaveBeenCalled();
    expect(api.getMediaLoadedInfoManager().initialize).toHaveBeenCalled();
    expect(api.getMicrophoneManager().initialize).toHaveBeenCalled();
    expect(api.getCallManager().initialize).toHaveBeenCalled();
  });

  it('should disconnect', () => {
    const windowRemoveEventListener = vi.spyOn(global.window, 'removeEventListener');

    const element = createCardHTMLElement();
    element.setAttribute('panel', '');
    element.setAttribute('casted', '');
    element.setAttribute('tabindex', '0');

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
    expect(element.getAttribute('tabindex')).toBeNull();
    expect(api.getMediaLoadedInfoManager().clear).toHaveBeenCalled();
    expect(api.getFullscreenManager().disconnect).toHaveBeenCalled();

    expect(removeEventListener).toHaveBeenCalledWith(
      'mousemove',
      api.getInteractionManager().reportInteraction,
    );
    expect(removeEventListener).toHaveBeenCalledWith(
      'll-custom',
      api.getActionsManager().handleCustomActionEvent,
    );
    expect(removeEventListener).toHaveBeenCalledWith(
      'action',
      api.getActionsManager().handleInteractionEvent,
    );
    expect(removeEventListener).toHaveBeenCalledWith(
      'action',
      api.getInteractionManager().reportInteraction,
    );
    expect(removeEventListener).toHaveBeenCalledWith(
      'touchstart',
      api.getInteractionManager().reportInteraction,
    );
    expect(removeEventListener).toHaveBeenCalledWith(
      'touchmove',
      api.getInteractionManager().reportInteraction,
    );
    expect(windowRemoveEventListener).toHaveBeenCalledWith(
      'location-changed',
      expect.anything(),
    );
    expect(windowRemoveEventListener).toHaveBeenCalledWith(
      'popstate',
      expect.anything(),
    );
    expect(windowRemoveEventListener).toHaveBeenCalledWith(
      'advanced-camera-card:editor:diagnostics',
      expect.anything(),
    );

    expect(api.getMediaLoadedInfoManager().clear).toHaveBeenCalled();
    expect(api.getFullscreenManager().disconnect).toHaveBeenCalled();
    expect(api.getKeyboardStateManager().uninitialize).toHaveBeenCalled();
    expect(api.getActionsManager().uninitialize).toHaveBeenCalled();
    expect(api.getCallManager().uninitialize).toHaveBeenCalled();
    expect(api.getInitializationManager().invalidateAspect).toHaveBeenCalledWith(
      InitializationAspect.CAMERAS,
    );
    expect(api.getInitializationManager().invalidateAspect).toHaveBeenCalledWith(
      InitializationAspect.INITIAL_TRIGGER,
    );
    expect(api.getInitializationManager().getSessionManager().end).toHaveBeenCalled();
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

      expect(element.requestUpdate).toHaveBeenCalled();
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

      expect(element.requestUpdate).toHaveBeenCalled();
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

      expect(element.requestUpdate).toHaveBeenCalled();
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
      expect(element.requestUpdate).not.toHaveBeenCalled();
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

      expect(api.getViewManager().setViewByParameters).toHaveBeenCalledWith({
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
      vi.mocked(api.getViewManager().canSetViewDefault).mockReturnValue(true);

      const dialog = createDialogWithCard(element);
      document.body.append(dialog);
      manager.elementConnected();

      fireFromDialog(dialog);

      expect(api.getViewManager().setViewDefault).toHaveBeenCalled();
    });

    it('should reset the view when leaving diagnostics with no default view available', () => {
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
      vi.mocked(api.getViewManager().canSetViewDefault).mockReturnValue(false);

      const dialog = createDialogWithCard(element);
      document.body.append(dialog);
      manager.elementConnected();

      fireFromDialog(dialog);

      expect(api.getViewManager().reset).toHaveBeenCalled();
      expect(api.getViewManager().setViewDefault).not.toHaveBeenCalled();
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

      expect(api.getViewManager().setViewByParameters).not.toHaveBeenCalled();
    });
  });
});
