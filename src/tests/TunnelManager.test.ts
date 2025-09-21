/**
 * Test Suite for TunnelManager
 * Tests the centralized tunnel coordination and failover functionality
 */

import { TunnelManager } from '@/services/TunnelManager';
import { TunnelProvider } from '@/services/base/TunnelServiceTypes';

describe('TunnelManager', () => {
  let tunnelManager: TunnelManager;

  beforeEach(() => {
    tunnelManager = TunnelManager.getInstance();
  });

  describe('Provider Management', () => {
    test('should return best available provider', () => {
      const bestProvider = tunnelManager.getBestProvider();
      expect(bestProvider).toBe('serveo'); // Highest priority free TCP provider
    });

    test('should exclude specified providers', () => {
      const bestProvider = tunnelManager.getBestProvider(['serveo']);
      expect(bestProvider).toBe('pinggy'); // Next best option
    });

    test('should throw error when no providers available', () => {
      expect(() => {
        tunnelManager.getBestProvider(['serveo', 'pinggy', 'ngrok']);
      }).toThrow('No healthy providers available');
    });

    test('should return fallback providers', () => {
      const fallbacks = tunnelManager.getFallbackProviders('serveo');
      expect(fallbacks).toContain('pinggy');
    });
  });

  describe('Service Management', () => {
    test('should return available services', () => {
      const services = tunnelManager.getAvailableServices();
      expect(services.size).toBeGreaterThan(0);
      expect(services.has('serveo')).toBe(true);
      expect(services.has('pinggy')).toBe(true);
      expect(services.has('ngrok')).toBe(true);
    });

    test('should get service for provider', () => {
      const serveoService = tunnelManager.getService('serveo');
      expect(serveoService).toBeDefined();
      expect(serveoService?.getProviderName()).toBe('serveo');
    });

    test('should return undefined for invalid provider', () => {
      const invalidService = tunnelManager.getService('invalid' as TunnelProvider);
      expect(invalidService).toBeUndefined();
    });
  });

  describe('Health Status', () => {
    test('should return health status for all services', () => {
      const healthStatus = tunnelManager.getHealthStatus();
      expect(healthStatus).toHaveProperty('serveo');
      expect(healthStatus).toHaveProperty('pinggy');
      expect(healthStatus).toHaveProperty('ngrok');
      
      expect(healthStatus.serveo).toHaveProperty('isHealthy');
      expect(healthStatus.serveo).toHaveProperty('config');
    });
  });

  describe('Configuration Validation', () => {
    test('should validate valid serveo configuration', () => {
      const error = tunnelManager.validateProviderConfig('serveo', {});
      expect(error).toBeNull();
    });

    test('should reject invalid provider', () => {
      const error = tunnelManager.validateProviderConfig('invalid' as TunnelProvider, {});
      expect(error).not.toBeNull();
      expect(error?.type).toBe('CONFIGURATION_ERROR');
    });

    test('should require ngrok token for ngrok provider', () => {
      const error = tunnelManager.validateProviderConfig('ngrok', {});
      expect(error).not.toBeNull();
      expect(error?.message).toContain('token');
    });

    test('should accept ngrok configuration with token', () => {
      const error = tunnelManager.validateProviderConfig('ngrok', { token: 'test-token' });
      expect(error).toBeNull();
    });
  });

  describe('Tunnel Creation', () => {
    test('should create tunnel with default provider', async () => {
      // Mock the actual tunnel creation to avoid real network calls
      const mockService = {
        createTunnel: jest.fn().mockResolvedValue({
          success: true,
          tunnelUrl: 'tcp://test.serveo.net:12345',
          hostname: 'test.serveo.net',
          port: 12345,
          provider: 'serveo'
        }),
        isAvailable: jest.fn().mockReturnValue(true),
        validateOptions: jest.fn().mockReturnValue({ valid: true, errors: [] })
      };

      // Replace the service temporarily
      const originalService = tunnelManager.getService('serveo');
      (tunnelManager as any).services.set('serveo', mockService);

      const result = await tunnelManager.createTunnel();
      
      expect(result.success).toBe(true);
      expect(result.provider).toBe('serveo');
      expect(result.tunnelUrl).toBe('tcp://test.serveo.net:12345');

      // Restore original service
      if (originalService) {
        (tunnelManager as any).services.set('serveo', originalService);
      }
    });

    test('should handle tunnel creation failure', async () => {
      // Mock all services to fail
      const mockFailingService = {
        createTunnel: jest.fn().mockResolvedValue({
          success: false,
          provider: 'serveo',
          error: 'Connection failed'
        }),
        isAvailable: jest.fn().mockReturnValue(true),
        validateOptions: jest.fn().mockReturnValue({ valid: true, errors: [] })
      };

      const originalServices = new Map();
      for (const [provider, service] of (tunnelManager as any).services) {
        originalServices.set(provider, service);
        (tunnelManager as any).services.set(provider, mockFailingService);
      }

      const result = await tunnelManager.createTunnel();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('providers failed');

      // Restore original services
      for (const [provider, service] of originalServices) {
        (tunnelManager as any).services.set(provider, service);
      }
    });
  });

  describe('Legacy Compatibility', () => {
    test('should support legacy createTunnelEnhanced method', async () => {
      // Mock the service
      const mockService = {
        createTunnel: jest.fn().mockResolvedValue({
          success: true,
          tunnelUrl: 'tcp://test.serveo.net:12345',
          hostname: 'test.serveo.net',
          port: 12345,
          provider: 'serveo'
        }),
        isAvailable: jest.fn().mockReturnValue(true),
        validateOptions: jest.fn().mockReturnValue({ valid: true, errors: [] })
      };

      const originalService = tunnelManager.getService('serveo');
      (tunnelManager as any).services.set('serveo', mockService);

      const result = await tunnelManager.createTunnelEnhanced('serveo', { targetPort: 3389 });
      
      expect(result.success).toBe(true);
      expect(result.provider).toBe('serveo');
      expect(result).toHaveProperty('parseResult');
      expect(result).toHaveProperty('commandUsed');
      expect(result).toHaveProperty('outputLog');

      if (originalService) {
        (tunnelManager as any).services.set('serveo', originalService);
      }
    });
  });

  describe('Cleanup', () => {
    test('should cleanup all processes', () => {
      // This should not throw
      expect(() => {
        tunnelManager.cleanupAll();
      }).not.toThrow();
    });

    test('should get process logs', () => {
      const logs = tunnelManager.getProcessLogs('test-session');
      expect(Array.isArray(logs)).toBe(true);
    });
  });

  describe('Connectivity Testing', () => {
    test('should test connectivity for all services', async () => {
      const results = await tunnelManager.testAllConnectivity();
      
      expect(results).toHaveProperty('serveo');
      expect(results).toHaveProperty('pinggy');
      expect(results).toHaveProperty('ngrok');
      
      // Each result should have a success property
      Object.values(results).forEach(result => {
        expect(result).toHaveProperty('success');
      });
    }, 30000); // Increase timeout for network operations
  });
});

