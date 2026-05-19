import { POP_OUT_ANIMATION_NAME } from '../const.js';

/**
 * Whether `ev` marks the end of a pop-out (exit) animation on the element the
 * handler is bound to.
 *
 * `animationend` bubbles and `pop-out` is a shared keyframe name, so an event
 * originating on a descendant that uses the same animation is excluded by
 * requiring the animation to have run on the listening element itself.
 */
export function hasPopOutAnimationEnded(
  // Only the fields actually read are required, rather than a full
  // `AnimationEvent`. jsdom has no `AnimationEvent` constructor, so this lets
  // tests pass a plain object instead of mocking the event.
  ev: Pick<AnimationEvent, 'target' | 'currentTarget' | 'animationName'>,
): boolean {
  return ev.target === ev.currentTarget && ev.animationName === POP_OUT_ANIMATION_NAME;
}
