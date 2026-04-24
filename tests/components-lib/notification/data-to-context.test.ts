import { describe, expect, it } from 'vitest';
import { dataToContext } from '../../../src/components-lib/notification/data-to-context';

describe('dataToContext', () => {
  it('should return an array of string items unchanged when input is an array of strings', () => {
    expect(dataToContext(['line one', 'line two'])).toEqual(['line one', 'line two']);
  });

  it('should YAML-dump object items when input is an array containing objects', () => {
    const result = dataToContext([{ key: 'value' }]);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('key: value');
  });

  it('should handle a mixed array of strings and objects', () => {
    const result = dataToContext(['plain string', { foo: 'bar' }]);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('plain string');
    expect(result[1]).toContain('foo: bar');
  });

  it('should return a single YAML-dumped string for a plain object', () => {
    const result = dataToContext({ error: 'something went wrong', code: 42 });
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('error: something went wrong');
    expect(result[0]).toContain('code: 42');
  });

  it('should return an empty array for an empty array input', () => {
    expect(dataToContext([])).toEqual([]);
  });
});
