import type { IssueKey, IssuePresence } from '../card-controller/issues/types';
import type { MicrophoneDiagnostics } from '../card-controller/types';
import type { RawAdvancedCameraCardConfig } from '../config/types';
import { getIntegrationManifest } from '../ha/integration';
import type { IntegrationManifest } from '../ha/integration/types';
import type { DeviceRegistryManager } from '../ha/registry/device';
import type { HomeAssistant } from '../ha/types';
import { HASS_WEB_PROXY_DOMAIN } from '../ha/web-proxy';
import { getLanguage } from '../localize/localize';
import { getGitInfo, getReleaseVersion } from './build-info';

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

interface Diagnostics {
  card_version: string;
  browser: string;
  date: Date;
  lang: string;
  timezone: string;
  git: GitDiagnostics;

  ha_version?: string;
  config?: RawAdvancedCameraCardConfig;
  issues?: IssueKey[];
  microphone?: MicrophoneDiagnostics;

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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      // Silently ignore integrations not being found.
    }
  }

  return {
    detected: !!manifest,
    ...(manifest?.version && { version: manifest.version }),
  };
};

export const getDiagnostics = async (options?: {
  hass?: HomeAssistant;
  deviceRegistryManager?: DeviceRegistryManager;
  rawConfig?: RawAdvancedCameraCardConfig;
  issues?: IssuePresence;
  microphoneDiagnostics?: MicrophoneDiagnostics;
}): Promise<Diagnostics> => {
  const { hass, deviceRegistryManager, rawConfig, issues, microphoneDiagnostics } =
    options ?? {};

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

  const gitInfo = getGitInfo();

  return {
    card_version: getReleaseVersion(),
    browser: navigator.userAgent,
    date: new Date(),
    lang: getLanguage(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    git: {
      ...(gitInfo.hash && { hash: gitInfo.hash }),
      ...(gitInfo.buildDate && { build_date: gitInfo.buildDate }),
      ...(gitInfo.commitDate && { commit_date: gitInfo.commitDate }),
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
    issues: issues ? [...issues.keys()] : [],
    ...(rawConfig && { config: rawConfig }),
    ...(microphoneDiagnostics && { microphone: microphoneDiagnostics }),
  };
};
