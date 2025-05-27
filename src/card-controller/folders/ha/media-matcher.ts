import { Matcher } from '../../../config/schema/folders';
import { BrowseMedia } from '../../../ha/browse-media/types';
import { regexpExtract } from '../../../utils/regexp-extract';
import { REGEXP_GROUP_VALUE_KEY } from './types';

export class MediaMatcher {
  public match(media: BrowseMedia, matchers?: Matcher[], foldersOnly = false): boolean {
    if (foldersOnly && !media.can_expand) {
      return false;
    }

    for (const matcher of matchers ?? []) {
      if (matcher.type === 'title') {
        if (!this._matchTitle(matcher, media.title)) {
          return false;
        }
      }
    }

    return true;
  }

  private _matchTitle(matcher: Matcher, src: string): boolean {
    const valueToMatch = matcher.regexp
      ? regexpExtract(matcher.regexp, src, { groupName: REGEXP_GROUP_VALUE_KEY })
      : src;

    if (!valueToMatch) {
      return false;
    }

    if (matcher.title) {
      return valueToMatch === matcher.title;
    }

    return true;
  }
}
