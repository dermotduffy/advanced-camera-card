import type { StyleInfo } from 'lit/directives/style-map.js';

import type { CameraManager } from '../camera-manager/manager';
import type { CallManager } from '../card-controller/call/manager';
import type { FoldersManager } from '../card-controller/folders/manager';
import type { FullscreenManager } from '../card-controller/fullscreen/fullscreen-manager';
import type { MediaPlayerManager } from '../card-controller/media-player-manager';
import type { MicrophoneManager } from '../card-controller/microphone-manager';
import type { PIPManager } from '../card-controller/pip-manager';
import type { ViewItemManager } from '../card-controller/view/item-manager';
import type { ViewManager } from '../card-controller/view/view-manager';
import {
  VIEWS_USER_SPECIFIED,
  type AdvancedCameraCardView,
} from '../config/schema/common/const';
import type { MenuItem } from '../config/schema/elements/custom/menu/types';
import type { AdvancedCameraCardConfig } from '../config/schema/types';
import { getEntityTitle } from '../ha/get-entity-title';
import type { HomeAssistant } from '../ha/types';
import { localize } from '../localize/localize.js';
import type { MediaLoadedInfo } from '../types';
import {
  createCallAnswerAction,
  createCallEndAction,
  createCallStartAction,
  createCameraAction,
  createDisplayModeAction,
  createGeneralAction,
  createMediaPlayerAction,
  createPTZControlsAction,
  createPTZMultiAction,
  createSetReviewAction,
  createSubstreamOffAction,
  createSubstreamOnAction,
  createViewAction,
  isAdvancedCameraCardCustomAction,
} from '../utils/action';
import { arrayify, isTruthy } from '../utils/basic';
import { isBeingCasted } from '../utils/casting';
import { getPTZTarget } from '../utils/ptz';
import { ViewItemClassifier } from '../view/item-classifier';
import { getStreamCameraID, hasSubstream } from '../view/substream';
import { resolveViewName } from '../view/utils/resolve-default';
import type { View } from '../view/view';
import {
  getCameraIDsWithCapabilityForView,
  isViewSupported,
} from '../view/view-support';

type MenuButtonName = keyof AdvancedCameraCardConfig['menu']['buttons'];

const MENU_BUTTON_DETAILS: Record<
  MenuButtonName,
  { icon: string; localizationKey: string }
> = {
  call: { icon: 'mdi:phone', localizationKey: 'config.live.controls.call.start' },
  camera_ui: { icon: 'mdi:web', localizationKey: 'config.menu.buttons.camera_ui' },
  cameras: { icon: 'mdi:video-switch', localizationKey: 'config.menu.buttons.cameras' },
  clips: { icon: 'mdi:filmstrip', localizationKey: 'config.view.views.clips' },
  display_mode: { icon: 'mdi:grid', localizationKey: 'display_modes.grid' },
  download: { icon: 'mdi:download', localizationKey: 'config.menu.buttons.download' },
  expand: {
    icon: 'mdi:arrow-expand-all',
    localizationKey: 'config.menu.buttons.expand',
  },
  folders: {
    icon: 'mdi:folder-multiple',
    localizationKey: 'config.menu.buttons.folders',
  },
  fullscreen: {
    icon: 'mdi:fullscreen',
    localizationKey: 'config.menu.buttons.fullscreen',
  },
  gallery: {
    icon: 'mdi:play-box-multiple',
    localizationKey: 'config.menu.buttons.gallery',
  },
  image: { icon: 'mdi:image', localizationKey: 'config.view.views.image' },
  info: { icon: 'mdi:information-outline', localizationKey: 'config.menu.buttons.info' },
  iris: {
    icon: 'advanced-camera-card:iris',
    localizationKey: 'config.menu.buttons.iris',
  },
  live: { icon: 'mdi:cctv', localizationKey: 'config.view.views.live' },
  media_player: {
    icon: 'mdi:cast',
    localizationKey: 'config.menu.buttons.media_player',
  },
  microphone: {
    icon: 'mdi:microphone-off',
    localizationKey: 'config.menu.buttons.microphone',
  },
  mute: { icon: 'mdi:volume-off', localizationKey: 'config.menu.buttons.mute' },
  pip: {
    icon: 'mdi:picture-in-picture-bottom-right',
    localizationKey: 'config.menu.buttons.pip',
  },
  play: { icon: 'mdi:play', localizationKey: 'config.menu.buttons.play' },
  ptz_controls: { icon: 'mdi:pan', localizationKey: 'config.menu.buttons.ptz_controls' },
  ptz_home: { icon: 'mdi:home', localizationKey: 'config.menu.buttons.ptz_home' },
  recordings: { icon: 'mdi:album', localizationKey: 'config.view.views.recordings' },
  reviews: {
    icon: 'mdi:play-box-edit-outline',
    localizationKey: 'config.view.views.reviews',
  },
  screenshot: {
    icon: 'mdi:monitor-screenshot',
    localizationKey: 'config.menu.buttons.screenshot',
  },
  set_review: {
    icon: 'mdi:check-circle-outline',
    localizationKey: 'common.set_reviews.reviewed',
  },
  snapshots: { icon: 'mdi:camera', localizationKey: 'config.view.views.snapshots' },
  substreams: {
    icon: 'mdi:video-input-component',
    localizationKey: 'config.menu.buttons.substreams',
  },
  timeline: { icon: 'mdi:chart-gantt', localizationKey: 'config.view.views.timeline' },
};

