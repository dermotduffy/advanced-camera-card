export const computeDomain = (entityId: string): string => {
  return entityId.substring(0, entityId.indexOf('.'));
};
