import { z } from 'zod';
import { SEVERITIES } from '../../../types';

export const severitySchema = z.enum(SEVERITIES);