const isMenuButtonName = (name: string): name is MenuButtonName =>
  name in MENU_BUTTON_DETAILS;

export interface MenuButtonControllerOptions {
  callManager?: CallManager | null;
  currentMediaLoadedInfo?: MediaLoadedInfo | null;
  showCameraUIButton?: boolean;
  fullscreenManager?: FullscreenManager | null;
  inExpandedMode?: boolean;
  microphoneManager?: MicrophoneManager | null;
  mediaPlayerController?: MediaPlayerManager | null;
  pipManager?: PIPManager | null;
  viewItemManager?: ViewItemManager | null;
  viewManager?: ViewManager | null;
  view?: View | null;
}

export class MenuButtonController {
  // Array of dynamic menu buttons to be added to menu.
  private _dynamicMenuButtons: MenuItem[] = [];

  public addDynamicMenuButton(button: MenuItem): void {
    if (!this._dynamicMenuButtons.includes(button)) {
      this._dynamicMenuButtons.push(button);
    }
  }

  public removeDynamicMenuButton(button: MenuItem): void {
    this._dynamicMenuButtons = this._dynamicMenuButtons.filter(
      (existingButton) => existingButton != button,
    );
  }

  /**
   * Get the menu buttons to display.
   * @returns An array of menu buttons.
   */
  public calculateButtons(
    hass: HomeAssistant,
    config: AdvancedCameraCardConfig,
    cameraManager: CameraManager,
    foldersManager: FoldersManager,
    options?: MenuButtonControllerOptions,
  ): MenuItem[] {
    const builtInButtons: Record<MenuButtonName, MenuItem | null> = {
      iris: this._getIrisButton(config),
      cameras: this._getCamerasButton(config, cameraManager, options?.view),
      substreams: this._getSubstreamsButton(config, cameraManager, options?.view),
      live: this._getLiveButton(config, cameraManager, foldersManager, options?.view),
      clips: this._getClipsButton(config, cameraManager, foldersManager, options?.view),
      snapshots: this._getSnapshotsButton(
        config,
        cameraManager,
        foldersManager,
        options?.view,
      ),
      recordings: this._getRecordingsButton(
        config,
        cameraManager,
        foldersManager,
        options?.view,
      ),
      reviews: this._getReviewsButton(
        config,
        cameraManager,
        foldersManager,
        options?.view,
      ),
      gallery: this._getGalleryButton(
        config,
        cameraManager,
        foldersManager,
        options?.view,
      ),
      image: this._getImageButton(config, cameraManager, foldersManager, options?.view),
      timeline: this._getTimelineButton(
        config,
        cameraManager,
        foldersManager,
        options?.view,
      ),
      download: this._getDownloadButton(config, options?.viewItemManager, options?.view),
      info: this._getInfoButton(config, cameraManager, options?.view),
      set_review: this._getSetReviewButton(config, options?.view),
      camera_ui: this._getCameraUIButton(config, options?.showCameraUIButton),
      call: this._getCallButton(
        config,
        cameraManager,
        options?.callManager,
        options?.view,
      ),
      microphone: this._getMicrophoneButton(
        config,
        cameraManager,
        options?.view,
        options?.microphoneManager,
        options?.callManager,
      ),
      expand: this._getExpandButton(config, options?.inExpandedMode),
      fullscreen: this._getFullscreenButton(config, options?.fullscreenManager),
      pip: this._getPIPButton(config, options?.pipManager),
      media_player: this._getCastButton(
        hass,
        config,
        cameraManager,
        options?.view,
        options?.mediaPlayerController,
      ),
      play: this._getPlayPauseButton(config, options?.currentMediaLoadedInfo),
      mute: this._getMuteUnmuteButton(config, options?.currentMediaLoadedInfo),
      screenshot: this._getScreenshotButton(config, options?.currentMediaLoadedInfo),
      display_mode: this._getDisplayModeButton(
        config,
        cameraManager,
        foldersManager,
        options?.view,
      ),
      ptz_controls: this._getPTZControlsButton(config, cameraManager, options?.view),
      ptz_home: this._getPTZHomeButton(config, cameraManager, options?.view),
      folders: this._getFoldersButton(config, foldersManager, options?.view),
    };

    const buttons: MenuItem[] = [
      ...Object.keys(builtInButtons)
        .filter(isMenuButtonName)
        .map((name) => this._orUnavailable(config, name, builtInButtons[name])),

      ...this._dynamicMenuButtons.map((button) => ({
        ...button,
        style: this._getStyle(
          button,
          this._getStyleFromActions(
            config,
            cameraManager,
            foldersManager,
            button,
            options,
          ),
        ),
      })),
    ].filter(isTruthy);

    return buttons;
  }

  /**
   * Get the button, or an inert placeholder for an unavailable button
   * configured with `unavailable: inert`.
   * @param config The card configuration.
   * @param name The button's name in `menu.buttons`.
   * @param button The button, or null when it is unavailable.
   * @returns The button, the inert placeholder, or null.
   */
  private _orUnavailable(
    config: AdvancedCameraCardConfig,
    name: MenuButtonName,
    button: MenuItem | null,
  ): MenuItem | null {
    const buttonConfig = config.menu.buttons[name];
    return button || buttonConfig.unavailable !== 'inert'
      ? button
      : {
          icon: MENU_BUTTON_DETAILS[name].icon,
          ...buttonConfig,
          type: 'custom:advanced-camera-card-menu-icon',
          title: localize(MENU_BUTTON_DETAILS[name].localizationKey),
          inert: true,
        };
  }

