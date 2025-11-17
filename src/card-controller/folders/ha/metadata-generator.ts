import { parse } from 'date-fns';
import { Parser } from '../../../config/schema/folders';
import {
  BrowseMedia,
  BrowseMediaMetadata,
  RichBrowseMedia,
} from '../../../ha/browse-media/types';

import type parser from 'any-date-parser';
import { isValidDate } from '../../../utils/basic';
import { regexpExtract } from '../../../utils/regexp-extract';
import { REGEXP_GROUP_VALUE_KEY } from './types';

export class MetadataGenerator {
  protected _anyDateParser: typeof parser | null = null;

  public async prepare(parsers?: Parser[]): Promise<void> {
    if (this._anyDateParser) {
      return;
    }

    // Dynamically import the any-date-parser only if we have a parser that
    // requires it, in order to save on bundle size.
    if (
      parsers?.some(
        (parser) => ['date', 'startdate'].includes(parser.type) && !parser.format,
      )
    ) {
      this._anyDateParser = (await import('any-date-parser')).default;
    }
  }

  public generate(
    media: BrowseMedia,
    parent?: RichBrowseMedia<BrowseMediaMetadata>,
    parsers?: Parser[],
  ): BrowseMediaMetadata | null {
    // Always propagate metadata from parent to children.
    const metadata: BrowseMediaMetadata = {
      ...parent?._metadata,
    };

    for (const parser of parsers ?? []) {
      const valueToParse = parser.regexp
        ? regexpExtract(parser.regexp, media.title, {
            groupName: REGEXP_GROUP_VALUE_KEY,
          })
        : media.title;
      if (!valueToParse) {
        continue;
      }
      if (parser.type === 'startdate' || parser.type === 'date') {
        metadata.startDate =
          this._parseDate(
            parser,
            valueToParse,
            metadata.startDate ?? parent?._metadata?.startDate,
          ) ?? undefined;
      }
    }

    return Object.keys(metadata).length > 0 ? metadata : null;
  }

  private _parseDate(parser: Parser, src: string, base?: Date): Date | undefined {
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
