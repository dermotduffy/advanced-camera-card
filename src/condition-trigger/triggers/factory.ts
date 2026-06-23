import { Trigger } from '../../config/schema/condition-trigger/triggers/types';
import { CallTrigger } from './triggers/call';
import { CameraTrigger } from './triggers/camera';
import { ConfigTrigger } from './triggers/config';
import { DisplayModeTrigger } from './triggers/display-mode';
import { EventTrigger } from './triggers/event';
import { ExpandTrigger } from './triggers/expand';
import { FullscreenTrigger } from './triggers/fullscreen';
import { InitializedTrigger } from './triggers/initialized';
import { InteractionTrigger } from './triggers/interaction';
import { KeyTrigger } from './triggers/key';
import { MediaLoadedTrigger } from './triggers/media-loaded';
import { MicrophoneTrigger } from './triggers/microphone';
import { NumericStateTrigger } from './triggers/numeric-state';
import { ScreenTrigger } from './triggers/screen';
import { StateTrigger } from './triggers/state';
import { TemplateTrigger } from './triggers/template';
import { TriggeredTrigger } from './triggers/triggered';
import { TriggerEvaluator, TriggerEvaluatorContext } from './triggers/types';
import { ViewTrigger } from './triggers/view';

export const createTriggerEvaluator = (
  trigger: Trigger,
  context: TriggerEvaluatorContext,
): TriggerEvaluator => {
  switch (trigger.trigger) {
    // Stock HA triggers: read `hass.states` and emit HA `State` payloads.
    case 'state':
      return new StateTrigger(trigger, context);
    case 'numeric_state':
      return new NumericStateTrigger(trigger, context);
    case 'template':
      return new TemplateTrigger(trigger, context);
    case 'event':
      return new EventTrigger(trigger, context);

    // `screen` watches window.matchMedia.
    case 'screen':
      return new ScreenTrigger(trigger);

    // Card-state triggers: watch a field of `ConditionState`, firing on any
    // change (omit the value) or when the change passes the matching condition.
    case 'call':
      return new CallTrigger(trigger, context);
    case 'camera':
      return new CameraTrigger(trigger, context);
    case 'config':
      return new ConfigTrigger(trigger, context);
    case 'display_mode':
      return new DisplayModeTrigger(trigger, context);
    case 'expand':
      return new ExpandTrigger(trigger, context);
    case 'fullscreen':
      return new FullscreenTrigger(trigger, context);
    case 'initialized':
      return new InitializedTrigger(trigger, context);
    case 'interaction':
      return new InteractionTrigger(trigger, context);
    case 'key':
      return new KeyTrigger(trigger, context);
    case 'media_loaded':
      return new MediaLoadedTrigger(trigger, context);
    case 'microphone':
      return new MicrophoneTrigger(trigger, context);
    case 'triggered':
      return new TriggeredTrigger(trigger, context);
    case 'view':
      return new ViewTrigger(trigger, context);
  }
};
