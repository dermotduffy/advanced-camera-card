import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CameraManager } from '../../src/camera-manager/manager';
import { ActionsManager } from '../../src/card-controller/actions/actions-manager';
import { AutomationsManager } from '../../src/card-controller/automations-manager';
import { CameraURLManager } from '../../src/card-controller/camera-url-manager';
import {
  CardElementManager,
  CardHTMLElement,
} from '../../src/card-controller/card-element-manager';
import { ConfigManager } from '../../src/card-controller/config/config-manager';
import { CardController } from '../../src/card-controller/controller';
import { DefaultManager } from '../../src/card-controller/default-manager';
import { ExpandManager } from '../../src/card-controller/expand-manager';
import { FoldersManager } from '../../src/card-controller/folders/manager';
import { FullscreenManager } from '../../src/card-controller/fullscreen/fullscreen-manager';
import { HASSManager } from '../../src/card-controller/hass/hass-manager';
import { InitializationManager } from '../../src/card-controller/initialization-manager';
import { InteractionManager } from '../../src/card-controller/interaction-manager';
import { IssueManager } from '../../src/card-controller/issues/issue-manager';
import { KeyboardStateManager } from '../../src/card-controller/keyboard-state-manager';
import { MediaLoadedInfoManager } from '../../src/card-controller/media-info-manager';
import { MediaPlayerManager } from '../../src/card-controller/media-player-manager';
import { MicrophoneManager } from '../../src/card-controller/microphone-manager';
import { NotificationManager } from '../../src/card-controller/notification-manager';
import { PIPManager } from '../../src/card-controller/pip-manager';
import { QueryStringManager } from '../../src/card-controller/query-string-manager';
import { StatusBarItemManager } from '../../src/card-controller/status-bar-item-manager';
import { StyleManager } from '../../src/card-controller/style-manager';
import { TriggersManager } from '../../src/card-controller/triggers-manager';
import { ViewItemManager } from '../../src/card-controller/view/item-manager';
import { ViewManager } from '../../src/card-controller/view/view-manager';
import { ConditionStateManager } from '../../src/conditions/state-manager';
import { AdvancedCameraCardEditor } from '../../src/editor';
import { DeviceRegistryManager } from '../../src/ha/registry/device';
import { EntityRegistryManagerLive } from '../../src/ha/registry/entity';
import { ResolvedMediaCache } from '../../src/ha/resolved-media';

vi.mock('../../src/camera-manager/manager');
vi.mock('../../src/card-controller/actions/actions-manager');
vi.mock('../../src/card-controller/automations-manager');
vi.mock('../../src/card-controller/camera-url-manager');
vi.mock('../../src/card-controller/card-element-manager');
vi.mock('../../src/card-controller/config/config-manager');
vi.mock('../../src/card-controller/default-manager');
vi.mock('../../src/card-controller/download-manager');
vi.mock('../../src/card-controller/expand-manager');
vi.mock('../../src/card-controller/folders/manager');
vi.mock('../../src/card-controller/fullscreen/fullscreen-manager');
vi.mock('../../src/card-controller/hass/hass-manager');
vi.mock('../../src/card-controller/initialization-manager');
vi.mock('../../src/card-controller/interaction-manager');
vi.mock('../../src/card-controller/keyboard-state-manager');
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
vi.mock('../../src/card-controller/triggers-manager');
vi.mock('../../src/card-controller/view/item-manager');
vi.mock('../../src/card-controller/view/view-manager');
vi.mock('../../src/conditions/state-manager');
vi.mock('../../src/ha/registry/device');
vi.mock('../../src/ha/registry/entity');
vi.mock('../../src/ha/resolved-media');

const createCardElement = (): CardHTMLElement => {
  const element = document.createElement('div') as unknown as CardHTMLElement;
  element.addController = vi.fn();
  return element;
};

const createController = (): CardController => {
  return new CardController(createCardElement(), vi.fn(), vi.fn());
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

    expect(CardElementManager).toBeCalledWith(
      controller,
      element,
      scrollCallback,
      menuToggleCallback,
    );
    expect(controller.getEffectsManager()).toBeTruthy();
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
      expect(createController().getHASSManager()).toBe(
        vi.mocked(HASSManager).mock.instances[0],
      );
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

    describe('getStubConfig', () => {
      it('should handle with camera entities', () => {
        expect(
          CardController.getStubConfig(['camera.office', 'binary_sensor.motion']),
        ).toEqual({
          cameras: [{ camera_entity: 'camera.office' }],
        });
      });

      it('should handle without camera entities', () => {
        expect(CardController.getStubConfig(['binary_sensor.motion'])).toEqual({
          cameras: [{ camera_entity: 'camera.demo' }],
        });
      });
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

    it('should return getTriggersManager', () => {
      expect(createController().getTriggersManager()).toBe(
        vi.mocked(TriggersManager).mock.instances[0],
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
      ).toBeCalled();
    });

    it('should handle hostDisconnected', () => {
      createController().hostDisconnected();
      expect(
        vi.mocked(CardElementManager).mock.instances[0].elementDisconnected,
      ).toBeCalled();
    });
  });
});
