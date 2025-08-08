// Comprehensive error handling utility for CHECKINV5

export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  userId?: string;
  action?: string;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorLog: AppError[] = [];

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  // Handle Firebase errors
  static handleFirebaseError(error: any, context: string): AppError {
    const errorHandler = ErrorHandler.getInstance();
    
    let appError: AppError = {
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred',
      timestamp: new Date(),
      action: context
    };

    if (error.code) {
      switch (error.code) {
        case 'permission-denied':
          appError = {
            code: 'PERMISSION_DENIED',
            message: 'You do not have permission to perform this action',
            details: error,
            timestamp: new Date(),
            action: context
          };
          break;
        case 'unauthenticated':
          appError = {
            code: 'UNAUTHENTICATED',
            message: 'Please log in to continue',
            details: error,
            timestamp: new Date(),
            action: context
          };
          break;
        case 'not-found':
          appError = {
            code: 'NOT_FOUND',
            message: 'The requested resource was not found',
            details: error,
            timestamp: new Date(),
            action: context
          };
          break;
        case 'already-exists':
          appError = {
            code: 'ALREADY_EXISTS',
            message: 'This resource already exists',
            details: error,
            timestamp: new Date(),
            action: context
          };
          break;
        case 'invalid-argument':
          appError = {
            code: 'INVALID_ARGUMENT',
            message: 'Invalid data provided',
            details: error,
            timestamp: new Date(),
            action: context
          };
          break;
        case 'resource-exhausted':
          appError = {
            code: 'RESOURCE_EXHAUSTED',
            message: 'System resources are temporarily unavailable',
            details: error,
            timestamp: new Date(),
            action: context
          };
          break;
        case 'failed-precondition':
          appError = {
            code: 'FAILED_PRECONDITION',
            message: 'Operation failed due to a precondition not being met',
            details: error,
            timestamp: new Date(),
            action: context
          };
          break;
        case 'aborted':
          appError = {
            code: 'ABORTED',
            message: 'Operation was aborted',
            details: error,
            timestamp: new Date(),
            action: context
          };
          break;
        case 'out-of-range':
          appError = {
            code: 'OUT_OF_RANGE',
            message: 'Operation attempted outside the valid range',
            details: error,
            timestamp: new Date(),
            action: context
          };
          break;
        case 'unimplemented':
          appError = {
            code: 'UNIMPLEMENTED',
            message: 'Operation is not implemented or not supported',
            details: error,
            timestamp: new Date(),
            action: context
          };
          break;
        case 'internal':
          appError = {
            code: 'INTERNAL_ERROR',
            message: 'Internal system error occurred',
            details: error,
            timestamp: new Date(),
            action: context
          };
          break;
        case 'unavailable':
          appError = {
            code: 'UNAVAILABLE',
            message: 'Service is currently unavailable',
            details: error,
            timestamp: new Date(),
            action: context
          };
          break;
        case 'data-loss':
          appError = {
            code: 'DATA_LOSS',
            message: 'Unrecoverable data loss or corruption',
            details: error,
            timestamp: new Date(),
            action: context
          };
          break;
        default:
          appError = {
            code: error.code || 'UNKNOWN_FIREBASE_ERROR',
            message: error.message || 'Firebase operation failed',
            details: error,
            timestamp: new Date(),
            action: context
          };
      }
    }

    errorHandler.logError(appError);
    return appError;
  }

  // Handle validation errors
  static handleValidationError(field: string, value: any, rule: string): AppError {
    const errorHandler = ErrorHandler.getInstance();
    
    const appError: AppError = {
      code: 'VALIDATION_ERROR',
      message: `Validation failed for ${field}: ${rule}`,
      details: { field, value, rule },
      timestamp: new Date(),
      action: 'validation'
    };

    errorHandler.logError(appError);
    return appError;
  }

  // Handle authentication errors
  static handleAuthError(error: any, context: string): AppError {
    const errorHandler = ErrorHandler.getInstance();
    
    let appError: AppError = {
      code: 'AUTH_ERROR',
      message: 'Authentication failed',
      details: error,
      timestamp: new Date(),
      action: context
    };

    if (error.code) {
      switch (error.code) {
        case 'auth/user-not-found':
          appError.message = 'No account found with this email address';
          break;
        case 'auth/wrong-password':
          appError.message = 'Incorrect password';
          break;
        case 'auth/invalid-email':
          appError.message = 'Invalid email address';
          break;
        case 'auth/weak-password':
          appError.message = 'Password is too weak';
          break;
        case 'auth/email-already-in-use':
          appError.message = 'Email address is already in use';
          break;
        case 'auth/too-many-requests':
          appError.message = 'Too many failed attempts. Please try again later';
          break;
        case 'auth/user-disabled':
          appError.message = 'This account has been disabled';
          break;
        case 'auth/operation-not-allowed':
          appError.message = 'This operation is not allowed';
          break;
        case 'auth/invalid-credential':
          appError.message = 'Invalid credentials';
          break;
        default:
          appError.message = error.message || 'Authentication failed';
      }
    }

    errorHandler.logError(appError);
    return appError;
  }

  // Handle date parsing errors
  static handleDateError(dateValue: any, context: string): AppError {
    const errorHandler = ErrorHandler.getInstance();
    
    const appError: AppError = {
      code: 'DATE_PARSING_ERROR',
      message: 'Failed to parse date value',
      details: { dateValue, context },
      timestamp: new Date(),
      action: context
    };

    errorHandler.logError(appError);
    return appError;
  }

  // Handle API errors
  static handleApiError(error: any, endpoint: string): AppError {
    const errorHandler = ErrorHandler.getInstance();
    
    const appError: AppError = {
      code: 'API_ERROR',
      message: `API request failed: ${endpoint}`,
      details: { endpoint, error },
      timestamp: new Date(),
      action: 'api_request'
    };

    errorHandler.logError(appError);
    return appError;
  }

  // Log error for monitoring
  private logError(error: AppError): void {
    this.errorLog.push(error);
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error logged:', {
        code: error.code,
        message: error.message,
        action: error.action,
        timestamp: error.timestamp,
        details: error.details
      });
    }

    // In production, you would send this to a logging service
    // like Sentry, LogRocket, or your own logging API
    if (process.env.NODE_ENV === 'production') {
      // TODO: Implement production logging
      // this.sendToLoggingService(error);
    }
  }

  // Get error log (for debugging)
  getErrorLog(): AppError[] {
    return [...this.errorLog];
  }

  // Clear error log
  clearErrorLog(): void {
    this.errorLog = [];
  }

  // Get error statistics
  getErrorStats(): { total: number; byCode: Record<string, number>; byAction: Record<string, number> } {
    const byCode: Record<string, number> = {};
    const byAction: Record<string, number> = {};

    this.errorLog.forEach(error => {
      byCode[error.code] = (byCode[error.code] || 0) + 1;
      byAction[error.action || 'unknown'] = (byAction[error.action || 'unknown'] || 0) + 1;
    });

    return {
      total: this.errorLog.length,
      byCode,
      byAction
    };
  }
}