  private _getIrisButton(config: AdvancedCameraCardConfig): MenuItem {
    return {
      icon: MENU_BUTTON_DETAILS.iris.icon,
      ...config.menu.buttons.iris,
      type: 'custom:advanced-camera-card-menu-icon',
      title: localize(MENU_BUTTON_DETAILS.iris.localizationKey),
      // The default button always shows regardless of whether the menu is
      // hidden or not.
      permanent: true,
      tap_action:
        config.menu?.style === 'hidden'
          ? createGeneralAction('menu_toggle')
          : createGeneralAction('default'),
      hold_action: createViewAction('diagnostics'),
    };
  }

  private _getCamerasButton(
    config: AdvancedCameraCardConfig,
    cameraManager: CameraManager,
    view?: View | null,
  ): MenuItem | null {
    // Show all cameras in the menu rather than just cameras that support the
    // current view for a less surprising UX.
    const menuCameraIDs = cameraManager.getStore().getCameraIDsWithCapability('menu');
    if (menuCameraIDs.size > 1) {
      const submenuItems = Array.from(menuCameraIDs, (cameraID) => {
        const metadata = cameraManager.getCameraMetadata(cameraID);

        return {
          enabled: true,
          icon: metadata?.icon.icon,
          entity: metadata?.icon.entity,
          state_color: true,
          title: metadata?.title,
          selected: view?.camera === cameraID,
          tap_action: createCameraAction(cameraID),
        };
      });

      return {
        icon: MENU_BUTTON_DETAILS.cameras.icon,
        ...config.menu.buttons.cameras,
        type: 'custom:advanced-camera-card-menu-submenu',
        title: localize(MENU_BUTTON_DETAILS.cameras.localizationKey),
        items: submenuItems,
      };
    }
    return null;
  }

  private _getSubstreamsButton(
    config: AdvancedCameraCardConfig,
    cameraManager: CameraManager,
    view?: View | null,
  ): MenuItem | null {
    if (!view?.camera) {
      return null;
    }

    const substreamCameraIDs = cameraManager
      .getStore()
      .getAllDependentCameras(view.camera, 'substream');

    if (substreamCameraIDs.size && view.is('live')) {
      const substreams = Array.from(substreamCameraIDs).filter(
        (cameraID) => cameraID !== view.camera,
      );
      const streams = [view.camera, ...substreams];
      const substreamAwareCameraID = getStreamCameraID(view);

      if (streams.length === 2) {
        // If there are only two dependencies (the main camera, and 1 other)
        // then use a button not a menu to toggle.
        return {
          icon: MENU_BUTTON_DETAILS.substreams.icon,
          title: localize(MENU_BUTTON_DETAILS.substreams.localizationKey),
          ...config.menu.buttons.substreams,
          style: this._getStyle(
            config.menu.buttons.substreams,
            substreamAwareCameraID !== view.camera
              ? this._getEmphasizedStyle()
              : undefined,
          ),
          type: 'custom:advanced-camera-card-menu-icon',
          tap_action: hasSubstream(view)
            ? createSubstreamOffAction()
            : createSubstreamOnAction(),
        };
      } else if (streams.length > 2) {
        const menuItems = Array.from(streams, (streamID) => {
          const metadata = cameraManager.getCameraMetadata(streamID) ?? undefined;
          return {
            enabled: true,
            icon: metadata?.icon.icon,
            entity: metadata?.icon.entity,
            state_color: true,
            title: metadata?.title,
            selected: substreamAwareCameraID === streamID,
            tap_action: createSubstreamOnAction({ stream: streamID }),
          };
        });

        return {
          icon: MENU_BUTTON_DETAILS.substreams.icon,
          title: localize(MENU_BUTTON_DETAILS.substreams.localizationKey),
          ...config.menu.buttons.substreams,
          style: this._getStyle(
            config.menu.buttons.substreams,
            substreamAwareCameraID !== view.camera
              ? this._getEmphasizedStyle()
              : undefined,
          ),
          type: 'custom:advanced-camera-card-menu-submenu',
          items: menuItems,
        };
      }
    }
    return null;
  }

  private _getLiveButton(
    config: AdvancedCameraCardConfig,
    cameraManager: CameraManager,
    foldersManager: FoldersManager,
    view?: View | null,
  ): MenuItem | null {
    return isViewSupported('live', cameraManager, foldersManager, view?.camera)
      ? {
          icon: MENU_BUTTON_DETAILS.live.icon,
          ...config.menu.buttons.live,
          type: 'custom:advanced-camera-card-menu-icon',
          title: localize(MENU_BUTTON_DETAILS.live.localizationKey),
          style: this._getStyle(
            config.menu.buttons.live,
            view?.is('live') ? this._getEmphasizedStyle() : undefined,
          ),
          tap_action: createViewAction('live'),
        }
      : null;
  }

  private _getClipsButton(
    config: AdvancedCameraCardConfig,
    cameraManager: CameraManager,
    foldersManager: FoldersManager,
    view?: View | null,
  ): MenuItem | null {
    return isViewSupported('clips', cameraManager, foldersManager, view?.camera)
      ? {
          icon: MENU_BUTTON_DETAILS.clips.icon,
          ...config.menu.buttons.clips,
          type: 'custom:advanced-camera-card-menu-icon',
          title: localize(MENU_BUTTON_DETAILS.clips.localizationKey),
          style: this._getStyle(
            config.menu.buttons.clips,
            view?.is('clips') ? this._getEmphasizedStyle() : undefined,
          ),
          tap_action: createViewAction('clips'),
          hold_action: createViewAction('clip'),
        }
      : null;
  }

