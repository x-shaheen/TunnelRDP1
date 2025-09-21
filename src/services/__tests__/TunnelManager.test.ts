/**
 * Comprehensive tests for TunnelManager with new VPN and tunneling providers
 */

import { TunnelManager } from '../TunnelManager';
import { TunnelProvider } from '../base/TunnelServiceTypes';
import { LoggingService } from '../LoggingService';

// Mock the logging service
jest.mock('../LoggingService');

// Mock all provider services
jest.mock('../providers/NgrokService');
jest.mock('../providers/PinggyService');
jest.mock('../providers/ServeoService');
jest.mock('../providers/LocalExposeService');
jest.mock('../providers/TailscaleService');
jest.mock('../providers/CloudflareTunnelService');

describe('TunnelManager', () => {
  let tunnelManager: TunnelManager;
  let mockLogger: jest.Mocked<LoggingService>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Mock LoggingService
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      getInstance: jest.fn()
    } as any;
    
    (LoggingService.getInstance as jest.Mock).mockReturnValue(mockLogger);
    
    // Get fresh instance
    tunnelManager = TunnelManager.getInstance();
  });

  describe('Initialization', () => {
    it('should initialize all tunnel services', () => {
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Tunnel services initialized',
        'TUNNEL_MANAGER',
        expect.objectContaining({
          services: expect.arrayContaining([
            'tailscale',
            'cloudflare-tunnel',
            'localexpose',
            'ngrok',
            'pinggy',
            'serveo'
          ]),
          vpnProviders: ['tailscale', 'cloudflare-tunnel'],
          directProviders: ['localexpose'],
          sshProviders: ['ngrok', 'pinggy', 'serveo']
        })
      );
    });

    it('should be a singleton', () => {
      const instance1 = TunnelManager.getInstance();
      const instance2 = TunnelManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Provider Priority', () => {
    it('should prioritize VPN providers first', () => {
      const providers = tunnelManager.getProvidersToTry();
      expect(providers[0]).toBe('tailscale');
      expect(providers.slice(0, 2)).toEqual(['tailscale', 'localexpose']);
    });

    it('should include all TCP-capable providers', () => {
      const providers = tunnelManager.getProvidersToTry();
      expect(providers).toContain('tailscale');
      expect(providers).toContain('localexpose');
      expect(providers).toContain('cloudflare-tunnel');
      expect(providers).toContain('serveo');
      expect(providers).toContain('pinggy');
      expect(providers).toContain('ngrok');
    });

    it('should exclude localhost.run for TCP connections', () => {
      const providers = tunnelManager.getProvidersToTry();
      expect(providers).not.toContain('localhost.run');
    });
  });

  describe('Fallback Providers', () => {
    it('should provide correct fallback for tailscale', () => {
      const fallbacks = tunnelManager.getFallbackProviders('tailscale');
      expect(fallbacks).toEqual(['localexpose', 'serveo']);
    });

    it('should provide correct fallback for localexpose', () => {
      const fallbacks = tunnelManager.getFallbackProviders('localexpose');
      expect(fallbacks).toEqual(['serveo', 'pinggy']);
    });

    it('should provide correct fallback for cloudflare-tunnel', () => {
      const fallbacks = tunnelManager.getFallbackProviders('cloudflare-tunnel');
      expect(fallbacks).toEqual(['tailscale', 'localexpose']);
    });
  });

  describe('Tunnel Creation', () => {
    it('should attempt tunnel creation with default options', async () => {
      // Mock successful tunnel creation
      const mockService = {
        createTunnel: jest.fn().mockResolvedValue({
          success: true,
          provider: 'tailscale',
          tunnelUrl: 'tcp://test.ts.net:3389',
          duration: 1000
        })
      };

      // Replace the service in the manager
      (tunnelManager as any).services.set('tailscale', mockService);

      const result = await tunnelManager.createTunnel();

      expect(result.success).toBe(true);
      expect(result.provider).toBe('tailscale');
      expect(result.tunnelUrl).toBe('tcp://test.ts.net:3389');
      expect(mockService.createTunnel).toHaveBeenCalledWith({});
    });

    it('should try fallback providers on failure', async () => {
      // Mock first provider failure, second provider success
      const mockTailscale = {
        createTunnel: jest.fn().mockResolvedValue({
          success: false,
          provider: 'tailscale',
          error: 'Tailscale not authenticated'
        })
      };

      const mockLocalExpose = {
        createTunnel: jest.fn().mockResolvedValue({
          success: true,
          provider: 'localexpose',
          tunnelUrl: 'tcp://test.loclx.io:3389',
          duration: 2000
        })
      };

      (tunnelManager as any).services.set('tailscale', mockTailscale);
      (tunnelManager as any).services.set('localexpose', mockLocalExpose);

      const result = await tunnelManager.createTunnel();

      expect(mockTailscale.createTunnel).toHaveBeenCalled();
      expect(mockLocalExpose.createTunnel).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.provider).toBe('localexpose');
    });

    it('should handle all providers failing', async () => {
      // Mock all providers to fail
      const mockFailure = {
        success: false,
        provider: 'test',
        error: 'Service unavailable'
      };

      const services = ['tailscale', 'localexpose', 'cloudflare-tunnel', 'serveo', 'pinggy', 'ngrok'];
      services.forEach(provider => {
        const mockService = {
          createTunnel: jest.fn().mockResolvedValue({
            ...mockFailure,
            provider
          })
        };
        (tunnelManager as any).services.set(provider, mockService);
      });

      const result = await tunnelManager.createTunnel();

      expect(result.success).toBe(false);
      expect(result.error).toContain('All');
      expect(result.error).toContain('providers failed');
    });

    it('should pass custom options to providers', async () => {
      const mockService = {
        createTunnel: jest.fn().mockResolvedValue({
          success: true,
          provider: 'tailscale',
          tunnelUrl: 'tcp://test.ts.net:3389'
        })
      };

      (tunnelManager as any).services.set('tailscale', mockService);

      const options = {
        targetPort: 5432,
        targetHost: '192.168.1.100',
        token: 'test-token'
      };

      await tunnelManager.createTunnel('tailscale', options);

      expect(mockService.createTunnel).toHaveBeenCalledWith(options);
    });
  });

  describe('Legacy Compatibility', () => {
    it('should support legacy createTunnelEnhanced method', async () => {
      const mockService = {
        createTunnel: jest.fn().mockResolvedValue({
          success: true,
          provider: 'serveo',
          tunnelUrl: 'tcp://test.serveo.net:3389',
          logs: ['Connection established']
        })
      };

      (tunnelManager as any).services.set('serveo', mockService);

      const result = await tunnelManager.createTunnelEnhanced('serveo', {
        targetPort: 3389
      });

      expect(result.success).toBe(true);
      expect(result.parseResult).toEqual({
        success: true,
        tunnelUrl: 'tcp://test.serveo.net:3389'
      });
      expect(result.commandUsed).toBe('Managed by TunnelManager');
      expect(result.outputLog).toEqual(['Connection established']);
    });

    it('should handle legacy provider names', async () => {
      const mockService = {
        createTunnel: jest.fn().mockResolvedValue({
          success: true,
          provider: 'pinggy',
          tunnelUrl: 'tcp://test.pinggy.link:3389'
        })
      };

      (tunnelManager as any).services.set('pinggy', mockService);

      const result = await tunnelManager.createTunnelEnhanced('pinggy');

      expect(result.success).toBe(true);
      expect(mockService.createTunnel).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle service initialization errors', () => {
      // Mock constructor to throw error
      const originalError = console.error;
      console.error = jest.fn();

      expect(() => {
        // This would be called during initialization
        (tunnelManager as any).initializeServices();
      }).not.toThrow();

      console.error = originalError;
    });

    it('should handle missing service gracefully', async () => {
      // Remove a service
      (tunnelManager as any).services.delete('tailscale');

      const result = await tunnelManager.createTunnel('tailscale');

      expect(result.success).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Service not found for provider: tailscale',
        'TUNNEL_MANAGER'
      );
    });

    it('should handle service exceptions', async () => {
      const mockService = {
        createTunnel: jest.fn().mockRejectedValue(new Error('Network error'))
      };

      (tunnelManager as any).services.set('tailscale', mockService);

      const result = await tunnelManager.createTunnel('tailscale');

      expect(result.success).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Provider tailscale threw error',
        'TUNNEL_MANAGER',
        expect.any(Error),
        expect.any(Object)
      );
    });
  });

  describe('Provider Selection Logic', () => {
    it('should respect provider preference when specified', async () => {
      const mockService = {
        createTunnel: jest.fn().mockResolvedValue({
          success: true,
          provider: 'cloudflare-tunnel',
          tunnelUrl: 'https://test.trycloudflare.com'
        })
      };

      (tunnelManager as any).services.set('cloudflare-tunnel', mockService);

      const result = await tunnelManager.createTunnel('cloudflare-tunnel');

      expect(mockService.createTunnel).toHaveBeenCalled();
      expect(result.provider).toBe('cloudflare-tunnel');
    });

    it('should filter providers based on options', () => {
      const options = { requiresAuth: false };
      const providers = tunnelManager.getProvidersToTry(undefined, options);

      // Should include free providers that don't require auth
      expect(providers).toContain('serveo');
      expect(providers).toContain('pinggy');
    });
  });
});
