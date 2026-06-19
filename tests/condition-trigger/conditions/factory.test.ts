import { describe, expect, it } from 'vitest';
import { CallConditionEvaluator } from '../../../src/condition-trigger/conditions/conditions/call';
import { CameraConditionEvaluator } from '../../../src/condition-trigger/conditions/conditions/camera';
import { DisplayModeConditionEvaluator } from '../../../src/condition-trigger/conditions/conditions/display-mode';
import { ExpandConditionEvaluator } from '../../../src/condition-trigger/conditions/conditions/expand';
import { FullscreenConditionEvaluator } from '../../../src/condition-trigger/conditions/conditions/fullscreen';
import { InteractionConditionEvaluator } from '../../../src/condition-trigger/conditions/conditions/interaction';
import { KeyConditionEvaluator } from '../../../src/condition-trigger/conditions/conditions/key';
import { MediaLoadedConditionEvaluator } from '../../../src/condition-trigger/conditions/conditions/media-loaded';
import { MicrophoneConditionEvaluator } from '../../../src/condition-trigger/conditions/conditions/microphone';
import { TriggeredConditionEvaluator } from '../../../src/condition-trigger/conditions/conditions/triggered';
import { ConditionEvaluator } from '../../../src/condition-trigger/conditions/conditions/types';
import { ViewConditionEvaluator } from '../../../src/condition-trigger/conditions/conditions/view';
import { createConditionEvaluatorForTrigger } from '../../../src/condition-trigger/conditions/factory';
import { Trigger } from '../../../src/config/schema/condition-trigger/triggers/types';

type ConditionEvaluatorConstructor = new (...args: never[]) => ConditionEvaluator;

describe('createConditionEvaluatorForTrigger', () => {
  it.each<[Trigger, ConditionEvaluatorConstructor]>([
    [{ trigger: 'call', call: true }, CallConditionEvaluator],
    [{ trigger: 'camera', cameras: ['front'] }, CameraConditionEvaluator],
    [{ trigger: 'display_mode', display_mode: 'single' }, DisplayModeConditionEvaluator],
    [{ trigger: 'expand', expand: true }, ExpandConditionEvaluator],
    [{ trigger: 'fullscreen', fullscreen: true }, FullscreenConditionEvaluator],
    [{ trigger: 'interaction', interaction: true }, InteractionConditionEvaluator],
    [{ trigger: 'key', key: 'a' }, KeyConditionEvaluator],
    [{ trigger: 'media_loaded', media_loaded: true }, MediaLoadedConditionEvaluator],
    [{ trigger: 'microphone', muted: true }, MicrophoneConditionEvaluator],
    [{ trigger: 'triggered', triggered: ['front'] }, TriggeredConditionEvaluator],
    [{ trigger: 'view', views: ['live'] }, ViewConditionEvaluator],
  ])(
    'should reuse the matching condition for a valued %o trigger',
    (trigger, expected) => {
      expect(createConditionEvaluatorForTrigger(trigger)).toBeInstanceOf(expected);
    },
  );

  it.each<[string, Trigger]>([
    ['a valueless trigger fires on any change', { trigger: 'fullscreen' }],
    ['config has no matching condition', { trigger: 'config', paths: ['menu.style'] }],
    [
      'stock triggers evaluate themselves',
      { trigger: 'state', entity_id: 'binary_sensor.x' },
    ],
  ])('should have no condition when %s', (_description, trigger) => {
    expect(createConditionEvaluatorForTrigger(trigger)).toBeNull();
  });
});
