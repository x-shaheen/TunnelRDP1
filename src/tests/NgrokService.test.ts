/**
 * Test Suite for NgrokService
 * Tests Ngrok-specific functionality in isolation
 */

import { NgrokService } from '@/services/providers/NgrokService';

describe('NgrokService', () => {
  let ngrokService: NgrokService;

  beforeEach(() => {
    ngrokService = new NgrokService();
  });

  describe('Configuration', () => {
    test('should have correct provider configuration', () => {
      const config = ngrokService.getConfig();
      expect(config.provider).toBe('ngrok');
      expect(config.requiresAuth).toBe(true);
      expect(config.requiresInstallation).toBe(true);
      expect(config.supportsTCP).toBe(true);
      expect(config.isFree).toBe(false);
      expect(config.priority).toBe(3);
    });

    test('should require authentication', () => {
      expect(ngrokService.requiresAuth()).toBe(true);
    });

    test('should support TCP', () => {
      expect(ngrokService.supportsTCP()).toBe(true);
    });

    test('should not be free', () => {
      expect(ngrokService.isFree()).toBe(false);
    });
  });

  describe('Options Validation', () => {
    test('should require token', () => {
      const validation = ngrokService.validateOptions({});
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Ngrok requires an authentication token');
    });

    test('should accept valid token', () => {
      const validation = ngrokService.validateOptions({ token: 'test-token' });
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should validate port range', () => {
      const validation = ngrokService.validateOptions({ 
        token: 'test-token',
        targetPort: 70000 
      });
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Target port must be between 1 and 65535');
    });

    test('should validate timeout', () => {
      const validation = ngrokService.validateOptions({ 
        token: 'test-token',
        timeout: 500 
      });
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Timeout must be at least 1000ms');
    });

    test('should accept valid configuration', () => {
      const validation = ngrokService.validateOptions({
        token: 'test-token',
        targetPort: 3389,
        timeout: 30000,
        subdomain: 'myapp'
      });
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('Command Building', () => {
    test('should build basic ngrok command', () => {
      const command = ngrokService.buildCommand({ token: 'test-token' });
      
      expect(command.command).toBe('ngrok');
      expect(command.args).toContain('tcp');
      expect(command.args).toContain('3389'); // Default port
      expect(command.environment?.NGROK_AUTHTOKEN).toBe('test-token');
    });

    test('should build command with custom port', () => {
      const command = ngrokService.buildCommand({ 
        token: 'test-token',
        targetPort: 5000 
      });
      
      expect(command.args).toContain('5000');
    });

    test('should build command with subdomain', () => {
      const command = ngrokService.buildCommand({ 
        token: 'test-token',
        subdomain: 'myapp' 
      });
      
      expect(command.args).toContain('--subdomain');
      expect(command.args).toContain('myapp');
    });
  });

  describe('Health Status', () => {
    test('should start with healthy status', () => {
      const health = ngrokService.getHealthStatus();
      expect(health.isHealthy).toBe(true);
      expect(health.consecutiveFailures).toBe(0);
    });

    test('should be available initially', () => {
      expect(ngrokService.isAvailable()).toBe(true);
    });
  });

  describe('Installation Check', () => {
    test('should check ngrok installation', async () => {
      const result = await ngrokService.checkInstallation();
      
      expect(result).toHaveProperty('installed');
      expect(typeof result.installed).toBe('boolean');
      
      if (result.installed) {
        expect(result).toHaveProperty('version');
      } else {
        expect(result).toHaveProperty('error');
      }
    });
  });

  describe('Tunnel Creation', () => {
    test('should fail without token', async () => {
      const result = await ngrokService.createTunnel({});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid options');
      expect(result.provider).toBe('ngrok');
    });

    test('should attempt tunnel creation with valid token', async () => {
      // This test will likely fail in CI/test environment since ngrok isn't installed
      // But it should at least validate the options and attempt to start the process
      const result = await ngrokService.createTunnel({ 
        token: 'test-token',
        timeout: 5000 // Short timeout for testing
      });
      
      expect(result.provider).toBe('ngrok');
      // Result can be success or failure depending on ngrok availability
      expect(typeof result.success).toBe('boolean');
      
      if (!result.success) {
        // Should have a meaningful error message
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
      }
    });
  });

  describe('Session Management', () => {
    test('should handle session logs', () => {
      const sessionId = 'test-session';
      const logs = ngrokService.getSessionLogs(sessionId);
      
      expect(Array.isArray(logs)).toBe(true);
      expect(logs).toHaveLength(0); // No logs initially
    });

    test('should cleanup processes', () => {
      // Should not throw
      expect(() => {
        ngrokService.cleanupAllProcesses();
      }).not.toThrow();
    });
  });

  describe('Provider Information', () => {
    test('should return correct provider name', () => {
      expect(ngrokService.getProviderName()).toBe('ngrok');
    });

    test('should return correct priority', () => {
      expect(ngrokService.getPriority()).toBe(3);
    });

    test('should return fallback providers', () => {
      const fallbacks = ngrokService.getFallbackProviders();
      expect(Array.isArray(fallbacks)).toBe(true);
      expect(fallbacks).toHaveLength(0); // Ngrok has no fallbacks
    });
  });
});

// Integration tests (these may fail in CI without ngrok installed)
describe('NgrokService Integration', () => {
  let ngrokService: NgrokService;

  beforeEach(() => {
    ngrokService = new NgrokService();
  });

  test('should handle real installation check gracefully', async () => {
    const result = await ngrokService.checkInstallation();
    
    // Should always return a result, even if ngrok is not installed
    expect(result).toBeDefined();
    expect(typeof result.installed).toBe('boolean');
    
    if (!result.installed) {
      expect(result.error).toBeDefined();
    }
  });
});

// Mock tests for specific scenarios
describe('NgrokService Mocked Scenarios', () => {
  let ngrokService: NgrokService;

  beforeEach(() => {
    ngrokService = new NgrokService();
  });

  test('should handle process spawn errors', async () => {
    // Mock spawn to throw an error
    const originalSpawn = require('child_process').spawn;
    require('child_process').spawn = jest.fn().mockImplementation(() => {
      throw new Error('Spawn failed');
    });

    const result = await ngrokService.createTunnel({ 
      token: 'test-token',
      timeout: 1000 
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Spawn failed');

    // Restore original spawn
    require('child_process').spawn = originalSpawn;
  });
});
