/**
 * Enhanced Error Boundary Component
 * Provides comprehensive error handling with user-friendly feedback and recovery options
 */

'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { LoggingService } from '@/services/LoggingService';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

export class EnhancedErrorBoundary extends Component<Props, State> {
  private loggingService: LoggingService;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    };
    this.loggingService = LoggingService.getInstance();
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error
    this.loggingService.critical(
      'React Error Boundary caught an error',
      'ERROR_BOUNDARY',
      error,
      {
        errorInfo,
        componentStack: errorInfo.componentStack,
        errorBoundary: this.constructor.name
      }
    );

    this.setState({
      error,
      errorInfo
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    });

    this.loggingService.info('User initiated error recovery', 'ERROR_BOUNDARY');
  };

  private handleReportError = () => {
    const { error, errorInfo, errorId } = this.state;
    
    if (error && errorId) {
      // In production, this would send to error reporting service
      const errorReport = {
        errorId,
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo?.componentStack,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        url: window.location.href
      };

      this.loggingService.info('Error report generated', 'ERROR_BOUNDARY', errorReport);
      
      // Copy to clipboard for user
      navigator.clipboard.writeText(JSON.stringify(errorReport, null, 2)).then(() => {
        alert('Error report copied to clipboard. Please share this with support.');
      });
    }
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-gray-800 rounded-lg shadow-xl p-6 border border-red-500/20">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-white">
                  Something went wrong
                </h3>
                <p className="text-sm text-gray-300">
                  An unexpected error occurred in the application
                </p>
              </div>
            </div>

            <div className="bg-gray-700 rounded-md p-3 mb-4">
              <p className="text-sm text-gray-300 font-mono">
                Error ID: {this.state.errorId}
              </p>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-2">
                  <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-300">
                    Technical Details
                  </summary>
                  <div className="mt-2 text-xs text-gray-400 font-mono whitespace-pre-wrap">
                    {this.state.error.message}
                    {this.state.error.stack && (
                      <div className="mt-2 text-xs text-gray-500">
                        {this.state.error.stack}
                      </div>
                    )}
                  </div>
                </details>
              )}
            </div>

            <div className="space-y-3">
              <button
                onClick={this.handleRetry}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200"
              >
                Try Again
              </button>
              
              <button
                onClick={this.handleReportError}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200"
              >
                Report Error
              </button>

              <button
                onClick={() => window.location.reload()}
                className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium py-2 px-4 rounded-md transition-colors duration-200"
              >
                Reload Page
              </button>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-700">
              <p className="text-xs text-gray-400 text-center">
                If this problem persists, please contact support with the Error ID above.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook for handling errors in functional components
 */
export function useErrorHandler() {
  const loggingService = LoggingService.getInstance();

  const handleError = React.useCallback((error: Error, context?: string, data?: any) => {
    loggingService.error(
      error.message,
      context || 'COMPONENT_ERROR',
      error,
      data
    );
  }, [loggingService]);

  const handleAsyncError = React.useCallback(async (
    asyncOperation: () => Promise<any>,
    context?: string
  ) => {
    try {
      return await asyncOperation();
    } catch (error) {
      handleError(error as Error, context);
      throw error; // Re-throw to allow component to handle
    }
  }, [handleError]);

  return { handleError, handleAsyncError };
}

/**
 * Higher-order component for adding error handling to any component
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  const WrappedComponent = (props: P) => (
    <EnhancedErrorBoundary fallback={fallback}>
      <Component {...props} />
    </EnhancedErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

export default EnhancedErrorBoundary;
