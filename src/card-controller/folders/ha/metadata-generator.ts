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
import { isValidDate } from '../../../utils/basic';
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
    parent?: RichBrowseMedia<BrowseMediaMetadata>,
    parsers?: Parser[],
  ): BrowseMediaMetadata | null {
    const metadata = this._getInheritedMetadata(parent?._metadata);

    for (const parser of parsers ?? []) {
      if (!isDateValueParser(parser)) {
        continue;
      }

      const valueToParse = parser.regexp
        ? regexpExtract(parser.regexp, media.title, {
            groupName: REGEXP_GROUP_VALUE_KEY,
          })
        : media.title;
      if (!valueToParse) {
        continue;
      }

      const startDate = metadata.startDate ?? parent?._metadata?.startDate;
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

    // An end time before the start time (e.g. `22:18:51 - 00:00:00`) crosses
    // midnight.
    if (
      metadata.startDate &&
      metadata.endDate &&
      metadata.endDate < metadata.startDate
    ) {
      metadata.endDate = addDays(metadata.endDate, 1);
    }

    return Object.keys(metadata).length > 0 ? metadata : null;
  }

  private _getInheritedMetadata(
    parentMetadata?: BrowseMediaMetadata,
  ): BrowseMediaMetadata {
    // Thumbnail and end date are not passed down: a picture of a folder is not
    // a picture of each file within it, and a file within a folder does not end
    // when the folder ends.
    return omit(parentMetadata, ['endDate', 'thumbnailOverride']);
  }

  private _parseDate(
    parser: DateValueParser,
    src: string,
    base?: Date,
  ): Date | undefined {
    if (parser.format) {
      return this._parseFormattedDate(parser.format, src, base);
    }
    return this._parseUnknownDate(src, base);
  }

  private _parseFormattedDate(
    format: string,
    src: string,
    base?: Date,
  ): Date | undefined {
    const result = parse(src, format, base ?? new Date());
    return isValidDate(result) ? result : undefined;
  }

  private _parseUnknownDate(src: string, base?: Date): Date | undefined {
    if (!this._anyDateParser) {
      return undefined;
    }
    const result = this._anyDateParser.attempt(src);
    if (!Object.keys(result).length) {
      return undefined;
    }
    const candidate = this._anyDateParser.fromObject({
      ...(base && {
        year: base.getFullYear(),
        month: base.getMonth() + 1,
        day: base.getDate(),
        hour: base.getHours(),
        minute: base.getMinutes(),
        second: base.getSeconds(),
        millisecond: base.getMilliseconds(),
      }),
      ...result,
    });
    return isValidDate(candidate) ? candidate : undefined;
  }
}
