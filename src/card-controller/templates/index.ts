import { HASS, renderTemplate } from 'ha-nunjucks/dist';
import { ConditionState, ConditionsTriggerData } from '../../conditions/types';
import { HomeAssistant } from '../../ha/types';

interface TemplateMediaData {
  title: string;
  is_folder: boolean;
}
interface TemplateContextInternal {
  camera?: string;
  view?: string;
  trigger?: ConditionsTriggerData;
  media?: TemplateMediaData;
}

interface TemplateContext {
  advanced_camera_card: TemplateContextInternal;

  // Convenient alias.
  acc: TemplateContextInternal;
}

export class TemplateRenderer {
  public renderRecursively = (
    hass: HomeAssistant,
    data: unknown,
    options?: {
      conditionState?: ConditionState;
      triggerData?: ConditionsTriggerData;
      mediaData?: TemplateMediaData;
    },
  ): unknown => {
    return this._renderTemplateRecursively(
      hass,
      data,
      this._generateTemplateContext(options),
    );
  };

  protected _generateTemplateContext(options?: {
    conditionState?: ConditionState;
    triggerData?: ConditionsTriggerData;
    mediaData?: TemplateMediaData;
  }): TemplateContext | undefined {
    if (
      !options?.conditionState?.camera &&
      !options?.conditionState?.view &&
      !options?.triggerData &&
      !options?.mediaData
    ) {
      return;
    }

    const advancedCameraCardContext: TemplateContextInternal = {
      ...(options?.conditionState?.camera && { camera: options.conditionState.camera }),
      ...(options?.conditionState?.view && { view: options.conditionState.view }),
      ...(options?.triggerData && { trigger: options.triggerData }),
      ...(options?.mediaData && { media: options.mediaData }),
    };

    return {
      acc: advancedCameraCardContext,
      advanced_camera_card: advancedCameraCardContext,
    };
  }

  protected _renderTemplateRecursively(
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
