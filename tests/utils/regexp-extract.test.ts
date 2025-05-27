import { describe, expect, it } from 'vitest';
import { regexpExtract } from '../../src/utils/regexp-extract';

describe('regexpExtract', () => {
  it('returns null if no match is found', () => {
    expect(regexpExtract(/foo/, 'bar')).toBeNull();
  });

  it('returns the full match if no group is specified', () => {
    expect(regexpExtract(/foo/, 'foo bar')).toBe('foo');
  });

  it('returns the named group if groupName is specified', () => {
    const pattern = /(?<first>\w+)\s(?<second>\w+)/;
    expect(regexpExtract(pattern, 'hello world', { groupName: 'first' })).toBe('hello');
    expect(regexpExtract(pattern, 'hello world', { groupName: 'second' })).toBe('world');
  });

  it('returns the numbered group if groupNumber is specified', () => {
    expect(regexpExtract(/(\d+)-(\w+)/, '123-abc', { groupNumber: 1 })).toBe('123');
    expect(regexpExtract(/(\d+)-(\w+)/, '123-abc', { groupNumber: 2 })).toBe('abc');
  });

  it('returns full match if groupName does not exist', () => {
    expect(regexpExtract(/(?<foo>\w+)/, 'bar', { groupName: 'baz' })).toBe('bar');
  });

  it('returns full match if groupNumber does not exist', () => {
    expect(regexpExtract(/(\d+)/, '123', { groupNumber: 2 })).toBe('123');
  });

  it('works with string pattern', () => {
    expect(regexpExtract('(foo)', 'foo bar', { groupNumber: 1 })).toBe('foo');
  });

  it('prefers groupName over groupNumber if both are provided', () => {
    const pattern = /(?<word>\w+)\s(\w+)/;
    expect(
      regexpExtract(pattern, 'hello world', { groupName: 'word', groupNumber: 2 }),
    ).toBe('hello');
  });

  it('returns null if match exists but group is undefined', () => {
    expect(regexpExtract(/foo(bar)?/, 'foo', { groupNumber: 1 })).toBe('foo');
  });
});
