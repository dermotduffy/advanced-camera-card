import { HASS, renderTemplate } from 'ha-nunjucks/dist';
import { ConditionState, ConditionsTriggerData } from '../../conditions/types';
import { HomeAssistant } from '../../ha/types';

interface TemplateContextInternal {
  camera?: string;
  view?: string;
  trigger?: ConditionsTriggerData;
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
    },
  ): unknown => {
    return this._renderTemplateRecursively(
      hass,
      data,
      this._conditionStateToTemplateContext(
        options?.conditionState,
        options?.triggerData,
      ),
    );
  };

  protected _conditionStateToTemplateContext(
    conditionState?: ConditionState,
    triggerData?: ConditionsTriggerData,
  ): TemplateContext | undefined {
    if (!conditionState?.camera && !conditionState?.view && !triggerData) {
      return;
    }

    const advancedCameraCardContext: TemplateContextInternal = {
      ...(conditionState?.camera && { camera: conditionState.camera }),
      ...(conditionState?.view && { view: conditionState.view }),
      ...(triggerData && { trigger: triggerData }),
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
