import { HASS, renderTemplate } from 'ha-nunjucks/dist';
import { ConditionState } from '../../condition-trigger/conditions/types';
import { TriggerData } from '../../condition-trigger/triggers/types';
import { HomeAssistant } from '../../ha/types';
import { TemplateACCNamespace, TemplateMediaData } from './types';

interface TemplateContext {
  advanced_camera_card: TemplateACCNamespace;

  // Convenient alias.
  acc: TemplateACCNamespace;

  // The HA-native top-level `trigger`, set only when a trigger fired.
  trigger?: TriggerData;
}

interface TemplateRenderOptions {
  conditionState?: ConditionState;
  triggerData?: TriggerData;
  mediaData?: TemplateMediaData;
}

export class TemplateRenderer {
  public renderRecursively = (
    hass: HomeAssistant,
    data: unknown,
    options?: TemplateRenderOptions,
  ): unknown => {
    return this._renderTemplateRecursively(
      hass,
      data,
      this._generateTemplateContext(options),
    );
  };

  private _generateTemplateContext(
    options?: TemplateRenderOptions,
  ): TemplateContext | undefined {
    if (
      !options?.conditionState?.camera &&
      !options?.conditionState?.view &&
      !options?.conditionState?.config &&
      !options?.triggerData &&
      !options?.mediaData
    ) {
      return;
    }

    const advancedCameraCardContext: TemplateACCNamespace = {
      ...(options?.conditionState?.camera && { camera: options.conditionState.camera }),
      ...(options?.conditionState?.view && { view: options.conditionState.view }),
      ...(options?.conditionState?.config && { config: options.conditionState.config }),
      ...(options?.mediaData && { media: options.mediaData }),
    };

    return {
      acc: advancedCameraCardContext,
      advanced_camera_card: advancedCameraCardContext,
      ...(options?.triggerData && { trigger: options.triggerData }),
    };
  }

  private _renderTemplateRecursively(
    hass: HomeAssistant,
    data: unknown,
    templateContext?: TemplateContext,
  ): unknown {
    if (typeof data === 'string') {
      return renderTemplate(
        // ha-nunjucks has a more complete model of the Home Assistant object, but
        // does not export it as a type.
        hass as unknown as typeof HASS,
        data,
        templateContext,
      );
    } else if (Array.isArray(data)) {
      return data.map((item) =>
        this._renderTemplateRecursively(hass, item, templateContext),
      );
    } else if (typeof data === 'object' && data !== null) {
      const result = {};
      for (const key in data) {
        result[key] = this._renderTemplateRecursively(hass, data[key], templateContext);
      }
      return result;
    }
    return data;
  }
}
