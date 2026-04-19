import { describe, expect, it } from 'vitest';
import { AdvancedCameraCardError } from '../../src/types';
import { getContextFromError } from '../../src/utils/error-context';

describe('getContextFromError', () => {
  it('should return the context for an AdvancedCameraCardError with an object context', () => {
    const error = new AdvancedCameraCardError('boom', { foo: 'bar' });
    expect(getContextFromError(error)).toEqual({ foo: 'bar' });
  });

  it('should return null for an AdvancedCameraCardError without context', () => {
    const error = new AdvancedCameraCardError('boom');
    expect(getContextFromError(error)).toBeNull();
  });

  it('should return null for an AdvancedCameraCardError with null context', () => {
    const error = new AdvancedCameraCardError('boom', null);
    expect(getContextFromError(error)).toBeNull();
  });

  it('should return null for an AdvancedCameraCardError with non-object context', () => {
    const error = new AdvancedCameraCardError('boom', 'string context');
    expect(getContextFromError(error)).toBeNull();
  });

  it('should return null for a plain Error', () => {
    expect(getContextFromError(new Error('plain'))).toBeNull();
  });

  it('should return null for non-error values', () => {
    expect(getContextFromError('string')).toBeNull();
    expect(getContextFromError(42)).toBeNull();
    expect(getContextFromError(null)).toBeNull();
    expect(getContextFromError(undefined)).toBeNull();
    expect(getContextFromError({})).toBeNull();
  });
});
