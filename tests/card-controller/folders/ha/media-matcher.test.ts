import { describe, expect, it } from 'vitest';
import { MediaMatcher } from '../../../../src/card-controller/folders/ha/media-matcher';
import { Matcher } from '../../../../src/config/schema/folders';
import { BrowseMedia } from '../../../../src/ha/browse-media/types';

describe('MediaMatcher', () => {
  describe('match', () => {
    const createMediaItem = (
      title: string,
      can_expand: boolean,
      media_class = 'image',
    ): BrowseMedia => ({
      title,
      media_class,
      media_content_type: media_class === 'directory' ? 'directory' : 'image/jpeg',
      media_content_id: `${media_class}_${title.replace(/\s+/g, '_')}`,
      can_play: media_class !== 'directory',
      can_expand,
      thumbnail: null,
    });

    it('should return false if foldersOnly is true and media.can_expand is false', () => {
      const mediaMatcher = new MediaMatcher();
      const media = createMediaItem('Test File', false);
      expect(mediaMatcher.match(media, [], true)).toBe(false);
    });

    it('should return true if foldersOnly is true and media.can_expand is true', () => {
      const mediaMatcher = new MediaMatcher();
      const media = createMediaItem('Test Folder', true, 'directory');
      expect(mediaMatcher.match(media, [], true)).toBe(true);
    });

    it('should return true if matchers array is empty', () => {
      const mediaMatcher = new MediaMatcher();
      const media = createMediaItem('Test Media', false);
      expect(mediaMatcher.match(media, [])).toBe(true);
    });

    it('should return true if matchers array is undefined', () => {
      const mediaMatcher = new MediaMatcher();
      const media = createMediaItem('Test Media', false);
      expect(mediaMatcher.match(media, undefined)).toBe(true);
    });

    describe('with title matcher', () => {
      it('should return true when title matches exactly', () => {
        const mediaMatcher = new MediaMatcher();
        const media = createMediaItem('Exact Title', false);
        const matchers: Matcher[] = [{ type: 'title', title: 'Exact Title' }];
        expect(mediaMatcher.match(media, matchers)).toBe(true);
      });

      it('should return false when title does not match exactly', () => {
        const mediaMatcher = new MediaMatcher();
        const media = createMediaItem('DOES NOT MATCH', false);
        const matchers: Matcher[] = [{ type: 'title', title: 'Exact Title' }];
        expect(mediaMatcher.match(media, matchers)).toBe(false);
      });

      it('should return true when title matches regexp and extracted value matches matcher.title', () => {
        const mediaMatcher = new MediaMatcher();
        const media = createMediaItem('Prefix-ImportantPart-Suffix', false);
        const matchers: Matcher[] = [
          {
            type: 'title',
            regexp: '^Prefix-(?<value>ImportantPart)-Suffix$',
            title: 'ImportantPart',
          },
        ];
        expect(mediaMatcher.match(media, matchers)).toBe(true);
      });

      it('should return false when title matches regexp but extracted value does not match matcher.title', () => {
        const mediaMatcher = new MediaMatcher();
        const media = createMediaItem('Prefix-ImportantPart-Suffix', false);
        const matchers: Matcher[] = [
          {
            type: 'title',
            regexp: '^Prefix-(?<value>ImportantPart)-Suffix$',
            title: 'WrongPart',
          },
        ];
        expect(mediaMatcher.match(media, matchers)).toBe(false);
      });

      it('should return true when title matches regexp with an explicit title value', () => {
        const mediaMatcher = new MediaMatcher();
        const media = createMediaItem('Prefix-ImportantPart-Suffix', false);
        const matchers: Matcher[] = [
          {
            type: 'title',
            regexp: '^Prefix-(?<value>ImportantPart)-Suffix$',
            // title is undefined.
          },
        ];
        expect(mediaMatcher.match(media, matchers)).toBe(true);
      });

      it('should return false when title does not match regexp', () => {
        const mediaMatcher = new MediaMatcher();
        const media = createMediaItem('Unrelated Title', false);
        const matchers: Matcher[] = [
          {
            type: 'title',
            regexp: '^Prefix-(?<value>ImportantPart)-Suffix$',
            title: 'ImportantPart',
          },
        ];
        expect(mediaMatcher.match(media, matchers)).toBe(false);
      });

      it('should return false when regexp is provided but does not extract the required group', () => {
        const mediaMatcher = new MediaMatcher();
        const media = createMediaItem('Prefix-ImportantPart-Suffix', false);
        const matchers: Matcher[] = [
          {
            type: 'title',
            regexp: `^Prefix-ImportantPart-Suffix$`, // No named group
            title: 'ImportantPart',
          },
        ];
        expect(mediaMatcher.match(media, matchers)).toBe(false);
      });

      it('should return true when no regexp and no matcher.title (matches any title)', () => {
        const mediaMatcher = new MediaMatcher();
        const media = createMediaItem('Any Title Will Do', false);
        const matchers: Matcher[] = [{ type: 'title' }];
        expect(mediaMatcher.match(media, matchers)).toBe(true);
      });
    });

    it('should return false if one of multiple matchers fails', () => {
      const mediaMatcher = new MediaMatcher();
      const media = createMediaItem('Test Media One', false);
      const matchers: Matcher[] = [
        { type: 'title', title: 'Test Media One' }, // Pass
        { type: 'title', title: 'Test Media Two' }, // Fail
      ];
      expect(mediaMatcher.match(media, matchers)).toBe(false);
    });

    it('should return true if all multiple matchers pass', () => {
      const mediaMatcher = new MediaMatcher();
      const media = createMediaItem('Test Media One', false);
      const matchers: Matcher[] = [
        { type: 'title', title: 'Test Media One' },
        {
          type: 'title',
          regexp: `^(?<value>Test Media One)$`,
          title: 'Test Media One',
        },
      ];
      expect(mediaMatcher.match(media, matchers)).toBe(true);
    });

    it('should ignore matchers of unknown types', () => {
      const mediaMatcher = new MediaMatcher();
      const media = createMediaItem('Test Media', false);

      const matchers: Matcher[] = [
        { type: 'unknownMatcherType' as 'title' },
      ];
      expect(mediaMatcher.match(media, matchers)).toBe(true);
    });
  });
});
