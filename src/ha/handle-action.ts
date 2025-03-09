import { fireHASSEvent } from './fire-hass-event.js';
import { forwardHaptic } from './haptic.js';
import { navigate } from './navigate.js';
import { toggleEntity } from './toggle-entity.js';
import { ActionConfig, HomeAssistant } from './types.js';

export const handleActionConfig = (
  node: HTMLElement,
  hass: HomeAssistant,
  config: {
    entity?: string;
    camera_image?: string;
    hold_action?: ActionConfig;
    tap_action?: ActionConfig;
    double_tap_action?: ActionConfig;
  },
  actionConfig: ActionConfig | undefined,
): void => {
  if (!actionConfig) {
    actionConfig = {
      action: 'more-info',
    };
  }

  if (
    actionConfig.confirmation &&
    (!actionConfig.confirmation.exemptions ||
      !actionConfig.confirmation.exemptions.some((e) => e.user === hass!.user!.id))
  ) {
    forwardHaptic('warning');

    if (
      !confirm(
        actionConfig.confirmation.text ||
          `Are you sure you want to ${actionConfig.action}?`,
      )
    ) {
      return;
    }
  }

  switch (actionConfig.action) {
    case 'more-info':
      if (config.entity || config.camera_image) {
        fireHASSEvent(node, 'hass-more-info', {
          entityId: config.entity ? config.entity : config.camera_image!,
        });
      }
      break;
    case 'navigate':
      if (actionConfig.navigation_path) {
        navigate(node, actionConfig.navigation_path);
      }
      break;
    case 'url':
      if (actionConfig.url_path) {
        window.open(actionConfig.url_path);
      }
      break;
    case 'toggle':
      if (config.entity) {
        toggleEntity(hass, config.entity!);
        forwardHaptic('success');
      }
      break;
    case 'perform-action': {
      if (!actionConfig.perform_action) {
        forwardHaptic('failure');
        return;
      }
      const [domain, service] = actionConfig.perform_action.split('.', 2);
      hass.callService(domain, service, actionConfig.data, actionConfig.target);
      forwardHaptic('success');
      break;
    }
    case 'call-service': {
      if (!actionConfig.service) {
        forwardHaptic('failure');
        return;
      }
      const [domain, service] = actionConfig.service.split('.', 2);
      hass.callService(domain, service, actionConfig.data, actionConfig.target);
      forwardHaptic('success');
      break;
    }
    case 'fire-dom-event': {
      fireHASSEvent(node, 'll-custom', actionConfig);
    }
  }
};
