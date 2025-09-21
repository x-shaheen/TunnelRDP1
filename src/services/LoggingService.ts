/**
 * Production-Ready Logging Service
 * Provides comprehensive logging, monitoring, and debugging capabilities
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  context?: string;
  data?: any;
  error?: Error;
  userId?: string;
  sessionId?: string;
  requestId?: string;
}

export interface LogMetrics {
  totalLogs: number;
  errorCount: number;
  warningCount: number;
  averageResponseTime: number;
  lastError?: LogEntry;
  systemHealth: 'healthy' | 'warning' | 'critical';
}

export class LoggingService {
  private static instance: LoggingService;
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;
  private currentLogLevel: LogLevel = LogLevel.INFO;
  private metrics: LogMetrics = {
    totalLogs: 0,
    errorCount: 0,
    warningCount: 0,
    averageResponseTime: 0,
    systemHealth: 'healthy'
  };

  private constructor() {
    // Set log level based on environment
    if (typeof window !== 'undefined') {
      this.currentLogLevel = process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO;
    }
  }

  public static getInstance(): LoggingService {
    if (!LoggingService.instance) {
      LoggingService.instance = new LoggingService();
    }
    return LoggingService.instance;
  }

  /**
   * Log debug message
   */
  public debug(message: string, context?: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, context, data);
  }

  /**
   * Log info message
   */
  public info(message: string, context?: string, data?: any): void {
    this.log(LogLevel.INFO, message, context, data);
  }

  /**
   * Log warning message
   */
  public warn(message: string, context?: string, data?: any): void {
    this.log(LogLevel.WARN, message, context, data);
  }

  /**
   * Log error message
   */
  public error(message: string, context?: string, error?: Error, data?: any): void {
    this.log(LogLevel.ERROR, message, context, data, error);
  }

  /**
   * Log critical error message
   */
  public critical(message: string, context?: string, error?: Error, data?: any): void {
    this.log(LogLevel.CRITICAL, message, context, data, error);
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, context?: string, data?: any, error?: Error): void {
    if (level < this.currentLogLevel) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      context,
      data,
      error,
      requestId: this.generateRequestId()
    };

    // Add to logs array
    this.logs.push(logEntry);
    
    // Maintain max logs limit
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Update metrics
    this.updateMetrics(logEntry);

    // Output to console in development
    if (process.env.NODE_ENV === 'development') {
      this.outputToConsole(logEntry);
    }

    // Send to external logging service in production
    if (process.env.NODE_ENV === 'production') {
      this.sendToExternalService(logEntry);
    }
  }

  /**
   * Update logging metrics
   */
  private updateMetrics(logEntry: LogEntry): void {
    this.metrics.totalLogs++;

    if (logEntry.level === LogLevel.ERROR || logEntry.level === LogLevel.CRITICAL) {
      this.metrics.errorCount++;
      this.metrics.lastError = logEntry;
    }

    if (logEntry.level === LogLevel.WARN) {
      this.metrics.warningCount++;
    }

    // Update system health
    const errorRate = this.metrics.errorCount / this.metrics.totalLogs;
    if (errorRate > 0.1) {
      this.metrics.systemHealth = 'critical';
    } else if (errorRate > 0.05 || this.metrics.warningCount > 10) {
      this.metrics.systemHealth = 'warning';
    } else {
      this.metrics.systemHealth = 'healthy';
    }
  }

  /**
   * Output log to console with formatting
   */
  private outputToConsole(logEntry: LogEntry): void {
    const timestamp = new Date(logEntry.timestamp).toISOString();
    const levelName = LogLevel[logEntry.level];
    const contextStr = logEntry.context ? `[${logEntry.context}]` : '';
    
    const logMessage = `${timestamp} ${levelName} ${contextStr} ${logEntry.message}`;

    switch (logEntry.level) {
      case LogLevel.DEBUG:
        console.debug(logMessage, logEntry.data);
        break;
      case LogLevel.INFO:
        console.info(logMessage, logEntry.data);
        break;
      case LogLevel.WARN:
        console.warn(logMessage, logEntry.data);
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(logMessage, logEntry.error, logEntry.data);
        break;
    }
  }

  /**
   * Send log to external service (placeholder for production)
   */
  private sendToExternalService(logEntry: LogEntry): void {
    // In production, this would send to services like:
    // - Sentry for error tracking
    // - LogRocket for session replay
    // - DataDog for monitoring
    // - Custom analytics endpoint
    
    // For now, we'll just store it locally
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const existingLogs = JSON.parse(localStorage.getItem('rdp-logs') || '[]');
        existingLogs.push(logEntry);
        
        // Keep only last 100 logs in localStorage
        if (existingLogs.length > 100) {
          existingLogs.splice(0, existingLogs.length - 100);
        }
        
        localStorage.setItem('rdp-logs', JSON.stringify(existingLogs));
      } catch (error) {
        console.error('Failed to store log in localStorage:', error);
      }
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get recent logs
   */
  public getRecentLogs(count: number = 50): LogEntry[] {
    return this.logs.slice(-count);
  }

  /**
   * Get logs by level
   */
  public getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * Get logs by context
   */
  public getLogsByContext(context: string): LogEntry[] {
    return this.logs.filter(log => log.context === context);
  }

  /**
   * Get current metrics
   */
  public getMetrics(): LogMetrics {
    return { ...this.metrics };
  }

  /**
   * Clear all logs
   */
  public clearLogs(): void {
    this.logs = [];
    this.metrics = {
      totalLogs: 0,
      errorCount: 0,
      warningCount: 0,
      averageResponseTime: 0,
      systemHealth: 'healthy'
    };
  }

  /**
   * Set log level
   */
  public setLogLevel(level: LogLevel): void {
    this.currentLogLevel = level;
  }

  /**
   * Export logs as JSON
   */
  public exportLogs(): string {
    return JSON.stringify({
      exportedAt: Date.now(),
      metrics: this.metrics,
      logs: this.logs
    }, null, 2);
  }

  /**
   * Log API request/response
   */
  public logApiCall(
    method: string,
    url: string,
    statusCode: number,
    responseTime: number,
    error?: Error
  ): void {
    const level = statusCode >= 400 ? LogLevel.ERROR : LogLevel.INFO;
    const message = `${method} ${url} - ${statusCode} (${responseTime}ms)`;
    
    this.log(level, message, 'API', {
      method,
      url,
      statusCode,
      responseTime
    }, error);

    // Update average response time
    const totalCalls = this.logs.filter(log => log.context === 'API').length;
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (totalCalls - 1) + responseTime) / totalCalls;
  }

  /**
   * Log deployment event
   */
  public logDeployment(
    provider: string,
    repository: string,
    status: 'started' | 'completed' | 'failed',
    details?: any
  ): void {
    const level = status === 'failed' ? LogLevel.ERROR : LogLevel.INFO;
    const message = `Deployment ${status}: ${provider} -> ${repository}`;
    
    this.log(level, message, 'DEPLOYMENT', {
      provider,
      repository,
      status,
      ...details
    });
  }

  /**
   * Log user action
   */
  public logUserAction(action: string, userId?: string, details?: any): void {
    this.log(LogLevel.INFO, `User action: ${action}`, 'USER', {
      action,
      userId,
      ...details
    });
  }

  /**
   * Log system event
   */
  public logSystemEvent(event: string, details?: any): void {
    this.log(LogLevel.INFO, `System event: ${event}`, 'SYSTEM', details);
  }
}
