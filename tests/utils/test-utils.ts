// Stand-in for the built-in `Promise.withResolvers()`, whose type needs the
// `es2024` lib: the shared tsconfig stays on `es2021` to ensure `src` cannot
// use it, as some supported browsers lack it.
export interface PromiseWithResolvers<T = void> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

export const createPromiseWithResolvers = <T = void>(): PromiseWithResolvers<T> => {
  let resolve: (value: T) => void = () => {};
  let reject: (reason?: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};
