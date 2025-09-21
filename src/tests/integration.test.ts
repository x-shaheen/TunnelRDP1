/**
 * Integration Tests for RDP Automation System
 * Tests end-to-end functionality and component interactions
 */

import { TunnelingService } from '@/services/TunnelingService';
import { ApiService } from '@/services/ApiService';
import { LoggingService } from '@/services/LoggingService';
import { generateWorkflowContent, validateDeploymentConfig } from '@/utils/workflow-templates';
import { DeploymentConfig, TunnelingProvider } from '@/types/tunneling';

describe('RDP Automation Integration Tests', () => {
  let tunnelingService: TunnelingService;
  let apiService: ApiService;
  let loggingService: LoggingService;
  let mockConfig: DeploymentConfig;

  beforeEach(() => {
    tunnelingService = TunnelingService.getInstance();
    apiService = ApiService.getInstance();
    loggingService = LoggingService.getInstance();
    
    mockConfig = {
      provider: 'serveo' as TunnelingProvider,
      repositoryName: 'integration-test-repo',
      selectedAccount: {
        id: 123,
        login: 'testuser',
        name: 'Test User',
        description: 'Integration Test Account',
        avatar_url: 'https://test.com/avatar.jpg',
        type: 'user',
        permissions: {
          admin: true,
          push: true,
          pull: true
        }
      },
      deploymentTarget: 'personal',
      enableAutoFailover: true,
      maxRetryAttempts: 3,
      timeoutMinutes: 90
    };
  });

  describe('Service Integration', () => {
    test('should integrate tunneling service with workflow generation', () => {
      // Get best provider from tunneling service
      const bestProvider = tunnelingService.getBestProvider();
      expect(bestProvider).toBe('serveo');

      // Generate workflow using the provider
      const workflowContent = generateWorkflowContent(bestProvider);
      expect(workflowContent).toContain('SERVEO TUNNEL SETUP');
      expect(workflowContent).toContain('RDP Server Deployment (Production)');
    });

    test('should validate configuration across services', () => {
      // Validate using tunneling service
      const tunnelingError = tunnelingService.validateProviderConfig(mockConfig.provider, mockConfig);
      expect(tunnelingError).toBeNull();

      // Validate using workflow templates
      const validationErrors = validateDeploymentConfig(mockConfig);
      expect(validationErrors).toHaveLength(0);
    });

    test('should handle provider failover integration', () => {
      // Get primary provider and its fallbacks
      const primaryProvider = tunnelingService.getBestProvider();
      const fallbacks = tunnelingService.getFallbackProviders(primaryProvider);
      
      // Generate workflow with failover
      const workflowSteps = tunnelingService.generateProviderWorkflowSteps(
        primaryProvider,
        undefined,
        true
      );

      // Should contain failover logic for each fallback
      fallbacks.forEach(fallback => {
        expect(workflowSteps).toContain(fallback);
      });
    });

    test('should integrate logging across all services', () => {
      // Clear logs
      loggingService.clearLogs();

      // Perform operations that should generate logs
      tunnelingService.validateProviderConfig('invalid' as TunnelingProvider, {});
      
      // Check that logs were generated
      const logs = loggingService.getRecentLogs();
      expect(logs.length).toBeGreaterThan(0);
    });
  });

  describe('End-to-End Workflow Generation', () => {
    test('should generate complete serveo workflow with all features', () => {
      const workflow = generateWorkflowContent('serveo', 'myapp', true);
      
      // Should contain all required sections
      expect(workflow).toContain('name: RDP Server Deployment (Production)');
      expect(workflow).toContain('System Information and Prerequisites');
      expect(workflow).toContain('Enhanced RDP Configuration');
      expect(workflow).toContain('SERVEO TUNNEL SETUP');
      expect(workflow).toContain('Keep RDP Server Active');
      
      // Should contain custom subdomain
      expect(workflow).toContain('myapp:3389');
      
      // Should contain failover logic
      expect(workflow).toContain('Failover to Alternative Providers');
      expect(workflow).toContain('pinggy');
      
      // Should be valid PowerShell
      expect(workflow).toContain('echo "');
      expect(workflow).toContain('Start-Sleep');
      expect(workflow).toContain('try {');
      expect(workflow).toContain('} catch {');
    });

    test('should generate complete pinggy workflow', () => {
      const workflow = generateWorkflowContent('pinggy', undefined, true);
      
      expect(workflow).toContain('PINGGY TUNNEL SETUP');
      expect(workflow).toContain('a.pinggy.io');
      expect(workflow).toContain('port 443');
      expect(workflow).toContain('90 seconds'); // Pinggy timeout
    });

    test('should generate complete ngrok workflow', () => {
      const workflow = generateWorkflowContent('ngrok', undefined, false);
      
      expect(workflow).toContain('NGROK SETUP');
      expect(workflow).toContain('Download and Setup Ngrok');
      expect(workflow).toContain('localhost:4040/api/tunnels');
      expect(workflow).toContain('NGROK_AUTH_TOKEN');
    });
  });

  describe('Configuration Validation Integration', () => {
    test('should validate complete deployment configuration', () => {
      const errors = validateDeploymentConfig(mockConfig);
      expect(errors).toHaveLength(0);
    });

    test('should catch all validation errors', () => {
      const invalidConfig: DeploymentConfig = {
        provider: 'ngrok' as TunnelingProvider,
        repositoryName: 'ab', // Too short
        selectedAccount: undefined as any, // Missing
        deploymentTarget: 'personal',
        enableAutoFailover: true,
        maxRetryAttempts: 3,
        timeoutMinutes: 90,
        ngrokToken: undefined // Required for ngrok
      };

      const errors = validateDeploymentConfig(invalidConfig);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(error => error.includes('Repository name'))).toBe(true);
      expect(errors.some(error => error.includes('account'))).toBe(true);
    });

    test('should validate provider-specific requirements', () => {
      // Test ngrok without token
      const ngrokConfig = {
        ...mockConfig,
        provider: 'ngrok' as TunnelingProvider,
        ngrokToken: undefined
      };

      const errors = validateDeploymentConfig(ngrokConfig);
      expect(errors.some(error => error.includes('token'))).toBe(true);

      // Test localhost.run (should fail for TCP)
      const localhostConfig = {
        ...mockConfig,
        provider: 'localhost.run' as TunnelingProvider
      };

      const tunnelingError = tunnelingService.validateProviderConfig('localhost.run', {});
      expect(tunnelingError).not.toBeNull();
      expect(tunnelingError?.message).toContain('TCP');
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle cascading errors gracefully', () => {
      // Start with invalid provider
      const invalidProvider = 'invalid' as TunnelingProvider;
      
      // Should fail validation
      const validationError = tunnelingService.validateProviderConfig(invalidProvider, {});
      expect(validationError).not.toBeNull();
      
      // Should not generate workflow
      expect(() => {
        tunnelingService.generateProviderWorkflowSteps(invalidProvider);
      }).toThrow();
      
      // Should log errors
      const errorLogs = loggingService.getLogsByLevel(3); // ERROR level
      expect(errorLogs.length).toBeGreaterThan(0);
    });

    test('should provide comprehensive error context', () => {
      const error = tunnelingService.validateProviderConfig('localhost.run', {});
      
      expect(error).toHaveProperty('type');
      expect(error).toHaveProperty('message');
      expect(error).toHaveProperty('provider');
      expect(error).toHaveProperty('timestamp');
      expect(error).toHaveProperty('retryable');
      
      expect(error?.provider).toBe('localhost.run');
      expect(error?.retryable).toBe(false);
    });
  });

  describe('Performance Integration', () => {
    test('should handle multiple concurrent operations', async () => {
      const operations = Array(10).fill(null).map((_, index) => {
        return new Promise(resolve => {
          setTimeout(() => {
            const provider = index % 2 === 0 ? 'serveo' : 'pinggy';
            const workflow = generateWorkflowContent(provider as TunnelingProvider);
            resolve(workflow.length > 0);
          }, Math.random() * 100);
        });
      });

      const results = await Promise.all(operations);
      expect(results.every(result => result === true)).toBe(true);
    });

    test('should maintain performance under load', () => {
      const start = performance.now();
      
      // Perform multiple operations
      for (let i = 0; i < 100; i++) {
        const provider = i % 2 === 0 ? 'serveo' : 'pinggy';
        tunnelingService.validateProviderConfig(provider as TunnelingProvider, {});
        generateWorkflowContent(provider as TunnelingProvider);
      }
      
      const end = performance.now();
      expect(end - start).toBeLessThan(2000); // Should complete in under 2 seconds
    });
  });

  describe('Real-world Scenarios', () => {
    test('should handle typical user deployment flow', () => {
      // 1. User selects provider
      const selectedProvider = tunnelingService.getBestProvider();
      expect(selectedProvider).toBe('serveo');

      // 2. System validates configuration
      const config = { ...mockConfig, provider: selectedProvider };
      const validationErrors = validateDeploymentConfig(config);
      expect(validationErrors).toHaveLength(0);

      // 3. System generates workflow
      const workflow = generateWorkflowContent(selectedProvider, 'myapp', true);
      expect(workflow).toContain('myapp:3389');

      // 4. System provides fallback options
      const fallbacks = tunnelingService.getFallbackProviders(selectedProvider);
      expect(fallbacks.length).toBeGreaterThan(0);
    });

    test('should handle provider failure scenario', () => {
      // 1. Primary provider fails
      const excludedProviders = ['serveo'];
      
      // 2. System selects fallback
      const fallbackProvider = tunnelingService.getBestProvider(excludedProviders);
      expect(fallbackProvider).toBe('pinggy');

      // 3. System generates fallback workflow
      const workflow = generateWorkflowContent(fallbackProvider, undefined, true);
      expect(workflow).toContain('PINGGY TUNNEL SETUP');
    });

    test('should handle organization deployment', () => {
      const orgConfig = {
        ...mockConfig,
        deploymentTarget: 'organization' as const,
        selectedAccount: {
          ...mockConfig.selectedAccount,
          type: 'organization' as const
        }
      };

      const validationErrors = validateDeploymentConfig(orgConfig);
      expect(validationErrors).toHaveLength(0);

      const workflow = generateWorkflowContent(orgConfig.provider);
      expect(workflow).toContain('RDP Server Deployment (Production)');
    });
  });

  describe('System Health Integration', () => {
    test('should monitor system health across services', () => {
      // Generate some activity
      loggingService.info('Test info message');
      loggingService.warn('Test warning message');
      loggingService.error('Test error message');

      const metrics = loggingService.getMetrics();
      expect(metrics.totalLogs).toBeGreaterThan(0);
      expect(metrics.errorCount).toBeGreaterThan(0);
      expect(metrics.warningCount).toBeGreaterThan(0);
      expect(metrics.systemHealth).toBeDefined();
    });

    test('should provide comprehensive system status', () => {
      const healthStatus = require('@/utils/workflow-templates').getProviderHealthStatus();
      
      expect(healthStatus).toHaveProperty('serveo');
      expect(healthStatus).toHaveProperty('pinggy');
      expect(healthStatus).toHaveProperty('ngrok');
      expect(healthStatus).toHaveProperty('localhost.run');

      expect(healthStatus.serveo.status).toBe('healthy');
      expect(healthStatus.pinggy.status).toBe('healthy');
      expect(healthStatus['localhost.run'].status).toBe('unsupported');
    });
  });
});
