import type { MessageBase } from 'home-assistant-js-websocket';

// At import the real ha-nunjucks engine finds Home Assistant by polling, on a
// timer, for a connected `home-assistant` element. This runs before each test
// file and connects one if none is connected, so the engine initializes
// immediately rather than leaving that timer pending.
if (!document.querySelector('home-assistant')) {
  const ha = document.createElement('home-assistant');
  Object.assign(ha, {
    hass: {
      // The readiness gate the engine polls for.
      connected: true,
      connection: {
        connected: true,
        // Awaited by ha-nunjucks' registry fetches during init. Most (labels,
        // entities) expect a bare array; repairs issues expects a `{issues}`
        // wrapper -- see ha-nunjucks' fetchLabelRegistry/fetchEntityRegistry
        // vs fetchRepairsIssues.
        sendMessagePromise: (message: MessageBase) =>
          Promise.resolve(message.type === 'repairs/list_issues' ? { issues: [] } : []),
        // ha-nunjucks 1.7.x subscribes to live registry updates (labels,
        // entities, repairs issues, config entries) during init via these two
        // methods; without them, the calls throw and the engine deletes its
        // own global state, silently.
        subscribeEvents: () => Promise.resolve(() => {}),
        subscribeMessage: () => Promise.resolve(() => {}),
      },
      language: 'en',
      // ha-nunjucks 1.7.x builds number/time formatters during init
      // (getNumberFormatter/getTimeFormatter), which read these unconditionally.
      locale: {
        language: 'en',
        number_format: 'language',
        time_format: 'language',
        time_zone: 'local',
      },
      // Fallback for resolveTimeZone() if the 'local' branch above isn't taken.
      config: {
        time_zone: 'UTC',
      },
      states: {},
    },
  });
  document.body.appendChild(ha);
}
