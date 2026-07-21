// Registers the card's custom icons as a Home Assistant custom iconset, so
// any `ha-icon` (and the icon picker) can render `advanced-camera-card:<name>`
// icons -- inside or outside the card. The iconset format supports a single
// monochrome SVG path per icon, so each asset is a single-path silhouette,
// with its path data extracted at build time.

import frigateIcon from '../images/icons/frigate.svg';
import irisIcon from '../images/icons/iris.svg';
import motioneyeIcon from '../images/icons/motioneye.svg';
import reolinkIcon from '../images/icons/reolink.svg';
import tplinkIcon from '../images/icons/tplink.svg';

interface CustomIconsetIcon {
  path: string;
  viewBox?: string;
}

interface CustomIconsetListItem {
  name: string;
}

interface CustomIconsetHelpers {
  getIcon: (name: string) => Promise<CustomIconsetIcon>;
  getIconList: () => Promise<CustomIconsetListItem[]>;
}

declare global {
  interface Window {
    customIcons?: Record<string, CustomIconsetHelpers>;
  }
}

export const CUSTOM_ICONSET_PREFIX = 'advanced-camera-card';

const ICONS: Record<string, CustomIconsetIcon> = {
  frigate: frigateIcon,
  iris: irisIcon,
  motioneye: motioneyeIcon,
  reolink: reolinkIcon,
  tplink: tplinkIcon,
};

export const CUSTOM_ICON_NAMES = Object.keys(ICONS);

const getIcon = async (name: string): Promise<CustomIconsetIcon> => {
  const icon: CustomIconsetIcon | undefined = ICONS[name];
  if (!icon) {
    throw new Error(`Unknown icon: ${CUSTOM_ICONSET_PREFIX}:${name}`);
  }
  return icon;
};

const getIconList = async (): Promise<CustomIconsetListItem[]> =>
  CUSTOM_ICON_NAMES.map((name) => ({ name }));

/**
 * Register the card's custom iconset with Home Assistant. Safe to call more
 * than once; an existing registration (e.g. from a second loaded copy of the
 * card) is left in place.
 */
export const registerCustomIconset = (): void => {
  window.customIcons ??= {};
  window.customIcons[CUSTOM_ICONSET_PREFIX] ??= { getIcon, getIconList };
};