  private _getSnapshotsButton(
    config: AdvancedCameraCardConfig,
    cameraManager: CameraManager,
    foldersManager: FoldersManager,
    view?: View | null,
  ): MenuItem | null {
    return isViewSupported('snapshots', cameraManager, foldersManager, view?.camera)
      ? {
          icon: MENU_BUTTON_DETAILS.snapshots.icon,
          ...config.menu.buttons.snapshots,
          type: 'custom:advanced-camera-card-menu-icon',
          title: localize(MENU_BUTTON_DETAILS.snapshots.localizationKey),
          style: this._getStyle(
            config.menu.buttons.snapshots,
            view?.is('snapshots') ? this._getEmphasizedStyle() : undefined,
          ),
          tap_action: createViewAction('snapshots'),
          hold_action: createViewAction('snapshot'),
        }
      : null;
  }

  private _getRecordingsButton(
    config: AdvancedCameraCardConfig,
    cameraManager: CameraManager,
    foldersManager: FoldersManager,
    view?: View | null,
  ): MenuItem | null {
    return isViewSupported('recordings', cameraManager, foldersManager, view?.camera)
      ? {
          icon: MENU_BUTTON_DETAILS.recordings.icon,
          ...config.menu.buttons.recordings,
          type: 'custom:advanced-camera-card-menu-icon',
          title: localize(MENU_BUTTON_DETAILS.recordings.localizationKey),
          style: this._getStyle(
            config.menu.buttons.recordings,
            view?.is('recordings') ? this._getEmphasizedStyle() : undefined,
          ),
          tap_action: createViewAction('recordings'),
          hold_action: createViewAction('recording'),
        }
      : null;
  }

  private _getReviewsButton(
    config: AdvancedCameraCardConfig,
    cameraManager: CameraManager,
    foldersManager: FoldersManager,
    view?: View | null,
  ): MenuItem | null {
    return isViewSupported('reviews', cameraManager, foldersManager, view?.camera)
      ? {
          icon: MENU_BUTTON_DETAILS.reviews.icon,
          ...config.menu.buttons.reviews,
          type: 'custom:advanced-camera-card-menu-icon',
          title: localize(MENU_BUTTON_DETAILS.reviews.localizationKey),
          style: this._getStyle(
            config.menu.buttons.reviews,
            view?.is('reviews') ? this._getEmphasizedStyle() : undefined,
          ),
          tap_action: createViewAction('reviews'),
          hold_action: createViewAction('review'),
        }
      : null;
  }

  private _getGalleryButton(
    config: AdvancedCameraCardConfig,
    cameraManager: CameraManager,
    foldersManager: FoldersManager,
    view?: View | null,
  ): MenuItem | null {
    return isViewSupported('gallery', cameraManager, foldersManager, view?.camera)
      ? {
          icon: MENU_BUTTON_DETAILS.gallery.icon,
          ...config.menu.buttons.gallery,
          type: 'custom:advanced-camera-card-menu-icon',
          title: localize(MENU_BUTTON_DETAILS.gallery.localizationKey),
          style: this._getStyle(
            config.menu.buttons.gallery,
            view?.is('gallery') ? this._getEmphasizedStyle() : undefined,
          ),
          tap_action: createViewAction('gallery'),
          hold_action: createViewAction('media'),
        }
      : null;
  }

  private _getImageButton(
    config: AdvancedCameraCardConfig,
    cameraManager: CameraManager,
    foldersManager: FoldersManager,
    view?: View | null,
  ): MenuItem | null {
    return isViewSupported('image', cameraManager, foldersManager, view?.camera)
      ? {
          icon: MENU_BUTTON_DETAILS.image.icon,
          ...config.menu.buttons.image,
          type: 'custom:advanced-camera-card-menu-icon',
          title: localize(MENU_BUTTON_DETAILS.image.localizationKey),
          style: this._getStyle(
            config.menu.buttons.image,
            view?.is('image') ? this._getEmphasizedStyle() : undefined,
          ),
          tap_action: createViewAction('image'),
        }
      : null;
  }

  private _getTimelineButton(
    config: AdvancedCameraCardConfig,
    cameraManager: CameraManager,
    foldersManager: FoldersManager,
    view?: View | null,
  ): MenuItem | null {
    return isViewSupported('timeline', cameraManager, foldersManager, view?.camera)
      ? {
          icon: MENU_BUTTON_DETAILS.timeline.icon,
          ...config.menu.buttons.timeline,
          type: 'custom:advanced-camera-card-menu-icon',
          title: localize(MENU_BUTTON_DETAILS.timeline.localizationKey),
          style: this._getStyle(
            config.menu.buttons.timeline,
            view?.is('timeline') ? this._getEmphasizedStyle() : undefined,
          ),
          tap_action: createViewAction('timeline'),
        }
      : null;
  }

  private _getDownloadButton(
    config: AdvancedCameraCardConfig,
    viewItemManager?: ViewItemManager | null,
    view?: View | null,
  ): MenuItem | null {
    const selectedItem = view?.queryResults?.getSelectedResult();
    const capabilities = selectedItem
      ? viewItemManager?.getCapabilities(selectedItem)
      : null;
    if (view?.isViewerView() && capabilities?.canDownload && !isBeingCasted()) {
      return {
        icon: MENU_BUTTON_DETAILS.download.icon,
        ...config.menu.buttons.download,
        type: 'custom:advanced-camera-card-menu-icon',
        title: localize(MENU_BUTTON_DETAILS.download.localizationKey),
        tap_action: createGeneralAction('download'),
      };
    }
    return null;
  }

