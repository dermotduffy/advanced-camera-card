import type { ReactiveController, ReactiveControllerHost, TemplateResult } from 'lit';

import { FormsController, type FormContext, type FormsInput } from './forms-controller';
import { fireEditorIntent } from './intents';
import type { FormRequest } from './schema/registry';
import type { ConfigChange, ConfigPath } from './types';

type SectionEditorControllerHost = ReactiveControllerHost & EventTarget;

/**
 * One top-level section of the editor: whether its panel is open, and the
 * forms it shows. A section is given the whole configuration, because a
 * dropdown in one section may list values set in another, but it never changes
 * it: an edit is reported to the editor as an intent.
 */
export class SectionController implements ReactiveController {
  private _host: SectionEditorControllerHost;
  private _formsController: FormsController;

  private _open = false;

  // A section's body is built only once it has been opened, and is kept
  // afterwards: closing animates, and a section the user never opens never
  // builds its forms at all.
  private _everOpened = false;

  constructor(
    host: SectionEditorControllerHost,
    renderDocumentation: (path: ConfigPath) => TemplateResult | null,
  ) {
    this._host = host;
    this._formsController = new FormsController(
      (changes: ConfigChange[]) =>
        fireEditorIntent(this._host, { type: 'changes', changes }),
      renderDocumentation,
    );
    host.addController(this);
  }

  public hostConnected(): void {
    // No connection-time work.
  }

  public setInput(request: FormRequest, input: FormsInput): void {
    this._formsController.setInput(request, input);
  }

  public getContexts(): FormContext[] {
    return this._formsController.getContexts();
  }

  public isOpen(): boolean {
    return this._open;
  }

  public wasEverOpened(): boolean {
    return this._everOpened;
  }

  public setOpen(open: boolean): void {
    if (open === this._open) {
      return;
    }
    this._open = open;
    this._everOpened = this._everOpened || open;
    this._host.requestUpdate();
  }
}
