/**
 * Comprehensive Test Suite for TunnelingService (Legacy Compatibility)
 * Tests backward compatibility with the new modular architecture
 */

import { TunnelingService } from '@/services/TunnelingService';
import { TunnelingProvider } from '@/types/tunneling';

describe('TunnelingService (Legacy Compatibility)', () => {
  let tunnelingService: TunnelingService;

  beforeEach(() => {
    tunnelingService = TunnelingService.getInstance();
  });

  describe('Provider Selection', () => {
    test('should return best available provider', () => {
      const bestProvider = tunnelingService.getBestProvider();
      expect(bestProvider).toBe('serveo'); // Highest priority free TCP provider
    });

    test('should exclude specified providers', () => {
      const bestProvider = tunnelingService.getBestProvider(['serveo']);
      expect(bestProvider).toBe('pinggy'); // Next best option
    });

    test('should throw error when no providers available', () => {
      expect(() => {
        tunnelingService.getBestProvider(['serveo', 'pinggy', 'ngrok']);
      }).toThrow('No healthy providers available');
    });

    test('should return fallback providers', () => {
      const fallbacks = tunnelingService.getFallbackProviders('serveo');
      expect(fallbacks).toContain('pinggy');
    });
  });

  describe('Configuration Validation', () => {
    test('should validate valid serveo configuration', () => {
      const error = tunnelingService.validateProviderConfig('serveo', {});
      expect(error).toBeNull();
    });

    test('should reject invalid provider', () => {
      const error = tunnelingService.validateProviderConfig('invalid' as TunnelingProvider, {});
      expect(error).not.toBeNull();
      expect(error?.type).toBe('CONFIGURATION_ERROR');
    });

    test('should require ngrok token for ngrok provider', () => {
      const error = tunnelingService.validateProviderConfig('ngrok', {});
      expect(error).not.toBeNull();
      expect(error?.message).toContain('token');
    });

    test('should accept ngrok configuration with token', () => {
      const error = tunnelingService.validateProviderConfig('ngrok', { token: 'test-token' });
      expect(error).toBeNull();
    });
  });

  describe('Service Management', () => {
    test('should get available services', () => {
      const services = tunnelingService.getAvailableServices();
      expect(services).toBeDefined();
    });

    test('should get service for provider', () => {
      const serveoService = tunnelingService.getService('serveo');
      expect(serveoService).toBeDefined();
    });

    test('should get health status', () => {
      const healthStatus = tunnelingService.getHealthStatus();
      expect(healthStatus).toHaveProperty('serveo');
      expect(healthStatus).toHaveProperty('pinggy');
      expect(healthStatus).toHaveProperty('ngrok');
    });
  });

  describe('Tunnel Creation', () => {
    test('should support legacy createTunnelEnhanced method', async () => {
      // Mock the underlying service to avoid real network calls
      const mockResult = {
        success: true,
        tunnelUrl: 'tcp://test.serveo.net:12345',
        hostname: 'test.serveo.net',
        port: 12345,
        provider: 'serveo',
        parseResult: { success: true },
        commandUsed: 'Managed by TunnelManager',
        outputLog: [],
        errorLog: []
      };

      // This is a basic test to ensure the method exists and returns expected structure
      const result = await tunnelingService.createTunnelEnhanced('serveo', { targetPort: 3389 }, 1);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('provider');
      expect(result).toHaveProperty('parseResult');
      expect(result).toHaveProperty('commandUsed');
      expect(result).toHaveProperty('outputLog');
      expect(result).toHaveProperty('errorLog');
    });
  });

  describe('Process Management', () => {
    test('should handle process logs', () => {
      const logs = tunnelingService.getProcessLogs('test-session');
      expect(Array.isArray(logs)).toBe(true);
    });

    test('should cleanup all processes', () => {
      // Should not throw
      expect(() => {
        tunnelingService.cleanupAllProcesses();
      }).not.toThrow();
    });
  });

  describe('Connectivity Testing', () => {
    test('should test connectivity for all services', async () => {
      const results = await tunnelingService.testAllConnectivity();

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
describe('TunnelingService Browser Environment', () => {
  beforeEach(() => {
    // Mock browser environment
    Object.defineProperty(window, 'location', {
      value: { href: 'https://test.com' },
      writable: true
    });
  });

  test('should work in browser environment', () => {
    const service = TunnelingService.getInstance();
    expect(service).toBeDefined();
    expect(service.getBestProvider()).toBe('serveo');
  });
});

// Performance tests
describe('TunnelingService Performance', () => {
  test('should validate configurations quickly', () => {
    const start = performance.now();
    const service = TunnelingService.getInstance();

    for (let i = 0; i < 1000; i++) {
      service.validateProviderConfig('serveo', {});
    }

    const end = performance.now();
    expect(end - start).toBeLessThan(100); // Should complete in under 100ms
  });
});
