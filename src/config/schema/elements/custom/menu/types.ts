import { MenuIcon } from './icon';
import { MenuStateIcon } from './state-icon';
import { MenuSubmenu } from './submenu';
import { MenuSubmenuSelect } from './submenu-select';

export type MenuItem = MenuIcon | MenuStateIcon | MenuSubmenu | MenuSubmenuSelect;
