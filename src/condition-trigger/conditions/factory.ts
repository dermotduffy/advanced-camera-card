import type { ReadonlyDeep } from 'type-fest';

import type { Condition } from '../../config/schema/condition-trigger/conditions/types';
import type { Trigger } from '../../config/schema/condition-trigger/triggers/types';
import { AndConditionEvaluator } from './conditions/and';
import { CallConditionEvaluator } from './conditions/call';
import { CameraConditionEvaluator } from './conditions/camera';
import { DisplayModeConditionEvaluator } from './conditions/display-mode';
import { ExpandConditionEvaluator } from './conditions/expand';
import { FullscreenConditionEvaluator } from './conditions/fullscreen';
import { InitializedConditionEvaluator } from './conditions/initialized';
import { InteractionConditionEvaluator } from './conditions/interaction';
import { KeyConditionEvaluator } from './conditions/key';
import { MediaLoadedConditionEvaluator } from './conditions/media-loaded';
import { MicrophoneConditionEvaluator } from './conditions/microphone';
import { NotConditionEvaluator } from './conditions/not';
import { NumericStateConditionEvaluator } from './conditions/numeric-state';
import { OrConditionEvaluator } from './conditions/or';
import { ScreenConditionEvaluator } from './conditions/screen';
import { StateConditionEvaluator } from './conditions/state';
import { TemplateConditionEvaluator } from './conditions/template';
import { TriggeredConditionEvaluator } from './conditions/triggered';
import type { ConditionEvaluator, EvaluatorContext } from './conditions/types';
import { UserConditionEvaluator } from './conditions/user';
import { UserAgentConditionEvaluator } from './conditions/user-agent';
import { ViewConditionEvaluator } from './conditions/view';

export const createConditionEvaluator = (
  condition: ReadonlyDeep<Condition>,
  context: EvaluatorContext,
): ConditionEvaluator => {
  switch (condition.condition) {
    case undefined:
    case 'state':
      return new StateConditionEvaluator(condition, context);
    case 'view':
      return new ViewConditionEvaluator(condition);
    case 'fullscreen':
      return new FullscreenConditionEvaluator(condition);
    case 'expand':
      return new ExpandConditionEvaluator(condition);
    case 'camera':
      return new CameraConditionEvaluator(condition);
    case 'numeric_state':
      return new NumericStateConditionEvaluator(condition, context);
    case 'user':
      return new UserConditionEvaluator(condition);
    case 'media_loaded':
      return new MediaLoadedConditionEvaluator(condition);
    case 'screen':
      return new ScreenConditionEvaluator(condition);
    case 'display_mode':
      return new DisplayModeConditionEvaluator(condition);
    case 'triggered':
      return new TriggeredConditionEvaluator(condition);
    case 'interaction':
      return new InteractionConditionEvaluator(condition);
    case 'microphone':
      return new MicrophoneConditionEvaluator(condition);
    case 'call':
      return new CallConditionEvaluator(condition);
    case 'key':
      return new KeyConditionEvaluator(condition);
    case 'user_agent':
      return new UserAgentConditionEvaluator(condition);
    case 'initialized':
      return new InitializedConditionEvaluator(condition);
    case 'template':
      return new TemplateConditionEvaluator(condition, context);
    case 'or':
      return new OrConditionEvaluator(
        condition.conditions.map((child) => createConditionEvaluator(child, context)),
      );
    case 'and':
      return new AndConditionEvaluator(
        condition.conditions.map((child) => createConditionEvaluator(child, context)),
      );
    case 'not':
      return new NotConditionEvaluator(
        condition.conditions.map((child) => createConditionEvaluator(child, context)),
      );
  }
};

// A trigger carries a condition value -- the value its matching condition
// checks against -- when it has a field beyond the discriminator and the
// universal `enabled` (e.g. `fullscreen: true`, `cameras: [...]`).
const triggerHasConditionValue = (trigger: Trigger): boolean =>
  Object.keys(trigger).some((key) => key !== 'trigger' && key !== 'enabled');

// Build the condition evaluator a card trigger checks its changes against, or
// null if it has none. A trigger has no condition when it carries no value (the
// any-change form) or is trigger-only (`config`) -- both then fire on any change
// of the watched state -- or when it matches the transition itself rather than
// its result (`call`), which does its own filtering. Otherwise the trigger and
// its condition share a base schema, so an evaluator (typed on that base) is
// built directly from the trigger -- no discriminator-swap.
export const createConditionEvaluatorForTrigger = (
  trigger: Trigger,
): ConditionEvaluator | null => {
  // A valueless trigger has no condition to check against -- it fires on any
  // change. This is necessary so a change that would make the matching
  // condition *fail* still fires the trigger.
  //
  //  - Scenario: the selected camera changes to no camera selected.
  //  - Trigger: `camera` with no value (means: fire on any change).
  //  - As a condition, valueless `camera` means "any camera *is* selected".
  //  - Without this short-circuit:
  //      - the condition evaluates false (no camera is selected), so
  //      - the trigger (incorrectly) does not fire.
  //
  // It comes down to a valueless *trigger* meaning "any change", while a
  // valueless *condition* means "the thing is set" -- and the shared evaluator
  // only knows the condition meaning, so this distinction must be made here.
  if (!triggerHasConditionValue(trigger)) {
    return null;
  }

  switch (trigger.trigger) {
    case 'camera':
      return new CameraConditionEvaluator(trigger);
    case 'display_mode':
      return new DisplayModeConditionEvaluator(trigger);
    case 'expand':
      return new ExpandConditionEvaluator(trigger);
    case 'fullscreen':
      return new FullscreenConditionEvaluator(trigger);
    case 'initialized':
      return new InitializedConditionEvaluator(trigger);
    case 'interaction':
      return new InteractionConditionEvaluator(trigger);
    case 'key':
      return new KeyConditionEvaluator(trigger);
    case 'microphone':
      return new MicrophoneConditionEvaluator(trigger);
    case 'media_loaded':
      return new MediaLoadedConditionEvaluator(trigger);
    case 'view':
      return new ViewConditionEvaluator(trigger);
    case 'triggered':
      return new TriggeredConditionEvaluator(trigger);
    case 'config':
      return null;
    default:
      // Only `call` reaches here. It matches the transition rather than its
      // result, so it builds its own `from`/`to` evaluators from the call
      // condition.
      return null;
  }
};