// Utility functions for common error scenarios
export const ErrorUtils = {
  // Safe date parsing with error handling
  parseDate: (dateValue: any, context: string): Date | null => {
    try {
      if (!dateValue) return null;
      
      let date: Date;
      if (dateValue && typeof dateValue === 'object' && dateValue.toDate) {
        // Firebase Timestamp
        date = dateValue.toDate();
      } else {
        // String or number timestamp
        date = new Date(dateValue);
      }
      
      if (isNaN(date.getTime())) {
        ErrorHandler.handleDateError(dateValue, context);
        return null;
      }
      
      return date;
    } catch (error) {
      ErrorHandler.handleDateError(dateValue, context);
      return null;
    }
  },

  // Safe number parsing
  parseNumber: (value: any, defaultValue: number = 0): number => {
    try {
      const num = Number(value);
      return isNaN(num) ? defaultValue : num;
    } catch (error) {
      return defaultValue;
    }
  },

  // Safe string parsing
  parseString: (value: any, defaultValue: string = ''): string => {
    try {
      return String(value || defaultValue);
    } catch (error) {
      return defaultValue;
    }
  },

  // Validate required fields
  validateRequired: (data: any, requiredFields: string[]): AppError | null => {
    for (const field of requiredFields) {
      if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
        return ErrorHandler.handleValidationError(field, data[field], 'required');
      }
    }
    return null;
  },

  // Validate email format
  validateEmail: (email: string): AppError | null => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return ErrorHandler.handleValidationError('email', email, 'invalid format');
    }
    return null;
  },

  // Validate date range
  validateDateRange: (startDate: Date, endDate: Date): AppError | null => {
    if (startDate >= endDate) {
      return ErrorHandler.handleValidationError('dateRange', { startDate, endDate }, 'start date must be before end date');
    }
    return null;
  }
};

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance(); 