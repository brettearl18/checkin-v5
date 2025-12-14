/**
 * Scoring Utilities for Traffic Light System
 * 
 * Provides helper functions to determine traffic light status based on
 * client-specific scoring thresholds.
 */

export interface ScoringThresholds {
  redMax: number;      // Maximum score for Red zone (e.g., 33 or 75)
  orangeMax: number;   // Maximum score for Orange zone (e.g., 80 or 89)
  // Green is implicitly: orangeMax + 1 to 100
}

export type TrafficLightStatus = 'red' | 'orange' | 'green';

export type ScoringProfile = 'lifestyle' | 'high-performance' | 'moderate' | 'custom';

/**
 * Default scoring profiles with threshold ranges
 */
export const scoringProfiles: Record<ScoringProfile, {
  name: string;
  description: string;
  thresholds: ScoringThresholds;
}> = {
  'lifestyle': {
    name: 'Lifestyle',
    description: 'General wellness, flexible approach - More lenient standards',
    thresholds: { redMax: 33, orangeMax: 80 }
    // Red: 0-33, Orange: 34-80, Green: 81-100
  },
  'high-performance': {
    name: 'High Performance',
    description: 'Elite athletes, competitive clients - Stricter standards',
    thresholds: { redMax: 75, orangeMax: 89 }
    // Red: 0-75, Orange: 76-89, Green: 90-100
  },
  'moderate': {
    name: 'Moderate',
    description: 'Active clients, good adherence expected',
    thresholds: { redMax: 60, orangeMax: 85 }
    // Red: 0-60, Orange: 61-85, Green: 86-100
  },
  'custom': {
    name: 'Custom',
    description: 'Customized thresholds for specific needs',
    thresholds: { redMax: 70, orangeMax: 85 }
    // Red: 0-70, Orange: 71-85, Green: 86-100
  }
};

/**
 * Get default thresholds for a scoring profile
 */
export function getDefaultThresholds(profile: ScoringProfile): ScoringThresholds {
  return scoringProfiles[profile].thresholds;
}

/**
 * Determine traffic light status based on score and thresholds
 */
export function getTrafficLightStatus(
  score: number,
  thresholds: ScoringThresholds
): TrafficLightStatus {
  if (score <= thresholds.redMax) return 'red';
  if (score <= thresholds.orangeMax) return 'orange';
  return 'green';
}

/**
 * Get CSS classes for traffic light status
 */
export function getTrafficLightColor(status: TrafficLightStatus): string {
  switch (status) {
    case 'red':
      return 'text-red-600 bg-red-50 border-red-200';
    case 'orange':
      return 'text-orange-600 bg-orange-50 border-orange-200';
    case 'green':
      return 'text-green-600 bg-green-50 border-green-200';
  }
}

/**
 * Get gradient classes for traffic light status (for score displays)
 */
export function getTrafficLightGradient(status: TrafficLightStatus): string {
  switch (status) {
    case 'red':
      return 'from-red-500 to-pink-600';
    case 'orange':
      return 'from-orange-500 to-amber-600';
    case 'green':
      return 'from-green-500 to-emerald-600';
  }
}

/**
 * Get traffic light icon/emoji
 */
export function getTrafficLightIcon(status: TrafficLightStatus): string {
  switch (status) {
    case 'red':
      return '🔴';
    case 'orange':
      return '🟠';
    case 'green':
      return '🟢';
  }
}

/**
 * Get human-readable label for traffic light status
 */
export function getTrafficLightLabel(status: TrafficLightStatus): string {
  switch (status) {
    case 'red':
      return 'Needs Attention';
    case 'orange':
      return 'On Track';
    case 'green':
      return 'Excellent';
  }
}

/**
 * Get motivational message based on traffic light status
 */
export function getTrafficLightMessage(status: TrafficLightStatus, score: number): string {
  switch (status) {
    case 'red':
      return 'Keep going! Every step forward is progress.';
    case 'orange':
      return 'Good progress! You\'re on the right track.';
    case 'green':
      return 'Excellent! You\'re doing amazing!';
  }
}

/**
 * Get score range description for a given threshold
 */
export function getScoreRangeDescription(thresholds: ScoringThresholds): string {
  return `Red: 0-${thresholds.redMax}% | Orange: ${thresholds.redMax + 1}-${thresholds.orangeMax}% | Green: ${thresholds.orangeMax + 1}-100%`;
}

/**
 * Legacy function for backward compatibility
 * Converts old threshold format (red/yellow/green) to new format (redMax/orangeMax)
 */
export function convertLegacyThresholds(oldThresholds: {
  red?: number;
  yellow?: number;
  green?: number;
}): ScoringThresholds {
  // If old format exists, convert it
  if (oldThresholds.red !== undefined && oldThresholds.yellow !== undefined) {
    // Old format: red = below this, yellow = below this, green = above this
    // New format: redMax = max for red, orangeMax = max for orange
    return {
      redMax: oldThresholds.red - 1, // If old red was 60, new redMax is 59
      orangeMax: oldThresholds.yellow - 1 // If old yellow was 80, new orangeMax is 79
    };
  }
  
  // Default to lifestyle if conversion fails
  return scoringProfiles.lifestyle.thresholds;
}


