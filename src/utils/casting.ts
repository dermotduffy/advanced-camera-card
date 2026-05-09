/**
 * Determine if the card is currently being casted.
 */
export const isBeingCasted = (userAgent: string = navigator.userAgent): boolean => {
  return !!userAgent.match(/CrKey\//);
};
