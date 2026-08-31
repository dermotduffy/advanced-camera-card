import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { ThumbnailMetadataGenerator } from '../../../../src/card-controller/folders/ha/thumbnail-metadata-generator';
import type { TemplateRenderer } from '../../../../src/card-controller/templates';
import type {
  BrowseMediaMetadata,
  RichBrowseMedia,
} from '../../../../src/ha/browse-media/types';
import { createHASS, createRichBrowseMedia } from '../../../test-utils';

describe('ThumbnailMetadataGenerator', () => {
  const createMedia = (
    title: string,
    mediaClass = 'video',
  ): RichBrowseMedia<BrowseMediaMetadata> =>
    createRichBrowseMedia({
      title,
      media_class: mediaClass,
      media_content_id: `media-source://folder/${title}`,
      _metadata: {},
    });

  const createImage = (title: string): RichBrowseMedia<BrowseMediaMetadata> =>
    createMedia(title, 'image');

  const createFolder = (
    title: string,
    mediaClass = 'directory',
  ): RichBrowseMedia<BrowseMediaMetadata> => ({
    ...createMedia(title, mediaClass),
    can_expand: true,
  });

  it('should do nothing without a thumbnail parser', () => {
    const generator = new ThumbnailMetadataGenerator(mock<TemplateRenderer>());
    const children = [createMedia('clip.mp4'), createImage('clip.jpg')];

    generator.generate(createHASS(), children, [{ type: 'date' }]);

    expect(children[0]._metadata).toEqual({});
    expect(children[1]._metadata).toEqual({});
  });

  it('should use an image with a matching title as a thumbnail', () => {
    const generator = new ThumbnailMetadataGenerator(mock<TemplateRenderer>());
    const children = [createMedia('clip.mp4'), createImage('clip.jpg')];

    generator.generate(createHASS(), children, [{ type: 'thumbnail' }]);

    expect(children[0]._metadata).toEqual({
      thumbnailOverride: 'media-source://folder/clip.jpg',
    });
    expect(children[1]._metadata).toEqual({
      thumbnailOverride: 'media-source://folder/clip.jpg',
    });
  });

  it('should not use an image with a different title as a thumbnail', () => {
    const generator = new ThumbnailMetadataGenerator(mock<TemplateRenderer>());
    const children = [createMedia('clip.mp4'), createImage('something-else.jpg')];

    generator.generate(createHASS(), children, [{ type: 'thumbnail' }]);

    expect(children[0]._metadata).toEqual({});
    expect(children[1]._metadata).toEqual({
      thumbnailOverride: 'media-source://folder/something-else.jpg',
    });
  });

  it('should use a regexp to match a title to an image', () => {
    const generator = new ThumbnailMetadataGenerator(mock<TemplateRenderer>());
    const children = [createMedia('clip.mp4'), createImage('clip_thumb.jpg')];

    generator.generate(createHASS(), children, [
      { type: 'thumbnail', regexp: '^(?<value>.+?)(?:_thumb)?\\.[^.]+$' },
    ]);

    expect(children[0]._metadata).toEqual({
      thumbnailOverride: 'media-source://folder/clip_thumb.jpg',
    });
    expect(children[1]._metadata).toEqual({
      thumbnailOverride: 'media-source://folder/clip_thumb.jpg',
    });
  });

  it('should ignore media that a regexp does not match', () => {
    const generator = new ThumbnailMetadataGenerator(mock<TemplateRenderer>());
    const children = [createMedia('clip.mp4'), createImage('clip.jpg')];

    generator.generate(createHASS(), children, [
      { type: 'thumbnail', regexp: 'WILL-NOT-MATCH' },
    ]);

    expect(children[0]._metadata).toEqual({});
    expect(children[1]._metadata).toEqual({});
  });

  it('should use an image as its own thumbnail', () => {
    const generator = new ThumbnailMetadataGenerator(mock<TemplateRenderer>());
    const children = [createImage('bird.jpg'), createImage('cat.jpg')];

    generator.generate(createHASS(), children, [{ type: 'thumbnail' }]);

    expect(children[0]._metadata).toEqual({
      thumbnailOverride: 'media-source://folder/bird.jpg',
    });
    expect(children[1]._metadata).toEqual({
      thumbnailOverride: 'media-source://folder/cat.jpg',
    });
  });

  it('should use the first of several matching images as a thumbnail', () => {
    const generator = new ThumbnailMetadataGenerator(mock<TemplateRenderer>());
    const children = [
      createMedia('clip.mp4'),
      createImage('clip.jpg'),
      createImage('clip.png'),
    ];

    generator.generate(createHASS(), children, [
      { type: 'thumbnail', regexp: '^(?<value>[^.]+)' },
    ]);

    expect(children[0]._metadata).toEqual({
      thumbnailOverride: 'media-source://folder/clip.jpg',
    });
    expect(children[1]._metadata).toEqual({
      thumbnailOverride: 'media-source://folder/clip.jpg',
    });

    expect(children[2]._metadata).toEqual({
      thumbnailOverride: 'media-source://folder/clip.png',
    });
  });

  it('should give a folder a thumbnail from a matching image', () => {
    const generator = new ThumbnailMetadataGenerator(mock<TemplateRenderer>());
    const children = [createFolder('2026-08-28'), createImage('2026-08-28.jpg')];

    generator.generate(createHASS(), children, [{ type: 'thumbnail' }]);

    expect(children[0]._metadata).toEqual({
      thumbnailOverride: 'media-source://folder/2026-08-28.jpg',
    });
    expect(children[1]._metadata).toEqual({
      thumbnailOverride: 'media-source://folder/2026-08-28.jpg',
    });
  });

  it('should not remove a file extension from a folder title', () => {
    const generator = new ThumbnailMetadataGenerator(mock<TemplateRenderer>());
    const children = [createFolder('2026.08'), createImage('2026.08.jpg')];

    generator.generate(createHASS(), children, [{ type: 'thumbnail' }]);

    expect(children[0]._metadata).toEqual({
      thumbnailOverride: 'media-source://folder/2026.08.jpg',
    });
  });

  it('should not use a folder as a thumbnail', () => {
    const generator = new ThumbnailMetadataGenerator(mock<TemplateRenderer>());

    // Some integrations report a folder with an image media class.
    const children = [createMedia('clip.mp4'), createFolder('clip', 'image')];

    generator.generate(createHASS(), children, [
      { type: 'thumbnail', regexp: '^(?<value>[^.]+)' },
    ]);

    expect(children[0]._metadata).toEqual({});
    expect(children[1]._metadata).toEqual({});
  });

  it('should keep the thumbnail set by the first parser that matches', () => {
    const generator = new ThumbnailMetadataGenerator(mock<TemplateRenderer>());
    const children = [
      createMedia('clip.mp4'),
      createImage('clip_alt.png'),
      createImage('clip.jpg'),
    ];

    generator.generate(createHASS(), children, [
      { type: 'thumbnail' },
      { type: 'thumbnail', regexp: '^(?<value>[^._]+)' },
    ]);

    expect(children[0]._metadata).toEqual({
      thumbnailOverride: 'media-source://folder/clip.jpg',
    });
  });

  describe('with a value template', () => {
    it('should use the rendered value as a thumbnail', () => {
      const templateRenderer = mock<TemplateRenderer>();
      templateRenderer.renderRecursively.mockReturnValue(
        'media-source://thumbs/clip.jpg',
      );
      const generator = new ThumbnailMetadataGenerator(templateRenderer);
      const children = [createMedia('clip.mp4')];
      const hass = createHASS();

      generator.generate(hass, children, [
        { type: 'thumbnail', value_template: '{{ acc.media.id }}' },
      ]);

      expect(templateRenderer.renderRecursively).toHaveBeenCalledWith(
        hass,
        '{{ acc.media.id }}',
        {
          mediaData: {
            id: 'media-source://folder/clip.mp4',
            title: 'clip.mp4',
            is_folder: false,
          },
        },
      );
      expect(children[0]._metadata).toEqual({
        thumbnailOverride: 'media-source://thumbs/clip.jpg',
      });
    });

    it('should use the rendered value as an image thumbnail', () => {
      const templateRenderer = mock<TemplateRenderer>();
      templateRenderer.renderRecursively.mockReturnValue(
        'media-source://folder/clip.jpg',
      );
      const generator = new ThumbnailMetadataGenerator(templateRenderer);
      const children = [createMedia('clip.mp4'), createImage('clip.jpg')];

      generator.generate(createHASS(), children, [
        { type: 'thumbnail', value_template: '{{ 1 }}' },
      ]);

      expect(children[1]._metadata).toEqual({
        thumbnailOverride: 'media-source://folder/clip.jpg',
      });
    });

    it('should ignore a template that does not render a string', () => {
      const templateRenderer = mock<TemplateRenderer>();
      templateRenderer.renderRecursively.mockReturnValue(false);
      const generator = new ThumbnailMetadataGenerator(templateRenderer);
      const children = [createMedia('clip.mp4')];

      generator.generate(createHASS(), children, [
        { type: 'thumbnail', value_template: '{{ 1 == 2 }}' },
      ]);

      expect(children[0]._metadata).toEqual({});
    });

    it('should ignore a template that renders only whitespace', () => {
      const templateRenderer = mock<TemplateRenderer>();
      templateRenderer.renderRecursively.mockReturnValue('\n  ');
      const generator = new ThumbnailMetadataGenerator(templateRenderer);
      const children = [createMedia('clip.mp4')];

      generator.generate(createHASS(), children, [
        { type: 'thumbnail', value_template: '{% if false %}x{% endif %}' },
      ]);

      expect(children[0]._metadata).toEqual({});
    });

    it('should ignore a template that renders an empty string', () => {
      const templateRenderer = mock<TemplateRenderer>();
      templateRenderer.renderRecursively.mockReturnValue('');
      const generator = new ThumbnailMetadataGenerator(templateRenderer);
      const children = [createMedia('clip.mp4')];

      generator.generate(createHASS(), children, [
        { type: 'thumbnail', value_template: '{{ "" }}' },
      ]);

      expect(children[0]._metadata).toEqual({});
    });

    it('should not render a template for media that already has a thumbnail', () => {
      const templateRenderer = mock<TemplateRenderer>();
      templateRenderer.renderRecursively.mockReturnValue(
        'media-source://thumbs/clip.jpg',
      );
      const generator = new ThumbnailMetadataGenerator(templateRenderer);
      const children = [createMedia('clip.mp4'), createImage('clip.jpg')];

      generator.generate(createHASS(), children, [
        { type: 'thumbnail' },
        { type: 'thumbnail', value_template: '{{ acc.media.id }}' },
      ]);

      expect(templateRenderer.renderRecursively).not.toHaveBeenCalled();
      expect(children[0]._metadata).toEqual({
        thumbnailOverride: 'media-source://folder/clip.jpg',
      });
    });
  });
});

