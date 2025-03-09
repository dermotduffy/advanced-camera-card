import pkg from '../../package.json';
import { RawAdvancedCameraCardConfig } from '../config/types';
import { HomeAssistant } from '../ha/types';
import { getLanguage } from '../localize/localize';
import { getIntegrationManifest } from './ha/integration';
import { IntegrationManifest } from './ha/integration/types';
import { DeviceRegistryManager } from './ha/registry/device';
import { HASS_WEB_PROXY_DOMAIN } from './ha/web-proxy';

type FrigateDevices = Record<string, string>;

interface GitDiagnostics {
  build_version?: string;
  build_date?: string;
  commit_date?: string;
}

interface IntegrationDiagnostics {
  detected: boolean;
  version?: string;
}

export const getReleaseVersion = (): string => {
  const releaseVersion: string = '__ADVANCED_CAMERA_CARD_RELEASE_VERSION__';

  /* istanbul ignore if: depends on rollup substitution -- @preserve */
  if (releaseVersion === 'pkg') {
    return pkg.version;
  }

  /* istanbul ignore if: depends on rollup substitution -- @preserve */
  if (releaseVersion === 'dev') {
    return `dev+${pkg['gitAbbrevHash']}`;
  }

  return releaseVersion;
};

interface Diagnostics {
  card_version: string;
  browser: string;
  date: Date;
  lang: string;
  timezone: string;
  git: GitDiagnostics;

  ha_version?: string;
  config?: RawAdvancedCameraCardConfig;

  custom_integrations: {
    frigate: IntegrationDiagnostics & {
      devices?: FrigateDevices;
    };
    hass_web_proxy: IntegrationDiagnostics;
  };
}

const getIntegrationDiagnostics = async (
  integration: string,
  hass?: HomeAssistant,
): Promise<IntegrationDiagnostics> => {
  let manifest: IntegrationManifest | null = null;

  if (hass) {
    try {
      manifest = await getIntegrationManifest(hass, integration);
    } catch (e) {
      // Silently ignore integrations not being found.
    }
  }

  return {
    detected: !!manifest,
    ...(manifest?.version && { version: manifest.version }),
  };
};

export const getDiagnostics = async (
  hass?: HomeAssistant,
  deviceRegistryManager?: DeviceRegistryManager,
  rawConfig?: RawAdvancedCameraCardConfig,
): Promise<Diagnostics> => {
  // Get the Frigate devices in order to extract the Frigate integration and
  // server version numbers.
  const frigateDevices =
    hass && deviceRegistryManager
      ? await deviceRegistryManager.getMatchingDevices(
          hass,
          (device) => device.manufacturer === 'Frigate',
        )
      : [];

  const frigateVersionMap: Map<string, string> = new Map();
  frigateDevices?.forEach((device) => {
    device.config_entries.forEach((configEntry) => {
      if (device.model) {
        frigateVersionMap.set(configEntry, device.model);
      }
    });
  });

  return {
    card_version: getReleaseVersion(),
    browser: navigator.userAgent,
    date: new Date(),
    lang: getLanguage(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    git: {
      ...(pkg['gitAbbrevHash'] && { hash: pkg['gitAbbrevHash'] }),
      ...(pkg['buildDate'] && { build_date: pkg['buildDate'] }),
      ...(pkg['gitDate'] && { commit_date: pkg['gitDate'] }),
    },
    ...(hass && { ha_version: hass.config.version }),
    custom_integrations: {
      frigate: {
        ...(await getIntegrationDiagnostics('frigate', hass)),
        ...(frigateVersionMap.size && {
          devices: Object.fromEntries(frigateVersionMap),
        }),
      },
      hass_web_proxy: await getIntegrationDiagnostics(HASS_WEB_PROXY_DOMAIN, hass),
    },
    ...(rawConfig && { config: rawConfig }),
  };
};
