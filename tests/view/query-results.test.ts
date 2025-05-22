import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewFolder, ViewItem } from '../../src/view/item';
import { QueryResults } from '../../src/view/query-results';
import { createFolder, generateViewMediaArray } from '../test-utils';

describe('dispatchViewContextChangeEvent', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('should function with empty results', () => {
    const fakeNow = new Date('2023-08-07T20:44');
    vi.useFakeTimers();
    vi.setSystemTime(fakeNow);

    const results = new QueryResults();
    expect(results.isSupersetOf(results)).toBeFalsy();
    expect(results.getCameraIDs()).toEqual(new Set());
    expect(results.getResults()).toEqual([]);
    expect(results.getResultsCount()).toEqual(0);
    expect(results.hasResults()).toBeFalsy();
    expect(results.getResult(0)).toBeNull();
    expect(results.getSelectedIndex()).toBeNull();
    expect(results.getSelectedResult()).toBeNull();
    expect(results.hasSelectedResult()).toBeFalsy();

    expect(results.resetSelectedResult()).toBe(results);
    expect(results.getResultsTimestamp()).toEqual(fakeNow);

    expect(results.selectIndex(0)).toEqual(results);
    expect(results.getSelectedResult()).toBeNull();

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    expect(results.selectResultIfFound((_item: ViewItem) => true)).toEqual(results);
    expect(results.getSelectedResult()).toBeNull();

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    expect(results.selectBestResult((_item: ViewItem[]) => null)).toEqual(results);
    expect(results.getSelectedResult()).toBeNull();
    expect(results.getMultipleSelectedResults()).toEqual([]);
  });

  it('should function with basic results', () => {
    const testResults = generateViewMediaArray();
    const results = new QueryResults({ results: testResults });

    expect(results.isSupersetOf(results)).toBeTruthy();
    expect(results.getCameraIDs()).toEqual(new Set(['kitchen', 'office']));
    expect(results.getResults()).toEqual(testResults);
    expect(results.getResultsCount()).toEqual(200);
    expect(results.hasResults()).toBeTruthy();
    expect(results.getResult(0)).not.toBeNull();
    expect(results.getSelectedIndex()).toBe(199);
    expect(results.getSelectedResult()).not.toBeNull();
    expect(results.hasSelectedResult()).toBeTruthy();

    expect(results.resetSelectedResult()).toBe(results);
    expect(results.getSelectedResult()).toBeNull();

    expect(results.selectIndex(100)).toEqual(results);
    expect(results.getSelectedIndex()).toBe(100);

    expect(
      results.selectResultIfFound((item: ViewItem) => item.getID() === 'id-kitchen-42'),
    ).toEqual(results);
    expect(results.getSelectedResult()?.getID()).toBe('id-kitchen-42');

    expect(
      results.selectBestResult((itemArray: ViewItem[]) =>
        itemArray.findIndex((item) => item.getID() === 'id-kitchen-43'),
      ),
    ).toEqual(results);
    expect(results.getSelectedResult()?.getID()).toBe('id-kitchen-43');
  });

  it('should function with camera slice', () => {
    const testResults = generateViewMediaArray();
    const results = new QueryResults({ results: testResults });
    const slice = results.getSlice('office');
    expect(slice).not.toBeNull();
    expect(slice!.getResults()).toEqual(
      testResults.filter((item) => item.getCameraID() === 'office'),
    );
    expect(slice!.getResultsCount()).toEqual(100);
    expect(slice!.hasResults()).toBeTruthy();
    expect(slice!.getResult(0)).not.toBeNull();
    expect(slice!.getResult()).toBeNull();
    expect(slice!.getSelectedIndex()).toBe(99);
    expect(slice!.getSelectedResult()?.getID()).toEqual('id-office-99');
    expect(slice!.hasSelectedResult()).toBeTruthy();

    expect(slice!.resetSelectedResult());
    expect(slice!.getSelectedResult()).toBeNull();

    expect(slice!.selectIndex(10));
    expect(slice!.getSelectedIndex()).toBe(10);

    expect(slice!.selectIndex(10000));
    expect(slice!.getSelectedIndex()).toBe(10);

    expect(slice!.selectIndex(-10000));
    expect(slice!.getSelectedIndex()).toBe(10);

    slice!.selectResultIfFound((item: ViewItem) => item.getID() === 'id-office-42');
    expect(slice!.getSelectedResult()?.getID()).toBe('id-office-42');

    slice!.selectBestResult((itemArray: ViewItem[]) =>
      itemArray.findIndex((item) => item.getID() === 'id-office-43'),
    );
    expect(slice!.getSelectedResult()?.getID()).toBe('id-office-43');
  });

  describe('should respect select approach during construction', () => {
    it.each([
      ['first' as const, 0],
      ['last' as const, 199],
    ])('%s', async (selectApproach, expectedIndex) => {
      const results = new QueryResults({
        results: generateViewMediaArray(),
        selectApproach: selectApproach,
      });
      expect(results.getSelectedIndex()).toBe(expectedIndex);
    });
  });

  it('should respect selectIndex during construction', () => {
    const results = new QueryResults({
      results: generateViewMediaArray(),
      selectedIndex: 42,
    });
    expect(results.getSelectedIndex()).toBe(42);
  });

  it('should correctly clone a slice', () => {
    const results = new QueryResults({
      results: generateViewMediaArray(),
    });
    const slice = results.getSlice('office');
    const clone = slice?.clone();
    expect(clone?.getResults()).toBe(slice?.getResults());
    expect(clone?.getSelectedIndex()).toBe(slice?.getSelectedIndex());
  });

  it('should not get slice for non-existent camera', () => {
    const results = new QueryResults({
      results: generateViewMediaArray(),
    });
    expect(results.getSlice('not-a-camera')).toBeNull();
  });

  it('should get main slice', () => {
    const results = new QueryResults({
      results: generateViewMediaArray(),
    });
    expect(results.getSlice()?.getResults()).toBe(results.getResults());
  });

  it('should correctly clone', () => {
    const results = new QueryResults({
      results: generateViewMediaArray(),
    });
    const clone = results.clone();
    expect(results.getResultsTimestamp()).toBe(clone.getResultsTimestamp());
    expect(results.getResults()).toBe(clone.getResults());
    for (const cameraID of results.getCameraIDs()) {
      expect(results.getSlice(cameraID)?.getResults()).toBe(
        clone.getSlice(cameraID)?.getResults(),
      );
    }
  });

  it('should not getResults on invalid slice', () => {
    const results = new QueryResults({
      results: generateViewMediaArray(),
    });
    expect(results.getResults('not-a-camera')).toBeNull();
    expect(results.getResultsCount('not-a-camera')).toBe(0);
    expect(results.hasSelectedResult('not-a-camera')).toBeFalsy();
  });

  it('should always demote main selection', () => {
    const results = new QueryResults({
      results: generateViewMediaArray(),
    });

    results
      .getSlice('office')
      ?.selectResultIfFound((item) => item.getID() === 'id-office-42');

    // Verify main and office selections are as expected.
    expect(results.getSelectedIndex()).toBe(199);
    expect(results.getSelectedResult('office')?.getID()).toBe('id-office-42');

    // Select a different main result...
    results?.selectResultIfFound((item) => item.getID() === 'id-office-80');

    // ... and ensure that selection has been demoted into the camera slice.
    expect(results.getSelectedResult('office')?.getID()).toBe('id-office-80');
  });

  it('should promote camera selection', () => {
    const results = new QueryResults({
      results: generateViewMediaArray(),
    });

    results
      .getSlice('office')
      ?.selectResultIfFound((item) => item.getID() === 'id-office-42');

    expect(results.getSelectedIndex()).toBe(199);

    results.promoteCameraSelectionToMainSelection('office');

    expect(results.getSelectedIndex()).not.toBe(199);
    expect(results.getSelectedResult()?.getID()).toBe('id-office-42');
  });

  it('should selectBestResult via advanced selection criteria', () => {
    const results = new QueryResults({
      results: generateViewMediaArray(),
    });

    results.selectBestResult(
      (itemArray: ViewItem[]) => {
        const index = itemArray.findIndex((item) => item.getID()?.endsWith('-42'));
        return index < 0 ? null : index;
      },
      { allCameras: true },
    );

    expect(results.getSelectedResult('office')?.getID()).toBe('id-office-42');
    expect(results.getSelectedResult('kitchen')?.getID()).toBe('id-kitchen-42');
  });

  it('should get multiple selected results', () => {
    const results = new QueryResults({
      results: generateViewMediaArray(),
    });

    expect(
      results
        .getMultipleSelectedResults({ main: true, allCameras: true })
        .map((item) => item.getID()),
    ).toEqual(['id-office-99', 'id-kitchen-99', 'id-office-99']);
  });

  it('should get multiple selected results without main', () => {
    const results = new QueryResults({
      results: generateViewMediaArray(),
    });

    expect(
      results
        .getMultipleSelectedResults({ main: false, allCameras: true })
        .map((item) => item.getID()),
    ).toEqual(['id-kitchen-99', 'id-office-99']);
  });

  it('should get no results with invalid camera ID without main', () => {
    const results = new QueryResults({
      results: generateViewMediaArray(),
    });

    expect(
      results
        .getMultipleSelectedResults({ main: false, cameraID: 'not-a-real-camera' })
        .map((item) => item.getID()),
    ).toEqual([]);
  });

  it('should not demote main selection when selecting from a specific camera', () => {
    const results = new QueryResults({
      results: generateViewMediaArray(),
    });

    results.selectIndex(42);
    results.selectIndex(24, 'office');

    expect(results.getSelectedIndex()).toBe(42);
    expect(results.getSelectedIndex('office')).toBe(24);
  });

  it('should keep selected folder in main slice but not camera slices', () => {
    const folder = new ViewFolder(createFolder());
    const results = new QueryResults({
      results: [
        folder,
        ...generateViewMediaArray({
          cameraIDs: ['camera.office', 'camera.kitchen'],
        }),
      ],
      selectedIndex: 0,
    });

    expect(results.getSelectedResult()).toBe(folder);
    expect(results.getSelectedResult('camera.office')).not.toBe(folder);
  });
});
