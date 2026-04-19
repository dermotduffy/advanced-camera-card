import { ConditionState, ConditionsTriggerData } from '../../conditions/types';
import { HomeAssistant } from '../../ha/types';

type HANunjucksRenderTemplate = (
  hass: unknown,
  str: string,
  context?: object,
  validate?: boolean,
) => string | boolean;

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

interface TemplateRenderOptions {
  conditionState?: ConditionState;
  triggerData?: ConditionsTriggerData;
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

  private _renderTemplateRecursively(
    hass: HomeAssistant,
    data: unknown,
    templateContext?: TemplateContext,
  ): unknown {
    if (typeof data === 'string') {
      return this._getRenderTemplate()?.(hass, data, templateContext) ?? data;
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

  protected _getRenderTemplate(): HANunjucksRenderTemplate | null {
    return (
      (
        globalThis as {
          window?: {
            haNunjucks?: {
              renderTemplate?: HANunjucksRenderTemplate;
            };
          };
        }
      ).window?.haNunjucks?.renderTemplate ?? null
    );
  }
}
