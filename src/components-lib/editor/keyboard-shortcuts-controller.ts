import type { ReactiveController, ReactiveControllerHost, TemplateResult } from 'lit';

import { CONF_VIEW_KEYBOARD_SHORTCUTS } from '../../config/const';
import { getConfigValue } from '../../config/management';
import { PTZ_KEYBOARD_SHORTCUTS, type KeyboardShortcut } from '../../config/schema/view';
import { FormsController, type FormContext, type FormsInput } from './forms-controller';
import { fireEditorIntent } from './intents';
import type { FormRequest } from './schema/registry';
import type { ConfigChange, ConfigPath } from './types';

type KeyboardShortcutsControllerHost = ReactiveControllerHost & EventTarget;

const FORM_REQUEST: FormRequest = {
  kind: 'full-section',
  name: 'view.keyboard_shortcuts',
};

/**
 * The keyboard shortcuts panel: the settings that apply to all the shortcuts,
 * and the key assigned to each one. A key is assigned by pressing it rather
 * than by filling in a field, so the individual shortcuts cannot be part of
 * the panel's own form.
 */
export class KeyboardShortcutsController implements ReactiveController {
  private _host: KeyboardShortcutsControllerHost;
  private _forms: FormsController;
  private _input: FormsInput | null = null;

  constructor(
    host: KeyboardShortcutsControllerHost,
    renderDocumentation: (path: ConfigPath) => TemplateResult | null,
  ) {
    this._host = host;
    this._forms = new FormsController(
      (changes: ConfigChange[]) =>
        fireEditorIntent(this._host, { type: 'changes', changes }),
      renderDocumentation,
    );
    host.addController(this);
  }

  public hostConnected(): void {
    // No connection-time work.
  }

  public setInput(input: FormsInput): void {
    this._input = input;
    this._forms.setInput(FORM_REQUEST, input);
  }

  public getContexts(): FormContext[] {
    return this._forms.getContexts();
  }

  /**
   * Get the key assigned to each shortcut: the configured one, or the default
   * where the configuration says nothing.
   * @returns The shortcuts, keyed by name and in the order they are shown.
   */
  public getShortcuts(): Record<string, unknown> {
    const shortcuts: Record<string, unknown> = {};
    for (const name of PTZ_KEYBOARD_SHORTCUTS) {
      shortcuts[name] = getConfigValue(
        this._input?.config ?? {},
        `${CONF_VIEW_KEYBOARD_SHORTCUTS}.${name}`,
        getConfigValue(this._input?.defaults ?? {}, [
          ...CONF_VIEW_KEYBOARD_SHORTCUTS.split('.'),
          name,
        ]),
      );
    }
    return shortcuts;
  }

  public setShortcut(name: string, value: KeyboardShortcut | null): void {
    fireEditorIntent(this._host, {
      type: 'changes',
      changes: [
        {
          path: [...CONF_VIEW_KEYBOARD_SHORTCUTS.split('.'), name],
          // A null shortcut is set rather than deleted: it means the user
          // deliberately unassigned a key that has a default.
          type: 'set',
          value,
        },
      ],
    });
  }
}
