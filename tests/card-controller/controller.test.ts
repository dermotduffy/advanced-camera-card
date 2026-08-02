import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';

import { CameraManager } from '../../src/camera-manager/manager';
import { ActionsManager } from '../../src/card-controller/actions/actions-manager';
import { AutomationsManager } from '../../src/card-controller/automations-manager';
import { CallManager } from '../../src/card-controller/call/manager';
import { CameraTriggersManager } from '../../src/card-controller/camera-triggers-manager';
import { CameraURLManager } from '../../src/card-controller/camera-url-manager';
import {
  CardElementManager,
  type CardHTMLElement,
} from '../../src/card-controller/card-element-manager';
import { ConfigManager } from '../../src/card-controller/config/config-manager';
import { CardController } from '../../src/card-controller/controller';
import { DefaultManager } from '../../src/card-controller/default-manager';
import { ExpandManager } from '../../src/card-controller/expand-manager';
import { FoldersManager } from '../../src/card-controller/folders/manager';
import { FullscreenManager } from '../../src/card-controller/fullscreen/fullscreen-manager';
import type { EventWatcherSubscriptionInterface } from '../../src/card-controller/hass/event-watcher';
import type { HASSManager } from '../../src/card-controller/hass/hass-manager';
import { InitializationManager } from '../../src/card-controller/initialization/initialization-manager';
import { InteractionManager } from '../../src/card-controller/interaction-manager';
import { IssueManager } from '../../src/card-controller/issues/issue-manager';
import { KeyboardStateManager } from '../../src/card-controller/keyboard-state-manager';
import { LockManager } from '../../src/card-controller/lock/manager';
import { MediaLoadedInfoManager } from '../../src/card-controller/media-info-manager';
import { MediaPlayerManager } from '../../src/card-controller/media-player-manager';
import { MicrophoneManager } from '../../src/card-controller/microphone-manager';
import { NotificationManager } from '../../src/card-controller/notification-manager';
import { PIPManager } from '../../src/card-controller/pip-manager';
import { QueryStringManager } from '../../src/card-controller/query-string-manager';
import { StatusBarItemManager } from '../../src/card-controller/status-bar-item-manager';
import { StyleManager } from '../../src/card-controller/style-manager';
import { TemplateManager } from '../../src/card-controller/templates';
import { ViewItemManager } from '../../src/card-controller/view/item-manager';
import { ViewManager } from '../../src/card-controller/view/view-manager';
import { ConditionStateManager } from '../../src/condition-trigger/conditions/state-manager';
import { AdvancedCameraCardEditor } from '../../src/editor';
import { DeviceRegistryManager } from '../../src/ha/registry/device';
import { EntityRegistryManagerLive } from '../../src/ha/registry/entity';
import { ResolvedMediaCache } from '../../src/ha/resolved-media';
import { createSubscriptionHealth } from './test-utils';

vi.mock('../../src/camera-manager/manager');
vi.mock('../../src/card-controller/actions/actions-manager');
vi.mock('../../src/card-controller/automations-manager');
vi.mock('../../src/card-controller/call/manager');
vi.mock('../../src/card-controller/camera-url-manager');
vi.mock('../../src/card-controller/card-element-manager');
vi.mock('../../src/card-controller/config/config-manager');
vi.mock('../../src/card-controller/default-manager');
vi.mock('../../src/card-controller/download-manager');
vi.mock('../../src/card-controller/expand-manager');
vi.mock('../../src/card-controller/folders/manager');
vi.mock('../../src/card-controller/fullscreen/fullscreen-manager');
vi.mock('../../src/card-controller/initialization/initialization-manager');
vi.mock('../../src/card-controller/interaction-manager');
vi.mock('../../src/card-controller/keyboard-state-manager');
vi.mock('../../src/card-controller/lock/manager');
vi.mock('../../src/card-controller/media-info-manager');
vi.mock('../../src/card-controller/media-player-manager');
vi.mock('../../src/card-controller/microphone-manager');
vi.mock('../../src/card-controller/notification-manager');
vi.mock('../../src/card-controller/pip-manager');
vi.mock('../../src/card-controller/issues/state-manager');
vi.mock('../../src/card-controller/issues/issue-manager');
vi.mock('../../src/card-controller/query-string-manager');
vi.mock('../../src/card-controller/status-bar-item-manager');
vi.mock('../../src/card-controller/style-manager');
vi.mock('../../src/card-controller/templates');
vi.mock('../../src/card-controller/camera-triggers-manager');
vi.mock('../../src/card-controller/view/item-manager');
vi.mock('../../src/card-controller/view/view-manager');
vi.mock('../../src/condition-trigger/conditions/state-manager');
vi.mock('../../src/ha/registry/device');
vi.mock('../../src/ha/registry/entity');
vi.mock('../../src/ha/resolved-media');

