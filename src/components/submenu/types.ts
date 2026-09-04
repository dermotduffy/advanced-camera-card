import type { Actions } from '../../config/schema/actions/types';
import type { Interaction } from '../../types';

export interface SubmenuItem extends Actions {
  title?: string;
  subtitle?: string;
  icon?: string;
  entity?: string;
  state_color?: boolean;
  style?: Record<string, string>;
  enabled?: boolean;
  selected?: boolean;
}

export interface SubmenuInteraction extends Interaction {
  item: SubmenuItem;
}
