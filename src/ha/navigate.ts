import { fireHASSEvent } from './fire-hass-event.js';

declare global {
  interface HASSDomEvents {
    'location-changed': {
      replace: boolean;
    };
  }
}

export const navigate = (_node: unknown, path: string, replace: boolean = false) => {
  if (replace) {
    history.replaceState(null, '', path);
  } else {
    history.pushState(null, '', path);
  }
  fireHASSEvent(window, 'location-changed', {
    replace,
  });
};
