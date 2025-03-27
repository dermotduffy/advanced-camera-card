import { afterEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { QueryStringManager } from '../../src/card-controller/query-string-manager';
import { SubstreamSelectViewModifier } from '../../src/card-controller/view/modifiers/substream-select';
import { createCardAPI } from '../test-utils';

const setQueryString = (qs: string): void => {
  const location: Location = mock<Location>();
  location.search = qs;

  vi.spyOn(window, 'location', 'get').mockReturnValue(location);
};

// @vitest-environment jsdom
describe('QueryStringManager', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should reject malformed query string', async () => {
    setQueryString('BOGUS_KEY=BOGUS_VALUE');
    const api = createCardAPI();
    vi.mocked(api.getMessageManager().hasMessage).mockReturnValue(true);
    const manager = new QueryStringManager(api);

    expect(manager.hasViewRelatedActionsToRun()).toBeFalsy();
    await manager.executeIfNecessary();

    expect(api.getActionsManager().executeActions).not.toBeCalled();
    expect(api.getViewManager().setViewByParameters).not.toBeCalled();
  });

  describe('should execute view name action from query string', () => {
    it.each([
      ['clip' as const],
      ['clips' as const],
      ['diagnostics' as const],
      ['image' as const],
      ['live' as const],
      ['recording' as const],
      ['recordings' as const],
      ['snapshot' as const],
      ['snapshots' as const],
      ['timeline' as const],
    ])('%s', async (viewName: string) => {
      setQueryString(`?advanced-camera-card-action.id.${viewName}=`);
      const api = createCardAPI();

      // View actions do not need the card to have been updated.
      vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(false);
      const manager = new QueryStringManager(api);

      expect(manager.hasViewRelatedActionsToRun()).toBeTruthy();
      await manager.executeIfNecessary();
      expect(manager.hasViewRelatedActionsToRun()).toBeFalsy();

      expect(api.getViewManager().setViewByParametersWithNewQuery).toBeCalledWith({
        params: {
          view: viewName,
        },
      });
    });
  });

  describe('should execute non-view action from query string', () => {
    it.each([
      ['camera_ui' as const],
      ['download' as const],
      ['expand' as const],
      ['menu_toggle' as const],
    ])('%s', async (action: string) => {
      setQueryString(`?advanced-camera-card-action.id.${action}=`);
      const api = createCardAPI();
      vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(true);
      const manager = new QueryStringManager(api);

      expect(manager.hasViewRelatedActionsToRun()).toBeFalsy();
      await manager.executeIfNecessary();

      expect(api.getActionsManager().executeActions).toBeCalledWith({
        actions: [
          {
            action: 'fire-dom-event',
            card_id: 'id',
            advanced_camera_card_action: action,
          },
        ],
      });
    });
  });

  it('should execute view default action', async () => {
    setQueryString('?advanced-camera-card-action.id.default=');
    const api = createCardAPI();
    // View actions do not need the card to have been updated.
    vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(false);

    const manager = new QueryStringManager(api);

    expect(manager.hasViewRelatedActionsToRun()).toBeTruthy();
    await manager.executeIfNecessary();
    expect(manager.hasViewRelatedActionsToRun()).toBeFalsy();

    expect(api.getViewManager().setViewDefaultWithNewQuery).toBeCalled();
    expect(api.getActionsManager().executeActions).not.toBeCalled();
    expect(api.getViewManager().setViewByParameters).not.toBeCalled();
  });

  it('should execute camera_select action', async () => {
    setQueryString('?advanced-camera-card-action.id.camera_select=camera.office');
    const api = createCardAPI();
    vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(true);
    const manager = new QueryStringManager(api);

    expect(manager.hasViewRelatedActionsToRun()).toBeTruthy();
    await manager.executeIfNecessary();
    expect(manager.hasViewRelatedActionsToRun()).toBeFalsy();

    expect(api.getViewManager().setViewByParametersWithNewQuery).toBeCalledWith({
      params: {
        camera: 'camera.office',
      },
    });
    expect(api.getActionsManager().executeActions).not.toBeCalled();
    expect(api.getViewManager().setViewDefault).not.toBeCalled();
  });

  it('should execute live_substream_select action', async () => {
    setQueryString(
      '?advanced-camera-card-action.id.live_substream_select=camera.office_hd',
    );
    const api = createCardAPI();
    vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(true);
    const manager = new QueryStringManager(api);

    expect(manager.hasViewRelatedActionsToRun()).toBeTruthy();
    await manager.executeIfNecessary();
    expect(manager.hasViewRelatedActionsToRun()).toBeFalsy();

    expect(api.getViewManager().setViewByParametersWithNewQuery).toBeCalledWith({
      modifiers: [expect.any(SubstreamSelectViewModifier)],
      params: {},
    });

    expect(api.getActionsManager().executeActions).not.toBeCalled();
    expect(api.getViewManager().setViewDefault).not.toBeCalled();
  });

  describe('should ignore action without value', () => {
    it.each([['camera_select' as const], ['live_substream_select' as const]])(
      '%s',
      async (action: string) => {
        setQueryString(`?advanced-camera-card-action.id.${action}=`);
        const api = createCardAPI();
        vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(true);
        const manager = new QueryStringManager(api);

        expect(manager.hasViewRelatedActionsToRun()).toBeFalsy();
        await manager.executeIfNecessary();

        expect(api.getActionsManager().executeActions).not.toBeCalled();
        expect(api.getViewManager().setViewDefault).not.toBeCalled();
        expect(api.getViewManager().setViewByParameters).not.toBeCalled();
      },
    );
  });

  it('should handle unknown action', async () => {
    const consoleSpy = vi.spyOn(global.console, 'warn').mockReturnValue(undefined);

    setQueryString('?advanced-camera-card-action.id.not_an_action=value');
    const api = createCardAPI();
    vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(true);
    const manager = new QueryStringManager(api);

    expect(manager.hasViewRelatedActionsToRun()).toBeFalsy();
    await manager.executeIfNecessary();

    expect(api.getActionsManager().executeActions).not.toBeCalled();
    expect(api.getViewManager().setViewDefault).not.toBeCalled();
    expect(api.getViewManager().setViewByParameters).not.toBeCalled();
    expect(consoleSpy).toBeCalled();
  });

  describe('should execute view name action from query string', () => {
    it.each([
      ['clip' as const],
      ['clips' as const],
      ['diagnostics' as const],
      ['image' as const],
      ['live' as const],
      ['recording' as const],
      ['recordings' as const],
      ['snapshot' as const],
      ['snapshots' as const],
      ['timeline' as const],
    ])('%s', async (viewName: string) => {
      setQueryString(`?advanced-camera-card-action.id.${viewName}=`);
      const api = createCardAPI();
      vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(true);
      const manager = new QueryStringManager(api);

      expect(manager.hasViewRelatedActionsToRun()).toBeTruthy();
      await manager.executeIfNecessary();
      expect(manager.hasViewRelatedActionsToRun()).toBeFalsy();

      expect(api.getViewManager().setViewByParametersWithNewQuery).toBeCalledWith({
        params: {
          view: viewName,
        },
      });
    });
  });

  describe('should handle conflicting but valid actions', () => {
    it('view and default with camera and substream specified', async () => {
      setQueryString(
        '?advanced-camera-card-action.id.clips=' +
          '&advanced-camera-card-action.id.live_substream_select=camera.kitchen_hd' +
          '&advanced-camera-card-action.id.default=' +
          '&advanced-camera-card-action.id.camera_select=camera.kitchen',
      );
      const api = createCardAPI();
      vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(true);
      const manager = new QueryStringManager(api);

      await manager.executeIfNecessary();

      expect(api.getViewManager().setViewDefaultWithNewQuery).toBeCalledWith({
        params: {
          camera: 'camera.kitchen',
        },
        modifiers: [expect.any(SubstreamSelectViewModifier)],
      });
      expect(api.getViewManager().setViewByParametersWithNewQuery).not.toBeCalled();
    });

    it('multiple cameras specified', async () => {
      setQueryString(
        '?advanced-camera-card-action.id.camera_select=camera.kitchen' +
          '&advanced-camera-card-action.id.camera_select=camera.office',
      );
      const api = createCardAPI();
      vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(true);
      const manager = new QueryStringManager(api);

      await manager.executeIfNecessary();

      expect(api.getViewManager().setViewByParametersWithNewQuery).toBeCalledWith({
        params: {
          camera: 'camera.office',
        },
      });
    });
  });

  it('should only execute when needed', async () => {
    setQueryString(
      '?advanced-camera-card-action.id.live_substream_select=camera.office_hd',
    );
    const api = createCardAPI();
    vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(true);
    const manager = new QueryStringManager(api);

    expect(manager.hasViewRelatedActionsToRun()).toBeTruthy();
    await manager.executeIfNecessary();
    expect(manager.hasViewRelatedActionsToRun()).toBeFalsy();
    expect(api.getViewManager().setViewByParametersWithNewQuery).toBeCalledTimes(1);

    await manager.executeIfNecessary();
    expect(manager.hasViewRelatedActionsToRun()).toBeFalsy();
    expect(api.getViewManager().setViewByParametersWithNewQuery).toBeCalledTimes(1);

    manager.requestExecution();

    expect(manager.hasViewRelatedActionsToRun()).toBeTruthy();
    await manager.executeIfNecessary();
    expect(manager.hasViewRelatedActionsToRun()).toBeFalsy();
    expect(api.getViewManager().setViewByParametersWithNewQuery).toBeCalledTimes(2);
  });

  it('should execute actions with old frigate-card-action key', async () => {
    setQueryString(`?frigate-card-action.id.clips=`);
    const api = createCardAPI();

    // View actions do not need the card to have been updated.
    vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(false);
    const manager = new QueryStringManager(api);

    expect(manager.hasViewRelatedActionsToRun()).toBeTruthy();
    await manager.executeIfNecessary();
    expect(manager.hasViewRelatedActionsToRun()).toBeFalsy();

    expect(api.getViewManager().setViewByParametersWithNewQuery).toBeCalledWith({
      params: {
        view: 'clips',
      },
    });
  });
});
