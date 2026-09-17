// From: https://github.com/home-assistant/frontend/blob/dev/src/common/entity/compute_object_id.ts
export const computeObjectId = (entityId: string): string => {
  return entityId.slice(entityId.indexOf('.') + 1);
};
