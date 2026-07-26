import { afterEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { CardController } from '../../src/card-controller/controller';
import { QueryStringManager } from '../../src/card-controller/query-string-manager';
import { SubstreamViewModifier } from '../../src/card-controller/view/modifiers/substream';
import { createConfig } from '../config/test-utils';
import { createCardAPI } from '../test-utils';

const setQueryString = (qs: string): void => {
  const location: Location = mock<Location>();
  location.search = qs;

  vi.spyOn(window, 'location', 'get').mockReturnValue(location);
};

const setCardID = (api: CardController, cardID: string): void => {
  vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
    createConfig({
      card_id: cardID,
    }),
  );
};

// @vitest-environment jsdom
describe('QueryStringManager', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should reject malformed query string', async () => {
    setQueryString('BOGUS_KEY=BOGUS_VALUE');
    const api = createCardAPI();
    vi.mocked(api.getIssueManager().getStateManager().hasFullCardIssue).mockReturnValue(
      true,
    );
    const manager = new QueryStringManager(api);

    expect(manager.hasViewRelatedActionsToRun()).toBeFalsy();
    await manager.executeIfNecessary();

    expect(api.getActionsManager().executeActions).not.toHaveBeenCalled();
    expect(api.getViewManager().setViewByParameters).not.toHaveBeenCalled();
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
      setCardID(api, 'id');

      // View actions do not need the card to have been updated.
      vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(false);
      const manager = new QueryStringManager(api);

      expect(manager.hasViewRelatedActionsToRun()).toBeTruthy();
      await manager.executeIfNecessary();
      expect(manager.hasViewRelatedActionsToRun()).toBeFalsy();

      expect(api.getViewManager().setViewByParametersWithNewQuery).toHaveBeenCalledWith({
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
      setCardID(api, 'id');
      vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(true);
      const manager = new QueryStringManager(api);

      expect(manager.hasViewRelatedActionsToRun()).toBeFalsy();
      await manager.executeIfNecessary();

      expect(api.getActionsManager().executeActions).toHaveBeenCalledWith({
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
    setCardID(api, 'id');
    // View actions do not need the card to have been updated.
    vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(false);

    const manager = new QueryStringManager(api);

    expect(manager.hasViewRelatedActionsToRun()).toBeTruthy();
    await manager.executeIfNecessary();
    expect(manager.hasViewRelatedActionsToRun()).toBeFalsy();

    expect(api.getViewManager().setViewDefaultWithNewQuery).toHaveBeenCalled();
    expect(api.getActionsManager().executeActions).not.toHaveBeenCalled();
    expect(api.getViewManager().setViewByParameters).not.toHaveBeenCalled();
  });

  it('should execute camera_select action', async () => {
    setQueryString('?advanced-camera-card-action.id.camera_select=camera.office');
    const api = createCardAPI();
    setCardID(api, 'id');
    vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(true);
    const manager = new QueryStringManager(api);

    expect(manager.hasViewRelatedActionsToRun()).toBeTruthy();
    await manager.executeIfNecessary();
    expect(manager.hasViewRelatedActionsToRun()).toBeFalsy();

    expect(api.getViewManager().setViewByParametersWithNewQuery).toHaveBeenCalledWith({
      params: {
        camera: 'camera.office',
      },
    });
    expect(api.getActionsManager().executeActions).not.toHaveBeenCalled();
    expect(api.getViewManager().setViewDefault).not.toHaveBeenCalled();
  });

  it('should execute substream_on with a stream value as a view modifier', async () => {
    setQueryString('?advanced-camera-card-action.id.substream_on=camera.office_hd');
    const api = createCardAPI();
    setCardID(api, 'id');
    vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(true);
    const manager = new QueryStringManager(api);

    expect(manager.hasViewRelatedActionsToRun()).toBeTruthy();
    await manager.executeIfNecessary();
    expect(manager.hasViewRelatedActionsToRun()).toBeFalsy();

    expect(api.getViewManager().setViewByParametersWithNewQuery).toHaveBeenCalledWith({
      modifiers: [new SubstreamViewModifier({ stream: 'camera.office_hd' })],
      params: {},
    });

    expect(api.getActionsManager().executeActions).not.toHaveBeenCalled();
    expect(api.getViewManager().setViewDefault).not.toHaveBeenCalled();
  });

  it('should dispatch substream_on without a value as a non-view action', async () => {
    setQueryString('?advanced-camera-card-action.id.substream_on=');
    const api = createCardAPI();
    setCardID(api, 'id');
    vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(true);
    const manager = new QueryStringManager(api);

    expect(manager.hasViewRelatedActionsToRun()).toBeFalsy();
    await manager.executeIfNecessary();

    expect(api.getActionsManager().executeActions).toHaveBeenCalledWith({
      actions: [
        {
          action: 'fire-dom-event',
          card_id: 'id',
          advanced_camera_card_action: 'substream_on',
        },
      ],
    });
  });

  it('should execute substream_off as a view modifier that clears the override', async () => {
    setQueryString('?advanced-camera-card-action.id.substream_off=');
    const api = createCardAPI();
    setCardID(api, 'id');
    vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(true);
    const manager = new QueryStringManager(api);

    expect(manager.hasViewRelatedActionsToRun()).toBeTruthy();
    await manager.executeIfNecessary();
    expect(manager.hasViewRelatedActionsToRun()).toBeFalsy();

    expect(api.getViewManager().setViewByParametersWithNewQuery).toHaveBeenCalledWith({
      modifiers: [new SubstreamViewModifier()],
      params: {},
    });
    expect(api.getActionsManager().executeActions).not.toHaveBeenCalled();
  });

  it('should warn on the legacy live_substream_select URL form', async () => {
    const consoleSpy = vi.spyOn(global.console, 'warn').mockReturnValue(undefined);

    setQueryString(
      '?advanced-camera-card-action.id.live_substream_select=camera.office_hd',
    );
    const api = createCardAPI();
    setCardID(api, 'id');
    vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(true);
    const manager = new QueryStringManager(api);

    expect(manager.hasViewRelatedActionsToRun()).toBeFalsy();
    await manager.executeIfNecessary();

    expect(api.getActionsManager().executeActions).not.toHaveBeenCalled();
    expect(api.getViewManager().setViewByParametersWithNewQuery).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('live_substream_select'),
    );
  });

  it('should ignore camera_select without a value', async () => {
    setQueryString('?advanced-camera-card-action.id.camera_select=');
    const api = createCardAPI();
    setCardID(api, 'id');
    vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(true);
    const manager = new QueryStringManager(api);

    expect(manager.hasViewRelatedActionsToRun()).toBeFalsy();
    await manager.executeIfNecessary();

    expect(api.getActionsManager().executeActions).not.toHaveBeenCalled();
    expect(api.getViewManager().setViewDefault).not.toHaveBeenCalled();
    expect(api.getViewManager().setViewByParameters).not.toHaveBeenCalled();
  });

  it('should handle unknown action', async () => {
    const consoleSpy = vi.spyOn(global.console, 'warn').mockReturnValue(undefined);

    setQueryString('?advanced-camera-card-action.id.not_an_action=value');
    const api = createCardAPI();
    setCardID(api, 'id');
    vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(true);
    const manager = new QueryStringManager(api);

    expect(manager.hasViewRelatedActionsToRun()).toBeFalsy();
    await manager.executeIfNecessary();

    expect(api.getActionsManager().executeActions).not.toHaveBeenCalled();
    expect(api.getViewManager().setViewDefault).not.toHaveBeenCalled();
    expect(api.getViewManager().setViewByParameters).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();
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
      setCardID(api, 'id');
      vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(true);
      const manager = new QueryStringManager(api);

      expect(manager.hasViewRelatedActionsToRun()).toBeTruthy();
      await manager.executeIfNecessary();
      expect(manager.hasViewRelatedActionsToRun()).toBeFalsy();

      expect(api.getViewManager().setViewByParametersWithNewQuery).toHaveBeenCalledWith({
        params: {
          view: viewName,
        },
      });
    });
  });

  describe('should handle conflicting but valid actions', () => {
    it('should handle view and default with camera and substream specified', async () => {
      setQueryString(
        '?advanced-camera-card-action.id.clips=' +
          '&advanced-camera-card-action.id.substream_on=camera.kitchen_hd' +
          '&advanced-camera-card-action.id.default=' +
          '&advanced-camera-card-action.id.camera_select=camera.kitchen',
      );
      const api = createCardAPI();
      setCardID(api, 'id');
      vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(true);
      const manager = new QueryStringManager(api);

      await manager.executeIfNecessary();

      expect(api.getViewManager().setViewDefaultWithNewQuery).toHaveBeenCalledWith({
        params: {
          camera: 'camera.kitchen',
        },
        modifiers: [new SubstreamViewModifier({ stream: 'camera.kitchen_hd' })],
      });
      expect(
        api.getViewManager().setViewByParametersWithNewQuery,
      ).not.toHaveBeenCalled();
    });

    it('should handle multiple cameras specified', async () => {
      setQueryString(
        '?advanced-camera-card-action.id.camera_select=camera.kitchen' +
          '&advanced-camera-card-action.id.camera_select=camera.office',
      );
      const api = createCardAPI();
      setCardID(api, 'id');
      vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(true);
      const manager = new QueryStringManager(api);

      await manager.executeIfNecessary();

      expect(api.getViewManager().setViewByParametersWithNewQuery).toHaveBeenCalledWith({
        params: {
          camera: 'camera.office',
        },
      });
    });
  });

  it('should only execute when needed', async () => {
    setQueryString('?advanced-camera-card-action.id.substream_on=camera.office_hd');
    const api = createCardAPI();
    setCardID(api, 'id');
    vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(true);
    const manager = new QueryStringManager(api);

    expect(manager.hasViewRelatedActionsToRun()).toBeTruthy();
    await manager.executeIfNecessary();
    expect(manager.hasViewRelatedActionsToRun()).toBeFalsy();
    expect(api.getViewManager().setViewByParametersWithNewQuery).toHaveBeenCalledTimes(
      1,
    );

    await manager.executeIfNecessary();
    expect(manager.hasViewRelatedActionsToRun()).toBeFalsy();
    expect(api.getViewManager().setViewByParametersWithNewQuery).toHaveBeenCalledTimes(
      1,
    );

    manager.requestExecution();

    expect(manager.hasViewRelatedActionsToRun()).toBeTruthy();
    await manager.executeIfNecessary();
    expect(manager.hasViewRelatedActionsToRun()).toBeFalsy();
    expect(api.getViewManager().setViewByParametersWithNewQuery).toHaveBeenCalledTimes(
      2,
    );
  });

  it('should execute actions with old frigate-card-action key', async () => {
    setQueryString(`?frigate-card-action.id.clips=`);
    const api = createCardAPI();
    setCardID(api, 'id');

    // View actions do not need the card to have been updated.
    vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(false);
    const manager = new QueryStringManager(api);

    expect(manager.hasViewRelatedActionsToRun()).toBeTruthy();
    await manager.executeIfNecessary();
    expect(manager.hasViewRelatedActionsToRun()).toBeFalsy();

    expect(api.getViewManager().setViewByParametersWithNewQuery).toHaveBeenCalledWith({
      params: {
        view: 'clips',
      },
    });
  });

  describe('should filter by card_id', () => {
    it('should execute view action when card_id matches', async () => {
      setQueryString('?advanced-camera-card-action.my_card.clips=');
      const api = createCardAPI();
      setCardID(api, 'my_card');
      vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(false);
      const manager = new QueryStringManager(api);

      expect(manager.hasViewRelatedActionsToRun()).toBeTruthy();
      await manager.executeIfNecessary();

      expect(api.getViewManager().setViewByParametersWithNewQuery).toHaveBeenCalledWith({
        params: {
          view: 'clips',
        },
      });
    });

    it('should NOT execute view action when card_id does not match', async () => {
      setQueryString('?advanced-camera-card-action.other_card.clips=');
      const api = createCardAPI();
      setCardID(api, 'my_card');
      vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(false);
      const manager = new QueryStringManager(api);

      expect(manager.hasViewRelatedActionsToRun()).toBeFalsy();
      await manager.executeIfNecessary();

      expect(
        api.getViewManager().setViewByParametersWithNewQuery,
      ).not.toHaveBeenCalled();
      expect(api.getActionsManager().executeActions).not.toHaveBeenCalled();
    });

    it('should execute action without card_id on any card', async () => {
      setQueryString('?advanced-camera-card-action.clips=');
      const api = createCardAPI();
      setCardID(api, 'my_card');
      vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(false);
      const manager = new QueryStringManager(api);

      expect(manager.hasViewRelatedActionsToRun()).toBeTruthy();
      await manager.executeIfNecessary();

      expect(api.getViewManager().setViewByParametersWithNewQuery).toHaveBeenCalledWith({
        params: {
          view: 'clips',
        },
      });
    });

    it('should NOT execute non-view action when card_id does not match', async () => {
      setQueryString('?advanced-camera-card-action.other_card.menu_toggle=');
      const api = createCardAPI();
      setCardID(api, 'my_card');
      vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(true);
      const manager = new QueryStringManager(api);

      expect(manager.hasViewRelatedActionsToRun()).toBeFalsy();
      await manager.executeIfNecessary();

      expect(api.getActionsManager().executeActions).not.toHaveBeenCalled();
    });

    it('should execute action when card has no card_id and URL has card_id', async () => {
      setQueryString('?advanced-camera-card-action.some_card.clips=');
      const api = createCardAPI();
      vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(false);
      const manager = new QueryStringManager(api);

      // Should NOT execute since URL targets 'some_card' but this card has no card_id
      expect(manager.hasViewRelatedActionsToRun()).toBeFalsy();
      await manager.executeIfNecessary();

      expect(
        api.getViewManager().setViewByParametersWithNewQuery,
      ).not.toHaveBeenCalled();
    });
  });
});
