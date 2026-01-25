import { z } from 'zod';
import { SEVERITIES } from '../../../severity';

export const severitySchema = z.enum(SEVERITIES);