  private _getInfoButton(
    config: AdvancedCameraCardConfig,
    _cameraManager: CameraManager,
    view?: View | null,
  ): MenuItem | null {
    const selectedItem = view?.queryResults?.getSelectedResult();
    if (
      !ViewItemClassifier.isMedia(selectedItem) ||
      !(view?.isViewerView() || view?.isGalleryView() || view?.is('timeline'))
    ) {
      return null;
    }
    return {
      icon: MENU_BUTTON_DETAILS.info.icon,
      ...config.menu.buttons.info,
      type: 'custom:advanced-camera-card-menu-icon',
      title: localize(MENU_BUTTON_DETAILS.info.localizationKey),
      tap_action: createGeneralAction('info'),
    };
  }

  private _getSetReviewButton(
    config: AdvancedCameraCardConfig,
    view?: View | null,
  ): MenuItem | null {
    const selectedItem = view?.queryResults?.getSelectedResult();
    if (!view?.isViewerView() || !ViewItemClassifier.isReview(selectedItem)) {
      return null;
    }
    const isReviewed = selectedItem.isReviewed();
    if (isReviewed === null) {
      return null;
    }

    return {
      icon: isReviewed ? 'mdi:check-circle' : MENU_BUTTON_DETAILS.set_review.icon,
      ...config.menu.buttons.set_review,
      type: 'custom:advanced-camera-card-menu-icon',
      title: isReviewed
        ? localize('common.set_reviews.unreviewed')
        : localize(MENU_BUTTON_DETAILS.set_review.localizationKey),
      tap_action: createSetReviewAction(),
      style: this._getStyle(
        config.menu.buttons.set_review,
        isReviewed ? this._getEmphasizedStyle() : undefined,
      ),
    };
  }

  private _getCameraUIButton(
    config: AdvancedCameraCardConfig,
    showCameraUIButton?: boolean,
  ): MenuItem | null {
    return showCameraUIButton
      ? {
          icon: MENU_BUTTON_DETAILS.camera_ui.icon,
          ...config.menu.buttons.camera_ui,
          type: 'custom:advanced-camera-card-menu-icon',
          title: localize(MENU_BUTTON_DETAILS.camera_ui.localizationKey),
          tap_action: createGeneralAction('camera_ui'),
        }
      : null;
  }

  private _getCallButton(
    config: AdvancedCameraCardConfig,
    cameraManager: CameraManager,
    callManager?: CallManager | null,
    view?: View | null,
  ): MenuItem | null {
    if (!view?.camera || !view.is('live')) {
      return null;
    }
    const cameraID = view.camera;

    // The call targets: the selected camera and/or any 2-way-audio-capable
    // dependency.
    const targets = [
      ...cameraManager.getStore().getAllDependentCameras(cameraID, '2-way-audio'),
    ];
    if (!targets.length) {
      return null;
    }

    const connecting = !!callManager?.isConnecting();

    // In a call, a single button regardless of target count. An unanswered
    // inbound call (ringing) answers; an answered or outbound call hangs up.
    const call = callManager?.getCall();
    if (call) {
      const ringing = call.inbound && !call.answered;
      return {
        icon: ringing ? 'mdi:phone-ring' : 'mdi:phone-hangup',
        title: ringing
          ? localize('config.live.controls.call.answer')
          : localize('config.live.controls.call.end'),
        ...config.menu.buttons.call,
        ...(connecting && { in_progress: true }),
        style: this._getStyle(
          config.menu.buttons.call,
          ringing
            ? this._getPulsingStyle(
                'var(--advanced-camera-card-menu-button-positive-color)',
              )
            : this._getEmphasizedStyle(true),
        ),
        type: 'custom:advanced-camera-card-menu-icon',
        tap_action: ringing ? createCallAnswerAction() : createCallEndAction(),
        // While ringing, tap answers and hold rejects.
        ...(ringing && { hold_action: createCallEndAction() }),
      };
    }

    // Idle, single target: a plain button (`call_start` resolves the default).
    if (targets.length === 1) {
      return {
        icon: MENU_BUTTON_DETAILS.call.icon,
        title: localize(MENU_BUTTON_DETAILS.call.localizationKey),
        ...config.menu.buttons.call,
        ...(connecting && { in_progress: true }),
        type: 'custom:advanced-camera-card-menu-icon',
        tap_action: createCallStartAction(),
      };
    }

    // Idle, multiple targets: a submenu, one entry per stream.
    const menuItems = targets.map((streamID) => {
      const metadata = cameraManager.getCameraMetadata(streamID) ?? undefined;
      return {
        enabled: true,
        icon: metadata?.icon.icon,
        entity: metadata?.icon.entity,
        state_color: true,
        title: metadata?.title,
        tap_action: createCallStartAction({
          camera: cameraID,
          ...(streamID !== cameraID && { stream: streamID }),
        }),
      };
    });

    return {
      icon: MENU_BUTTON_DETAILS.call.icon,
      title: localize(MENU_BUTTON_DETAILS.call.localizationKey),
      ...config.menu.buttons.call,
      ...(connecting && { in_progress: true }),
      type: 'custom:advanced-camera-card-menu-submenu',
      items: menuItems,
    };
  }

