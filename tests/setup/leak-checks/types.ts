/**
 * Checks that a test file restores a category of shared state.
 */
export interface LeakCheck {
  // Example: `Event listeners on the global document or window`.
  description: string;

  /**
   * Records the state the test file starts with.
   */
  start(): void;

  /**
   * Describes each difference from the state recorded by `start`.
   */
  finish(): string[];
}
