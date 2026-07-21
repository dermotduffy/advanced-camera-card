import type { TemplateResult } from 'lit';
import { isEqual } from 'lodash-es';

import type { RawAdvancedCameraCardConfig } from '../../config/types';
import type { HAFormSchema } from '../../ha/types';
import { getDocLinkPath } from './doc-links';
import { computeConfigChanges, computeDisplayedData } from './form-data';
import { computeFormLabel } from './form-labels';
import { getForms, type FormRequest, type FormRequestOptions } from './schema/registry';
import type { ConfigChange, ConfigPath, EditorForm } from './types';

// A form together with the callbacks `ha-form` needs. Held as one object and
// reused across renders: `ha-form` compares each of these by identity, and
// rebuilding them would re-render every field of every open form whenever
// anything else in the editor changes.
export interface FormContext {
  // The fields to show, and where in the configuration they live.
  form: EditorForm;

  // The values the fields show: the configured ones, with anything unset
  // filled in from the defaults.
  displayedData: RawAdvancedCameraCardConfig;

  // The name to show for a field.
  computeLabel: (
    schema: HAFormSchema,
    data?: unknown,
    options?: { path?: string[] },
  ) => string;

  // The documentation link to show under a field, or null for a field that
  // has no documentation of its own.
  computeHelper: (
    schema: HAFormSchema,
    options?: { path?: string[] },
  ) => TemplateResult | null;

  // Called by `ha-form` with the whole form's data whenever the user edits a
  // field.
  valueChanged: (ev: CustomEvent<{ value?: unknown }>) => void;
}

// Everything a form needs to be built and filled in: the user's configuration,
// the defaults a field shows when the configuration does not set it, and the
// lists of cameras and folders the dropdowns choose from.
export interface FormsInput {
  // The user's configuration, which may be partially or completely invalid.
  config: RawAdvancedCameraCardConfig;

  // The value each field shows when the configuration does not set it, with
  // any adjustments the configured profiles make.
  defaults: RawAdvancedCameraCardConfig;

  // The lists a dropdown chooses from: the cameras and the folders.
  options: FormRequestOptions;
}

/**
 * Builds the forms for one part of the configuration (e.g. the menu section, or
 * a camera) and works out what each one displays, what its fields are called,
 * where its documentation is, and what an edit to it means for the
 * configuration.
 *
 * The forms are built again only if a different part is asked for, or if the
 * lists the dropdowns choose from change. `ha-form` compares what it is given
 * by identity, so handing it a new object every render would redraw every field
 * and interrupt whatever the user was typing.
 *
 * This never changes the configuration. An edit is passed to `onChanges` as a
 * list of changes, each naming the full path of the value it applies to.
 */
export class FormsController {
  // Reports the changes an edit represents. The changes carry absolute
  // configuration paths, so the receiver applies them without knowing which
  // form produced them.
  private _onChanges: (changes: ConfigChange[]) => void;

  // Renders the documentation link for a configuration path. Injected because
  // a template belongs to the rendering layer.
  private _renderDocumentation: (path: ConfigPath) => TemplateResult | null;

  private _request: FormRequest | null = null;
  private _options: FormRequestOptions | null = null;

  // Empty until the first `setInput`, which is harmless: there are no forms to
  // read it until then.
  private _input: FormsInput = {
    config: {},
    defaults: {},
    options: { cameras: [], folders: [] },
  };

  private _contexts: FormContext[] = [];

  constructor(
    onChanges: (changes: ConfigChange[]) => void,
    renderDocumentation: (path: ConfigPath) => TemplateResult | null,
  ) {
    this._onChanges = onChanges;
    this._renderDocumentation = renderDocumentation;
  }

  /**
   * Set which forms are wanted and the configuration they display. The
   * contexts are rebuilt only when something they depend on has actually
   * changed, so that a change elsewhere in the editor leaves open forms alone.
   * @param request Which part of the configuration the forms are for.
   * @param input The configuration, the defaults and the dropdown choices.
   */
  public setInput(request: FormRequest, input: FormsInput): void {
    // Whether the forms *might* differ. A request builds its forms from only
    // some of the options, so this asks the question rather than answering it.
    const mightDiffer =
      !isEqual(this._request, request) || !isEqual(this._options, input.options);
    this._request = request;
    this._options = input.options;

    // Whether they actually do. Building forms is cheap; replacing them is not,
    // since `ha-form` compares by identity and redraws every field it is handed
    // anew. Renaming a camera, for instance, changes the list of cameras every
    // *other* camera's dependency dropdown offers, while that camera's own form
    // (which never lists itself) comes back exactly as it was.
    const rebuilt = mightDiffer ? getForms(request, input.options) : null;
    const changedForms =
      rebuilt &&
      !isEqual(
        rebuilt,
        this._contexts.map((context) => context.form),
      )
        ? rebuilt
        : null;

    const previous = this._input;
    if (
      !changedForms &&
      previous.config === input.config &&
      previous.defaults === input.defaults
    ) {
      return;
    }
    this._input = input;

    // Only what a form displays depends on the configuration. Its schema and
    // its callbacks do not, so when the forms themselves are unchanged only the
    // displayed data is replaced: rebuilding the rest would have `ha-form`
    // re-render every field of every open form, losing whatever the user was
    // typing.
    this._contexts = changedForms
      ? changedForms.map((form, index) => this._buildContext(form, index, input))
      : this._contexts.map((context) => ({
          ...context,
          displayedData: computeDisplayedData(
            context.form,
            input.config,
            input.defaults,
          ),
        }));
  }

  public getContexts(): FormContext[] {
    return this._contexts;
  }

  private _buildContext(
    form: EditorForm,
    index: number,
    input: FormsInput,
  ): FormContext {
    return {
      form,
      displayedData: computeDisplayedData(form, input.config, input.defaults),
      computeLabel: (
        schema: HAFormSchema,
        _data?: unknown,
        options?: { path?: string[] },
      ) => computeFormLabel(form.basePath, schema, options),

      // Caution: `ha-form` types the helper as a string, but interpolates it
      // into a Lit template, so a template renders as-is; should a future Home
      // Assistant version coerce it to a string, the link would degrade to
      // text.
      computeHelper: (schema: HAFormSchema, options?: { path?: string[] }) => {
        const path = getDocLinkPath(form.basePath, schema, options);
        return path ? this._renderDocumentation(path) : null;
      },
      valueChanged: (ev: CustomEvent<{ value?: unknown }>) =>
        this._valueChanged(index, ev),
    };
  }

  private _valueChanged(index: number, ev: CustomEvent<{ value?: unknown }>): void {
    const context = this._contexts[index];
    if (!context) {
      return;
    }

    const changes = computeConfigChanges(
      context.form,
      context.displayedData,
      ev.detail?.value,
      this._input.config,
      this._input.defaults,
    );

    if (changes.length) {
      this._onChanges(changes);
    }
  }
}
