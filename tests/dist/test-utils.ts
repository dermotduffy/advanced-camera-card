/**
 * Loads the module at `url` the same way Home Assistant puts a dashboard
 * resource into one: by appending a script element for it. Resolves once the
 * browser has fetched and run it.
 *
 * Rejects only when the file could not be fetched or parsed. A module that
 * throws while running has still loaded, and reports itself to `window`
 * instead.
 */
export const loadModule = async (url: string): Promise<void> =>
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.type = 'module';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Could not load ${url}`));
    script.src = url;

    document.body.appendChild(script);
  });

/**
 * Waits for the browser to get through the work it already has queued.
 *
 * Draining promises (as `flushPromises` does) reaches none of that work. An
 * uncaught exception or a rejected promise nothing handled, for instance, is
 * reported only once the browser has run out of work to do.
 */
export const flushBrowserWork = async (): Promise<void> =>
  await new Promise((resolve) => setTimeout(resolve));
