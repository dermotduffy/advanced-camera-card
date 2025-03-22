import { PTZAction } from '../../config/schema/actions/custom/ptz';
import { KeyboardShortcuts, PTZKeyboardShortcutName } from '../../config/schema/view';
import { createPTZMultiAction } from '../../utils/action';
import { CardConfigLoaderAPI, TaggedAutomation } from '../types';

export const setKeyboardShortcutsFromConfig = (api: CardConfigLoaderAPI) => {
  const automationTag = setKeyboardShortcutsFromConfig;
  api.getAutomationsManager().deleteAutomations(automationTag);

  const shortcuts = api.getConfigManager().getConfig()?.view.keyboard_shortcuts;
  if (!shortcuts) {
    return;
  }

  const automations = convertKeyboardShortcutsToAutomations(automationTag, shortcuts);
  if (automations.length) {
    api.getAutomationsManager().addAutomations(automations);
  }
};

const ptzKeyboardShortcutToPTZAction = (
  ptzKbs: PTZKeyboardShortcutName,
): PTZAction | null => {
  switch (ptzKbs) {
    case 'ptz_left':
      return 'left';
    case 'ptz_right':
      return 'right';
    case 'ptz_up':
      return 'up';
    case 'ptz_down':
      return 'down';
    case 'ptz_zoom_in':
      return 'zoom_in';
    case 'ptz_zoom_out':
      return 'zoom_out';
  }
  /* istanbul ignore next: No (current) way to reach this code -- @preserve */
  return null;
};

const convertKeyboardShortcutsToAutomations = (
  tag: unknown,
  shortcuts: KeyboardShortcuts,
): TaggedAutomation[] => {
  if (!shortcuts.enabled) {
    return [];
  }

  const automations: TaggedAutomation[] = [];

  for (const name of [
    'ptz_down',
    'ptz_left',
    'ptz_right',
    'ptz_up',
    'ptz_zoom_in',
    'ptz_zoom_out',
  ] as const) {
    const shortcut = shortcuts[name];
    const ptzAction = ptzKeyboardShortcutToPTZAction(name);
    if (!shortcut || !ptzAction) {
      continue;
    }

    automations.push({
      conditions: [
        {
          condition: 'key' as const,
          key: shortcut.key,
          state: 'down',
          shift: shortcut.shift,
          ctrl: shortcut.ctrl,
          alt: shortcut.alt,
          meta: shortcut.meta,
        },
      ],
      actions: [
        createPTZMultiAction({
          ptzAction: ptzAction,
          ptzPhase: 'start',
        }),
      ],
      tag: tag,
    });

    automations.push({
      conditions: [
        {
          condition: 'key' as const,
          key: shortcut.key,
          state: 'up',
        },
      ],
      actions: [
        createPTZMultiAction({
          ptzAction: ptzAction,
          ptzPhase: 'stop',
        }),
      ],
      tag: tag,
    });
  }

  const homeShortcut = shortcuts.ptz_home;
  if (homeShortcut) {
    automations.push({
      conditions: [
        {
          condition: 'key' as const,
          key: homeShortcut.key,
          state: 'down',
          shift: homeShortcut.shift,
          ctrl: homeShortcut.ctrl,
          alt: homeShortcut.alt,
          meta: homeShortcut.meta,
        },
      ],
      actions: [createPTZMultiAction()],
      tag: tag,
    });
  }

  return automations;
};
