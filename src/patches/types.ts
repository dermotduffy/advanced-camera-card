import type { LitElement } from 'lit';

export interface ConstructableLitElement {
  new (...args: unknown[]): LitElement;
}
