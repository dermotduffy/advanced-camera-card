import type { MenuIcon } from './icon';
import type { MenuStateIcon } from './state-icon';
import type { MenuSubmenu } from './submenu';
import type { MenuSubmenuSelect } from './submenu-select';

export type MenuItem = MenuIcon | MenuStateIcon | MenuSubmenu | MenuSubmenuSelect;
