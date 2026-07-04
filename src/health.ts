import type { UnsubscribeCallback } from './types';

// A source of health information: the current failures (of some domain-specific
// shape `F`) and a way to observe changes to them.
interface HealthInterface<F> {
  getFailures(): F[];
  addListener(listener: () => void): UnsubscribeCallback;
}

// Health that also supports a user-driven retry of whatever is currently
// failing. Separate from HealthInterface because observation and recovery are
// distinct capabilities: a read-only health source has nothing to retry.
export interface RecoverableHealthInterface<F> extends HealthInterface<F> {
  retry(): void;
}