describe('ThumbnailMetadataGenerator.removeThumbnailsOfOtherMedia', () => {
  const createMediaWithThumbnail = (
    title: string,
    thumbnailOverride?: string,
    mediaClass = 'video',
  ): RichBrowseMedia<BrowseMediaMetadata> =>
    createRichBrowseMedia({
      title,
      media_class: mediaClass,
      media_content_id: `media-source://folder/${title}`,
      _metadata: { ...(thumbnailOverride && { thumbnailOverride }) },
    });

  it('should remove media that other media uses as its thumbnail', () => {
    const generator = new ThumbnailMetadataGenerator(mock<TemplateRenderer>());
    const clip = createMediaWithThumbnail('clip.mp4', 'media-source://folder/clip.jpg');
    const image = createMediaWithThumbnail(
      'clip.jpg',
      'media-source://folder/clip.jpg',
      'image',
    );

    expect(generator.removeThumbnailsOfOtherMedia([clip, image])).toEqual([clip]);
  });

  it('should keep media that is only its own thumbnail', () => {
    const generator = new ThumbnailMetadataGenerator(mock<TemplateRenderer>());
    const image = createMediaWithThumbnail(
      'bird.jpg',
      'media-source://folder/bird.jpg',
      'image',
    );

    expect(generator.removeThumbnailsOfOtherMedia([image])).toEqual([image]);
  });

  it('should keep media without a thumbnail', () => {
    const generator = new ThumbnailMetadataGenerator(mock<TemplateRenderer>());
    const clip = createMediaWithThumbnail('clip.mp4');

    expect(generator.removeThumbnailsOfOtherMedia([clip])).toEqual([clip]);
  });

  it('should remove a thumbnail that is in a different folder to its media', () => {
    const generator = new ThumbnailMetadataGenerator(mock<TemplateRenderer>());
    const clip = createRichBrowseMedia({
      title: 'clip.mp4',
      media_content_id: 'media-source://videos/clip.mp4',
      _metadata: {
        thumbnailOverride: 'media-source://thumbs/clip.jpg',
      },
    });
    const image = createRichBrowseMedia({
      title: 'clip.jpg',
      media_class: 'image',
      media_content_id: 'media-source://thumbs/clip.jpg',
      _metadata: {
        thumbnailOverride: 'media-source://thumbs/clip.jpg',
      },
    });

    expect(generator.removeThumbnailsOfOtherMedia([clip, image])).toEqual([clip]);
  });
});
