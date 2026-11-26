import { describe, expect, it } from 'vitest';

import { MetadataGenerator } from '../../../../src/card-controller/folders/ha/metadata-generator';
import type { Parser } from '../../../../src/config/schema/folders';
import type { BrowseMediaMetadata } from '../../../../src/ha/browse-media/types';
import { createBrowseMedia, createRichBrowseMedia } from '../../../test-utils';

describe('MetadataGenerator', () => {
  const browseMedia = createBrowseMedia({
    title: 'Test Media 2025-05-26 18:18',
  });
  // Create expected date using local time, since the date parser interprets
  // the date string in local time (not UTC)
  const expectedDate = new Date(2025, 4, 26, 18, 18);
  const formatlessDateParser: Parser = {
    type: 'startdate',
  };

  describe('should dynamically import any-date-parser when needed', () => {
    it('should not import any-date-parser if no parsers require it', async () => {
      const generator = new MetadataGenerator();
      await generator.prepare([
        // Pretend no parsers require unknown date formats.
      ]);

      expect(
        generator.generate(browseMedia, [formatlessDateParser])?.startDate,
      ).toBeUndefined();
    });

    it('should import any-date-parser if a parser requires it', async () => {
      const generator = new MetadataGenerator();

      await generator.prepare([formatlessDateParser]);
      expect(generator.generate(browseMedia, [formatlessDateParser])?.startDate).toEqual(
        expectedDate,
      );

      // Re-preparing should nothing.
      await generator.prepare([formatlessDateParser]);
      expect(generator.generate(browseMedia, [formatlessDateParser])?.startDate).toEqual(
        expectedDate,
      );
    });
  });

  describe('should generate metadata', () => {
    it('should not generate metadata without an parsers', async () => {
      const generator = new MetadataGenerator();
      await generator.prepare([]);

      expect(generator.generate(browseMedia)).toBeNull();
    });

    it('should ignore unknown parsers', async () => {
      const goodParser: Parser = {
        type: 'date',
      };
      const badParser: Parser = {
        type: 'UNKNOWN' as 'date',
      };
      const generator = new MetadataGenerator();
      await generator.prepare([goodParser, badParser]);

      expect(generator.generate(browseMedia, [goodParser, badParser])).toEqual({
        startDate: expectedDate,
      });
    });

    describe('should generate date metadata', () => {
      describe('should generate date metadata without a date format', () => {
        it('should generate start date without a date format', async () => {
          const generator = new MetadataGenerator();
          await generator.prepare([formatlessDateParser]);

          expect(
            generator.generate(browseMedia, [formatlessDateParser])?.startDate,
          ).toEqual(expectedDate);
        });

        it('should treat date as an alias for the startdate parser', async () => {
          const parser: Parser = {
            type: 'date',
          };
          const generator = new MetadataGenerator();
          await generator.prepare([parser]);

          expect(generator.generate(browseMedia, [parser])?.startDate).toEqual(
            expectedDate,
          );
        });

        it('should not parse when regexp fails to match', async () => {
          const parser: Parser = {
            type: 'date',
            regexp: 'WILL_NOT_MATCH',
          };
          const generator = new MetadataGenerator();
          await generator.prepare([parser]);

          expect(generator.generate(browseMedia, [parser])?.startDate).toBeUndefined();
        });

        it('should fail to generate start date without a date format', async () => {
          const badBrowseMedia = createBrowseMedia({
            title: 'Test Media NO DATE',
          });
          const generator = new MetadataGenerator();
          await generator.prepare([formatlessDateParser]);

          expect(
            generator.generate(badBrowseMedia, [formatlessDateParser])?.startDate,
          ).toBeUndefined();
        });

        it('should fail to generate start date with invalid date', async () => {
          const badBrowseMedia = createBrowseMedia({
            title: '20250507AM',
          });
          const generator = new MetadataGenerator();
          await generator.prepare([formatlessDateParser]);

          expect(
            generator.generate(badBrowseMedia, [formatlessDateParser])?.startDate,
          ).toBeUndefined();
        });

        it('should incorporate parent metadata without a date format', async () => {
          // Parent has a start date at local midnight on 2025-05-26
          const parentBrowseMedia = createRichBrowseMedia({
            title: '2025-05-26',
            _metadata: {
              startDate: new Date(2025, 4, 26, 0, 0),
            },
          });
          const childBrowseMedia = createBrowseMedia({
            title: '22:42',
          });
          const generator = new MetadataGenerator();
          await generator.prepare([formatlessDateParser]);

          expect(
            generator.generate(
              childBrowseMedia,
              [formatlessDateParser],
              parentBrowseMedia,
            )?.startDate,
          ).toEqual(new Date(2025, 4, 26, 22, 42));
        });

        it('should not incorporate a parent thumbnail', async () => {
          const parentBrowseMedia = createRichBrowseMedia({
            title: '2025-05-26',
            _metadata: {
              thumbnailOverride: 'media-source://media_source/local/2025-05-26.jpg',
            },
          });
          const childBrowseMedia = createBrowseMedia({
            title: '22:42',
          });
          const generator = new MetadataGenerator();
          await generator.prepare([formatlessDateParser]);

          expect(
            generator.generate(
              childBrowseMedia,
              [formatlessDateParser],
              parentBrowseMedia,
            )?.thumbnailOverride,
          ).toBeUndefined();
        });
      });

      describe('should generate date metadata with a date format', () => {
        it('should generate start date with a date formater and a regexp', async () => {
          const dateParser: Parser = {
            type: 'startdate',
            format: 'yyyy-MM-dd HH:mm',
            regexp: 'Test Media (?<value>.*)',
          };
          const generator = new MetadataGenerator();
          await generator.prepare([dateParser]);

          expect(generator.generate(browseMedia, [dateParser])?.startDate).toEqual(
            expectedDate,
          );
        });

        it('should fail to generate start date with a date formater without a regexp', async () => {
          const dateParser: Parser = {
            type: 'startdate',
            format: 'yyyy-MM-dd HH:mm',
          };
          const generator = new MetadataGenerator();
          await generator.prepare([dateParser]);

          expect(
            generator.generate(browseMedia, [dateParser])?.startDate,
          ).toBeUndefined();
        });

        it('should use multiple parsed dates together', async () => {
          const browseMedia = createBrowseMedia({
            title: 'Foscam C1-20250507-171758-1746631078004-3.mp4',
          });
          const parsers: Parser[] = [
            {
              type: 'date',
              regexp: '\\d{8}',
            },
            {
              type: 'date',
              regexp: '-(?<value>\\d{6})-',
              format: 'HHmmss',
            },
          ];
          const generator = new MetadataGenerator();
          await generator.prepare(parsers);

          // The parsed date combines 20250507 (May 7, 2025) and 171758 (17:17:58)
          // interpreted in local time
          expect(generator.generate(browseMedia, parsers)?.startDate).toEqual(
            new Date(2025, 4, 7, 17, 17, 58),
          );
        });

        it('should not generate an end date without an enddate parser', async () => {
          const parser: Parser = { type: 'startdate', format: 'HH:mm' };
          const generator = new MetadataGenerator();
          await generator.prepare([parser]);

          expect(
            generator.generate(createBrowseMedia({ title: '22:42' }), [parser]),
          ).not.toHaveProperty('endDate');
        });

        it('should incorporate parent metadata with a date format', async () => {
          // Parent has a start date at local midnight on 2025-05-26
          const parentBrowseMedia = createRichBrowseMedia({
            title: '2025-05-26',
            _metadata: {
              startDate: new Date(2025, 4, 26, 0, 0),
            },
          });
          const childBrowseMedia = createBrowseMedia({
            title: '22:42',
          });
          const parser: Parser = {
            type: 'startdate',
            format: 'HH:mm',
          };
          const generator = new MetadataGenerator();
          await generator.prepare([parser]);

          expect(
            generator.generate(childBrowseMedia, [parser], parentBrowseMedia)?.startDate,
          ).toEqual(new Date(2025, 4, 26, 22, 42));
        });
      });
    });

    describe('should generate end date metadata', () => {
      const dayFolder = createRichBrowseMedia({
        title: '2026-11-09',
        _metadata: { startDate: new Date(2026, 10, 9) },
      });
      const parsers: Parser[] = [
        { type: 'startdate', regexp: '^\\d{2}:\\d{2}:\\d{2}', format: 'HH:mm:ss' },
        {
          type: 'enddate',
          regexp: '- (?<value>\\d{2}:\\d{2}:\\d{2})$',
          format: 'HH:mm:ss',
        },
      ];

      const generate = async (
        title: string,
        generatorParsers: Parser[] = parsers,
      ): Promise<BrowseMediaMetadata | null> => {
        const generator = new MetadataGenerator();
        await generator.prepare(generatorParsers);
        return generator.generate(
          createBrowseMedia({ title }),
          generatorParsers,
          dayFolder,
        );
      };

      it('should generate end date with a date format and a regexp', async () => {
        expect(await generate('05:54:10 - 08:26:53')).toEqual({
          startDate: new Date(2026, 10, 9, 5, 54, 10),
          endDate: new Date(2026, 10, 9, 8, 26, 53),
        });
      });

      it('should generate end date without a date format', async () => {
        expect(
          await generate('05:54:10 - 08:26:53', [
            parsers[0],
            { type: 'enddate', regexp: '- (?<value>.*)$' },
          ]),
        ).toEqual({
          startDate: new Date(2026, 10, 9, 5, 54, 10),
          endDate: new Date(2026, 10, 9, 8, 26, 53),
        });
      });

      it('should not take the start time for parts missing from the end date', async () => {
        expect(
          await generate('05:54:10 - 08:26', [
            parsers[0],
            { type: 'enddate', regexp: '- (?<value>.*)$' },
          ]),
        ).toEqual({
          startDate: new Date(2026, 10, 9, 5, 54, 10),
          endDate: new Date(2026, 10, 9, 8, 26, 0),
        });
      });

      it('should generate end date without a start date', async () => {
        const parser: Parser = { type: 'enddate', format: 'yyyy-MM-dd HH:mm:ss' };
        const generator = new MetadataGenerator();
        await generator.prepare([parser]);

        expect(
          generator.generate(createBrowseMedia({ title: '2026-11-09 08:26:53' }), [
            parser,
          ]),
        ).toEqual({ endDate: new Date(2026, 10, 9, 8, 26, 53) });
      });

      it('should move an end time that is earlier than the start time to the next day', async () => {
        expect(await generate('22:18:51 - 00:00:00')).toEqual({
          startDate: new Date(2026, 10, 9, 22, 18, 51),
          endDate: new Date(2026, 10, 10, 0, 0, 0),
        });
      });

      it('should not incorporate a parent end date', async () => {
        const parent = createRichBrowseMedia({
          title: '00:00:00 - 23:59:59',
          _metadata: {
            startDate: new Date(2026, 10, 9),
            endDate: new Date(2026, 10, 9, 23, 59, 59),
          },
        });
        const parser: Parser = { type: 'startdate', format: 'HH:mm:ss' };
        const generator = new MetadataGenerator();
        await generator.prepare([parser]);

        expect(
          generator.generate(createBrowseMedia({ title: '05:54:10' }), [parser], parent),
        ).toEqual({ startDate: new Date(2026, 10, 9, 5, 54, 10) });
      });

      it("should move an end time that is earlier than the parent folder's start time to the next day", () => {
        const parent = createRichBrowseMedia({
          title: '22',
          _metadata: { startDate: new Date(2026, 10, 9, 22) },
        });
        const parser: Parser = { type: 'enddate', format: 'HH:mm:ss' };

        expect(
          new MetadataGenerator().generate(
            createBrowseMedia({ title: '00:30:00' }),
            [parser],
            parent,
          ),
        ).toEqual({
          startDate: new Date(2026, 10, 9, 22),
          endDate: new Date(2026, 10, 10, 0, 30),
        });
      });
    });

    it("should leave the start date empty, rather than use the parent's, when the media's start date cannot be read", () => {
      const parent = createRichBrowseMedia({
        title: '2026-11-09',
        _metadata: { startDate: new Date(2026, 10, 9) },
      });
      const parser: Parser = { type: 'startdate', format: 'HH:mm:ss' };

      expect(
        new MetadataGenerator().generate(
          createBrowseMedia({ title: 'not a time' }),
          [parser],
          parent,
        )?.startDate,
      ).toBeUndefined();
    });
  });

  describe('generateUninherited', () => {
    it('should generate a start date from the media', () => {
      const parser: Parser = { type: 'date', format: 'yyyy-MM-dd' };

      expect(
        new MetadataGenerator().generateUninherited(
          createBrowseMedia({ title: '2026-10-31' }),
          [parser],
        ),
      ).toEqual({ startDate: new Date(2026, 9, 31) });
    });

    it('should fill in the parts of a date the parsers do not find from the base date', () => {
      expect(
        new MetadataGenerator().generateUninherited(
          createBrowseMedia({ title: '31' }),
          [{ type: 'date', format: 'dd' }],
          new Date(2026, 9, 1),
        ),
      ).toEqual({ startDate: new Date(2026, 9, 31) });
    });

    it('should combine a date and a time found by separate parsers', () => {
      const parsers: Parser[] = [
        { type: 'date', regexp: '^\\d{4}-\\d{2}-\\d{2}', format: 'yyyy-MM-dd' },
        { type: 'date', regexp: '(?<value>\\d{2}:\\d{2})$', format: 'HH:mm' },
      ];

      expect(
        new MetadataGenerator().generateUninherited(
          createBrowseMedia({ title: '2026-10-31 22:18' }),
          parsers,
        ),
      ).toEqual({ startDate: new Date(2026, 9, 31, 22, 18) });
    });

    it('should move an end time that is earlier than the start time to the next day, with no parent', () => {
      const parsers: Parser[] = [
        { type: 'startdate', regexp: '^[0-9:]{8}', format: 'HH:mm:ss' },
        { type: 'enddate', regexp: '[0-9:]{8}$', format: 'HH:mm:ss' },
      ];

      expect(
        new MetadataGenerator().generateUninherited(
          createBrowseMedia({ title: '22:18:51 - 00:50:06' }),
          parsers,
          new Date(2026, 9, 31),
        ),
      ).toEqual({
        startDate: new Date(2026, 9, 31, 22, 18, 51),
        endDate: new Date(2026, 10, 1, 0, 50, 6),
      });
    });

    it('should generate nothing from media without a date', () => {
      const parser: Parser = { type: 'date', regexp: '^\\d+$', format: 'dd' };

      expect(
        new MetadataGenerator().generateUninherited(
          createBrowseMedia({ title: 'Favorites' }),
          [parser],
          new Date(2026, 9, 1),
        ),
      ).toBeNull();
    });

    it('should ignore parsers that are not for dates', () => {
      expect(
        new MetadataGenerator().generateUninherited(
          createBrowseMedia({ title: '2026-10-31' }),
          [{ type: 'thumbnail' }],
        ),
      ).toBeNull();
    });
  });
});
