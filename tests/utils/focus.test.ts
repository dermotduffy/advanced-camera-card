import { afterEach, describe, expect, it } from 'vitest';

import { isFocusWithin } from '../../src/utils/focus';

// @vitest-environment jsdom
describe('isFocusWithin', () => {
  const createFocusableElement = (parent: Node): HTMLElement => {
    const element = document.createElement('div');
    element.setAttribute('tabindex', '0');
    parent.appendChild(element);
    return element;
  };

  afterEach(() => {
    document.body.replaceChildren();
  });

  it('should return false without focus', () => {
    const element = createFocusableElement(document.body);

    expect(isFocusWithin(element)).toBeFalsy();
  });

  it('should return false when focus is elsewhere', () => {
    const element = createFocusableElement(document.body);
    createFocusableElement(document.body).focus();

    expect(isFocusWithin(element)).toBeFalsy();
  });

  it('should return true when the element itself has focus', () => {
    const element = createFocusableElement(document.body);
    element.focus();

    expect(isFocusWithin(element)).toBeTruthy();
  });

  it('should return true when a child has focus', () => {
    const element = createFocusableElement(document.body);
    createFocusableElement(element).focus();

    expect(isFocusWithin(element)).toBeTruthy();
  });

  it('should return true when a child within nested shadow roots has focus', () => {
    const element = createFocusableElement(document.body);
    const outerShadow = element.attachShadow({ mode: 'open' });
    const inner = createFocusableElement(outerShadow);
    const innerShadow = inner.attachShadow({ mode: 'open' });

    createFocusableElement(innerShadow).focus();

    expect(isFocusWithin(element)).toBeTruthy();
  });

  it('should return true when the element is itself within a shadow root', () => {
    const host = createFocusableElement(document.body);
    const element = createFocusableElement(host.attachShadow({ mode: 'open' }));

    createFocusableElement(element.attachShadow({ mode: 'open' })).focus();

    expect(isFocusWithin(element)).toBeTruthy();
  });

  it('should return false when the element is not attached to a document', () => {
    const element = document.createElement('div');

    expect(isFocusWithin(element)).toBeFalsy();
  });
});
