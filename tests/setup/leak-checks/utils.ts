/**
 * Describes each distinct item with the number of times it occurs, for example
 * `setTimeout x2`.
 */
export const convertToCountStrings = (items: string[]): string[] => {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return [...counts].map(([item, count]) => `${item} x${count}`);
};

/**
 * Describes each key added, removed or changed between two snapshots, for
 * example `matchMedia added`.
 */
export const getSnapshotChanges = <Key, Value extends object | string | null>(
  before: Map<Key, Value>,
  after: Map<Key, Value>,
  isSame: (a: Value, b: Value) => boolean = Object.is,
): string[] =>
  [...new Set([...before.keys(), ...after.keys()])].flatMap((key) => {
    const beforeValue = before.get(key);
    const afterValue = after.get(key);
    if (beforeValue === undefined) {
      return [`${String(key)} added`];
    }
    if (afterValue === undefined) {
      return [`${String(key)} removed`];
    }
    return isSame(beforeValue, afterValue) ? [] : [`${String(key)} changed`];
  });