  private _getMicrophoneButton(
    config: AdvancedCameraCardConfig,
    cameraManager: CameraManager,
    view?: View | null,
    microphoneManager?: MicrophoneManager | null,
    callManager?: CallManager | null,
  ): MenuItem | null {
    const streamCameraID = view ? getStreamCameraID(view) : null;
    if (!streamCameraID) {
      return null;
    }

    // The microphone only transmits during an active call.
    if (!callManager?.isActive()) {
      return null;
    }

    const capabilities = cameraManager.getCameraCapabilities(streamCameraID);

    if (microphoneManager && capabilities?.has('2-way-audio')) {
      const unavailable =
        microphoneManager.isForbidden() || !microphoneManager.isSupported();
      const muted = microphoneManager.isMuted();
      const buttonType = config.menu.buttons.microphone.type;
      return {
        icon: unavailable
          ? 'mdi:microphone-message-off'
          : muted
            ? MENU_BUTTON_DETAILS.microphone.icon
            : 'mdi:microphone',
        ...config.menu.buttons.microphone,
        type: 'custom:advanced-camera-card-menu-icon',
        title: localize(MENU_BUTTON_DETAILS.microphone.localizationKey),
        style: this._getStyle(
          config.menu.buttons.microphone,
          unavailable || muted ? undefined : this._getEmphasizedStyle(true),
        ),
        ...(!unavailable &&
          buttonType === 'momentary' && {
            start_tap_action: createGeneralAction('microphone_unmute'),
            end_tap_action: createGeneralAction('microphone_mute'),
          }),
        ...(!unavailable &&
          buttonType === 'toggle' && {
            tap_action: createGeneralAction(
              muted ? 'microphone_unmute' : 'microphone_mute',
            ),
          }),
      };
    }
    return null;
  }

  private _getExpandButton(
    config: AdvancedCameraCardConfig,
    inExpandedMode?: boolean,
  ): MenuItem {
    return {
      icon: inExpandedMode ? 'mdi:arrow-collapse-all' : MENU_BUTTON_DETAILS.expand.icon,
      ...config.menu.buttons.expand,
      type: 'custom:advanced-camera-card-menu-icon',
      title: localize(MENU_BUTTON_DETAILS.expand.localizationKey),
      tap_action: createGeneralAction('expand'),
      style: this._getStyle(
        config.menu.buttons.expand,
        inExpandedMode ? this._getEmphasizedStyle() : undefined,
      ),
    };
  }

  private _getFullscreenButton(
    config: AdvancedCameraCardConfig,
    fullscreenManager?: FullscreenManager | null,
  ): MenuItem | null {
    const inFullscreen = fullscreenManager?.isInFullscreen();
    return fullscreenManager?.isSupported()
      ? {
          icon: inFullscreen
            ? 'mdi:fullscreen-exit'
            : MENU_BUTTON_DETAILS.fullscreen.icon,
          ...config.menu.buttons.fullscreen,
          type: 'custom:advanced-camera-card-menu-icon',
          title: localize(MENU_BUTTON_DETAILS.fullscreen.localizationKey),
          tap_action: createGeneralAction('fullscreen'),
          style: this._getStyle(
            config.menu.buttons.fullscreen,
            inFullscreen ? this._getEmphasizedStyle() : undefined,
          ),
        }
      : null;
  }

  private _getPIPButton(
    config: AdvancedCameraCardConfig,
    pipManager?: PIPManager | null,
  ): MenuItem | null {
    const inPIP = pipManager?.isInPIP();
    return pipManager?.isAvailable()
      ? {
          icon: inPIP
            ? 'mdi:picture-in-picture-bottom-right-outline'
            : MENU_BUTTON_DETAILS.pip.icon,
          ...config.menu.buttons.pip,
          type: 'custom:advanced-camera-card-menu-icon',
          title: localize(MENU_BUTTON_DETAILS.pip.localizationKey),
          tap_action: createGeneralAction('pip'),
          style: this._getStyle(
            config.menu.buttons.pip,
            inPIP ? this._getEmphasizedStyle() : undefined,
          ),
        }
      : null;
  }

  private _getCastButton(
    hass: HomeAssistant,
    config: AdvancedCameraCardConfig,
    cameraManager: CameraManager,
    view?: View | null,
    mediaPlayerController?: MediaPlayerManager | null,
  ): MenuItem | null {
    if (!view) {
      return null;
    }
    const selectedCameraConfig = view.camera
      ? cameraManager.getStore().getCameraConfig(view.camera)
      : null;
    if (
      mediaPlayerController?.hasMediaPlayers() &&
      (view.isViewerView() || (view.is('live') && selectedCameraConfig?.camera_entity))
    ) {
      const mediaPlayerItems = mediaPlayerController
        .getMediaPlayers()
        .map((playerEntityID) => {
          const title = getEntityTitle(hass, playerEntityID) || playerEntityID;
          const state = hass.states[playerEntityID];
          const disabled = !state || state.state === 'unavailable';

          return {
            enabled: true,
            selected: false,
            entity: playerEntityID,
            state_color: false,
            title: title,
            disabled: disabled,
            ...(!disabled && {
              tap_action: createMediaPlayerAction(playerEntityID, 'play'),
              hold_action: createMediaPlayerAction(playerEntityID, 'stop'),
            }),
          };
        });

      return {
        icon: MENU_BUTTON_DETAILS.media_player.icon,
        ...config.menu.buttons.media_player,
        type: 'custom:advanced-camera-card-menu-submenu',
        title: localize(MENU_BUTTON_DETAILS.media_player.localizationKey),
        items: mediaPlayerItems,
      };
    }
    return null;
  }

