import type { LeakCheck } from './types';
import { getSnapshotChanges } from './utils';

const addEntries = (
  snapshot: Map<string, string | null>,
  name: string,
  storage: Storage,
): void => {
  for (let i = 0; i < storage.length; ++i) {
    const key = storage.key(i);
    if (key !== null) {
      snapshot.set(`${name} '${key}'`, storage.getItem(key));
    }
  }
};

const takeSnapshot = (): Map<string, string | null> => {
  const snapshot = new Map<string, string | null>();
  addEntries(snapshot, 'localStorage', localStorage);
  addEntries(snapshot, 'sessionStorage', sessionStorage);
  return snapshot;
};

let baseline = new Map<string, string | null>();

export const storageLeakCheck: LeakCheck = {
  description: 'Web storage entries added, removed or changed',
  start: () => {
    baseline = takeSnapshot();
  },
  finish: () => getSnapshotChanges(baseline, takeSnapshot()),
};
