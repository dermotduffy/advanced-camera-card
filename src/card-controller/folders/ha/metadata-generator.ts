import type parser from 'any-date-parser';
import { addDays, parse, startOfDay } from 'date-fns';
import { omit } from 'lodash-es';

import type {
  DateParser,
  EndDateParser,
  Parser,
  StartDateParser,
} from '../../../config/schema/folders';
import type {
  BrowseMedia,
  BrowseMediaMetadata,
  RichBrowseMedia,
} from '../../../ha/browse-media/types';
import { isValidDate } from '../../../utils/date/validity';
import { regexpExtract } from '../../../utils/regexp-extract';
import { REGEXP_GROUP_VALUE_KEY } from './types';

type DateValueParser = DateParser | EndDateParser | StartDateParser;

const isDateValueParser = (parser: Parser): parser is DateValueParser =>
  parser.type === 'date' || parser.type === 'enddate' || parser.type === 'startdate';

export class MetadataGenerator {
  private _anyDateParser: typeof parser | null = null;

  public async prepare(parsers?: Parser[]): Promise<void> {
    if (this._anyDateParser) {
      return;
    }

    // Dynamically import the any-date-parser only if we have a parser that
    // requires it, in order to save on bundle size.
    if (parsers?.some((parser) => isDateValueParser(parser) && !parser.format)) {
      this._anyDateParser = (await import('any-date-parser')).default;
    }
  }

  public generate(
    media: BrowseMedia,
    parsers?: Parser[],
    parent?: RichBrowseMedia<BrowseMediaMetadata>,
  ): BrowseMediaMetadata | null {
    const metadata = this._wrapEndDateToNextDayIfNecessary({
      ...this._generateInherited(parent?._metadata),
      ...this.generateUninherited(media, parsers, parent?._metadata?.startDate),
    });
    return Object.keys(metadata).length > 0 ? metadata : null;
  }

  /**
   * Generate metadata from what the parsers find in the media itself, or null if
   * they find nothing. Unlike `generate`, nothing is inherited from a parent.
   * `baseDate` supplies any parts of a date the parsers do not find.
   */
  public generateUninherited(
    media: BrowseMedia,
    parsers?: Parser[],
    baseDate?: Date,
  ): BrowseMediaMetadata | null {
    const metadata: BrowseMediaMetadata = {};

    for (const parser of parsers ?? []) {
      if (!isDateValueParser(parser)) {
        continue;
      }

      const valueToParse = this._getValueToParse(parser, media);
      if (!valueToParse) {
        continue;
      }

      const startDate = metadata.startDate ?? baseDate;
      if (parser.type === 'enddate') {
        // An end date takes only its day from the start date, so parts the
        // title omits (e.g. seconds) are zero rather than the start's.
        metadata.endDate = this._parseDate(
          parser,
          valueToParse,
          startDate ? startOfDay(startDate) : undefined,
        );
      } else {
        metadata.startDate = this._parseDate(parser, valueToParse, startDate);
      }
    }

    return Object.keys(metadata).length > 0
      ? this._wrapEndDateToNextDayIfNecessary(metadata)
      : null;
  }

  // An end time before the start time (e.g. `22:18:51 - 00:00:00`) crosses
  // midnight.
  private _wrapEndDateToNextDayIfNecessary(
    metadata: BrowseMediaMetadata,
  ): BrowseMediaMetadata {
    return metadata.startDate &&
      metadata.endDate &&
      metadata.endDate < metadata.startDate
      ? { ...metadata, endDate: addDays(metadata.endDate, 1) }
      : metadata;
  }

  private _getValueToParse(parser: DateValueParser, media: BrowseMedia): string | null {
    return parser.regexp
      ? regexpExtract(parser.regexp, media.title, {
          groupName: REGEXP_GROUP_VALUE_KEY,
        })
      : media.title;
  }

  private _generateInherited(parentMetadata?: BrowseMediaMetadata): BrowseMediaMetadata {
    // Thumbnail and end date are not passed down: a picture of a folder is not
    // a picture of each file within it, and a file within a folder does not end
    // when the folder ends.
    return omit(parentMetadata, ['endDate', 'thumbnailOverride']);
  }

  private _parseDate(
    parser: DateValueParser,
    src: string,
    baseDate?: Date,
  ): Date | undefined {
    if (parser.format) {
      return this._parseFormattedDate(parser.format, src, baseDate);
    }
    return this._parseUnknownDate(src, baseDate);
  }

  private _parseFormattedDate(
    format: string,
    src: string,
    baseDate?: Date,
  ): Date | undefined {
    const result = parse(src, format, baseDate ?? new Date());
    return isValidDate(result) ? result : undefined;
  }

  private _parseUnknownDate(src: string, baseDate?: Date): Date | undefined {
    if (!this._anyDateParser) {
      return undefined;
    }
    const result = this._anyDateParser.attempt(src);
    if (!Object.keys(result).length) {
      return undefined;
    }
    const candidate = this._anyDateParser.fromObject({
      ...(baseDate && {
        year: baseDate.getFullYear(),
        month: baseDate.getMonth() + 1,
        day: baseDate.getDate(),
        hour: baseDate.getHours(),
        minute: baseDate.getMinutes(),
        second: baseDate.getSeconds(),
        millisecond: baseDate.getMilliseconds(),
      }),
      ...result,
    });
    return isValidDate(candidate) ? candidate : undefined;
  }
}
