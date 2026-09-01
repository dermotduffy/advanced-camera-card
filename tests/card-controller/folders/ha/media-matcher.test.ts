import { sub } from 'date-fns';
import { beforeAll, describe, expect, it } from 'vitest';

import { MediaMatcher } from '../../../../src/card-controller/folders/ha/media-matcher';
import { TemplateManager } from '../../../../src/card-controller/templates';
import type { Matcher } from '../../../../src/config/schema/folders';
import type {
  BrowseMediaMetadata,
  RichBrowseMedia,
} from '../../../../src/ha/browse-media/types';
import {
  createHASS,
  createMockTemplateRenderer,
  stubConnectedHomeAssistant,
} from '../../../test-utils';

// The `with template matcher` test loads the real ha-nunjucks engine, which
// reads `window`/`document` at import, so this suite needs a DOM environment.
// @vitest-environment jsdom
describe('MediaMatcher', () => {
  // A mock renderer for the matcher plumbing, which never renders templates.
  // The `value_template` suite below uses its own real, loaded engine.
  const templateManager = createMockTemplateRenderer();

  describe('match', () => {
    const createMediaItem = (
      title: string,
      can_expand = false,
      media_class = 'image',
    ): RichBrowseMedia<BrowseMediaMetadata> => ({
      title,
      media_class,
      media_content_type: media_class === 'directory' ? 'directory' : 'image/jpeg',
      media_content_id: `${media_class}_${title.replace(/\s+/g, '_')}`,
      can_play: media_class !== 'directory',
      can_expand,
      thumbnail: null,
    });

    it('should return false if foldersOnly is true and media.can_expand is false', () => {
      const mediaMatcher = new MediaMatcher(templateManager);
      const media = createMediaItem('Test File');
      expect(
        mediaMatcher.match(createHASS(), media, { matchers: [], foldersOnly: true }),
      ).toBe(false);
    });

    it('should return true if foldersOnly is true and media.can_expand is true', () => {
      const mediaMatcher = new MediaMatcher(templateManager);
      const media = createMediaItem('Test Folder', true, 'directory');
      expect(
        mediaMatcher.match(createHASS(), media, { matchers: [], foldersOnly: true }),
      ).toBe(true);
    });

    it('should return true if matchers array is empty', () => {
      const mediaMatcher = new MediaMatcher(templateManager);
      const media = createMediaItem('Test Media');
      expect(mediaMatcher.match(createHASS(), media, { matchers: [] })).toBe(true);
    });

    it('should return true if matchers array is undefined', () => {
      const mediaMatcher = new MediaMatcher(templateManager);
      const media = createMediaItem('Test Media');
      expect(mediaMatcher.match(createHASS(), media, { matchers: undefined })).toBe(
        true,
      );
    });

    describe('with title matcher', () => {
      it('should return true when title matches exactly', () => {
        const mediaMatcher = new MediaMatcher(templateManager);
        const media = createMediaItem('Exact Title');
        const matchers: Matcher[] = [{ type: 'title', title: 'Exact Title' }];
        expect(mediaMatcher.match(createHASS(), media, { matchers })).toBe(true);
      });

      it('should return false when title does not match exactly', () => {
        const mediaMatcher = new MediaMatcher(templateManager);
        const media = createMediaItem('DOES NOT MATCH');
        const matchers: Matcher[] = [{ type: 'title', title: 'Exact Title' }];
        expect(mediaMatcher.match(createHASS(), media, { matchers })).toBe(false);
      });

      it('should return true when title matches regexp and extracted value matches matcher.title', () => {
        const mediaMatcher = new MediaMatcher(templateManager);
        const media = createMediaItem('Prefix-ImportantPart-Suffix');
        const matchers: Matcher[] = [
          {
            type: 'title',
            regexp: '^Prefix-(?<value>ImportantPart)-Suffix$',
            title: 'ImportantPart',
          },
        ];
        expect(mediaMatcher.match(createHASS(), media, { matchers })).toBe(true);
      });

      it('should return false when title matches regexp but extracted value does not match matcher.title', () => {
        const mediaMatcher = new MediaMatcher(templateManager);
        const media = createMediaItem('Prefix-ImportantPart-Suffix');
        const matchers: Matcher[] = [
          {
            type: 'title',
            regexp: '^Prefix-(?<value>ImportantPart)-Suffix$',
            title: 'WrongPart',
          },
        ];
        expect(mediaMatcher.match(createHASS(), media, { matchers })).toBe(false);
      });

      it('should return true when title matches regexp with an explicit title value', () => {
        const mediaMatcher = new MediaMatcher(templateManager);
        const media = createMediaItem('Prefix-ImportantPart-Suffix');
        const matchers: Matcher[] = [
          {
            type: 'title',
            regexp: '^Prefix-(?<value>ImportantPart)-Suffix$',
            // title is undefined.
          },
        ];
        expect(mediaMatcher.match(createHASS(), media, { matchers })).toBe(true);
      });

      it('should return false when title does not match regexp', () => {
        const mediaMatcher = new MediaMatcher(templateManager);
        const media = createMediaItem('Unrelated Title');
        const matchers: Matcher[] = [
          {
            type: 'title',
            regexp: '^Prefix-(?<value>ImportantPart)-Suffix$',
            title: 'ImportantPart',
          },
        ];
        expect(mediaMatcher.match(createHASS(), media, { matchers })).toBe(false);
      });

      it('should return false when regexp is provided but does not extract the required group', () => {
        const mediaMatcher = new MediaMatcher(templateManager);
        const media = createMediaItem('Prefix-ImportantPart-Suffix');
        const matchers: Matcher[] = [
          {
            type: 'title',
            regexp: `^Prefix-ImportantPart-Suffix$`, // No named group
            title: 'ImportantPart',
          },
        ];
        expect(mediaMatcher.match(createHASS(), media, { matchers })).toBe(false);
      });

      it('should return true when no regexp and no matcher.title (matches any title)', () => {
        const mediaMatcher = new MediaMatcher(templateManager);
        const media = createMediaItem('Any Title Will Do');
        const matchers: Matcher[] = [{ type: 'title' }];
        expect(mediaMatcher.match(createHASS(), media, { matchers })).toBe(true);
      });
    });

    describe('with template matcher', () => {
      // These matchers render, so use a real engine loaded for the synchronous
      // renderer (rather than the shared mock).
      const templateManager = new TemplateManager();
      beforeAll(async () => {
        stubConnectedHomeAssistant();
        await templateManager.loadRenderer();
      });

      it('should return true when template value renders to true', () => {
        const mediaMatcher = new MediaMatcher(templateManager);
        const media = createMediaItem('Any Title Will Do');

        const matchers: Matcher[] = [
          {
            type: 'template',
            value_template: '{{ acc.media.title == "Any Title Will Do" }}',
          },
        ];
        expect(mediaMatcher.match(createHASS(), media, { matchers })).toBe(true);
      });

      it('should return true when template reads the id media value', () => {
        const mediaMatcher = new MediaMatcher(templateManager);
        const media = createMediaItem('Test File');

        const matchers: Matcher[] = [
          {
            type: 'template',
            value_template: '{{ acc.media.id == "image_Test_File" }}',
          },
        ];
        expect(mediaMatcher.match(createHASS(), media, { matchers })).toBe(true);
      });

      it('should return true when template reads the is_folder media value', () => {
        const mediaMatcher = new MediaMatcher(templateManager);
        const media = createMediaItem('Test Folder', true, 'directory');

        const matchers: Matcher[] = [
          {
            type: 'template',
            value_template: '{{ acc.media.is_folder }}',
          },
        ];
        expect(mediaMatcher.match(createHASS(), media, { matchers })).toBe(true);
      });

      it('should return false when template value renders to false', () => {
        const mediaMatcher = new MediaMatcher(templateManager);
        const media = createMediaItem('Any Title Will Do');

        const matchers: Matcher[] = [
          {
            type: 'template',
            value_template: '{{ acc.media.title == "Some Other Title" }}',
          },
        ];
        expect(mediaMatcher.match(createHASS(), media, { matchers })).toBe(false);
      });
    });

    describe('with or matcher', () => {
      it('should return true if at least one sub-matcher matches', () => {
        const mediaMatcher = new MediaMatcher(templateManager);
        const media = createMediaItem('Test Media');
        const matcher: Matcher = {
          type: 'or',
          matchers: [
            { type: 'title', title: 'Non-Matching Title' }, // Fails
            { type: 'title', title: 'Test Media' }, // Passes
          ],
        };
        expect(mediaMatcher.match(createHASS(), media, { matchers: [matcher] })).toBe(
          true,
        );
      });

      it('should return false if no sub-matcher matches', () => {
        const mediaMatcher = new MediaMatcher(templateManager);
        const media = createMediaItem('Test Media');
        const matcher: Matcher = {
          type: 'or',
          matchers: [
            { type: 'title', title: 'Non-Matching Title One' }, // Fails
            { type: 'title', title: 'Non-Matching Title Two' }, // Fails
          ],
        };
        expect(mediaMatcher.match(createHASS(), media, { matchers: [matcher] })).toBe(
          false,
        );
      });
    });

    describe('with date matcher', () => {
      it('should not match without metadata', () => {
        const mediaMatcher = new MediaMatcher(templateManager);
        const media = createMediaItem('Test Media');
        const matcher: Matcher = {
          type: 'date',
          since: { days: 1 },
        };
        expect(mediaMatcher.match(createHASS(), media, { matchers: [matcher] })).toBe(
          false,
        );
      });

      it.each([
        [
          {
            type: 'date' as const,
            since: { days: 2, minutes: 1 },
          },
        ],
        [
          {
            type: 'date' as const,
            since: { days: 2, hours: 1 },
          },
        ],
        [
          {
            type: 'date' as const,
            since: { months: 1 },
          },
        ],
        [
          {
            type: 'date' as const,
            since: { years: 1 },
          },
        ],
      ])('should match with date more recent than matcher %s', (matcher: Matcher) => {
        const mediaMatcher = new MediaMatcher(templateManager);
        const media = createMediaItem('Test Media');
        media._metadata = {
          startDate: sub(new Date(), { days: 1 }),
        };
        expect(mediaMatcher.match(createHASS(), media, { matchers: [matcher] })).toBe(
          true,
        );
      });

      it('should not match with date less recent than matcher', () => {
        const mediaMatcher = new MediaMatcher(templateManager);
        const media = createMediaItem('Test Media');
        media._metadata = {
          startDate: sub(new Date(), { days: 2 }),
        };
        const matcher: Matcher = {
          type: 'date',
          since: { days: 1 },
        };
        expect(mediaMatcher.match(createHASS(), media, { matchers: [matcher] })).toBe(
          false,
        );
      });
    });

    it('should return false if one of multiple matchers fails', () => {
      const mediaMatcher = new MediaMatcher(templateManager);
      const media = createMediaItem('Test Media One');
      const matchers: Matcher[] = [
        { type: 'title', title: 'Test Media One' }, // Pass
        { type: 'title', title: 'Test Media Two' }, // Fail
      ];
      expect(mediaMatcher.match(createHASS(), media, { matchers })).toBe(false);
    });

    it('should return true if all multiple matchers pass', () => {
      const mediaMatcher = new MediaMatcher(templateManager);
      const media = createMediaItem('Test Media One');
      const matchers: Matcher[] = [
        { type: 'title', title: 'Test Media One' },
        {
          type: 'title',
          regexp: `^(?<value>Test Media One)$`,
          title: 'Test Media One',
        },
      ];
      expect(mediaMatcher.match(createHASS(), media, { matchers })).toBe(true);
    });

    it('should ignore matchers of unknown types', () => {
      const mediaMatcher = new MediaMatcher(templateManager);
      const media = createMediaItem('Test Media');

      const matchers: Matcher[] = [{ type: 'unknownMatcherType' as 'title' }];
      expect(mediaMatcher.match(createHASS(), media, { matchers })).toBe(true);
    });
  });
});
