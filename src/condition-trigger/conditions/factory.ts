import { Condition } from '../../config/schema/condition-trigger/conditions/types';
import { AndConditionEvaluator } from './conditions/and';
import { CallConditionEvaluator } from './conditions/call';
import { CameraConditionEvaluator } from './conditions/camera';
import { ConfigConditionEvaluator } from './conditions/config';
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
import { ConditionEvaluator, EvaluatorContext } from './conditions/types';
import { UserConditionEvaluator } from './conditions/user';
import { UserAgentConditionEvaluator } from './conditions/user-agent';
import { ViewConditionEvaluator } from './conditions/view';

export const createConditionEvaluator = (
  condition: Condition,
  context: EvaluatorContext,
): ConditionEvaluator => {
  switch (condition.condition) {
    case undefined:
    case 'state':
      return new StateConditionEvaluator(condition);
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
    case 'config':
      return new ConfigConditionEvaluator(condition);
    case 'initialized':
      return new InitializedConditionEvaluator();
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
