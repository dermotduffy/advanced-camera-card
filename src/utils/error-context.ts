import { AdvancedCameraCardError } from '../types.js';

// Narrows an unknown error to its structured object `context` — non-null and
// of object type — or null if the error is not an AdvancedCameraCardError or
// has no usable context. Consolidates the instanceof + typeof + null-guard
// dance that notification builders and error handlers would otherwise repeat.
export const getContextFromError = (error: unknown): object | null =>
  error instanceof AdvancedCameraCardError &&
  typeof error.context === 'object' &&
  error.context !== null
    ? error.context
    : null;
