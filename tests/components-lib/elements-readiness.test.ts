import { describe, expect, it } from 'vitest';

import { areElementsReady } from '../../src/components-lib/elements-readiness';

describe('areElementsReady', () => {
  it('should render elements without templates before card initialization', () => {
    expect(areElementsReady(false, false)).toBe(true);
  });

  it('should wait for the template renderer when elements contain templates', () => {
    expect(areElementsReady(true, false)).toBe(false);
  });

  it('should render template-backed elements once the renderer is initialized', () => {
    expect(areElementsReady(true, true)).toBe(true);
  });
});
