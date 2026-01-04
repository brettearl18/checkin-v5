/**
 * Environment-aware logging utility
 * Only logs in development mode to prevent information leakage in production
 */

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Sanitize sensitive data from log messages
 */
function sanitizeData(data: any): any {
  if (!data) return data;
  
  if (typeof data === 'string') {
    // Remove potential sensitive patterns
    return data
      .replace(/password["\s:=]+[^,\s}]+/gi, 'password: [REDACTED]')
      .replace(/token["\s:=]+[^,\s}]+/gi, 'token: [REDACTED]')
      .replace(/secret["\s:=]+[^,\s}]+/gi, 'secret: [REDACTED]')
      .replace(/api[_-]?key["\s:=]+[^,\s}]+/gi, 'apiKey: [REDACTED]')
      .replace(/auth[_-]?token["\s:=]+[^,\s}]+/gi, 'authToken: [REDACTED]');
  }
  
  if (typeof data === 'object') {
    if (Array.isArray(data)) {
      return data.map(item => sanitizeData(item));
    }
    
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      // Redact sensitive fields
      if (lowerKey.includes('password') || 
          lowerKey.includes('token') || 
          lowerKey.includes('secret') || 
          lowerKey.includes('apikey') ||
          lowerKey.includes('auth') && lowerKey.includes('token')) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeData(value);
      }
    }
    return sanitized;
  }
  
  return data;
}

/**
 * Log info messages (only in development)
 */
export function logInfo(...args: any[]): void {
  if (isDevelopment) {
    const sanitized = args.map(arg => sanitizeData(arg));
    console.log(...sanitized);
  }
}

/**
 * Log error messages (always logged, but sanitized)
 */
export function logError(...args: any[]): void {
  const sanitized = args.map(arg => sanitizeData(arg));
  console.error(...sanitized);
}

/**
 * Log warning messages (only in development)
 */
export function logWarn(...args: any[]): void {
  if (isDevelopment) {
    const sanitized = args.map(arg => sanitizeData(arg));
    console.warn(...sanitized);
  }
}

/**
 * Log debug messages (only in development)
 */
export function logDebug(...args: any[]): void {
  if (isDevelopment) {
    const sanitized = args.map(arg => sanitizeData(arg));
    console.log('[DEBUG]', ...sanitized);
  }
}

/**
 * Safe error logging - logs error without exposing sensitive details
 */
export function logSafeError(message: string, error: unknown): void {
  if (error instanceof Error) {
    logError(message, {
      message: error.message,
      name: error.name,
      // Don't log stack trace in production
      stack: isDevelopment ? error.stack : undefined
    });
  } else {
    logError(message, error);
  }
}



