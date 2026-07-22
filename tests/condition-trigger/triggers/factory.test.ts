import { describe, expect, it } from 'vitest';

import { ConditionStateManager } from '../../../src/condition-trigger/conditions/state-manager';
import { createTriggerEvaluator } from '../../../src/condition-trigger/triggers/factory';
import { CallTrigger } from '../../../src/condition-trigger/triggers/triggers/call';
import { CameraTrigger } from '../../../src/condition-trigger/triggers/triggers/camera';
import { ConfigTrigger } from '../../../src/condition-trigger/triggers/triggers/config';
import { DisplayModeTrigger } from '../../../src/condition-trigger/triggers/triggers/display-mode';
import { EventTrigger } from '../../../src/condition-trigger/triggers/triggers/event';
import { ExpandTrigger } from '../../../src/condition-trigger/triggers/triggers/expand';
import { FullscreenTrigger } from '../../../src/condition-trigger/triggers/triggers/fullscreen';
import { InitializedTrigger } from '../../../src/condition-trigger/triggers/triggers/initialized';
import { InteractionTrigger } from '../../../src/condition-trigger/triggers/triggers/interaction';
import { KeyTrigger } from '../../../src/condition-trigger/triggers/triggers/key';
import { MediaLoadedTrigger } from '../../../src/condition-trigger/triggers/triggers/media-loaded';
import { MicrophoneTrigger } from '../../../src/condition-trigger/triggers/triggers/microphone';
import { NumericStateTrigger } from '../../../src/condition-trigger/triggers/triggers/numeric-state';
import { ScreenTrigger } from '../../../src/condition-trigger/triggers/triggers/screen';
import { StateTrigger } from '../../../src/condition-trigger/triggers/triggers/state';
import { TemplateTrigger } from '../../../src/condition-trigger/triggers/triggers/template';
import { TriggeredTrigger } from '../../../src/condition-trigger/triggers/triggers/triggered';
import type {
  TriggerEvaluator,
  TriggerEvaluatorContext,
} from '../../../src/condition-trigger/triggers/triggers/types';
import { ViewTrigger } from '../../../src/condition-trigger/triggers/triggers/view';
import type { Trigger } from '../../../src/config/schema/condition-trigger/triggers/types';
import { createHASSManager, createMockTemplateRenderer } from '../../test-utils';

type TriggerEvaluatorConstructor = new (...args: never[]) => TriggerEvaluator;

// @vitest-environment jsdom
describe('createTriggerEvaluator', () => {
  const context = (): TriggerEvaluatorContext => ({
    stateManager: new ConditionStateManager(),
    templateRenderer: createMockTemplateRenderer(),
    hassManager: createHASSManager(),
  });

  it.each<[Trigger, TriggerEvaluatorConstructor]>([
    [{ trigger: 'event', event_type: 'zha_event' }, EventTrigger],
    [{ trigger: 'state', entity_id: 'binary_sensor.x' }, StateTrigger],
    [{ trigger: 'numeric_state', entity_id: 'sensor.x', above: 5 }, NumericStateTrigger],
    [{ trigger: 'template', value_template: '{{ true }}' }, TemplateTrigger],
    [{ trigger: 'call', to: 'answered' }, CallTrigger],
    [{ trigger: 'camera', cameras: ['front'] }, CameraTrigger],
    [{ trigger: 'config' }, ConfigTrigger],
    [{ trigger: 'display_mode', display_mode: 'single' }, DisplayModeTrigger],
    [{ trigger: 'expand', expand: true }, ExpandTrigger],
    [{ trigger: 'fullscreen', fullscreen: true }, FullscreenTrigger],
    [{ trigger: 'interaction', interaction: true }, InteractionTrigger],
    [{ trigger: 'media_loaded', media_loaded: true }, MediaLoadedTrigger],
    [{ trigger: 'microphone', muted: true }, MicrophoneTrigger],
    [{ trigger: 'triggered' }, TriggeredTrigger],
    [{ trigger: 'view', views: ['live'] }, ViewTrigger],
    [{ trigger: 'initialized' }, InitializedTrigger],
    [{ trigger: 'key', key: 'a' }, KeyTrigger],
    [{ trigger: 'screen' }, ScreenTrigger],
  ])('should create the dedicated evaluator for a %o trigger', (trigger, expected) => {
    expect(createTriggerEvaluator(trigger, context())).toBeInstanceOf(expected);
  });
});
