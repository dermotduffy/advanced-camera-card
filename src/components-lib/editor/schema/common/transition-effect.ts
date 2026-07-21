import type { HAFormSchema } from '../../../../ha/types';
import { localize } from '../../../../localize/localize';
import { createSelectSelector } from './selectors';

// The "slide" transition effect between media. The field label auto-derives
// from each section's path; only the option labels are shared (under
// `config.common.transition_effects`).
export const getTransitionEffectSchema = (): HAFormSchema => ({
  name: 'transition_effect',
  selector: createSelectSelector([
    { value: 'none', label: localize('config.common.transition_effects.none') },
    { value: 'slide', label: localize('config.common.transition_effects.slide') },
  ]),
});
