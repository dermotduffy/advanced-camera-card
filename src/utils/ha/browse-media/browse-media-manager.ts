import { HomeAssistant } from '@dermotduffy/custom-card-helpers';
import { add } from 'date-fns';
import chunk from 'lodash-es/chunk';
import orderBy from 'lodash-es/orderBy';
import { BrowseMediaMetadata } from '../../../camera-manager/browse-media/types';
import { MemoryRequestCache } from '../../../camera-manager/cache';
import { allPromises } from '../../basic';
import { homeAssistantWSRequest } from '../ws-request';
import {
  BROWSE_MEDIA_CACHE_SECONDS,
  BrowseMedia,
  browseMediaSchema,
  RichBrowseMedia,
} from './types';

type BrowseMediaCache<M> = MemoryRequestCache<string, RichBrowseMedia<M>>;
type RichMetadataGenerator<M> = (
  media: BrowseMedia,
  parent?: RichBrowseMedia<M>,
) => M | null;

export type BrowseMediaTarget<M> = string | RichBrowseMedia<M>;
type RichBrowseMediaPredicate<M> = (media: RichBrowseMedia<M>) => boolean;

export const sortMediaByStartDate = (
  media: RichBrowseMedia<BrowseMediaMetadata>[],
): RichBrowseMedia<BrowseMediaMetadata>[] => {
  return orderBy(media, (media) => media._metadata?.startDate, 'desc');
};

export interface BrowseMediaStep<M> {
  // The targets to start the media walk from.
  targets: BrowseMediaTarget<M>[];

  // How many children to process concurrently. Default is infinite.
  concurrency?: number;

  // All children of the target have the metadata generator applied to them
  // first.
  metadataGenerator?: RichMetadataGenerator<M>;

  // If those children pass this matcher, then they will be included in the
  // output.
  matcher: RichBrowseMediaPredicate<M>;

  // Children (once past the matcher) will be sorted before the next step.
  sorter?: (media: RichBrowseMedia<M>[]) => RichBrowseMedia<M>[];

  // Whether to exit the walk early with the given output.
  earlyExit?: (media: RichBrowseMedia<M>[]) => boolean;

  // advance will be called to generate a next step (or null if the child should
  // just be included straight through to the output with no further steps).
  advance?: BrowseMediaStepAdvancer<M>;
}

type BrowseMediaStepAdvancer<M> = (media: RichBrowseMedia<M>[]) => BrowseMediaStep<M>[];

export class BrowseMediaManager<M> {
  // Walk down a browse media tree according to instructions included in `steps`.
  public async walkBrowseMedias(
    hass: HomeAssistant,
    steps: BrowseMediaStep<M>[] | null,
    options?: {
      cache?: BrowseMediaCache<M>;
    },
  ): Promise<RichBrowseMedia<M>[]> {
    if (!steps || !steps.length) {
      return [];
    }

    return (
      await allPromises(
        steps,
        async (step) => await this._walkBrowseMedia(hass, step, options),
      )
    ).flat();
  }

  protected async _walkBrowseMedia(
    hass: HomeAssistant,
    step: BrowseMediaStep<M>,
    options?: {
      cache?: BrowseMediaCache<M>;
    },
  ): Promise<RichBrowseMedia<M>[]> {
    let output: RichBrowseMedia<M>[] = [];

    for (const targetChunk of chunk(step.targets, step.concurrency ?? Infinity)) {
      const mediaChunk = await allPromises(
        targetChunk,
        async (target) =>
          await this._browseMedia(hass, target, {
            cache: options?.cache,
            matcher: step.matcher,
            metadataGenerator: step.metadataGenerator,
          }),
      );

      for (const parent of mediaChunk) {
        for (const child of parent.children ?? []) {
          if (step.matcher(child)) {
            output.push(child);
          }
        }
      }

      if (step.sorter) {
        output = step.sorter(output);
      }

      if (step.earlyExit && step.earlyExit(output)) {
        break;
      }
    }

    const nextSteps = step.advance ? step.advance(output) : null;
    if (!nextSteps?.length) {
      return output;
    }
    return await this.walkBrowseMedias(hass, nextSteps, options);
  }

  protected async _browseMedia(
    hass: HomeAssistant,
    target: string | RichBrowseMedia<M>,
    options?: {
      cache?: BrowseMediaCache<M>;
      matcher?: RichBrowseMediaPredicate<M>;
      metadataGenerator?: RichMetadataGenerator<M>;
    },
  ): Promise<RichBrowseMedia<M>> {
    const mediaContentID = typeof target === 'object' ? target.media_content_id : target;
    const cachedResult = options?.cache ? options.cache.get(mediaContentID) : null;
    if (cachedResult) {
      return cachedResult;
    }

    const request = {
      type: 'media_source/browse_media',
      media_content_id: mediaContentID,
    };
    const browseMedia = await homeAssistantWSRequest<RichBrowseMedia<M>>(
      hass,
      browseMediaSchema,
      request,
    );

    if (options?.metadataGenerator) {
      for (const child of browseMedia.children ?? []) {
        child._metadata =
          options.metadataGenerator(
            child,
            typeof target === 'object' ? target : undefined,
          ) ?? undefined;
      }
    }

    if (options?.cache) {
      options.cache.set(
        mediaContentID,
        browseMedia,
        add(new Date(), { seconds: BROWSE_MEDIA_CACHE_SECONDS }),
      );
    }
    return browseMedia;
  }
}
