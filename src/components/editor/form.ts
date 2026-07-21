import { html, type TemplateResult } from 'lit';

import type { FormContext } from '../../components-lib/editor/forms-controller';
import type { HomeAssistant } from '../../ha/types';

/**
 * Render the `ha-form`s of a set of form contexts. Each context is passed
 * through as it stands: `ha-form` compares its inputs by identity, so
 * substituting an equivalent object for any of them re-renders every field.
 * @param hass The HomeAssistant object.
 * @param contexts The contexts to render.
 * @returns A rendered template.
 */
export const renderForms = (
  hass: HomeAssistant | undefined,
  contexts: FormContext[],
): TemplateResult => {
  return html`${contexts.map(
    (context) => html`
      <ha-form
        .hass=${hass}
        .data=${context.displayedData}
        .schema=${context.form.schema}
        .computeLabel=${context.computeLabel}
        .computeHelper=${context.computeHelper}
        @value-changed=${context.valueChanged}
      ></ha-form>
    `,
  )}`;
};
