/**
 * Test Suite for ServeoService
 * Tests Serveo-specific functionality in isolation
 */

import { ServeoService } from '@/services/providers/ServeoService';

describe('ServeoService', () => {
  let serveoService: ServeoService;

  beforeEach(() => {
    serveoService = new ServeoService();
  });

  describe('Configuration', () => {
    test('should have correct provider configuration', () => {
      const config = serveoService.getConfig();
      expect(config.provider).toBe('serveo');
      expect(config.requiresAuth).toBe(false);
      expect(config.requiresInstallation).toBe(false);
      expect(config.supportsTCP).toBe(true);
      expect(config.supportsUDP).toBe(false);
      expect(config.isFree).toBe(true);
      expect(config.priority).toBe(1);
    });

    test('should not require authentication', () => {
      expect(serveoService.requiresAuth()).toBe(false);
    });

    test('should support TCP', () => {
      expect(serveoService.supportsTCP()).toBe(true);
    });

    test('should be free', () => {
      expect(serveoService.isFree()).toBe(true);
    });
  });

  describe('Options Validation', () => {
    test('should accept empty options', () => {
      const validation = serveoService.validateOptions({});
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should validate port range', () => {
      const validation = serveoService.validateOptions({ targetPort: 70000 });
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Target port must be between 1 and 65535');
    });

    test('should validate timeout', () => {
      const validation = serveoService.validateOptions({ timeout: 500 });
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Timeout must be at least 1000ms');
    });

    test('should validate subdomain format', () => {
      const validation = serveoService.validateOptions({ subdomain: 'invalid@subdomain' });
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Subdomain must contain only alphanumeric characters and hyphens');
    });

    test('should accept valid configuration', () => {
      const validation = serveoService.validateOptions({
        targetPort: 3389,
        timeout: 30000,
        subdomain: 'myapp-test'
      });
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('Command Building', () => {
    test('should build basic serveo command', () => {
      const command = serveoService.buildCommand({});
      
      expect(command.command).toBe('ssh');
      expect(command.args).toContain('-o');
      expect(command.args).toContain('StrictHostKeyChecking=no');
      expect(command.args).toContain('-R');
      expect(command.args).toContain('0:localhost:3389');
      expect(command.args).toContain('serveo.net');
    });

    test('should build command with custom port', () => {
      const command = serveoService.buildCommand({ targetPort: 5000 });
      
      expect(command.args).toContain('0:localhost:5000');
    });

    test('should build command with subdomain', () => {
      const command = serveoService.buildCommand({ subdomain: 'myapp' });
      
      expect(command.args).toContain('myapp:3389:localhost:3389');
    });

    test('should build command with custom host', () => {
      const command = serveoService.buildCommand({ 
        targetHost: '192.168.1.100',
        targetPort: 3389 
      });
      
      expect(command.args).toContain('0:192.168.1.100:3389');
    });
  });

  describe('Health Status', () => {
    test('should start with healthy status', () => {
      const health = serveoService.getHealthStatus();
      expect(health.isHealthy).toBe(true);
      expect(health.consecutiveFailures).toBe(0);
    });

    test('should be available initially', () => {
      expect(serveoService.isAvailable()).toBe(true);
    });
  });

  describe('Connectivity Testing', () => {
    test('should test connectivity to serveo', async () => {
      const result = await serveoService.testConnectivity();
      
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
      
      if (result.success) {
        expect(result).toHaveProperty('responseTime');
        expect(typeof result.responseTime).toBe('number');
      } else {
        expect(result).toHaveProperty('error');
        expect(typeof result.error).toBe('string');
      }
    }, 20000); // Increase timeout for network operations
  });

  describe('Subdomain Management', () => {
    test('should check subdomain availability', async () => {
      const result = await serveoService.checkSubdomainAvailability('test-app');
      
      expect(result).toHaveProperty('available');
      expect(typeof result.available).toBe('boolean');
    });

    test('should reject invalid subdomain format', async () => {
      const result = await serveoService.checkSubdomainAvailability('invalid@subdomain');
      
      expect(result.available).toBe(false);
      expect(result.error).toContain('Invalid subdomain format');
    });

    test('should generate recommended subdomains', () => {
      const recommendations = serveoService.getRecommendedSubdomains('myapp');
      
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations).toContain('myapp');
      
      // All recommendations should be valid
      recommendations.forEach(subdomain => {
        expect(subdomain.length).toBeGreaterThanOrEqual(3);
        expect(subdomain.length).toBeLessThanOrEqual(20);
        expect(/^[a-zA-Z0-9\-]+$/.test(subdomain)).toBe(true);
      });
    });

    test('should sanitize subdomain base names', () => {
      const recommendations = serveoService.getRecommendedSubdomains('My App! @#$');
      
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);
      
      // Should contain sanitized version
      expect(recommendations.some(sub => sub.includes('myapp'))).toBe(true);
    });
  });

  describe('Tunnel Creation', () => {
    test('should attempt tunnel creation with default options', async () => {
      // This test will likely fail in CI/test environment due to network restrictions
      // But it should at least validate the options and attempt to start the process
      const result = await serveoService.createTunnel({ 
        timeout: 5000 // Short timeout for testing
      });
      
      expect(result.provider).toBe('serveo');
      expect(typeof result.success).toBe('boolean');
      
      if (!result.success) {
        // Should have a meaningful error message
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
      }
    });

    test('should fail with invalid port', async () => {
      const result = await serveoService.createTunnel({ targetPort: 70000 });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid options');
      expect(result.provider).toBe('serveo');
    });

    test('should attempt tunnel creation with subdomain', async () => {
      const result = await serveoService.createTunnel({ 
        subdomain: 'test-app',
        timeout: 5000
      });
      
      expect(result.provider).toBe('serveo');
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('Session Management', () => {
    test('should handle session logs', () => {
      const sessionId = 'test-session';
      const logs = serveoService.getSessionLogs(sessionId);
      
      expect(Array.isArray(logs)).toBe(true);
      expect(logs).toHaveLength(0); // No logs initially
    });

    test('should cleanup processes', () => {
      // Should not throw
      expect(() => {
        serveoService.cleanupAllProcesses();
      }).not.toThrow();
    });
  });

  describe('Provider Information', () => {
    test('should return correct provider name', () => {
      expect(serveoService.getProviderName()).toBe('serveo');
    });

    test('should return correct priority', () => {
      expect(serveoService.getPriority()).toBe(1);
    });

    test('should return fallback providers', () => {
      const fallbacks = serveoService.getFallbackProviders();
      expect(Array.isArray(fallbacks)).toBe(true);
      expect(fallbacks).toContain('pinggy');
    });
  });
});

// Integration tests (these may fail in CI without network access)
describe('ServeoService Integration', () => {
  let serveoService: ServeoService;

  beforeEach(() => {
    serveoService = new ServeoService();
  });

  test('should handle real connectivity test gracefully', async () => {
    const result = await serveoService.testConnectivity();
    
    // Should always return a result, even if connectivity fails
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
    
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  }, 25000);
});

// Mock tests for specific scenarios
describe('ServeoService Mocked Scenarios', () => {
  let serveoService: ServeoService;

  beforeEach(() => {
    serveoService = new ServeoService();
  });

  test('should handle process spawn errors', async () => {
    // Mock spawn to throw an error
    const originalSpawn = require('child_process').spawn;
    require('child_process').spawn = jest.fn().mockImplementation(() => {
      throw new Error('Spawn failed');
    });

    const result = await serveoService.createTunnel({ timeout: 1000 });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Spawn failed');

    // Restore original spawn
    require('child_process').spawn = originalSpawn;
  });

  test('should handle multiple connection strategies', async () => {
    // Mock spawn to simulate different failure scenarios
    let callCount = 0;
    const originalSpawn = require('child_process').spawn;
    
    require('child_process').spawn = jest.fn().mockImplementation(() => {
      callCount++;
      const mockProcess = {
        pid: 12345,
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'exit') {
            setTimeout(() => callback(1), 100); // Simulate quick failure
          }
        }),
        kill: jest.fn()
      };
      return mockProcess;
    });

    const result = await serveoService.createTunnel({ timeout: 2000 });

    // Should have tried multiple strategies
    expect(callCount).toBeGreaterThan(1);
    expect(result.success).toBe(false);
    expect(result.error).toContain('strategies failed');

    // Restore original spawn
    require('child_process').spawn = originalSpawn;
  });
});
