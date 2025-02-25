import { Interaction } from '../../types';

export interface SubmenuItem {
  title?: string;
  subtitle?: string;
  icon?: string;
  entity?: string;
  style?: Record<string, string>;
  enabled?: boolean;
  selected?: boolean;

  hold_action?: unknown;
  double_tap_action?: unknown;
  [key: string]: unknown;
}

export interface SubmenuInteraction extends Interaction {
  item: SubmenuItem;
}
