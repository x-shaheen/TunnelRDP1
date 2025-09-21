/**
 * Tunnel Manager
 * Centralized coordinator for all tunneling services with failover and backward compatibility
 */

import { BaseTunnelService, TunnelConnectionOptions, TunnelConnectionResult } from './base/BaseTunnelService';
import { TunnelProvider, PROVIDER_PRIORITY_ORDER, PROVIDER_CONFIGS } from './base/TunnelServiceTypes';
import { NgrokService } from './providers/NgrokService';
import { PinggyService } from './providers/PinggyService';
import { ServeoService } from './providers/ServeoService';
import { LocalExposeService } from './providers/LocalExposeService';
import { TailscaleService } from './providers/TailscaleService';
import { CloudflareTunnelService } from './providers/CloudflareTunnelService';
import { LoggingService } from './LoggingService';

// Legacy interfaces for backward compatibility
export interface TunnelProcessResult extends TunnelConnectionResult {
  parseResult?: any;
  commandUsed?: string;
  outputLog?: string[];
  errorLog?: string[];
}

export interface LegacyTunnelingConfig {
  provider?: TunnelProvider;
  token?: string;
  authKey?: string;
  subdomain?: string;
  targetHost?: string;
  targetPort?: number;
}

export class TunnelManager {
  private static instance: TunnelManager;
  private services: Map<TunnelProvider, BaseTunnelService> = new Map();
  private logger: LoggingService;

  private constructor() {
    this.logger = LoggingService.getInstance();
    this.initializeServices();
  }

  public static getInstance(): TunnelManager {
    if (!TunnelManager.instance) {
      TunnelManager.instance = new TunnelManager();
    }
    return TunnelManager.instance;
  }

  /**
   * Initialize all tunnel services
   */
  private initializeServices(): void {
    try {
      // VPN-based providers (highest priority)
      this.services.set('tailscale', new TailscaleService(this.logger));
      this.services.set('cloudflare-tunnel', new CloudflareTunnelService(this.logger));

      // Direct tunneling services
      this.services.set('localexpose', new LocalExposeService(this.logger));

      // SSH-based providers (legacy)
      this.services.set('ngrok', new NgrokService());
      this.services.set('pinggy', new PinggyService());
      this.services.set('serveo', new ServeoService());

      this.logger.info('Tunnel services initialized', 'TUNNEL_MANAGER', {
        services: Array.from(this.services.keys()),
        vpnProviders: ['tailscale', 'cloudflare-tunnel'],
        directProviders: ['localexpose'],
        sshProviders: ['ngrok', 'pinggy', 'serveo']
      });
    } catch (error: any) {
      this.logger.error('Failed to initialize tunnel services', 'TUNNEL_MANAGER', error);
      throw error;
    }
  }

