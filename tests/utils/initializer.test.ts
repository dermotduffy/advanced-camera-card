import { describe, expect, it } from 'vitest';
import { Initializer } from '../../src/utils/initializer/initializer';

describe('Initializer', () => {
  it('should initialize with initializer', async () => {
    const initializer = new Initializer();

    expect(initializer.isInitialized('foo')).toBeFalsy();

    await initializer.initializeIfNecessary('foo', async () => {});
    expect(initializer.isInitialized('foo')).toBeTruthy();
  });

  it('should initialize without initializer', async () => {
    const initializer = new Initializer();

    expect(initializer.isInitialized('foo')).toBeFalsy();
    await initializer.initializeIfNecessary('foo');
    expect(initializer.isInitialized('foo')).toBeTruthy();
  });

  it('should initialize when already initialized', async () => {
    const initializer = new Initializer();

    expect(initializer.isInitialized('foo')).toBeFalsy();
    await initializer.initializeIfNecessary('foo', async () => {});
    await initializer.initializeIfNecessary('foo', async () => {});
    expect(initializer.isInitialized('foo')).toBeTruthy();
  });

  it('should not initialize with failed initializer', async () => {
    const initializer = new Initializer();

    expect(initializer.isInitialized('foo')).toBeFalsy();
    await expect(
      initializer.initializeIfNecessary('foo', async () => {
        throw new Error('test');
      }),
    ).rejects.toThrow('test');
    expect(initializer.isInitialized('foo')).toBeFalsy();
  });

  it('should initialize multiple', async () => {
    const initializer = new Initializer();

    expect(initializer.isInitializedMultiple(['foo', 'bar'])).toBeFalsy();
    await expect(
      initializer.initializeMultipleIfNecessary({
        foo: async () => {},
        bar: async () => {
          throw new Error('test');
        },
      }),
    ).rejects.toThrow('test');

    expect(initializer.isInitializedMultiple(['foo', 'bar'])).toBeFalsy();

    await initializer.initializeMultipleIfNecessary({
      bar: async () => {},
    });

    expect(initializer.isInitializedMultiple(['foo', 'bar'])).toBeTruthy();
  });

  it('should uninitialize', async () => {
    const initializer = new Initializer();
    await initializer.initializeIfNecessary('foo');
    expect(initializer.isInitialized('foo')).toBeTruthy();

    initializer.uninitialize('foo');

    expect(initializer.isInitialized('foo')).toBeFalsy();
  });
});