  private _getPlayPauseButton(
    config: AdvancedCameraCardConfig,
    currentMediaLoadedInfo?: MediaLoadedInfo | null,
  ): MenuItem | null {
    if (
      currentMediaLoadedInfo &&
      currentMediaLoadedInfo.mediaPlayerController &&
      currentMediaLoadedInfo.capabilities?.supportsPause
    ) {
      const paused = currentMediaLoadedInfo.mediaPlayerController?.playback?.isPaused();
      return {
        icon: paused ? MENU_BUTTON_DETAILS.play.icon : 'mdi:pause',
        ...config.menu.buttons.play,
        type: 'custom:advanced-camera-card-menu-icon',
        title: localize(MENU_BUTTON_DETAILS.play.localizationKey),
        tap_action: createGeneralAction(paused ? 'play' : 'pause'),
      };
    }
    return null;
  }

  private _getMuteUnmuteButton(
    config: AdvancedCameraCardConfig,
    currentMediaLoadedInfo?: MediaLoadedInfo | null,
  ): MenuItem | null {
    if (
      currentMediaLoadedInfo &&
      currentMediaLoadedInfo.mediaPlayerController &&
      currentMediaLoadedInfo?.capabilities?.hasAudio
    ) {
      const muted = currentMediaLoadedInfo.mediaPlayerController?.isMuted();
      return {
        icon: muted ? MENU_BUTTON_DETAILS.mute.icon : 'mdi:volume-high',
        ...config.menu.buttons.mute,
        type: 'custom:advanced-camera-card-menu-icon',
        title: localize(MENU_BUTTON_DETAILS.mute.localizationKey),
        tap_action: createGeneralAction(muted ? 'unmute' : 'mute'),
      };
    }
    return null;
  }

  private _getScreenshotButton(
    config: AdvancedCameraCardConfig,
    currentMediaLoadedInfo?: MediaLoadedInfo | null,
  ): MenuItem | null {
    if (currentMediaLoadedInfo && currentMediaLoadedInfo.mediaPlayerController) {
      return {
        icon: MENU_BUTTON_DETAILS.screenshot.icon,
        ...config.menu.buttons.screenshot,
        type: 'custom:advanced-camera-card-menu-icon',
        title: localize(MENU_BUTTON_DETAILS.screenshot.localizationKey),
        tap_action: createGeneralAction('screenshot'),
      };
    }
    return null;
  }

  private _getDisplayModeButton(
    config: AdvancedCameraCardConfig,
    cameraManager: CameraManager,
    foldersManager: FoldersManager,
    view?: View | null,
  ): MenuItem | null {
    const viewCameraIDs = view
      ? getCameraIDsWithCapabilityForView(view.view, cameraManager, foldersManager)
      : null;
    if (
      view?.supportsMultipleDisplayModes() &&
      viewCameraIDs &&
      viewCameraIDs.size > 1
    ) {
      const isGrid = view.isGrid();
      return {
        icon: isGrid ? 'mdi:grid-off' : MENU_BUTTON_DETAILS.display_mode.icon,
        ...config.menu.buttons.display_mode,
        style: this._getStyle(
          config.menu.buttons.display_mode,
          isGrid ? this._getEmphasizedStyle() : undefined,
        ),
        type: 'custom:advanced-camera-card-menu-icon',
        title: isGrid
          ? localize('display_modes.single')
          : localize(MENU_BUTTON_DETAILS.display_mode.localizationKey),
        tap_action: createDisplayModeAction(isGrid ? 'single' : 'grid'),
      };
    }
    return null;
  }

  private _getPTZControlsButton(
    config: AdvancedCameraCardConfig,
    cameraManager: CameraManager,
    view?: View | null,
  ): MenuItem | null {
    const ptzConfig = view?.is('live')
      ? config.live.controls.ptz
      : view?.isViewerView()
        ? config.media_viewer.controls.ptz
        : null;

    if (!view || !ptzConfig) {
      return null;
    }

    const ptzTarget = getPTZTarget(view, {
      cameraManager: cameraManager,
    });

    if (ptzTarget) {
      const isOn =
        view.context?.ptzControls?.enabled !== undefined
          ? view.context.ptzControls.enabled
          : ptzConfig.mode === 'on' ||
            (ptzConfig.mode === 'auto' && ptzTarget.type === 'ptz');
      return {
        icon: MENU_BUTTON_DETAILS.ptz_controls.icon,
        ...config.menu.buttons.ptz_controls,
        style: this._getStyle(
          config.menu.buttons.ptz_controls,
          isOn ? this._getEmphasizedStyle() : undefined,
        ),
        type: 'custom:advanced-camera-card-menu-icon',
        title: localize(MENU_BUTTON_DETAILS.ptz_controls.localizationKey),
        tap_action: createPTZControlsAction({ enabled: !isOn }),
      };
    }
    return null;
  }

  private _getPTZHomeButton(
    config: AdvancedCameraCardConfig,
    cameraManager: CameraManager,
    view?: View | null,
  ): MenuItem | null {
    const target = view
      ? getPTZTarget(view, {
          cameraManager: cameraManager,
        })
      : null;

    if (
      !target ||
      ((target.type === 'digital' &&
        view?.context?.zoom?.[target.targetID]?.observed?.isDefault) ??
        true)
    ) {
      return null;
    }

    return {
      icon: MENU_BUTTON_DETAILS.ptz_home.icon,
      ...config.menu.buttons.ptz_home,
      type: 'custom:advanced-camera-card-menu-icon',
      title: localize(MENU_BUTTON_DETAILS.ptz_home.localizationKey),
      tap_action: createPTZMultiAction({
        targetID: target.targetID,
      }),
    };
  }

