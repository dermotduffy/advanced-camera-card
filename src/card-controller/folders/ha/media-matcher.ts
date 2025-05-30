import { ConditionState } from '../../../conditions/types';
import { Matcher, TemplateMatcher, TitleMatcher } from '../../../config/schema/folders';
import { BrowseMedia } from '../../../ha/browse-media/types';
import { HomeAssistant } from '../../../ha/types';
import { regexpExtract } from '../../../utils/regexp-extract';
import { TemplateRenderer } from '../../templates';
import { REGEXP_GROUP_VALUE_KEY } from './types';

export class MediaMatcher {
  private _templateRenderer = new TemplateRenderer();

  public match(
    hass: HomeAssistant,
    media: BrowseMedia,
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

  private _matchTemplate(
    hass: HomeAssistant,
    matcher: TemplateMatcher,
    media: BrowseMedia,
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

  private _matchTitle(matcher: TitleMatcher, media: BrowseMedia): boolean {
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
