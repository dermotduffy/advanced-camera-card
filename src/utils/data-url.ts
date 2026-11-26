import type { DataURL } from '../types';

export const isDataURL = (url: string): url is DataURL => url.startsWith('data:');
