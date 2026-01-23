/**
 * Error handling utilities for consistent error messages
 */

/**
 * Extract error message from unknown error type
 * @param error Unknown error object
 * @returns User-friendly error message
 */
export function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
        return String(error.message);
    }
    return 'Unknown error';
}

/**
 * Format error for display to user
 * @param context Context where error occurred
 * @param error The error object
 * @returns Formatted error message
 */
export function formatError(context: string, error: unknown): string {
    const message = getErrorMessage(error);
    return `${context}: ${message}`;
}

/**
 * Check if error message indicates a specific condition
 * @param error Error object
 * @param condition Condition to check (e.g., 'connection closed')
 * @returns true if error matches condition
 */
export function isErrorType(error: unknown, ...conditions: string[]): boolean {
    const message = getErrorMessage(error).toLowerCase();
    return conditions.some(condition => message.includes(condition.toLowerCase()));
}
