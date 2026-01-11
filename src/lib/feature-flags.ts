/**
 * Feature Flags
 * 
 * Centralized feature flag configuration
 * Flags can be controlled via environment variables
 */

export const FEATURE_FLAGS = {
  /**
   * USE_PRE_CREATED_ASSIGNMENTS
   * 
   * When true: Uses pre-created assignment documents for recurring check-ins
   * When false: Uses dynamic generation of Week 2+ assignments (legacy behavior)
   * 
   * Default: false (use legacy dynamic generation)
   */
  USE_PRE_CREATED_ASSIGNMENTS: process.env.USE_PRE_CREATED_ASSIGNMENTS === 'true'
} as const;

/**
 * Type for feature flags (for TypeScript)
 */
export type FeatureFlag = keyof typeof FEATURE_FLAGS;

/**
 * Helper to check if a feature is enabled
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag];
}