const createCardElement = (): CardHTMLElement => {
  const element = document.createElement('div') as unknown as CardHTMLElement;
  element.addController = vi.fn();
  return element;
};

// Full HASSManager mock for CardController ctor injection (wires
// getEventWatcher().getHealth() so construction resolves). Distinct from the
// readonly-interface `createHASSManager` helper in tests/test-utils.ts.
const createMockHASSManager = (): MockProxy<HASSManager> => {
  const hassManager = mock<HASSManager>();
  hassManager.getEventWatcher.mockReturnValue(
    mock<EventWatcherSubscriptionInterface>({
      getHealth: () => createSubscriptionHealth(),
    }),
  );
  return hassManager;
};

const createController = (hassManager = createMockHASSManager()): CardController => {
  return new CardController(createCardElement(), vi.fn(), vi.fn(), hassManager);
};

// @vitest-environment jsdom
describe('CardController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should construct correctly', () => {
    const element = createCardElement();
    const scrollCallback = vi.fn();
    const menuToggleCallback = vi.fn();

    const controller = new CardController(element, scrollCallback, menuToggleCallback);

    expect(CardElementManager).toHaveBeenCalledWith(
      controller,
      element,
      scrollCallback,
      menuToggleCallback,
    );
    expect(controller.getEffectsManager()).toBeTruthy();
  });

  it('should wire ConditionStateManager as the first hass listener so semantic state is fresh before any other listener runs', () => {
    const hassManager = createMockHASSManager();
    createController(hassManager);

    const calls = vi.mocked(hassManager.addListener).mock.calls;

    // ConditionStateManager (CSM) first ordering is load-bearing: StateWatcher
    // lazy-attaches later; its diff handlers can synchronously write to CSM, so
    // CSM.hass must be fresh before any listener whose dispatch path reads
    // condition state.
    expect(calls).toHaveLength(1);

    const csmListener = calls[0][0];
    const hass = {} as Parameters<typeof csmListener>[0];
    csmListener(hass, null);
    expect(
      vi.mocked(ConditionStateManager).mock.instances[0].setState,
    ).toHaveBeenCalledWith({
      hass,
    });
  });

  describe('accessors', () => {
    it('should return getActionsManager', () => {
      expect(createController().getActionsManager()).toBe(
        vi.mocked(ActionsManager).mock.instances[0],
      );
    });

    it('should return getAutomationsManager', () => {
      expect(createController().getAutomationsManager()).toBe(
        vi.mocked(AutomationsManager).mock.instances[0],
      );
    });

    it('should return getCallManager', () => {
      expect(createController().getCallManager()).toBe(
        vi.mocked(CallManager).mock.instances[0],
      );
    });

    it('should return getDefaultManager', () => {
      expect(createController().getDefaultManager()).toBe(
        vi.mocked(DefaultManager).mock.instances[0],
      );
    });

    it('should return getCameraManager', () => {
      expect(createController().getCameraManager()).toBe(
        vi.mocked(CameraManager).mock.instances[0],
      );
    });

    it('should return getCameraURLManager', () => {
      expect(createController().getCameraURLManager()).toBe(
        vi.mocked(CameraURLManager).mock.instances[0],
      );
    });

    it('should return getCardElementManager', () => {
      expect(createController().getCardElementManager()).toBe(
        vi.mocked(CardElementManager).mock.instances[0],
      );
    });

    it('should return ConditionStateManager', () => {
      expect(createController().getConditionStateManager()).toBe(
        vi.mocked(ConditionStateManager).mock.instances[0],
      );
    });

    it('should return getConfigElement', async () => {
      expect(
        (await CardController.getConfigElement()) instanceof AdvancedCameraCardEditor,
      );
    });

    it('should return getConfigManager', () => {
      expect(createController().getConfigManager()).toBe(
        vi.mocked(ConfigManager).mock.instances[0],
      );
    });

    it('should return getDeviceRegistryManager', () => {
      expect(createController().getDeviceRegistryManager()).toBe(
        vi.mocked(DeviceRegistryManager).mock.instances[0],
      );
    });

    it('should return getEntityRegistryManager', () => {
      expect(createController().getEntityRegistryManager()).toBe(
        vi.mocked(EntityRegistryManagerLive).mock.instances[0],
      );
    });

    it('should return getExpandManager', () => {
      expect(createController().getExpandManager()).toBe(
        vi.mocked(ExpandManager).mock.instances[0],
      );
    });

    it('should return getFoldersManager', () => {
      expect(createController().getFoldersManager()).toBe(
        vi.mocked(FoldersManager).mock.instances[0],
      );
    });

    it('should return getFullscreenManager', () => {
      expect(createController().getFullscreenManager()).toBe(
        vi.mocked(FullscreenManager).mock.instances[0],
      );
    });

    it('should return getHASSManager', () => {
      const hassManager = createMockHASSManager();
      expect(createController(hassManager).getHASSManager()).toBe(hassManager);
    });

    it('should return getInitializationManager', () => {
      expect(createController().getInitializationManager()).toBe(
        vi.mocked(InitializationManager).mock.instances[0],
      );
    });

    it('should return getInteractionManager', () => {
      expect(createController().getInteractionManager()).toBe(
        vi.mocked(InteractionManager).mock.instances[0],
      );
    });

    it('should return getKeyboardStateManager', () => {
      expect(createController().getKeyboardStateManager()).toBe(
        vi.mocked(KeyboardStateManager).mock.instances[0],
      );
    });

    it('should return getLockManager', () => {
      expect(createController().getLockManager()).toBe(
        vi.mocked(LockManager).mock.instances[0],
      );
    });

    it('should return getMediaLoadedInfoManager', () => {
      expect(createController().getMediaLoadedInfoManager()).toBe(
        vi.mocked(MediaLoadedInfoManager).mock.instances[0],
      );
    });

    it('should return getMediaPlayerManager', () => {
      expect(createController().getMediaPlayerManager()).toBe(
        vi.mocked(MediaPlayerManager).mock.instances[0],
      );
    });

    it('should return getNotificationManager', () => {
      expect(createController().getNotificationManager()).toBe(
        vi.mocked(NotificationManager).mock.instances[0],
      );
    });

    it('should return getPIPManager', () => {
      expect(createController().getPIPManager()).toBe(
        vi.mocked(PIPManager).mock.instances[0],
      );
    });

    it('should return getIssueManager', () => {
      expect(createController().getIssueManager()).toBe(
        vi.mocked(IssueManager).mock.instances[0],
      );
    });

    it('should return getMicrophoneManager', () => {
      expect(createController().getMicrophoneManager()).toBe(
        vi.mocked(MicrophoneManager).mock.instances[0],
      );
    });

    it('should return getResolvedMediaCache', () => {
      expect(createController().getResolvedMediaCache()).toBe(
        vi.mocked(ResolvedMediaCache).mock.instances[0],
      );
    });

    it('should return getQueryStringManager', () => {
      expect(createController().getQueryStringManager()).toBe(
        vi.mocked(QueryStringManager).mock.instances[0],
      );
    });

    it('should return getStatusBarItemManager', () => {
      expect(createController().getStatusBarItemManager()).toBe(
        vi.mocked(StatusBarItemManager).mock.instances[0],
      );
    });

    it('should return getStyleManager', () => {
      expect(createController().getStyleManager()).toBe(
        vi.mocked(StyleManager).mock.instances[0],
      );
    });

    it('should return getTemplateManager', () => {
      expect(createController().getTemplateManager()).toBe(
        vi.mocked(TemplateManager).mock.instances[0],
      );
    });

    it('should return getCameraTriggersManager', () => {
      expect(createController().getCameraTriggersManager()).toBe(
        vi.mocked(CameraTriggersManager).mock.instances[0],
      );
    });

    it('should return getViewItemManager', () => {
      expect(createController().getViewItemManager()).toBe(
        vi.mocked(ViewItemManager).mock.instances[0],
      );
    });

    it('should return getViewManager', () => {
      expect(createController().getViewManager()).toBe(
        vi.mocked(ViewManager).mock.instances[0],
      );
    });
  });

  describe('creaters ', () => {
    it('should create createCameraManager', () => {
      const controller = createController();
      const original = controller.getCameraManager();

      controller.createCameraManager();

      expect(controller.getCameraManager()).not.toBe(original);
    });

    it('should create createMicrophoneManager', () => {
      const controller = createController();
      const original = controller.getMicrophoneManager();

      controller.createMicrophoneManager();

      expect(controller.getMicrophoneManager()).not.toBe(original);
    });
  });

  describe('handlers', () => {
    it('should handle hostConnected', () => {
      createController().hostConnected();
      expect(
        vi.mocked(CardElementManager).mock.instances[0].elementConnected,
      ).toHaveBeenCalled();
    });

    it('should handle hostDisconnected', () => {
      createController().hostDisconnected();
      expect(
        vi.mocked(CardElementManager).mock.instances[0].elementDisconnected,
      ).toHaveBeenCalled();
    });
  });
});
