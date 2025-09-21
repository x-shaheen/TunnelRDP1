/**
 * Base Tunnel Service Interface and Abstract Class
 * Provides common interface and functionality for all tunneling services
 */

import { LoggingService } from '../LoggingService';

export interface TunnelConnectionOptions {
  targetHost?: string;
  targetPort?: number;
  token?: string;
  subdomain?: string;
  timeout?: number;
  retries?: number;
}

export interface TunnelConnectionResult {
  success: boolean;
  tunnelUrl?: string;
  hostname?: string;
  port?: number;
  provider: string;
  processId?: number;
  error?: string;
  duration?: number;
  retryAttempt?: number;
  logs?: string[];
}

export interface TunnelHealthStatus {
  isHealthy: boolean;
  lastCheck: number;
  consecutiveFailures: number;
  averageResponseTime: number;
  error?: string;
}

export interface TunnelServiceConfig {
  provider: string;
  requiresAuth: boolean;
  requiresInstallation: boolean;
  supportsTCP: boolean;
  supportsUDP: boolean;
  supportsCustomDomain: boolean;
  isFree: boolean;
  description: string;
  priority: number;
  maxRetries: number;
  timeoutSeconds: number;
  fallbackProviders?: readonly string[];
}

export abstract class BaseTunnelService {
  protected logger: LoggingService;
  protected config: TunnelServiceConfig;
  protected healthStatus: TunnelHealthStatus;
  protected activeProcesses: Map<string, any> = new Map();
  protected processLogs: Map<string, string[]> = new Map();

  constructor(config: TunnelServiceConfig) {
    this.logger = LoggingService.getInstance();
    this.config = config;
    this.healthStatus = {
      isHealthy: true,
      lastCheck: Date.now(),
      consecutiveFailures: 0,
      averageResponseTime: 0
    };
  }

  /**
   * Abstract method to create a tunnel connection
   */
  abstract createTunnel(options?: TunnelConnectionOptions): Promise<TunnelConnectionResult>;

  /**
   * Abstract method to validate connection options
   */
  abstract validateOptions(options: TunnelConnectionOptions): { valid: boolean; errors: string[] };

  /**
   * Abstract method to build command for this provider
   */
  abstract buildCommand(options: TunnelConnectionOptions): { command: string; args: string[]; environment?: Record<string, string> };

  /**
   * Get service configuration
   */
  public getConfig(): TunnelServiceConfig {
    return { ...this.config };
  }

  /**
   * Get current health status
   */
  public getHealthStatus(): TunnelHealthStatus {
    return { ...this.healthStatus };
  }

  /**
   * Update health status
   */
  protected updateHealthStatus(success: boolean, responseTime?: number, error?: string): void {
    this.healthStatus.lastCheck = Date.now();
    
    if (success) {
      this.healthStatus.consecutiveFailures = 0;
      this.healthStatus.isHealthy = true;
      if (responseTime !== undefined) {
        this.healthStatus.averageResponseTime = 
          (this.healthStatus.averageResponseTime + responseTime) / 2;
      }
    } else {
      this.healthStatus.consecutiveFailures++;
      this.healthStatus.isHealthy = this.healthStatus.consecutiveFailures < 3;
      this.healthStatus.error = error;
    }

    this.logger.debug(
      `Health status updated for ${this.config.provider}`,
      'HEALTH',
      this.healthStatus
    );
  }

  /**
   * Generate unique session ID
   */
  protected generateSessionId(): string {
    return `${this.config.provider}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add log entry for a session
   */
  protected addSessionLog(sessionId: string, message: string): void {
    const logs = this.processLogs.get(sessionId) || [];
    logs.push(`[${new Date().toISOString()}] ${message}`);
    this.processLogs.set(sessionId, logs);

    // Limit log size
    if (logs.length > 1000) {
      this.processLogs.set(sessionId, logs.slice(-500));
    }
  }

  /**
   * Get logs for a session
   */
  public getSessionLogs(sessionId: string): string[] {
    return this.processLogs.get(sessionId) || [];
  }

  /**
   * Clean up process and associated resources
   */
  protected cleanupProcess(sessionId: string): void {
    const process = this.activeProcesses.get(sessionId);
    if (process && !process.killed) {
      try {
        process.kill('SIGTERM');
        setTimeout(() => {
          if (!process.killed) {
            process.kill('SIGKILL');
          }
        }, 5000);
      } catch (error) {
        this.logger.warn(`Failed to kill process for session ${sessionId}`, this.config.provider, error);
      }
    }
    
    this.activeProcesses.delete(sessionId);
    this.logger.debug(`Cleaned up process for session ${sessionId}`, this.config.provider);
  }

  /**
   * Clean up all active processes
   */
  public cleanupAllProcesses(): void {
    for (const sessionId of this.activeProcesses.keys()) {
      this.cleanupProcess(sessionId);
    }
    this.logger.info(`Cleaned up all processes for ${this.config.provider}`, this.config.provider);
  }

  /**
   * Delay helper for retry logic
   */
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if provider is available
   */
  public isAvailable(): boolean {
    return this.healthStatus.isHealthy && this.healthStatus.consecutiveFailures < 3;
  }

  /**
   * Get provider name
   */
  public getProviderName(): string {
    return this.config.provider;
  }

  /**
   * Get priority for failover ordering
   */
  public getPriority(): number {
    return this.config.priority;
  }

  /**
   * Check if provider supports TCP
   */
  public supportsTCP(): boolean {
    return this.config.supportsTCP;
  }

  /**
   * Check if provider requires authentication
   */
  public requiresAuth(): boolean {
    return this.config.requiresAuth;
  }

  /**
   * Check if provider is free
   */
  public isFree(): boolean {
    return this.config.isFree;
  }

  /**
   * Get fallback providers
   */
  public getFallbackProviders(): readonly string[] {
    return this.config.fallbackProviders || [];
  }
}
