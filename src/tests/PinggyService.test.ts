/**
 * Test Suite for PinggyService
 * Tests Pinggy-specific functionality in isolation
 */

import { PinggyService } from '@/services/providers/PinggyService';

describe('PinggyService', () => {
  let pinggyService: PinggyService;

  beforeEach(() => {
    pinggyService = new PinggyService();
  });

  describe('Configuration', () => {
    test('should have correct provider configuration', () => {
      const config = pinggyService.getConfig();
      expect(config.provider).toBe('pinggy');
      expect(config.requiresAuth).toBe(false);
      expect(config.requiresInstallation).toBe(false);
      expect(config.supportsTCP).toBe(true);
      expect(config.supportsUDP).toBe(true);
      expect(config.isFree).toBe(true);
      expect(config.priority).toBe(2);
    });

    test('should not require authentication by default', () => {
      expect(pinggyService.requiresAuth()).toBe(false);
    });

    test('should support TCP', () => {
      expect(pinggyService.supportsTCP()).toBe(true);
    });

    test('should be free', () => {
      expect(pinggyService.isFree()).toBe(true);
    });
  });

  describe('Options Validation', () => {
    test('should accept empty options', () => {
      const validation = pinggyService.validateOptions({});
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should validate port range', () => {
      const validation = pinggyService.validateOptions({ targetPort: 70000 });
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Target port must be between 1 and 65535');
    });

    test('should validate timeout', () => {
      const validation = pinggyService.validateOptions({ timeout: 500 });
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Timeout must be at least 1000ms');
    });

    test('should validate subdomain format', () => {
      const validation = pinggyService.validateOptions({ subdomain: 'invalid@subdomain' });
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Subdomain must contain only alphanumeric characters and hyphens');
    });

    test('should accept valid configuration', () => {
      const validation = pinggyService.validateOptions({
        targetPort: 3389,
        timeout: 30000,
        subdomain: 'myapp-test',
        token: 'user@host.pinggy.io'
      });
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('Command Building', () => {
    test('should build basic pinggy command', () => {
      const command = pinggyService.buildCommand({});
      
      expect(command.command).toBe('ssh');
      expect(command.args).toContain('-p');
      expect(command.args).toContain('443');
      expect(command.args).toContain('-R');
      expect(command.args).toContain('0:localhost:3389');
      expect(command.args).toContain('tcp@a.pinggy.io');
    });

    test('should build command with custom port', () => {
      const command = pinggyService.buildCommand({ targetPort: 5000 });
      
      expect(command.args).toContain('0:localhost:5000');
    });

    test('should build command with token', () => {
      const command = pinggyService.buildCommand({ token: 'user@host.pinggy.io' });
      
      expect(command.args).toContain('user@host.pinggy.io');
    });

    test('should build command with subdomain', () => {
      const command = pinggyService.buildCommand({ subdomain: 'myapp' });
      
      expect(command.args).toContain('myapp:3389:localhost:3389');
    });
  });

  describe('Health Status', () => {
    test('should start with healthy status', () => {
      const health = pinggyService.getHealthStatus();
      expect(health.isHealthy).toBe(true);
      expect(health.consecutiveFailures).toBe(0);
    });

    test('should be available initially', () => {
      expect(pinggyService.isAvailable()).toBe(true);
    });
  });

  describe('Connectivity Testing', () => {
    test('should test connectivity to pinggy servers', async () => {
      const result = await pinggyService.testConnectivity();
      
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
      
      if (result.success) {
        expect(result).toHaveProperty('host');
        expect(typeof result.host).toBe('string');
      } else {
        expect(result).toHaveProperty('error');
        expect(typeof result.error).toBe('string');
      }
    }, 15000); // Increase timeout for network operations
  });

  describe('Tunnel Creation', () => {
    test('should attempt tunnel creation with default options', async () => {
      // This test will likely fail in CI/test environment due to network restrictions
      // But it should at least validate the options and attempt to start the process
      const result = await pinggyService.createTunnel({ 
        timeout: 5000 // Short timeout for testing
      });
      
      expect(result.provider).toBe('pinggy');
      expect(typeof result.success).toBe('boolean');
      
      if (!result.success) {
        // Should have a meaningful error message
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
      }
    });

    test('should fail with invalid port', async () => {
      const result = await pinggyService.createTunnel({ targetPort: 70000 });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid options');
      expect(result.provider).toBe('pinggy');
    });

    test('should attempt tunnel creation with token', async () => {
      const result = await pinggyService.createTunnel({ 
        token: 'test@host.pinggy.io',
        timeout: 5000
      });
      
      expect(result.provider).toBe('pinggy');
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('Session Management', () => {
    test('should handle session logs', () => {
      const sessionId = 'test-session';
      const logs = pinggyService.getSessionLogs(sessionId);
      
      expect(Array.isArray(logs)).toBe(true);
      expect(logs).toHaveLength(0); // No logs initially
    });

    test('should cleanup processes', () => {
      // Should not throw
      expect(() => {
        pinggyService.cleanupAllProcesses();
      }).not.toThrow();
    });
  });

  describe('Provider Information', () => {
    test('should return correct provider name', () => {
      expect(pinggyService.getProviderName()).toBe('pinggy');
    });

    test('should return correct priority', () => {
      expect(pinggyService.getPriority()).toBe(2);
    });

    test('should return fallback providers', () => {
      const fallbacks = pinggyService.getFallbackProviders();
      expect(Array.isArray(fallbacks)).toBe(true);
      expect(fallbacks).toContain('ngrok');
    });
  });
});

// Integration tests (these may fail in CI without network access)
describe('PinggyService Integration', () => {
  let pinggyService: PinggyService;

  beforeEach(() => {
    pinggyService = new PinggyService();
  });

  test('should handle real connectivity test gracefully', async () => {
    const result = await pinggyService.testConnectivity();
    
    // Should always return a result, even if connectivity fails
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
    
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  }, 20000);
});

// Mock tests for specific scenarios
describe('PinggyService Mocked Scenarios', () => {
  let pinggyService: PinggyService;

  beforeEach(() => {
    pinggyService = new PinggyService();
  });

  test('should handle process spawn errors', async () => {
    // Mock spawn to throw an error
    const originalSpawn = require('child_process').spawn;
    require('child_process').spawn = jest.fn().mockImplementation(() => {
      throw new Error('Spawn failed');
    });

    const result = await pinggyService.createTunnel({ timeout: 1000 });

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

    const result = await pinggyService.createTunnel({ timeout: 2000 });

    // Should have tried multiple strategies
    expect(callCount).toBeGreaterThan(1);
    expect(result.success).toBe(false);
    expect(result.error).toContain('strategies failed');

    // Restore original spawn
    require('child_process').spawn = originalSpawn;
  });
});
