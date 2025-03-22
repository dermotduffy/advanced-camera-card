import { TimeDelta } from '../../../config/schema/actions/custom/sleep';

export const timeDeltaToSeconds = (timeDelta: TimeDelta): number => {
  return (
    (timeDelta.h ?? 0) * 3600 +
    (timeDelta.m ?? 0) * 60 +
    (timeDelta.s ?? 0) +
    (timeDelta.ms ?? 0) / 1000
  );
};
