import { sub } from 'date-fns';
import { ConditionState } from '../../../conditions/types';
import {
  DateMatcher,
  Matcher,
  StartDateMatcher,
  TemplateMatcher,
  TitleMatcher,
} from '../../../config/schema/folders';
import { BrowseMediaMetadata, RichBrowseMedia } from '../../../ha/browse-media/types';
import { HomeAssistant } from '../../../ha/types';
import { regexpExtract } from '../../../utils/regexp-extract';
import { TemplateRenderer } from '../../templates';
import { REGEXP_GROUP_VALUE_KEY } from './types';

export class MediaMatcher {
  private _templateRenderer = new TemplateRenderer();

  public match(
    hass: HomeAssistant,
    media: RichBrowseMedia<BrowseMediaMetadata>,
    options?: {
      foldersOnly?: boolean;
      matchers?: Matcher[];
      conditionState?: ConditionState;
    },
  ): boolean {
    if (options?.foldersOnly && !media.can_expand) {
      return false;
    }

    for (const matcher of options?.matchers ?? []) {
      switch (matcher.type) {
        case 'date':
        case 'startdate':
          if (!this._matchStartDate(matcher, media)) {
            return false;
          }
          break;

        case 'template':
          if (!this._matchTemplate(hass, matcher, media, options?.conditionState)) {
            return false;
          }
          break;

        case 'title':
          if (!this._matchTitle(matcher, media)) {
            return false;
          }
          break;

        case 'or':
          if (
            !matcher.matchers.some((subMatcher) =>
              this.match(hass, media, {
                foldersOnly: options?.foldersOnly,
                matchers: [subMatcher],
                conditionState: options?.conditionState,
              }),
            )
          ) {
            return false;
          }
          break;
      }
    }

    return true;
  }

  private _matchStartDate(
    matcher: DateMatcher | StartDateMatcher,
    media: RichBrowseMedia<BrowseMediaMetadata>,
  ): boolean {
    const startDate = media._metadata?.startDate;
    return (
      !!startDate &&
      startDate >=
        sub(new Date(), {
          years: matcher.since.years ?? 0,
          months: matcher.since.months ?? 0,
          days: matcher.since.days ?? 0,
          hours: matcher.since.hours ?? 0,
          minutes: matcher.since.minutes ?? 0,
        })
    );
  }

  private _matchTemplate(
    hass: HomeAssistant,
    matcher: TemplateMatcher,
    media: RichBrowseMedia<BrowseMediaMetadata>,
    conditionState?: ConditionState,
  ): boolean {
    return (
      this._templateRenderer.renderRecursively(hass, matcher.value_template, {
        conditionState,
        mediaData: {
          title: media.title,
          is_folder: media.can_expand,
        },
      }) === true
    );
  }

  private _matchTitle(
    matcher: TitleMatcher,
    media: RichBrowseMedia<BrowseMediaMetadata>,
  ): boolean {
    const valueToMatch = matcher.regexp
      ? regexpExtract(matcher.regexp, media.title, { groupName: REGEXP_GROUP_VALUE_KEY })
      : media.title;

    if (!valueToMatch) {
      return false;
    }

    if (matcher.title) {
      return valueToMatch === matcher.title;
    }

    return true;
  }
}
