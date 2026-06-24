import { LitElement } from 'lit';

export interface ConstructableLitElement {
  new (...args: unknown[]): LitElement;
}