// Mock tests for browser environment
describe('TunnelManager Browser Environment', () => {
  beforeEach(() => {
    // Mock browser environment
    Object.defineProperty(window, 'location', {
      value: { href: 'https://test.com' },
      writable: true
    });
  });

  test('should work in browser environment', () => {
    const manager = TunnelManager.getInstance();
    expect(manager).toBeDefined();
    expect(manager.getBestProvider()).toBe('serveo');
  });
});

// Performance tests
describe('TunnelManager Performance', () => {
  test('should handle multiple concurrent requests', async () => {
    const manager = TunnelManager.getInstance();
    
    // Mock service for performance testing
    const mockService = {
      createTunnel: jest.fn().mockResolvedValue({
        success: true,
        tunnelUrl: 'tcp://test.serveo.net:12345',
        provider: 'serveo'
      }),
      isAvailable: jest.fn().mockReturnValue(true),
      validateOptions: jest.fn().mockReturnValue({ valid: true, errors: [] })
    };

    const originalService = manager.getService('serveo');
    (manager as any).services.set('serveo', mockService);

    const promises = Array(10).fill(null).map(() => 
      manager.createTunnel('serveo', { targetPort: 3389 })
    );

    const results = await Promise.all(promises);
    
    expect(results).toHaveLength(10);
    results.forEach(result => {
      expect(result.success).toBe(true);
    });

    if (originalService) {
      (manager as any).services.set('serveo', originalService);
    }
  });
});
