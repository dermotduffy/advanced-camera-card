import { AdvancedCameraCardError } from '../types.js';
import { isRecord } from './basic.js';

// Narrows an unknown error to its structured object `context` -- a non-null
// record -- or null if the error is not an AdvancedCameraCardError or has no
// usable context. Consolidates the instanceof + null-guard dance that
// notification builders and error handlers would otherwise repeat.
export const getContextFromError = (error: unknown): Record<string, unknown> | null =>
  error instanceof AdvancedCameraCardError && isRecord(error.context)
    ? error.context
    : null;
