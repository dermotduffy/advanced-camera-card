import { ActionConfig } from './types.js';

export function hasAction(config?: ActionConfig): boolean {
  return config !== undefined && config.action !== 'none';
}
