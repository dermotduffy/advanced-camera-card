import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BrowseMedia,
  BrowseMediaCache,
  RichBrowseMedia,
  browseMediaSchema,
} from '../../../src/ha/browse-media/types';
import { BrowseMediaStep, BrowseMediaWalker } from '../../../src/ha/browse-media/walker';
import { homeAssistantWSRequest } from '../../../src/ha/ws-request';
import { createBrowseMedia, createHASS } from '../../test-utils';

vi.mock('../../../src/ha/ws-request');

describe('BrowseMediaWalker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return an empty array if steps are null or empty', async () => {
    const walker = new BrowseMediaWalker();
    const hass = createHASS();
    expect(await walker.walk(hass, null)).toEqual([]);
    expect(await walker.walk(hass, [])).toEqual([]);
  });

  it('should perform a simple walk with one step', async () => {
    const child = createBrowseMedia();
    const parent = createBrowseMedia({
      media_content_id: 'media/parent',
      children: [child],
    });

    vi.mocked(homeAssistantWSRequest).mockResolvedValue(parent);

    const hass = createHASS();
    const walker = new BrowseMediaWalker();
    const result = await walker.walk(hass, [
      {
        targets: ['media/parent'],
      },
    ]);

    expect(homeAssistantWSRequest).toBeCalledWith(hass, browseMediaSchema, {
      type: 'media_source/browse_media',
      media_content_id: 'media/parent',
    });
    expect(result).toEqual([child]);
  });

  it('should filter media using a matcher', async () => {
    const childToKeep = createBrowseMedia({
      media_content_id: 'media/child-keep',
    });
    const childToFilter = createBrowseMedia({
      media_content_id: 'media/child-filter',
    });

    const parent = createBrowseMedia({
      media_content_id: 'media/parent',
      media_content_type: 'directory',
      title: 'Parent',
      children: [childToKeep, childToFilter],
    });

    vi.mocked(homeAssistantWSRequest).mockResolvedValue(parent);

    const hass = createHASS();
    const walker = new BrowseMediaWalker();

    const steps: BrowseMediaStep<undefined>[] = [
      {
        targets: ['media/parent'],
        matcher: (media) => media.media_content_id === 'media/child-keep',
      },
    ];

    const result = await walker.walk(hass, steps);

    expect(homeAssistantWSRequest).toBeCalledWith(hass, browseMediaSchema, {
      type: 'media_source/browse_media',
      media_content_id: 'media/parent',
    });
    expect(result).toEqual([childToKeep]);
  });

  interface TestMetadata {
    custom: string;
  }

  describe('should generate metadata', async () => {
    it('should generate simple metadata', async () => {
      const child = createBrowseMedia({
        media_content_id: 'media/child',
      });

      const parent = createBrowseMedia({
        media_content_id: 'media/parent',
        children: [child],
      });

      const metadataGenerator = (
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _media: BrowseMedia,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _parentTarget?: RichBrowseMedia<TestMetadata>,
      ) => ({
        custom: 'foo',
      });

      vi.mocked(homeAssistantWSRequest).mockResolvedValue(parent);

      const steps: BrowseMediaStep<TestMetadata>[] = [
        {
          targets: ['media/parent'],
          metadataGenerator,
        },
      ];

      const walker = new BrowseMediaWalker();
      const result = await walker.walk(createHASS(), steps);

      expect(result.length).toBe(1);
      expect(result[0]?._metadata).toEqual({
        custom: 'foo',
      });
    });

    it('should handle parents without children', async () => {
      const parent = createBrowseMedia({
        media_content_id: 'media/parent-with-free-time',
        children: null,
      });

      const metadataGenerator = (
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _media: BrowseMedia,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _parentTarget?: RichBrowseMedia<TestMetadata>,
      ) => ({
        custom: 'foo',
      });

      vi.mocked(homeAssistantWSRequest).mockResolvedValue(parent);

      const steps: BrowseMediaStep<TestMetadata>[] = [
        {
          targets: ['media/parent'],
          metadataGenerator,
        },
      ];

      const walker = new BrowseMediaWalker();
      const result = await walker.walk(createHASS(), steps);

      expect(result.length).toBe(0);
    });

    it('should handle metadata generator that returns null', async () => {
      const child = createBrowseMedia({
        media_content_id: 'media/child',
      });
      const parent = createBrowseMedia({
        media_content_id: 'media/parent',
        children: [child],
      });

      const metadataGenerator = (
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _media: BrowseMedia,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _parentTarget?: RichBrowseMedia<TestMetadata>,
      ) => null;

      vi.mocked(homeAssistantWSRequest).mockResolvedValue(parent);

      const steps: BrowseMediaStep<TestMetadata>[] = [
        {
          targets: ['media/parent'],
          metadataGenerator,
        },
      ];

      const walker = new BrowseMediaWalker();
      const result = await walker.walk(createHASS(), steps);

      expect(result).toEqual([child]);
      expect(result[0]?._metadata).toBeUndefined();
    });

    it('should handle recurisve metadata', async () => {
      const grandchild = createBrowseMedia({
        media_content_id: 'media/grandchild',
        can_expand: false,
        can_play: true,
      });
      const subparent = createBrowseMedia({
        media_content_id: 'media/subparent',
        can_expand: true,
        children: [grandchild],
      });
      const parent = createBrowseMedia({
        media_content_id: 'media/parent',
        can_expand: true,
        children: [subparent],
      });

      const metadataGenerator = (
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _media: BrowseMedia,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _parentTarget?: RichBrowseMedia<TestMetadata>,
      ) => ({
        custom: 'foo',
      });

      vi.mocked(homeAssistantWSRequest).mockImplementation(
        async (_hass, _schema, request) => {
          if (request.media_content_id === 'media/parent') {
            return parent;
          }
          if (request.media_content_id === 'media/subparent') {
            return subparent;
          }
          throw new Error(
            `Unexpected media_content_id in mock: ${request.media_content_id}`,
          );
        },
      );

      const steps: BrowseMediaStep<TestMetadata>[] = [
        {
          targets: ['media/parent'],
          metadataGenerator,
          advance: (matchedDirs) => {
            return matchedDirs.map((dir) => ({
              targets: [dir],
              metadataGenerator,
            }));
          },
        },
      ];

      const hass = createHASS();
      const walker = new BrowseMediaWalker();
      const result = await walker.walk(hass, steps);

      expect(result.length).toBe(1);
      expect(result[0].media_content_id).toBe('media/grandchild');
      expect(result[0]?._metadata).toEqual({
        custom: 'foo',
      });
    });
  });

  it('should sort media using a sorter', async () => {
    const child_1 = createBrowseMedia({
      media_content_id: 'media/child-1',
    });
    const child_2 = createBrowseMedia({
      media_content_id: 'media/child-2',
    });
    const parent = createBrowseMedia({
      children: [child_2, child_1],
    });

    vi.mocked(homeAssistantWSRequest).mockResolvedValue(parent);

    const steps: BrowseMediaStep<undefined>[] = [
      {
        targets: ['media/parent'],
        sorter: (media) =>
          [...media].sort((a, b) =>
            a.media_content_id.localeCompare(b.media_content_id),
          ),
      },
    ];

    const walker = new BrowseMediaWalker();
    const result = await walker.walk(createHASS(), steps);
    expect(result.map((m) => m.media_content_id)).toEqual([
      'media/child-1',
      'media/child-2',
    ]);
  });

  it('should exit early when earlyExit returns true', async () => {
    const child_1 = createBrowseMedia({
      media_content_id: 'media/child-1',
    });
    const child_2 = createBrowseMedia({
      media_content_id: 'media/child-2',
    });
    const parent_1 = createBrowseMedia({
      media_content_id: 'media/parent-1',
      children: [child_1],
    });
    const parent_2 = createBrowseMedia({
      media_content_id: 'media/parent-2',
      children: [child_2],
    });

    vi.mocked(homeAssistantWSRequest).mockResolvedValueOnce(parent_1);

    vi.mocked(homeAssistantWSRequest).mockImplementation(
      async (_hass, _schema, request) => {
        if (request.media_content_id === 'media/parent-1') {
          return parent_1;
        }
        if (request.media_content_id === 'media/parent-2') {
          return parent_2;
        }
        throw new Error('Unexpected request');
      },
    );

    const steps: BrowseMediaStep<undefined>[] = [
      {
        targets: ['media/parent-1', 'media/parent-2'],
        concurrency: 1,
        earlyExit: (media) => media.length >= 1,
      },
    ];

    const hass = createHASS();
    const walker = new BrowseMediaWalker();
    const result = await walker.walk(hass, steps);

    expect(result).toEqual([child_1]);
    expect(homeAssistantWSRequest).toBeCalledTimes(1);
    expect(homeAssistantWSRequest).toBeCalledWith(hass, browseMediaSchema, {
      type: 'media_source/browse_media',
      media_content_id: 'media/parent-1',
    });
  });

  it('should advance to next steps for recursive walking', async () => {
    const grandchild = createBrowseMedia({
      media_content_id: 'media/grandchild',
      can_expand: false,
      can_play: true,
    });
    const subparent = createBrowseMedia({
      media_content_id: 'media/subparent',
      can_expand: true,
      children: [grandchild],
    });
    const parent = createBrowseMedia({
      media_content_id: 'media/parent',
      can_expand: true,
      children: [subparent],
    });

    vi.mocked(homeAssistantWSRequest).mockImplementation(
      async (_hass, _schema, request) => {
        if (request.media_content_id === 'media/parent') {
          return parent;
        }
        if (request.media_content_id === 'media/subparent') {
          return subparent;
        }
        throw new Error(
          `Unexpected media_content_id in mock: ${request.media_content_id}`,
        );
      },
    );

    const steps: BrowseMediaStep<undefined>[] = [
      {
        targets: ['media/parent'],
        matcher: (media) => media.can_expand === true,
        advance: (matchedDirs) => {
          return matchedDirs.map((dir) => ({
            targets: [dir],
            matcher: (childMedia) => childMedia.can_play === true,
          }));
        },
      },
    ];

    const hass = createHASS();
    const walker = new BrowseMediaWalker();
    const result = await walker.walk(hass, steps);

    expect(result.length).toBe(1);
    expect(result[0].media_content_id).toBe('media/grandchild');

    expect(homeAssistantWSRequest).toHaveBeenCalledTimes(2);
    expect(homeAssistantWSRequest).toHaveBeenCalledWith(hass, browseMediaSchema, {
      type: 'media_source/browse_media',
      media_content_id: 'media/parent',
    });
    expect(homeAssistantWSRequest).toHaveBeenCalledWith(hass, browseMediaSchema, {
      type: 'media_source/browse_media',
      media_content_id: 'media/subparent',
    });
  });

  it('should use cache when available', async () => {
    const child = createBrowseMedia({
      media_content_id: 'media/child',
    });
    const parent = createBrowseMedia({
      media_content_id: 'media/parent',
      children: [child],
    });

    vi.mocked(homeAssistantWSRequest).mockResolvedValue(parent);

    const cache = new BrowseMediaCache();
    const hass = createHASS();
    const walker = new BrowseMediaWalker();

    expect(await walker.walk(hass, [{ targets: ['media/parent'] }], { cache })).toEqual([
      child,
    ]);

    expect(homeAssistantWSRequest).toBeCalledTimes(1);
    expect(cache.has('media/parent')).toBe(true);
    expect(cache.get('media/parent')).toEqual(parent);

    expect(await walker.walk(hass, [{ targets: ['media/parent'] }], { cache })).toEqual([
      child,
    ]);
    expect(homeAssistantWSRequest).toBeCalledTimes(1);
  });

  it('should process multiple targets and combine their children', async () => {
    const child_1 = createBrowseMedia({
      media_content_id: 'media/child-1',
    });
    const parent_1 = createBrowseMedia({
      media_content_id: 'media/parent-1',
      children: [child_1],
    });
    const child_2 = createBrowseMedia({
      media_content_id: 'media/child-2',
    });
    const parent_2 = createBrowseMedia({
      media_content_id: 'media/parent-2',
      children: [child_2],
    });

    vi.mocked(homeAssistantWSRequest).mockImplementation(
      async (_hass, _schema, request) => {
        if (request.media_content_id === 'media/parent-1') {
          return parent_1;
        }
        if (request.media_content_id === 'media/parent-2') {
          return parent_2;
        }
        throw new Error('Unexpected request');
      },
    );

    const steps: BrowseMediaStep<undefined>[] = [
      {
        targets: ['media/parent-1', 'media/parent-2'],
      },
    ];

    const hass = createHASS();
    const walker = new BrowseMediaWalker();
    const result = await walker.walk(hass, steps);

    expect(homeAssistantWSRequest).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual(child_1);
    expect(result).toContainEqual(child_2);
  });
});
