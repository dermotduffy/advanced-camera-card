import { GrMenuItem } from '@graphiteds/core/components/gr-menu-item';
import { GrSelect } from '@graphiteds/core/components/gr-select';

// It was difficult to find a multi-select web component that matches these criteria:
// - Is a dropdown vs multi-select list.
// - Open source.
// - Supports being in a ScopedRegistry out of the box (i.e. does not auto-register with customElements).
// - Looks attractive / compatible with mostly Material elements.
// - Styleable
// - Does not bloat output size considerably.

// Web components evaluated (https://open-wc.org/guides/community/component-libraries/):
// - Material: No multiselect component.
// - Freshwords/@crayon: Considerable bloat in output due to i18n translations
//   that are used by _other_ components.
// - Carbon Design System: Workable, but less moderm / Material-like.
// - UI5: Auto-registers globally.
// - Vaadin: Auto-registers globally.
// - Liquid: Not open source.
// - [Many others]: No multiselect component.

export const grSelectElements = {
  'gr-select': GrSelect,
  'gr-menu-item': GrMenuItem,
};
