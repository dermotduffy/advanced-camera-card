import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { CardController } from '../../../../src/card-controller/controller';
import { ViewIncompatibleIssue } from '../../../../src/card-controller/issues/issues/view-incompatible';
import { AdvancedCameraCardError } from '../../../../src/types';
import { View } from '../../../../src/view/view';
import { createCardAPI } from '../../../test-utils';

describe('ViewIncompatibleIssue', () => {
  const createAPI = (hasView = false): CardController => {
    const api = createCardAPI();
    vi.mocked(api.getViewManager().getView).mockReturnValue(
      hasView ? mock<View>() : null,
    );
    return api;
  };

  it('should have correct key', () => {
    const issue = new ViewIncompatibleIssue(createAPI());
    expect(issue.key).toBe('view_incompatible');
  });

  it('should report no issue when untriggered', () => {
    const issue = new ViewIncompatibleIssue(createAPI());
    expect(issue.hasIssue()).toBe(false);
    expect(issue.getIssue()).toBeNull();
  });

  it('should report an issue after trigger', () => {
    const issue = new ViewIncompatibleIssue(createAPI());
    issue.trigger({ error: new Error('boom') });

    expect(issue.hasIssue()).toBe(true);
  });

  it('should treat a triggered null/undefined error as no issue', () => {
    const issue = new ViewIncompatibleIssue(createAPI());
    issue.trigger({ error: undefined });

    expect(issue.hasIssue()).toBe(false);
    expect(issue.getIssue()).toBeNull();
  });

  describe('isFullCardIssue', () => {
    it('should return true when no view is set', () => {
      const issue = new ViewIncompatibleIssue(createAPI(false));
      expect(issue.isFullCardIssue()).toBe(true);
    });

    it('should return false when a view is set', () => {
      const issue = new ViewIncompatibleIssue(createAPI(true));
      expect(issue.isFullCardIssue()).toBe(false);
    });
  });

  describe('getIssue', () => {
    it('should return a notification with heading, body, and no retry control', () => {
      const issue = new ViewIncompatibleIssue(createAPI());
      issue.trigger({ error: new Error('boom') });

      expect(issue.getIssue()).toEqual({
        icon: 'mdi:video-off',
        severity: 'high',
        notification: {
          heading: {
            text: 'View not supported',
            icon: 'mdi:video-off',
            severity: 'high',
          },
          body: { text: 'The selected camera or media does not support this view' },
        },
      });
    });

    it('should include error context on AdvancedCameraCardError', () => {
      const issue = new ViewIncompatibleIssue(createAPI());
      issue.trigger({
        error: new AdvancedCameraCardError('err', {
          view: 'snapshot',
          camera: 'cam.office',
        }),
      });

      const result = issue.getIssue();
      expect(result?.notification.context).toEqual([
        expect.stringContaining('view: snapshot'),
      ]);
    });

    it('should omit context on plain errors', () => {
      const issue = new ViewIncompatibleIssue(createAPI());
      issue.trigger({ error: new Error('plain') });

      const result = issue.getIssue();
      expect(result?.notification.context).toBeUndefined();
    });
  });

  it('should clear the issue after reset', () => {
    const issue = new ViewIncompatibleIssue(createAPI());
    issue.trigger({ error: new Error('boom') });
    expect(issue.hasIssue()).toBe(true);

    issue.reset();

    expect(issue.hasIssue()).toBe(false);
    expect(issue.getIssue()).toBeNull();
  });
});
