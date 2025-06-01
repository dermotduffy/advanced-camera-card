import { afterEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { INTERNAL_CALLBACK_ACTION } from '../../src/config/schema/actions/custom/internal.js';
import { ActionConfig } from '../../src/config/schema/actions/types.js';
import {
  createCameraAction,
  createDisplayModeAction,
  createFoldersViewAction,
  createGeneralAction,
  createInternalCallbackAction,
  createLogAction,
  createMediaPlayerAction,
  createPerformAction,
  createPTZAction,
  createPTZControlsAction,
  createPTZDigitalAction,
  createPTZMultiAction,
  createSelectOptionAction,
  createViewAction,
  getActionConfigGivenAction,
  hasAction,
  stopEventFromActivatingCardWideActions,
} from '../../src/utils/action.js';

describe('createGeneralAction', () => {
  it('should create general action', () => {
    expect(
      createGeneralAction('camera_ui', {
        cardID: 'card_id',
      }),
    ).toEqual({
      action: 'fire-dom-event',
      advanced_camera_card_action: 'camera_ui',
      card_id: 'card_id',
    });
  });
});

describe('createViewAction', () => {
  it('should create view action', () => {
    expect(
      createViewAction('clips', {
        cardID: 'card_id',
      }),
    ).toEqual({
      action: 'fire-dom-event',
      advanced_camera_card_action: 'clips',
      card_id: 'card_id',
    });
  });
});

describe('createCameraAction', () => {
  it('should create camera_select action', () => {
    expect(createCameraAction('camera_select', 'camera', { cardID: 'card_id' })).toEqual(
      {
        action: 'fire-dom-event',
        camera: 'camera',
        advanced_camera_card_action: 'camera_select',
        card_id: 'card_id',
      },
    );
  });
});

describe('createFolderAction', () => {
  it.each([['folder' as const], ['folders' as const]])(
    '%s',
    (viewName: 'folder' | 'folders') => {
      expect(
        createFoldersViewAction(viewName, { folderID: 'folderID', cardID: 'card_id' }),
      ).toEqual({
        action: 'fire-dom-event',
        advanced_camera_card_action: viewName,
        card_id: 'card_id',
        folder: 'folderID',
      });
    },
  );
});

describe('createMediaPlayerAction', () => {
  it('should create media_player action', () => {
    expect(
      createMediaPlayerAction('device', 'play', {
        cardID: 'card_id',
      }),
    ).toEqual({
      action: 'fire-dom-event',
      advanced_camera_card_action: 'media_player',
      media_player: 'device',
      media_player_action: 'play',
      card_id: 'card_id',
    });
  });
});

describe('createDisplayModeAction', () => {
  it('should create display mode action', () => {
    expect(
      createDisplayModeAction('grid', {
        cardID: 'card_id',
      }),
    ).toEqual({
      action: 'fire-dom-event',
      advanced_camera_card_action: 'display_mode_select',
      display_mode: 'grid',
      card_id: 'card_id',
    });
  });
});

describe('createPTZControlsAction', () => {
  it('should create PTZ controls action', () => {
    expect(
      createPTZControlsAction(true, {
        cardID: 'card_id',
      }),
    ).toEqual({
      action: 'fire-dom-event',
      advanced_camera_card_action: 'ptz_controls',
      enabled: true,
      card_id: 'card_id',
    });
  });
});

describe('createPTZAction', () => {
  it('should create ptz action without parameters', () => {
    expect(
      createPTZAction({
        cardID: 'card_id',
      }),
    ).toEqual({
      action: 'fire-dom-event',
      advanced_camera_card_action: 'ptz',
      card_id: 'card_id',
    });
  });

  it('should create ptz action with parameters', () => {
    expect(
      createPTZAction({
        cardID: 'card_id',
        ptzAction: 'right',
        ptzPhase: 'start',
        ptzPreset: 'preset',
        cameraID: 'camera_id',
      }),
    ).toEqual({
      action: 'fire-dom-event',
      advanced_camera_card_action: 'ptz',
      card_id: 'card_id',
      camera: 'camera_id',
      ptz_action: 'right',
      ptz_phase: 'start',
      ptz_preset: 'preset',
    });
  });
});

describe('createPTZDigitalAction', () => {
  it('should create ptz digital without parameters', () => {
    expect(
      createPTZDigitalAction({
        cardID: 'card_id',
      }),
    ).toEqual({
      action: 'fire-dom-event',
      advanced_camera_card_action: 'ptz_digital',
      card_id: 'card_id',
    });
  });

  it('should create ptz digital with parameters', () => {
    expect(
      createPTZDigitalAction({
        cardID: 'card_id',
        targetID: 'target_id',
        absolute: {
          pan: { x: 1, y: 2 },
          zoom: 3,
        },
        ptzAction: 'right',
        ptzPhase: 'start',
      }),
    ).toEqual({
      action: 'fire-dom-event',
      advanced_camera_card_action: 'ptz_digital',
      card_id: 'card_id',
      target_id: 'target_id',
      absolute: {
        pan: { x: 1, y: 2 },
        zoom: 3,
      },
      ptz_action: 'right',
      ptz_phase: 'start',
    });
  });
});

describe('createPTZMultiAction', () => {
  it('should create ptz multi with parameters', () => {
    expect(
      createPTZMultiAction({
        cardID: 'card_id',
        ptzAction: 'right',
        ptzPreset: 'preset',
      }),
    ).toEqual({
      action: 'fire-dom-event',
      advanced_camera_card_action: 'ptz_multi',
      card_id: 'card_id',
      ptz_action: 'right',
      ptz_preset: 'preset',
    });
  });

  it('should create ptz multi without parameters', () => {
    expect(
      createPTZMultiAction({
        cardID: 'card_id',
        ptzAction: 'right',
        ptzPhase: 'start',
        targetID: 'target_id',
      }),
    ).toEqual({
      action: 'fire-dom-event',
      advanced_camera_card_action: 'ptz_multi',
      card_id: 'card_id',
      ptz_action: 'right',
      ptz_phase: 'start',
      target_id: 'target_id',
    });
  });
});

describe('createLogAction', () => {
  it('should create log action', () => {
    expect(
      createLogAction('Hello, world!', {
        cardID: 'card_id',
      }),
    ).toEqual({
      action: 'fire-dom-event',
      advanced_camera_card_action: 'log',
      message: 'Hello, world!',
      card_id: 'card_id',
      level: 'info',
    });
  });
});

describe('createInternalCallbackAction', () => {
  it('should create internal callback action', () => {
    const callback = vi.fn();
    expect(
      createInternalCallbackAction(callback, {
        cardID: 'card_id',
      }),
    ).toEqual({
      action: 'fire-dom-event',
      advanced_camera_card_action: INTERNAL_CALLBACK_ACTION,
      callback: callback,
      card_id: 'card_id',
    });
  });
});

describe('createPerformAction', () => {
  it('should create perform action', () => {
    expect(
      createPerformAction('toggle', {
        cardID: 'card_id',
        target: { entity_id: 'light.office_main_lights' },
        data: {},
      }),
    ).toEqual({
      action: 'perform-action',
      perform_action: 'toggle',
      card_id: 'card_id',
      target: { entity_id: 'light.office_main_lights' },
      data: {},
    });
  });
});

describe('createSelectOptionAction', () => {
  it('should create select option action', () => {
    expect(
      createSelectOptionAction('select', 'select.foo', 'option', {
        cardID: 'card_id',
      }),
    ).toEqual({
      action: 'perform-action',
      perform_action: 'select.select_option',
      card_id: 'card_id',
      target: { entity_id: 'select.foo' },
      data: {
        option: 'option',
      },
    });
  });
});

describe('getActionConfigGivenAction', () => {
  const action = createViewAction('clips');

  it('should not handle undefined arguments', () => {
    expect(getActionConfigGivenAction()).toBeNull();
  });

  it('should not handle unknown interactions', () => {
    expect(
      getActionConfigGivenAction('triple_poke', { triple_poke_action: action }),
    ).toBeNull();
  });

  it('should handle tap actions', () => {
    expect(getActionConfigGivenAction('tap', { tap_action: action })).toBe(action);
  });

  it('should handle default tap action without an entity', () => {
    expect(getActionConfigGivenAction('tap', {})).toBeNull();
  });

  it('should handle default tap action with an entity', () => {
    expect(
      getActionConfigGivenAction('tap', { entity: 'light.office_main_lights' }),
    ).toEqual({
      action: 'more-info',
    });
  });

  it('should handle hold actions', () => {
    expect(getActionConfigGivenAction('hold', { hold_action: action })).toBe(action);
  });

  it('should handle double_tap actions', () => {
    expect(getActionConfigGivenAction('double_tap', { double_tap_action: action })).toBe(
      action,
    );
  });

  it('should handle end_tap actions', () => {
    expect(getActionConfigGivenAction('end_tap', { end_tap_action: action })).toBe(
      action,
    );
  });

  it('should handle start_tap actions', () => {
    expect(getActionConfigGivenAction('start_tap', { start_tap_action: action })).toBe(
      action,
    );
  });
});

describe('hasAction', () => {
  const realAction = createViewAction('clips');
  const noneAction: ActionConfig = {
    action: 'none',
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return true for real action', () => {
    expect(hasAction(realAction)).toBeTruthy();
  });

  it('should return false for none action', () => {
    expect(hasAction(noneAction)).toBeFalsy();
  });

  it('should return true with an array of actions some real', () => {
    expect(hasAction([noneAction, noneAction, realAction])).toBeTruthy();
  });

  it('should return false with an array of actions none real', () => {
    expect(hasAction([noneAction, noneAction, noneAction])).toBeFalsy();
  });
});

// @vitest-environment jsdom
describe('stopEventFromActivatingCardWideActions', () => {
  it('should stop event from propogating', () => {
    const event = mock<Event>();
    stopEventFromActivatingCardWideActions(event);
    expect(event.stopPropagation).toBeCalled();
  });
});
