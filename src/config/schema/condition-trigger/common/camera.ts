import { z } from 'zod';

export const cameraBaseSchema = z.object({
  // Matched against the selected camera: omitted matches any (a camera is
  // selected), a list matches one of those cameras, and `[]` matches none (no
  // camera selected).
  cameras: z.string().array().optional(),
});
export type CameraBase = z.infer<typeof cameraBaseSchema>;
