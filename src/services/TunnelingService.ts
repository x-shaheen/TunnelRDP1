/**
 * Production-Ready Tunneling Service
 * Backward compatibility wrapper for the new modular tunnel architecture
 * Delegates to TunnelManager for actual tunnel operations
 */

import { TunnelManager } from './TunnelManager';
import { TunnelProvider, PROVIDER_PRIORITY_ORDER } from './base/TunnelServiceTypes';

// Legacy imports for backward compatibility
import {
  TunnelingProvider,
  TunnelingConfig,
  TunnelConnectionResult,
  TunnelError
} from '@/types/tunneling';

// Legacy interface for backward compatibility
export interface TunnelProcessResult {
  success: boolean;
  tunnelUrl?: string;
  hostname?: string;
  port?: number;
  provider: string;
  processId?: number;
  error?: string;
  parseResult?: any;
  commandUsed?: string;
  outputLog?: string[];
  errorLog?: string[];
  duration?: number;
  retryAttempt?: number;
}

export class TunnelingService {
  private static instance: TunnelingService;
  private tunnelManager: TunnelManager;

  private constructor() {
    this.tunnelManager = TunnelManager.getInstance();
  }

  public static getInstance(): TunnelingService {
    if (!TunnelingService.instance) {
      TunnelingService.instance = new TunnelingService();
    }
    return TunnelingService.instance;
  }

  /**
   * Get the best available provider based on health checks
   */
  public getBestProvider(excludeProviders: TunnelingProvider[] = []): TunnelingProvider {
    return this.tunnelManager.getBestProvider(excludeProviders as TunnelProvider[]);
  }

  /**
   * Get fallback providers for a given provider
   */
  public getFallbackProviders(provider: TunnelingProvider): readonly TunnelingProvider[] {
    return this.tunnelManager.getFallbackProviders(provider as TunnelProvider);
  }

  /**
   * Enhanced tunnel creation with robust error handling and retry logic
   * Delegates to TunnelManager for actual implementation
   */
  public async createTunnelEnhanced(
    provider?: TunnelingProvider,
    config?: Partial<TunnelingConfig>,
    maxRetries: number = 3
  ): Promise<TunnelProcessResult> {
    return this.tunnelManager.createTunnelEnhanced(
      provider as TunnelProvider,
      config,
      maxRetries
    );
  }

  /**
   * Validate provider configuration
   */
  public validateProviderConfig(provider: TunnelingProvider, config: Partial<TunnelingConfig>): TunnelError | null {
    return this.tunnelManager.validateProviderConfig(provider as TunnelProvider, config);
  }

  /**
   * Get process logs for debugging
   */
  public getProcessLogs(sessionId: string): string[] {
    return this.tunnelManager.getProcessLogs(sessionId);
  }

  /**
   * Clean up all active processes
   */
  public cleanupAllProcesses(): void {
    this.tunnelManager.cleanupAllProcesses();
  }

  /**
   * Get health status for all services
   */
  public getHealthStatus(): Record<TunnelingProvider, any> {
    return this.tunnelManager.getHealthStatus();
  }

  /**
   * Test connectivity for all services
   */
  public async testAllConnectivity(): Promise<Record<TunnelingProvider, any>> {
    return this.tunnelManager.testAllConnectivity();
  }

  /**
   * Get available services
   */
  public getAvailableServices(): any {
    return this.tunnelManager.getAvailableServices();
  }

  /**
   * Get service for a provider
   */
  public getService(provider: TunnelingProvider): any {
    return this.tunnelManager.getService(provider as TunnelProvider);
  }
}
