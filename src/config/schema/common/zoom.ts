import { z } from 'zod';

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 10;

export const zoomSchema = z.number().min(ZOOM_MIN).max(ZOOM_MAX);
