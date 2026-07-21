import type { ReactiveController, ReactiveControllerHost, TemplateResult } from 'lit';

import { EqualityMap } from '../../cache/equality-map';
import { getConfigValue } from '../../config/management';
import type { RawAdvancedCameraCardConfigArray } from '../../config/types';
import { isRecord } from '../../utils/basic';
import { FormsController, type FormContext, type FormsInput } from './forms-controller';
import { fireEditorIntent } from './intents';
import type { FormRequest } from './schema/registry';
import type { ConfigChange, ConfigPath } from './types';

type ListFormsControllerHost = ReactiveControllerHost & EventTarget;

/**
 * The forms for a part of the editor that shows a list the user can add to,
 * reorder and delete from (e.g. cameras, folders, a camera's event triggers).
 * Every item in such a list has its own forms, so the forms are kept one set
 * per item rather than under fixed names, and the list itself is read straight
 * from the configuration, where it is an array.
 *
 * This never changes the configuration. An edit, or a change to the list, is
 * reported to the editor as an intent naming the full path it applies to.
 */
export class ListFormsController implements ReactiveController {
  private _host: ListFormsControllerHost;
  private _renderDocumentation: (path: ConfigPath) => TemplateResult | null;

  private _input: FormsInput | null = null;

  // One set of forms per item asked for, kept between renders so that editing
  // one item does not redraw the others. Keyed by the request itself, matched
  // by value.
  private _formsControllers = new EqualityMap<FormRequest, FormsController>();

  constructor(
    host: ListFormsControllerHost,
    renderDocumentation: (path: ConfigPath) => TemplateResult | null,
  ) {
    this._host = host;
    this._renderDocumentation = renderDocumentation;
    host.addController(this);
  }

  public hostConnected(): void {
    // No connection-time work.
  }

  public setInput(input: FormsInput): void {
    this._input = input;
  }

  /**
   * Read a list of items from the configuration. Non-object entries become
   * empty objects rather than being dropped, so that positions in the list
   * always match the configuration's own indices (edits address items by
   * index).
   * @param path The path of the list.
   * @returns The items.
   */
  public getList(path: ConfigPath): RawAdvancedCameraCardConfigArray {
    const value = this._input ? getConfigValue(this._input.config, path) : null;
    return Array.isArray(value)
      ? value.map((entry) => (isRecord(entry) ? entry : {}))
      : [];
  }

  public getFormContexts(request: FormRequest): FormContext[] {
    const input = this._input;
    if (!input) {
      return [];
    }
    let formsController = this._formsControllers.get(request);
    if (!formsController) {
      formsController = new FormsController(
        (changes: ConfigChange[]) =>
          fireEditorIntent(this._host, { type: 'changes', changes }),
        this._renderDocumentation,
      );
      this._formsControllers.set(request, formsController);
    }

    formsController.setInput(request, input);
    return formsController.getContexts();
  }

  public addItem(path: ConfigPath, item: unknown): void {
    fireEditorIntent(this._host, { type: 'list-add', path, item });
  }

  public moveItem(path: ConfigPath, from: number, to: number): void {
    fireEditorIntent(this._host, { type: 'list-move', path, from, to });
  }

  public deleteItem(path: ConfigPath, index: number): void {
    fireEditorIntent(this._host, { type: 'list-delete', path, index });
  }
}
