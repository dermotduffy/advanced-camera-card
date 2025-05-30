import { NonEmptyTuple } from 'type-fest';
import { describe, expect, it } from 'vitest';
import {
  matcherSchema,
  transformPathURLToPathArray,
} from '../../../src/config/schema/folders';

describe('transformURLToMediaSourceRoot', () => {
  const prefixes: NonEmptyTuple<string>[] = [
    ['http://card.camera/' as const],
    ['/' as const],
    ['' as const],
  ];

  describe('should return the media source root when given a root URL', () => {
    it.each(prefixes)('with prefix %s', (urlPrefix: string) => {
      const url = `${urlPrefix}media-browser/browser`;
      const result = transformPathURLToPathArray(url);
      expect(result).toEqual([{ id: 'media-source://' }]);
    });
  });

  describe('should return the media source root when given a valid URL', () => {
    it.each(prefixes)('with prefix %s', (urlPrefix: string) => {
      const url = `${urlPrefix}media-browser/browser/app%2Cmedia-source%3A%2F%2Fcamera`;
      const result = transformPathURLToPathArray(url);
      expect(result).toEqual([
        { id: 'media-source://' },
        { id: 'media-source://camera' },
      ]);
    });
  });

  describe('should return the decoded frigate URL', () => {
    it.each(prefixes)('with prefix %s', (urlPrefix: string) => {
      const url =
        `${urlPrefix}media-browser/browser/app%2Cmedia-source%3A%2F%2F` +
        'frigate/image%2Cmedia-source%3A%2F%2Ffrigate%2Ffrigate%2F' +
        'event-search%2Fsnapshots%2F%2F%2F%2F%2F%2F/image%2C' +
        'media-source%3A%2F%2Ffrigate%2Ffrigate%2Fevent-search' +
        '%2Fsnapshots%2F.this_month%2F1746082800%2F%2F%2F%2F';
      const result = transformPathURLToPathArray(url);
      expect(result).toEqual([
        { id: 'media-source://' },
        { id: 'media-source://frigate' },
        { id: 'media-source://frigate/frigate/event-search/snapshots//////' },
        {
          id: 'media-source://frigate/frigate/event-search/snapshots/.this_month/1746082800////',
        },
      ]);
    });
  });

  describe('should return the root for unknown URLs', () => {
    it.each(prefixes)('with prefix %s', (urlPrefix: string) => {
      const url = `${urlPrefix}something-completely-different`;
      const result = transformPathURLToPathArray(url);
      expect(result).toEqual([{ id: 'media-source://' }]);
    });
  });

  describe('should throw error for non-media source path component', () => {
    it.each(prefixes)('with prefix %s', (urlPrefix: string) => {
      const url = `${urlPrefix}media-browser/browser,does-not-start-with-media-source`;
      expect(() => transformPathURLToPathArray(url)).toThrowError(
        /Could not parse media source URL/,
      );
    });
  });
});

describe('should lazy evaluate schemas', () => {
  it('should lazy evaluate or matcher', () => {
    expect(
      matcherSchema.parse({
        type: 'or',
        matchers: [
          {
            type: 'title',
            title: 'Test Title',
          },
        ],
      }),
    ).toEqual({
      type: 'or',
      matchers: [
        {
          type: 'title',
          title: 'Test Title',
        },
      ],
    });
  });
});