  private _getFoldersButton(
    config: AdvancedCameraCardConfig,
    foldersManager?: FoldersManager | null,
    view?: View | null,
  ): MenuItem | null {
    const folders = Array.from(foldersManager?.getFolders() ?? []);
    if (!foldersManager?.hasFolders()) {
      return null;
    }

    if (folders.length === 1) {
      const folderID = folders[0][0];
      const isSelected = !!view?.query?.hasFolderQueries(folderID);
      const folder = folders[0][1];

      return {
        icon: folder.icon ?? 'mdi:folder',
        ...config.menu.buttons.folders,
        type: 'custom:advanced-camera-card-menu-icon',
        title: folder.title ?? localize(MENU_BUTTON_DETAILS.folders.localizationKey),
        style: this._getStyle(
          config.menu.buttons.folders,
          isSelected ? this._getEmphasizedStyle() : undefined,
        ),
        tap_action: createViewAction('folders'),
        hold_action: createViewAction('folder'),
      };
    }

    const submenuItems = folders.map(([id, folder]) => {
      const isSelected = !!view?.query?.hasFolderQueries(id);

      return {
        enabled: true,
        title: folder.title ?? folder.id,
        icon: folder.icon ?? 'mdi:folder',
        selected: isSelected,
        style: isSelected ? this._getEmphasizedStyle() : {},
        tap_action: createViewAction('folders', { folderID: id }),
        hold_action: createViewAction('folder', { folderID: id }),
      };
    });

    return {
      icon: MENU_BUTTON_DETAILS.folders.icon,
      ...config.menu.buttons.folders,
      type: 'custom:advanced-camera-card-menu-submenu',
      title: localize(MENU_BUTTON_DETAILS.folders.localizationKey),
      items: submenuItems,
      style: this._getStyle(
        config.menu.buttons.folders,
        view?.isAnyFolderView() ? this._getEmphasizedStyle() : undefined,
      ),
    };
  }

  /**
   * Get the style a menu button renders with: the configured style takes
   * precedence.
   * @param buttonConfig The user's configuration for the button.
   * @param stateStyle The style for the button's current state, if it has one.
   * @returns A StyleInfo.
   */
  private _getStyle(
    buttonConfig: { style?: StyleInfo },
    stateStyle?: StyleInfo,
  ): StyleInfo {
    return { ...stateStyle, ...buttonConfig.style };
  }

  /**
   * Get the style of emphasized menu items.
   * @returns A StyleInfo.
   */
  private _getEmphasizedStyle(critical?: boolean): StyleInfo {
    if (critical) {
      return this._getPulsingStyle(
        'var(--advanced-camera-card-menu-button-critical-color)',
      );
    }
    return {
      color: 'var(--advanced-camera-card-menu-button-active-color)',
    };
  }

  /**
   * Get a pulsing style in the given color, e.g. to draw attention to a
   * critical or a ringing button.
   * @param color The CSS color to pulse.
   * @returns A StyleInfo.
   */
  private _getPulsingStyle(color: string): StyleInfo {
    return {
      animation: 'pulse 3s infinite',
      color,
    };
  }

  /**
   * Given a button determine if the style should be emphasized by examining all
   * of the actions sequentially.
   * @param button The button to examine.
   * @returns A StyleInfo object.
   */
  private _getStyleFromActions(
    config: AdvancedCameraCardConfig,
    cameraManager: CameraManager,
    foldersManager: FoldersManager,
    button: MenuItem,
    options?: MenuButtonControllerOptions,
  ): StyleInfo {
    // Review
    for (const actionSet of [
      button.tap_action,
      button.double_tap_action,
      button.hold_action,
      button.start_tap_action,
      button.end_tap_action,
    ]) {
      for (const action of arrayify(actionSet)) {
        if (!isAdvancedCameraCardCustomAction(action)) {
          continue;
        }

        // Unlike other views, a folder action targets a specific folder, so
        // emphasize it only when that folder is the one being viewed. Matching
        // on the view name alone would emphasize every folder button at once.
        // An action without a folder ID keeps the plain view-name match.
        if (
          action.advanced_camera_card_action === 'folder' ||
          action.advanced_camera_card_action === 'folders'
        ) {
          const emphasized = action.folder
            ? !!options?.view?.query?.hasFolderQueries(action.folder)
            : !!options?.view?.is(action.advanced_camera_card_action);
          if (emphasized) {
            return this._getEmphasizedStyle();
          }
          continue;
        }

        if (
          VIEWS_USER_SPECIFIED.some(
            (viewName) =>
              viewName === action.advanced_camera_card_action &&
              options?.view?.is(
                action.advanced_camera_card_action as AdvancedCameraCardView,
              ),
          ) ||
          (action.advanced_camera_card_action === 'default' &&
            options?.view?.is(
              resolveViewName(config.view.default, cameraManager, foldersManager),
            )) ||
          (action.advanced_camera_card_action === 'fullscreen' &&
            !!options?.fullscreenManager?.isInFullscreen()) ||
          (action.advanced_camera_card_action === 'camera_select' &&
            options?.view?.camera === action.camera)
        ) {
          return this._getEmphasizedStyle();
        }
      }
    }
    return {};
  }
}
