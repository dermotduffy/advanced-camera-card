import { z } from 'zod';

export const eventsMediaTypeSchema = z.enum(['all', 'clips', 'snapshots']);
