/**
 * Password Validation Utility
 * Enforces strong password requirements for better security
 */

export interface PasswordValidationResult {
  valid: boolean;
  message?: string;
  strength?: 'weak' | 'medium' | 'strong';
  requirements?: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    special?: boolean;
  };
}

/**
 * Validates password against security requirements
 * 
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * 
 * @param password - Password to validate
 * @returns Validation result with details
 */
export function validatePassword(password: string): PasswordValidationResult {
  const requirements = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
  };

  // Check all requirements
  const valid = requirements.length && 
                requirements.uppercase && 
                requirements.lowercase && 
                requirements.number;

  // Determine strength
  let strength: 'weak' | 'medium' | 'strong' = 'weak';
  if (valid) {
    const metCount = Object.values(requirements).filter(Boolean).length;
    if (metCount >= 5) {
      strength = 'strong';
    } else if (metCount >= 4) {
      strength = 'medium';
    }
  }

  // Generate error message
  let message: string | undefined;
  if (!valid) {
    const missing: string[] = [];
    if (!requirements.length) {
      missing.push('at least 8 characters');
    }
    if (!requirements.uppercase) {
      missing.push('one uppercase letter');
    }
    if (!requirements.lowercase) {
      missing.push('one lowercase letter');
    }
    if (!requirements.number) {
      missing.push('one number');
    }
    message = `Password must contain ${missing.join(', ')}`;
  }

  return {
    valid,
    message,
    strength,
    requirements
  };
}

/**
 * Get a user-friendly password requirements description
 */
export function getPasswordRequirementsText(): string {
  return 'Password must be at least 8 characters and contain uppercase, lowercase, and a number';
}

/**
 * Get a detailed password requirements list for UI display
 */
export function getPasswordRequirementsList(): string[] {
  return [
    'At least 8 characters long',
    'At least one uppercase letter (A-Z)',
    'At least one lowercase letter (a-z)',
    'At least one number (0-9)'
  ];
}



