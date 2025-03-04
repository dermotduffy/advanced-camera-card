import { LitElement } from 'lit';

export type ConstructableLitElement = { new (...args: unknown[]): LitElement };
