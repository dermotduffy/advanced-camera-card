// `any-date-parser`, which the card imports when it first parses a date without
// a format, adds `Date.fromString` and `Date.fromAny` as it loads, so it loads
// here before any snapshot is taken.
import 'any-date-parser';

import { isObject } from 'lodash-es';
import { vi } from 'vitest';

import type { LeakCheck } from './types';
import { getSnapshotChanges } from './utils';

type Snapshot = Map<string, PropertyDescriptor>;

const EXEMPT_NAMES = new Set<string>([
  // `ha-nunjucks`, which the card imports when it first renders a template.
  'haNunjucks',
]);

const addProperties = (snapshot: Snapshot, owner: object, ownerName?: string): void => {
  for (const key of Reflect.ownKeys(owner)) {
    const descriptor = Object.getOwnPropertyDescriptor(owner, key);
    const name = ownerName ? `${ownerName}.${String(key)}` : String(key);
    if (descriptor && !EXEMPT_NAMES.has(name)) {
      snapshot.set(name, descriptor);
    }
  }
};

// The properties inside a global are compared unless they change as tests run:
// Vitest keeps its `expect` state in a global with a symbol key, and jsdom keeps
// its internals in globals named with a leading `_`.
const hasComparedProperties = (key: PropertyKey): key is string =>
  typeof key === 'string' && !key.startsWith('_') && !EXEMPT_NAMES.has(key);

const takeSnapshot = (): Snapshot => {
  const snapshot: Snapshot = new Map();
  addProperties(snapshot, globalThis);

  for (const key of Reflect.ownKeys(globalThis)) {
    const value: unknown = Reflect.get(globalThis, key);
    if (!hasComparedProperties(key) || !isObject(value) || value === globalThis) {
      continue;
    }
    addProperties(snapshot, value, key);

    const prototype: unknown = Reflect.get(value, 'prototype');
    if (isObject(prototype)) {
      addProperties(snapshot, prototype, `${key}.prototype`);
    }
  }
  return snapshot;
};

// Most globals under jsdom are accessors, whose `value` is always `undefined`,
// so a redefined accessor differs only in `get` or `set`.
const isSameDescriptor = (
  before: PropertyDescriptor,
  after: PropertyDescriptor,
): boolean =>
  // A spy that the test file installs as it loads is already in the starting
  // snapshot, and Vitest restores it once the file ends like any other spy.
  vi.isMockFunction(before.value) ||
  (Object.is(before.value, after.value) &&
    before.get === after.get &&
    before.set === after.set);

// Node defines some globals lazily, replacing each one the first time it is
// read, so every global is read once before any snapshot is taken.
for (const key of Reflect.ownKeys(globalThis)) {
  Reflect.get(globalThis, key);
}

let baseline: Snapshot = new Map();

export const globalLeakCheck: LeakCheck = {
  description: 'Globals added, removed or changed',
  start: () => {
    baseline = takeSnapshot();
  },
  finish: () => {
    // Vitest restores every spy once the test file ends, so restoring them now
    // leaves only the changes that outlive the file.
    vi.restoreAllMocks();

    return getSnapshotChanges(baseline, takeSnapshot(), isSameDescriptor);
  },
};
