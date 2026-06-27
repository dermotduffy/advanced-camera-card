import type { renderTemplate } from 'ha-nunjucks/dist';

import type { ConditionState } from '../../condition-trigger/conditions/types';
import type { TriggerData } from '../../condition-trigger/triggers/types';
import type { HomeAssistant } from '../../ha/types';
import { isRecord } from '../../utils/basic';
import type { TemplateACCNamespace, TemplateMediaData } from './types';

type RenderTemplate = typeof renderTemplate;

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

// The template-rendering methods that callers depend on. Callers (e.g.
// condition/trigger code) are kept independent of CardController via this
// interface.
export interface TemplateRenderer {
  // Whether the renderer has finished loading. Synchronous callers that may run
  // before loading completes (condition/trigger evaluation) check this and
  // defer rather than rendering a template against an absent renderer.
  isLoaded(): boolean;

  renderRecursively(
    hass: HomeAssistant,
    data: unknown,
    options?: TemplateRenderOptions,
  ): unknown;

  renderRecursivelyAsType<T>(
    hass: HomeAssistant,
    data: T,
    options?: TemplateRenderOptions,
  ): T;
}

// Renders nunjucks templates for the card. The renderer itself (`ha-nunjucks`,
// ~272KB) is large and most cards never use a template, so it is imported on
// demand the first time a template needs rendering (see `loadRenderer`).
export class TemplateManager implements TemplateRenderer {
  private _renderer: RenderTemplate | null = null;

  /**
   * Whether any string anywhere in a given piece of data is a template.
   */
  public static dataContainsTemplate(data: unknown): boolean {
    return TemplateManager._containsTemplate(JSON.stringify(data) ?? '');
  }

  /**
   * Load the renderer (the first time) and remember it. Repeat calls return
   * immediately once loaded; a failed load is not cached, so a later call
   * retries. Concurrent calls share a single load via the module cache.
   */
  public async loadRenderer(): Promise<void> {
    if (this._renderer) {
      return;
    }
    const module = await import('ha-nunjucks/dist');
    this._renderer = module.renderTemplate;
  }

  public isLoaded(): boolean {
    return !!this._renderer;
  }

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
      if (!TemplateManager._containsTemplate(data)) {
        return data;
      }

      if (!this._renderer) {
        // A defensive guard that should not be reached: the renderer is loaded
        // during mandatory initialization before the view, triggers, or actions
        // render, and the condition/trigger evaluators that can run earlier
        // check `isLoaded()` first and defer rather than calling in here.
        this.loadRenderer().catch(() => {});
        return data;
      }

      return this._renderer(
        // ha-nunjucks has a more complete model of the Home Assistant object, but
        // does not export it as a type.
        hass as unknown as Parameters<RenderTemplate>[0],
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

  /**
   * Whether a string contains a nunjucks template that needs rendering. It does
   * only if it has a matching pair of markers (`{{ … }}` or `{% … %}`); this is
   * the same check `ha-nunjucks` makes, so a string without them renders the
   * same whether or not the renderer has loaded -- which is what lets a card
   * that uses no templates avoid loading the renderer at all.
   */
  private static _containsTemplate(value: string): boolean {
    return (
      (value.includes('{{') && value.includes('}}')) ||
      (value.includes('{%') && value.includes('%}'))
    );
  }
}
