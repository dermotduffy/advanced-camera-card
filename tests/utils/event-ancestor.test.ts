import { assert, describe, expect, it } from 'vitest';
import { isAncestorInEventPath } from '../../src/utils/event-ancestor';

// @vitest-environment jsdom
describe('isAncestorInEventPath', () => {
  const dispatch = (source: EventTarget, listener: (ev: Event) => void) => {
    window.addEventListener('test', listener, { once: true });
    source.dispatchEvent(new CustomEvent('test', { bubbles: true, composed: true }));
  };

  it('returns true when element shares the ancestor with the event source', () => {
    const element = document.createElement('div');
    const ancestor = document.createElement('hui-dialog-edit-card');
    ancestor.attachShadow({ mode: 'open' });
    assert(ancestor.shadowRoot);
    ancestor.shadowRoot.append(element);
    document.body.append(ancestor);

    const eventSource = document.createElement('div');
    ancestor.shadowRoot.append(eventSource);

    let result: boolean | undefined;
    dispatch(eventSource, (ev) => {
      result = isAncestorInEventPath(element, ev, 'hui-dialog-edit-card');
    });

    expect(result).toBe(true);
  });

  it('returns false when element and event source are in different ancestors with the same tag', () => {
    const element = document.createElement('div');
    const ancestor1 = document.createElement('hui-dialog-edit-card');
    ancestor1.attachShadow({ mode: 'open' });
    assert(ancestor1.shadowRoot);
    ancestor1.shadowRoot.append(element);
    document.body.append(ancestor1);

    const ancestor2 = document.createElement('hui-dialog-edit-card');
    ancestor2.attachShadow({ mode: 'open' });
    assert(ancestor2.shadowRoot);
    const eventSource = document.createElement('div');
    ancestor2.shadowRoot.append(eventSource);
    document.body.append(ancestor2);

    let result: boolean | undefined;
    dispatch(eventSource, (ev) => {
      result = isAncestorInEventPath(element, ev, 'hui-dialog-edit-card');
    });

    expect(result).toBe(false);
  });

  it('returns false when element has no ancestor with the given tag', () => {
    const element = document.createElement('div');
    document.body.append(element);

    const eventSource = document.createElement('div');
    document.body.append(eventSource);

    let result: boolean | undefined;
    dispatch(eventSource, (ev) => {
      result = isAncestorInEventPath(element, ev, 'hui-dialog-edit-card');
    });

    expect(result).toBe(false);
  });

  it('traverses shadow boundaries in the element ancestor chain', () => {
    const element = document.createElement('div');
    const inner = document.createElement('hui-card');
    inner.attachShadow({ mode: 'open' });
    assert(inner.shadowRoot);
    inner.shadowRoot.append(element);

    const ancestor = document.createElement('hui-dialog-edit-card');
    ancestor.attachShadow({ mode: 'open' });
    assert(ancestor.shadowRoot);
    ancestor.shadowRoot.append(inner);
    document.body.append(ancestor);

    const eventSource = document.createElement('div');
    ancestor.shadowRoot.append(eventSource);

    let result: boolean | undefined;
    dispatch(eventSource, (ev) => {
      result = isAncestorInEventPath(element, ev, 'hui-dialog-edit-card');
    });

    expect(result).toBe(true);
  });
});