  /**
   * Create tunnel with automatic provider selection and failover
   */
  public async createTunnel(
    provider?: TunnelProvider,
    options: TunnelConnectionOptions = {},
    maxRetries: number = 3
  ): Promise<TunnelConnectionResult> {
    const sessionId = `manager-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    this.logger.info('Starting tunnel creation', 'TUNNEL_MANAGER', {
      sessionId,
      requestedProvider: provider,
      options: { ...options, token: options.token ? '[REDACTED]' : undefined },
      maxRetries
    });

    // Get providers to try
    const providersToTry = this.getProvidersToTry(provider, options);
    
    if (providersToTry.length === 0) {
      const error = 'No suitable providers available';
      this.logger.error(error, 'TUNNEL_MANAGER', undefined, { options });
      return {
        success: false,
        provider: provider || 'unknown',
        error,
        duration: Date.now() - startTime
      };
    }

    // Try each provider
    for (let i = 0; i < providersToTry.length; i++) {
      const currentProvider = providersToTry[i];
      const service = this.services.get(currentProvider);
      
      if (!service) {
        this.logger.warn(`Service not found for provider: ${currentProvider}`, 'TUNNEL_MANAGER');
        continue;
      }

      this.logger.debug(`Trying provider ${i + 1}/${providersToTry.length}: ${currentProvider}`, 'TUNNEL_MANAGER');

      try {
        const result = await service.createTunnel(options);
        
        if (result.success) {
          this.logger.info(`Tunnel created successfully with ${currentProvider}`, 'TUNNEL_MANAGER', {
            sessionId,
            provider: currentProvider,
            tunnelUrl: result.tunnelUrl,
            duration: Date.now() - startTime
          });
          
          return {
            ...result,
            duration: Date.now() - startTime
          };
        } else {
          this.logger.warn(`Provider ${currentProvider} failed`, 'TUNNEL_MANAGER', {
            error: result.error,
            attempt: i + 1
          });
        }

        // Wait before trying next provider (except for last one)
        if (i < providersToTry.length - 1) {
          await this.delay(1000 * (i + 1));
        }

      } catch (error: any) {
        this.logger.error(`Provider ${currentProvider} threw error`, 'TUNNEL_MANAGER', error, {
          attempt: i + 1
        });
      }
    }

    // All providers failed
    const error = `All ${providersToTry.length} providers failed`;
    this.logger.error(error, 'TUNNEL_MANAGER', undefined, {
      sessionId,
      providersAttempted: providersToTry,
      duration: Date.now() - startTime
    });

    return {
      success: false,
      provider: providersToTry[0] || 'unknown',
      error,
      duration: Date.now() - startTime
    };
  }

  /**
   * Legacy method for backward compatibility
   */
  public async createTunnelEnhanced(
    provider?: TunnelProvider,
    config?: Partial<LegacyTunnelingConfig>,
    maxRetries: number = 3
  ): Promise<TunnelProcessResult> {
    // Convert legacy config to new options format
    const options: TunnelConnectionOptions = {
      token: config?.token || config?.authKey,
      subdomain: config?.subdomain,
      targetHost: config?.targetHost,
      targetPort: config?.targetPort,
      retries: maxRetries
    };

    const result = await this.createTunnel(provider, options, maxRetries);

    // Convert to legacy format
    return {
      ...result,
      parseResult: result.success ? { success: true, tunnelUrl: result.tunnelUrl } : { success: false },
      commandUsed: `Managed by TunnelManager`,
      outputLog: result.logs || [],
      errorLog: result.error ? [result.error] : []
    };
  }

  /**
   * Validate provider configuration (legacy compatibility)
   */
  public validateProviderConfig(provider: TunnelProvider, config: Partial<LegacyTunnelingConfig>): any {
    const service = this.services.get(provider);
    if (!service) {
      return {
        type: 'CONFIGURATION_ERROR',
        message: `Unknown provider: ${provider}`,
        provider,
        retryable: false,
        timestamp: Date.now()
      };
    }

    const options: TunnelConnectionOptions = {
      token: config.token || config.authKey,
      subdomain: config.subdomain,
      targetHost: config.targetHost,
      targetPort: config.targetPort
    };

    const validation = service.validateOptions(options);
    if (validation.valid) {
      return null;
    }

    return {
      type: 'CONFIGURATION_ERROR',
      message: validation.errors.join(', '),
      provider,
      retryable: false,
      timestamp: Date.now()
    };
  }

  /**
   * Get providers to try based on request and availability
   */
  private getProvidersToTry(requestedProvider?: TunnelProvider, options: TunnelConnectionOptions = {}): TunnelProvider[] {
    const providers: TunnelProvider[] = [];

    // If specific provider requested, try it first
    if (requestedProvider) {
      const service = this.services.get(requestedProvider);
      if (service && service.isAvailable()) {
        // Check if provider supports the requested configuration
        const validation = service.validateOptions(options);
        if (validation.valid) {
          providers.push(requestedProvider);
        } else {
          this.logger.warn(`Requested provider ${requestedProvider} doesn't support options`, 'TUNNEL_MANAGER', {
            errors: validation.errors
          });
        }
      }
    }

    // Add other available providers in priority order
    for (const provider of PROVIDER_PRIORITY_ORDER) {
      if (providers.includes(provider)) continue; // Already added
      
      const service = this.services.get(provider);
      if (!service || !service.isAvailable()) continue;

      // Check if provider supports the configuration
      const validation = service.validateOptions(options);
      if (validation.valid) {
        providers.push(provider);
      }
    }

    return providers;
  }

  /**
   * Get best available provider
   */
  public getBestProvider(excludeProviders: TunnelProvider[] = []): TunnelProvider {
    for (const provider of PROVIDER_PRIORITY_ORDER) {
      if (excludeProviders.includes(provider)) continue;
      
      const service = this.services.get(provider);
      if (service && service.isAvailable() && service.supportsTCP()) {
        return provider;
      }
    }
    
    throw new Error('No healthy providers available');
  }

  /**
   * Get fallback providers for a given provider
   */
  public getFallbackProviders(provider: TunnelProvider): readonly TunnelProvider[] {
    const config = PROVIDER_CONFIGS[provider];
    return config?.fallbackProviders || [];
  }

  /**
   * Get service for a provider
   */
  public getService(provider: TunnelProvider): BaseTunnelService | undefined {
    return this.services.get(provider);
  }

  /**
   * Get all available services
   */
  public getAvailableServices(): Map<TunnelProvider, BaseTunnelService> {
    const available = new Map<TunnelProvider, BaseTunnelService>();
    
    for (const [provider, service] of this.services) {
      if (service.isAvailable()) {
        available.set(provider, service);
      }
    }
    
    return available;
  }

  /**
   * Get health status for all services
   */
  public getHealthStatus(): Record<TunnelProvider, any> {
    const status: Record<string, any> = {};
    
    for (const [provider, service] of this.services) {
      status[provider] = {
        ...service.getHealthStatus(),
        config: service.getConfig()
      };
    }
    
    return status;
  }

  /**
   * Test connectivity for all services
   */
  public async testAllConnectivity(): Promise<Record<TunnelProvider, any>> {
    const results: Record<string, any> = {};
    
    const testPromises = Array.from(this.services.entries()).map(async ([provider, service]) => {
      try {
        let testResult;
        
        // Call provider-specific test methods if available
        if (provider === 'serveo' && 'testConnectivity' in service) {
          testResult = await (service as any).testConnectivity();
        } else if (provider === 'pinggy' && 'testConnectivity' in service) {
          testResult = await (service as any).testConnectivity();
        } else if (provider === 'ngrok' && 'checkInstallation' in service) {
          testResult = await (service as any).checkInstallation();
        } else {
          testResult = { success: true, message: 'No specific test available' };
        }
        
        results[provider] = testResult;
      } catch (error: any) {
        results[provider] = {
          success: false,
          error: error.message
        };
      }
    });
    
    await Promise.all(testPromises);
    return results;
  }

  /**
   * Clean up all services
   */
  public cleanupAll(): void {
    this.logger.info('Cleaning up all tunnel services', 'TUNNEL_MANAGER');
    
    for (const [provider, service] of this.services) {
      try {
        service.cleanupAllProcesses();
      } catch (error: any) {
        this.logger.warn(`Failed to cleanup ${provider}`, 'TUNNEL_MANAGER', error);
      }
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Legacy method for process logs
   */
  public getProcessLogs(sessionId: string): string[] {
    // Try to get logs from any service that might have this session
    for (const service of this.services.values()) {
      const logs = service.getSessionLogs(sessionId);
      if (logs.length > 0) {
        return logs;
      }
    }
    return [];
  }

  /**
   * Legacy method for cleanup
   */
  public cleanupAllProcesses(): void {
    this.cleanupAll();
  }
}
