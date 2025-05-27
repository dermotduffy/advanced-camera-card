import { describe, expect, it } from 'vitest';
import { MetadataGenerator } from '../../../../src/card-controller/folders/ha/metadata-generator';
import { Parser } from '../../../../src/config/schema/folders';
import { createBrowseMedia, createRichBrowseMedia } from '../../../test-utils';

describe('MetadataGenerator', () => {
  const browseMedia = createBrowseMedia({
    title: 'Test Media 2025-05-26 18:18',
  });
  const expectedDate = new Date('2025-05-26T18:18:00.000Z');
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
        generator.generate(browseMedia, undefined, [formatlessDateParser])?.startDate,
      ).toBeUndefined();
    });

    it('should import any-date-parser if a parser requires it', async () => {
      const generator = new MetadataGenerator();

      await generator.prepare([formatlessDateParser]);
      expect(
        generator.generate(browseMedia, undefined, [formatlessDateParser])?.startDate,
      ).toEqual(expectedDate);

      // Re-preparing should nothing.
      await generator.prepare([formatlessDateParser]);
      expect(
        generator.generate(browseMedia, undefined, [formatlessDateParser])?.startDate,
      ).toEqual(expectedDate);
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

      expect(generator.generate(browseMedia, undefined, [goodParser, badParser])).toEqual({
        startDate: expectedDate,
      });
    });

    describe('should generate date metadata', () => {
      describe('should generate date metadata without a date format', () => {
        it('should generate start date without a date format', async () => {
          const generator = new MetadataGenerator();
          await generator.prepare([formatlessDateParser]);

          expect(
            generator.generate(browseMedia, undefined, [formatlessDateParser])
              ?.startDate,
          ).toEqual(expectedDate);
        });

        it('should treat date as an alias for the startdate parser', async () => {
          const parser: Parser = {
            type: 'date',
          };
          const generator = new MetadataGenerator();
          await generator.prepare([parser]);

          expect(
            generator.generate(browseMedia, undefined, [parser])?.startDate,
          ).toEqual(expectedDate);
        });

        it('should not parse when regexp fails to match', async () => {
          const parser: Parser = {
            type: 'date',
            regexp: 'WILL_NOT_MATCH', 
          };
          const generator = new MetadataGenerator();
          await generator.prepare([parser]);

          expect(
            generator.generate(browseMedia, undefined, [parser])?.startDate,
          ).toBeUndefined();
        });

        it('should fail to generate start date without a date format', async () => {
          const badBrowseMedia = createBrowseMedia({
            title: 'Test Media NO DATE',
          });
          const generator = new MetadataGenerator();
          await generator.prepare([formatlessDateParser]);

          expect(
            generator.generate(badBrowseMedia, undefined, [formatlessDateParser])
              ?.startDate,
          ).toBeUndefined();
        });

        it('should incorporate parent metadata without a date format', async () => {
          const parentBrowseMedia = createRichBrowseMedia({
            title: '2025-05-26',
            _metadata: {
              startDate: new Date('2025-05-26T00:00:00.000Z'),
            },
          });
          const childBrowseMedia = createBrowseMedia({
            title: '22:42',
          });
          const generator = new MetadataGenerator();
          await generator.prepare([formatlessDateParser]);

          expect(
            generator.generate(childBrowseMedia, parentBrowseMedia, [
              formatlessDateParser,
            ])?.startDate,
          ).toEqual(new Date('2025-05-26T22:42:00.000Z'));
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

          expect(
            generator.generate(browseMedia, undefined, [dateParser])?.startDate,
          ).toEqual(expectedDate);
        });

        it('should fail to generate start date with a date formater without a regexp', async () => {
          const dateParser: Parser = {
            type: 'startdate',
            format: 'yyyy-MM-dd HH:mm',
          };
          const generator = new MetadataGenerator();
          await generator.prepare([dateParser]);

          expect(
            generator.generate(browseMedia, undefined, [dateParser])?.startDate,
          ).toBeUndefined();
        });

        it('should incorporate parent metadata with a date format', async () => {
          const parentBrowseMedia = createRichBrowseMedia({
            title: '2025-05-26',
            _metadata: {
              startDate: new Date('2025-05-26T00:00:00.000Z'),
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
            generator.generate(childBrowseMedia, parentBrowseMedia, [
              parser,
            ])?.startDate,
          ).toEqual(new Date('2025-05-26T22:42:00.000Z'));
        });

      });
    });
  });
});
