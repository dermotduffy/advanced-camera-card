import { HASS, renderTemplate } from 'ha-nunjucks/dist';
import { ConditionState } from '../../condition-trigger/conditions/types';
import { TriggerData } from '../../condition-trigger/triggers/types';
import { HomeAssistant } from '../../ha/types';
import { isRecord } from '../../utils/basic';
import { TemplateACCNamespace, TemplateMediaData } from './types';

interface TemplateContext {
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

  // Structure-preserving variant of `renderRecursively`: arrays, records, and
  // primitives keep their shape (only string leaves are rendered), so the
  // caller's type is asserted back unchanged. Callers whose template renders to
  // a *different* type than its input (e.g. a string that yields a boolean)
  // must use `renderRecursively` and narrow the `unknown` result at runtime.
  public renderRecursivelyAsType = <T>(
    hass: HomeAssistant,
    data: T,
    options?: TemplateRenderOptions,
  ): T => this.renderRecursively(hass, data, options) as T;

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

    const acc: TemplateACCNamespace = {
      ...(options?.conditionState?.camera && { camera: options.conditionState.camera }),
      ...(options?.conditionState?.view && { view: options.conditionState.view }),
      ...(options?.conditionState?.config && { config: options.conditionState.config }),
      ...(options?.mediaData && { media: options.mediaData }),
    };

    return {
      acc,
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
    } else if (isRecord(data)) {
      const result = {};
      for (const key in data) {
        result[key] = this._renderTemplateRecursively(hass, data[key], templateContext);
      }
      return result;
    }
    return data;
  }
}
