import { describe, expect, it } from 'vitest';
import { EventMediaQuery } from '../../src/view/query';
import { QueryResults } from '../../src/view/query-results';
import { createView } from '../test-utils';

describe('View Basics', () => {
  it('should construct from parameters', () => {
    const query = new EventMediaQuery();
    const queryResults = new QueryResults();
    const context = {};

    const view = createView({
      view: 'live',
      camera: 'camera',
      query: query,
      queryResults: queryResults,
      context: context,
    });
    expect(view.is('live')).toBeTruthy();
    expect(view.view).toBe('live');
    expect(view.camera).toBe('camera');
    expect(view.query).toBe(query);
    expect(view.queryResults).toBe(queryResults);
    expect(view.context).toBe(context);
  });

  describe('should clone', () => {
    it('with query and queryResults', () => {
      const view = createView({
        view: 'live',
        camera: 'camera',
        query: new EventMediaQuery(),
        queryResults: new QueryResults(),
        context: {},
      });

      expect(view.clone()).toEqual(view);
    });

    it('without query and queryResults', () => {
      const view = createView({
        view: 'live',
        camera: 'camera',
        context: {},
      });

      expect(view.clone()).toEqual(view);
    });
  });

  it('should evolve with everything set', () => {
    const view = createView({
      view: 'live',
      camera: 'camera-1',
      query: new EventMediaQuery(),
      queryResults: new QueryResults(),
      context: {},
      displayMode: 'single',
    });

    const evolved = view.evolve({
      view: 'clips',
      camera: 'camera-2',
      query: new EventMediaQuery(),
      queryResults: new QueryResults(),
      context: {},
      displayMode: 'grid',
    });
    expect(evolved.view).not.toBe(view.view);
    expect(evolved.camera).not.toBe(view.camera);
    expect(evolved.query).not.toBe(view.query);
    expect(evolved.queryResults).not.toBe(view.queryResults);
    expect(evolved.context).not.toBe(view.context);
    expect(evolved.displayMode).not.toBe(view.displayMode);
  });

  it('should evolve with nothing set', () => {
    const view = createView({
      view: 'live',
      camera: 'camera-1',
      query: new EventMediaQuery(),
      queryResults: new QueryResults(),
      context: {},
    });

    const evolved = view.evolve({});

    expect(evolved.view).toBe(view.view);
    expect(evolved.camera).toBe(view.camera);
    expect(evolved.context).toBe(view.context);

    // Query and QueryResults are cloned if not set.
    expect(evolved.query).not.toBe(view.query);
    expect(evolved.query).toEqual(view.query);
    expect(evolved.queryResults).not.toBe(view.queryResults);
    expect(evolved.queryResults).toEqual(view.queryResults);
  });

  it('should not clone query and queryResults with nothing set', () => {
    const view = createView();
    const evolved = view.evolve({});

    // Query and QueryResults are cloned if not set.
    expect(evolved.query).toBeNull();
    expect(evolved.queryResults).toBeNull();
  });

  it('should merge in context', () => {
    const view = createView();
    const liveContext = { overrides: new Map() };
    const timelineContext = { window: { start: new Date(), end: new Date() } };

    view.mergeInContext({ live: liveContext });
    expect(view.context?.live).toEqual(liveContext);

    view.mergeInContext({ timeline: timelineContext });
    expect(view.context?.live).toEqual(liveContext);
    expect(view.context?.timeline).toEqual(timelineContext);

    // Verify that merging context creates a new context object, as some
    // downstream users may check for context equality.
    const oldContext = view.context;
    view.mergeInContext({ live: liveContext });
    expect(view.context).not.toBe(oldContext);
  });

  it('should remove context', () => {
    const view = createView({ context: { live: { overrides: new Map() } } });

    view.removeContext('live');
    expect(view.context).toEqual({});
  });

  it('should not remove context when no context', () => {
    const view = createView();
    expect(view.context).toBeNull();

    view.removeContext('live');
    expect(view.context).toBeNull();
  });

  it('should remove context property', () => {
    const view = createView({ context: { live: { overrides: new Map() } } });

    view.removeContextProperty('live', 'overrides');
    expect(view.context).toEqual({ live: {} });
  });

  it('should not remove context property that does not exist', () => {
    const view = createView({ context: {} });

    view.removeContextProperty('live', 'overrides');
    expect(view.context).toEqual({});
  });

  it('should detect gallery views', () => {
    expect(createView({ view: 'clips' }).isMediaGalleryView()).toBeTruthy();
    expect(createView({ view: 'snapshots' }).isMediaGalleryView()).toBeTruthy();
    expect(createView({ view: 'recordings' }).isMediaGalleryView()).toBeTruthy();
  });

  it('should not detect gallery view', () => {
    expect(createView({ view: 'live' }).isMediaGalleryView()).toBeFalsy();
    expect(createView({ view: 'timeline' }).isMediaGalleryView()).toBeFalsy();
  });

  it('should detect any media views', () => {
    expect(createView({ view: 'clip' }).isAnyMediaView()).toBeTruthy();
    expect(createView({ view: 'snapshot' }).isAnyMediaView()).toBeTruthy();
    expect(createView({ view: 'media' }).isAnyMediaView()).toBeTruthy();
    expect(createView({ view: 'recording' }).isAnyMediaView()).toBeTruthy();
    expect(createView({ view: 'live' }).isAnyMediaView()).toBeTruthy();
    expect(createView({ view: 'image' }).isAnyMediaView()).toBeTruthy();
  });

  it('should not detect any media view', () => {
    expect(createView({ view: 'timeline' }).isAnyMediaView()).toBeFalsy();
  });

  it('should detect viewer views', () => {
    expect(createView({ view: 'clip' }).isViewerView()).toBeTruthy();
    expect(createView({ view: 'snapshot' }).isViewerView()).toBeTruthy();
    expect(createView({ view: 'media' }).isViewerView()).toBeTruthy();
    expect(createView({ view: 'recording' }).isViewerView()).toBeTruthy();
  });

  it('should not detect viewer views', () => {
    expect(createView({ view: 'live' }).isViewerView()).toBeFalsy();
    expect(createView({ view: 'live' }).isViewerView()).toBeFalsy();
    expect(createView({ view: 'timeline' }).isViewerView()).toBeFalsy();
  });

  it('should get default media type', () => {
    expect(createView({ view: 'clip' }).getDefaultMediaType()).toBe('clips');
    expect(createView({ view: 'clips' }).getDefaultMediaType()).toBe('clips');
    expect(createView({ view: 'snapshot' }).getDefaultMediaType()).toBe('snapshots');
    expect(createView({ view: 'snapshots' }).getDefaultMediaType()).toBe('snapshots');
    expect(createView({ view: 'recording' }).getDefaultMediaType()).toBe('recordings');
    expect(createView({ view: 'recordings' }).getDefaultMediaType()).toBe('recordings');
  });

  it('should not get default media type', () => {
    expect(createView({ view: 'live' }).getDefaultMediaType()).toBeNull();
    expect(createView({ view: 'timeline' }).getDefaultMediaType()).toBeNull();
  });

  it('should determine if display mode is grid', () => {
    expect(createView({ displayMode: 'grid' }).isGrid()).toBeTruthy();
    expect(createView({ displayMode: 'single' }).isGrid()).toBeFalsy();
    expect(createView().isGrid()).toBeFalsy();
  });

  it('should determine if view supports multiple display modes', () => {
    expect(createView({ view: 'live' }).supportsMultipleDisplayModes()).toBeTruthy();
    expect(createView({ view: 'media' }).supportsMultipleDisplayModes()).toBeTruthy();
    expect(createView({ view: 'clip' }).supportsMultipleDisplayModes()).toBeTruthy();
    expect(createView({ view: 'snapshot' }).supportsMultipleDisplayModes()).toBeTruthy();
    expect(
      createView({ view: 'recording' }).supportsMultipleDisplayModes(),
    ).toBeTruthy();

    expect(createView({ view: 'clips' }).supportsMultipleDisplayModes()).toBeFalsy();
    expect(createView({ view: 'snapshots' }).supportsMultipleDisplayModes()).toBeFalsy();
    expect(
      createView({ view: 'recordings' }).supportsMultipleDisplayModes(),
    ).toBeFalsy();
    expect(createView({ view: 'image' }).supportsMultipleDisplayModes()).toBeFalsy();
    expect(createView({ view: 'timeline' }).supportsMultipleDisplayModes()).toBeFalsy();
  });
});
