import { describe, expect, it, vi } from 'vitest';

import { setKeyboardShortcutsFromConfig } from '../../../src/card-controller/config/load-keyboard-shortcuts';
import type { PTZAction } from '../../../src/config/schema/actions/custom/ptz';
import type { PTZKeyboardShortcutName } from '../../../src/config/schema/view';
import { createConfig } from '../../config/test-utils';
import { createCardAPI } from '../../test-utils';

describe('setKeyboardShortcutsFromConfig', () => {
  it('without shortcuts', () => {
    const api = createCardAPI();
    setKeyboardShortcutsFromConfig(api);

    expect(api.getAutomationsManager().deleteAutomations).toHaveBeenCalledWith(
      setKeyboardShortcutsFromConfig,
    );
    expect(api.getAutomationsManager().addAutomations).not.toHaveBeenCalled();
  });

  it('with shortcuts disabled', () => {
    const api = createCardAPI();
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
      createConfig({
        view: {
          keyboard_shortcuts: {
            enabled: false,
          },
        },
      }),
    );
    setKeyboardShortcutsFromConfig(api);

    expect(api.getAutomationsManager().deleteAutomations).toHaveBeenCalledWith(
      setKeyboardShortcutsFromConfig,
    );
    expect(api.getAutomationsManager().addAutomations).not.toHaveBeenCalled();
  });

  describe('PTZ shortcuts', () => {
    describe('actions', () => {
      it.each([
        ['ptz_left' as const, 'left' as const],
        ['ptz_right' as const, 'right' as const],
        ['ptz_up' as const, 'up' as const],
        ['ptz_down' as const, 'down' as const],
        ['ptz_zoom_in' as const, 'zoom_in' as const],
        ['ptz_zoom_out' as const, 'zoom_out' as const],
      ])('%s', (name: PTZKeyboardShortcutName, ptzAction: PTZAction) => {
        const api = createCardAPI();
        vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
          createConfig({
            view: {
              keyboard_shortcuts: {
                enabled: true,
                ptz_home: null,
                ptz_left: null,
                ptz_right: null,
                ptz_up: null,
                ptz_down: null,
                ptz_zoom_in: null,
                ptz_zoom_out: null,
                [name]: { key: 'z' },
              },
            },
          }),
        );

        setKeyboardShortcutsFromConfig(api);

        expect(api.getAutomationsManager().deleteAutomations).toHaveBeenCalledWith(
          setKeyboardShortcutsFromConfig,
        );
        expect(api.getAutomationsManager().addAutomations).toHaveBeenCalledWith([
          {
            actions: [
              {
                action: 'fire-dom-event',
                advanced_camera_card_action: 'ptz_multi',
                ptz_action: ptzAction,
                ptz_phase: 'start',
              },
            ],
            triggers: [
              {
                alt: undefined,
                trigger: 'key',
                ctrl: undefined,
                key: 'z',
                meta: undefined,
                shift: undefined,
                state: 'down',
              },
            ],
            tag: setKeyboardShortcutsFromConfig,
          },
          {
            actions: [
              {
                action: 'fire-dom-event',
                advanced_camera_card_action: 'ptz_multi',
                ptz_action: ptzAction,
                ptz_phase: 'stop',
              },
            ],
            triggers: [
              {
                trigger: 'key',
                key: 'z',
                state: 'up',
              },
            ],
            tag: setKeyboardShortcutsFromConfig,
          },
        ]);
      });

      it('should give the start and stop of a shortcut the same modifiers', () => {
        const api = createCardAPI();
        vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
          createConfig({
            view: {
              keyboard_shortcuts: {
                enabled: true,
                ptz_home: null,
                ptz_right: null,
                ptz_up: null,
                ptz_down: null,
                ptz_zoom_in: null,
                ptz_zoom_out: null,
                ptz_left: { key: 'z', ctrl: false, alt: false, meta: false },
              },
            },
          }),
        );

        setKeyboardShortcutsFromConfig(api);

        const automations = vi.mocked(api.getAutomationsManager().addAutomations).mock
          .calls[0][0];
        expect(automations.map((automation) => automation.triggers)).toEqual([
          [
            {
              trigger: 'key',
              key: 'z',
              state: 'down',
              ctrl: false,
              alt: false,
              meta: false,
              shift: undefined,
            },
          ],
          [
            {
              trigger: 'key',
              key: 'z',
              state: 'up',
              ctrl: false,
              alt: false,
              meta: false,
              shift: undefined,
            },
          ],
        ]);
      });

      it('ptz_home', () => {
        const api = createCardAPI();
        vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());

        setKeyboardShortcutsFromConfig(api);

        expect(api.getAutomationsManager().deleteAutomations).toHaveBeenCalledWith(
          setKeyboardShortcutsFromConfig,
        );
        expect(api.getAutomationsManager().addAutomations).toHaveBeenCalledWith(
          expect.arrayContaining([
            {
              actions: [
                {
                  action: 'fire-dom-event',
                  advanced_camera_card_action: 'ptz_multi',
                },
              ],
              triggers: [
                {
                  alt: false,
                  trigger: 'key',
                  ctrl: false,
                  key: 'h',
                  meta: false,
                  shift: undefined,
                  state: 'down',
                },
              ],
              tag: setKeyboardShortcutsFromConfig,
            },
          ]),
        );
      });
    });
  });
});
