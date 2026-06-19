import { describe, expect, it } from 'vitest';
import { userAgentConditionSchema } from '../../../../../../src/config/schema/condition-trigger/conditions/custom/user-agent';

describe('userAgentConditionSchema', () => {
  it('should reject a user_agent condition with no fields', () => {
    expect(() => userAgentConditionSchema.parse({ condition: 'user_agent' })).toThrow();
  });

  it('should accept a user_agent condition constrained by user_agent', () => {
    expect(
      userAgentConditionSchema.parse({ condition: 'user_agent', user_agent: 'Foo' }),
    ).toEqual({ condition: 'user_agent', user_agent: 'Foo' });
  });

  it('should accept a user_agent condition constrained by user_agent_re', () => {
    expect(
      userAgentConditionSchema.parse({ condition: 'user_agent', user_agent_re: 'Foo' }),
    ).toEqual({ condition: 'user_agent', user_agent_re: 'Foo' });
  });

  it('should accept a user_agent condition constrained by casting', () => {
    expect(
      userAgentConditionSchema.parse({ condition: 'user_agent', casting: true }),
    ).toEqual({ condition: 'user_agent', casting: true });
  });

  it('should accept a user_agent condition constrained by companion', () => {
    expect(
      userAgentConditionSchema.parse({ condition: 'user_agent', companion: true }),
    ).toEqual({ condition: 'user_agent', companion: true });
  });
});
