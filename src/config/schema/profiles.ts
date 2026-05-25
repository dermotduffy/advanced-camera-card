import { z } from 'zod';

const PROFILES = ['casting', 'doorbell', 'low-performance', 'scrubbing'] as const;
export type ProfileType = (typeof PROFILES)[number];
export const profilesSchema = z.enum(PROFILES).array().optional();
