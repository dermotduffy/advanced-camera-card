import { z } from 'zod';

const PROFILES = ['casting', 'low-performance', 'scrubbing'] as const;
export type ProfileType = (typeof PROFILES)[number];
export const profilesSchema = z.enum(PROFILES).array().optional();
