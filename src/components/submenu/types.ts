import { Actions } from '../../config/types';
import { Interaction } from '../../types';

export interface SubmenuItem extends Actions {
  title?: string;
  subtitle?: string;
  icon?: string;
  entity?: string;
  style?: Record<string, string>;
  enabled?: boolean;
  selected?: boolean;
}

export interface SubmenuInteraction extends Interaction {
  item: SubmenuItem;
}
