/**
 * ErrorService - Centralized Error Handling
 * Provides consistent error handling across the application
 *
 * Usage:
 * try {
 *   await fetchData();
 * } catch (error) {
 *   ErrorService.handle(error, 'ComponentName.methodName', true);
 * }
 */

import { ToastService } from './ToastService';
import { SystemLogger } from '../components/system/SystemLogger';

export class ErrorService {
  private static instance: ErrorService;
  private systemLogger: SystemLogger;

  private constructor() {
    this.systemLogger = SystemLogger.getInstance();
  }

  public static getInstance(): ErrorService {
    if (!ErrorService.instance) {
      ErrorService.instance = new ErrorService();
    }
    return ErrorService.instance;
  }

  /**
   * Handle an error with optional user notification
   *
   * @param error - The error object
   * @param context - Where the error occurred (e.g., 'PostService.createPost')
   * @param userFacing - Whether to show a toast notification to the user
   * @param customMessage - Optional custom message for user (defaults to error.message)
   */
  public static handle(
    error: unknown,
    context: string,
    userFacing: boolean = true,
    customMessage?: string
  ): void {
    const instance = ErrorService.getInstance();
    instance.handleError(error, context, userFacing, customMessage);
  }

  /**
   * Internal error handler
   */
  private handleError(
    error: unknown,
    context: string,
    userFacing: boolean,
    customMessage?: string
  ): void {
    // Convert unknown error to Error object
    const err = this.normalizeError(error);

    // 1. Log to Debug Logger (always)
    this.systemLogger.error(context, err.message);

    // 2. Log to console (always, for debugging)
    console.error(`[${context}]`, err);

    // 3. Show toast to user (if user-facing)
    if (userFacing) {
      const message = customMessage || this.getUserFriendlyMessage(err);
      ToastService.show(message, 'error');
    }
  }

  /**
   * Normalize unknown error to Error object
   */
  private normalizeError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }

    if (typeof error === 'string') {
      return new Error(error);
    }

    return new Error('An unknown error occurred');
  }

  /**
   * Convert technical error to user-friendly message
   */
  private getUserFriendlyMessage(error: Error): string {
    const message = error.message.toLowerCase();

    // Network errors
    if (message.includes('fetch') || message.includes('network')) {
      return 'Network error. Please check your connection.';
    }

    // Timeout errors
    if (message.includes('timeout')) {
      return 'Request timed out. Please try again.';
    }

    // Authentication errors
    if (message.includes('auth') || message.includes('login')) {
      return 'Authentication failed. Please log in again.';
    }

    // Relay errors
    if (message.includes('relay')) {
      return 'Failed to connect to relay. Please try again.';
    }

    // Generic fallback
    return error.message || 'An error occurred. Please try again.';
  }
}
