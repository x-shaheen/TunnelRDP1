/**
 * Production-Ready API Service
 * Handles all API interactions with comprehensive error handling, validation, and logging
 */

import { Octokit } from '@octokit/rest';
import { TunnelingProvider, DeploymentConfig, WorkflowStatus, TunnelError, TunnelErrorType } from '@/types/tunneling';
import { generateWorkflowContent, validateDeploymentConfig } from '@/utils/workflow-templates';
import { TunnelingService } from './TunnelingService';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: any;
  timestamp: number;
}

export interface DeploymentResult {
  repositoryUrl: string;
  workflowUrl: string;
  repositoryName: string;
  status: WorkflowStatus;
}

export class ApiService {
  private static instance: ApiService;
  private octokit: Octokit | null = null;
  private requestCount: Map<string, number> = new Map();
  private lastRequestTime: Map<string, number> = new Map();

  private constructor() {}

  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  /**
   * Initialize the API service with authentication
   */
  public initialize(accessToken: string): void {
    this.octokit = new Octokit({
      auth: accessToken,
      userAgent: 'RDP-Automation-v2.0',
      timeZone: 'UTC',
      request: {
        timeout: 30000, // 30 second timeout
        retries: 3
      }
    });
  }

  /**
   * Rate limiting check
   */
  private checkRateLimit(endpoint: string): boolean {
    const now = Date.now();
    const key = endpoint;
    
    // Reset counter every minute
    const lastRequest = this.lastRequestTime.get(key) || 0;
    if (now - lastRequest > 60000) {
      this.requestCount.set(key, 0);
    }
    
    const count = this.requestCount.get(key) || 0;
    if (count >= 30) { // 30 requests per minute limit
      return false;
    }
    
    this.requestCount.set(key, count + 1);
    this.lastRequestTime.set(key, now);
    return true;
  }

  /**
   * Enhanced error handling wrapper
   */
  private async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    operationName: string,
    retries: number = 3
  ): Promise<ApiResponse<T>> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        if (!this.checkRateLimit(operationName)) {
          return {
            success: false,
            error: 'Rate limit exceeded. Please wait before retrying.',
            timestamp: Date.now()
          };
        }

        const result = await operation();
        return {
          success: true,
          data: result,
          timestamp: Date.now()
        };
      } catch (error: any) {
        lastError = error;
        
        // Log the error
        console.error(`${operationName} attempt ${attempt} failed:`, error);
        
        // Check if error is retryable
        if (this.isRetryableError(error) && attempt < retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        break;
      }
    }

    return {
      success: false,
      error: this.formatError(lastError),
      details: lastError,
      timestamp: Date.now()
    };
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (error.status) {
      // Retry on server errors and rate limits
      return error.status >= 500 || error.status === 429;
    }
    
    // Retry on network errors
    return error.code === 'ECONNRESET' || 
           error.code === 'ETIMEDOUT' || 
           error.message?.includes('timeout');
  }

  /**
   * Format error messages for user consumption
   */
  private formatError(error: any): string {
    if (error.status === 401) {
      return 'Authentication failed. Please check your GitHub token.';
    }
    if (error.status === 403) {
      return 'Permission denied. Please check repository permissions.';
    }
    if (error.status === 404) {
      return 'Resource not found. Please verify the repository exists.';
    }
    if (error.status === 422) {
      return 'Invalid request data. Please check your configuration.';
    }
    if (error.status === 429) {
      return 'Rate limit exceeded. Please wait before retrying.';
    }
    if (error.status >= 500) {
      return 'GitHub service temporarily unavailable. Please try again later.';
    }
    
    return error.message || 'An unexpected error occurred.';
  }

  /**
   * Deploy RDP automation with comprehensive error handling
   */
  public async deployRDP(config: DeploymentConfig): Promise<ApiResponse<DeploymentResult>> {
    if (!this.octokit) {
      return {
        success: false,
        error: 'API service not initialized. Please authenticate first.',
        timestamp: Date.now()
      };
    }

    // Validate configuration
    const validationErrors = validateDeploymentConfig(config);
    if (validationErrors.length > 0) {
      return {
        success: false,
        error: `Configuration validation failed: ${validationErrors.join(', ')}`,
        timestamp: Date.now()
      };
    }

    return this.executeWithErrorHandling(async () => {
      // Step 1: Create repository
      const repoResult = await this.createRepository(config);
      if (!repoResult.success) {
        throw new Error(`Repository creation failed: ${repoResult.error}`);
      }

      // Step 2: Create workflow file
      const workflowResult = await this.createWorkflowFile(config);
      if (!workflowResult.success) {
        throw new Error(`Workflow creation failed: ${workflowResult.error}`);
      }

      // Step 3: Set up secrets (if needed)
      if (config.provider === 'ngrok' && config.ngrokToken) {
        const secretResult = await this.createSecret(config, 'NGROK_AUTH_TOKEN', config.ngrokToken);
        if (!secretResult.success) {
          throw new Error(`Secret creation failed: ${secretResult.error}`);
        }
      }

      if (config.provider === 'tailscale' && config.tailscaleAuthKey) {
        const secretResult = await this.createSecret(config, 'TAILSCALE_AUTH_KEY', config.tailscaleAuthKey);
        if (!secretResult.success) {
          throw new Error(`Tailscale secret creation failed: ${secretResult.error}`);
        }
      }

      if (config.provider === 'localexpose' && config.localexposeToken) {
        const secretResult = await this.createSecret(config, 'LOCLX_ACCESS_TOKEN', config.localexposeToken);
        if (!secretResult.success) {
          throw new Error(`LocalExpose secret creation failed: ${secretResult.error}`);
        }
      }

      // Step 4: Trigger workflow
      const triggerResult = await this.triggerWorkflow(config);
      if (!triggerResult.success) {
        throw new Error(`Workflow trigger failed: ${triggerResult.error}`);
      }

      const repositoryUrl = `https://github.com/${config.selectedAccount.login}/${config.repositoryName}`;
      const workflowUrl = `${repositoryUrl}/actions`;

      return {
        repositoryUrl,
        workflowUrl,
        repositoryName: config.repositoryName,
        status: {
          status: 'deploying',
          message: 'Deployment initiated successfully',
          repositoryUrl,
          startTime: Date.now()
        }
      };
    }, 'deployRDP');
  }

  /**
   * Create GitHub repository
   */
  private async createRepository(config: DeploymentConfig): Promise<ApiResponse<any>> {
    return this.executeWithErrorHandling(async () => {
      const createParams: any = {
        name: config.repositoryName,
        description: `RDP Server Automation using ${config.provider} tunneling`,
        private: false,
        auto_init: true,
        has_issues: false,
        has_projects: false,
        has_wiki: false
      };

      // Create in organization if specified
      if (config.deploymentTarget === 'organization') {
        createParams.org = config.selectedAccount.login;
        return await this.octokit!.rest.repos.createInOrg(createParams);
      } else {
        return await this.octokit!.rest.repos.createForAuthenticatedUser(createParams);
      }
    }, 'createRepository');
  }

  /**
   * Create workflow file
   */
  private async createWorkflowFile(config: DeploymentConfig): Promise<ApiResponse<any>> {
    return this.executeWithErrorHandling(async () => {
      const workflowContent = generateWorkflowContent(
        config.provider,
        config.customSubdomain,
        config.enableAutoFailover,
        config.ngrokToken,
        config.localexposeToken,
        config.tailscaleAuthKey,
        config.cloudflareSetup,
        config.sessionDuration || 355,
        config.keepAliveInterval || 10
      );

      const owner = config.selectedAccount.login;
      const repo = config.repositoryName;

      return await this.octokit!.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: '.github/workflows/rdp-deployment.yml',
        message: `Add RDP deployment workflow for ${config.provider}`,
        content: Buffer.from(workflowContent).toString('base64'),
        committer: {
          name: 'RDP Automation',
          email: 'automation@rdp-deploy.com'
        },
        author: {
          name: 'RDP Automation',
          email: 'automation@rdp-deploy.com'
        }
      });
    }, 'createWorkflowFile');
  }

  /**
   * Create repository secret
   */
  private async createSecret(config: DeploymentConfig, name: string, value: string): Promise<ApiResponse<any>> {
    return this.executeWithErrorHandling(async () => {
      const owner = config.selectedAccount.login;
      const repo = config.repositoryName;

      // Get repository public key for encryption
      const { data: publicKey } = await this.octokit!.rest.actions.getRepoPublicKey({
        owner,
        repo
      });

      // Encrypt the secret value
      const sodium = await import('libsodium-wrappers');
      await sodium.ready;
      
      const messageBytes = sodium.from_string(value);
      const keyBytes = sodium.from_base64(publicKey.key, sodium.base64_variants.ORIGINAL);
      const encryptedBytes = sodium.crypto_box_seal(messageBytes, keyBytes);
      const encrypted = sodium.to_base64(encryptedBytes, sodium.base64_variants.ORIGINAL);

      return await this.octokit!.rest.actions.createOrUpdateRepoSecret({
        owner,
        repo,
        secret_name: name,
        encrypted_value: encrypted,
        key_id: publicKey.key_id
      });
    }, 'createSecret');
  }

  /**
   * Trigger workflow
   */
  private async triggerWorkflow(config: DeploymentConfig): Promise<ApiResponse<any>> {
    return this.executeWithErrorHandling(async () => {
      const owner = config.selectedAccount.login;
      const repo = config.repositoryName;

      // Add delay to ensure workflow file is fully available
      console.log('Waiting 3 seconds for workflow file to be available...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      console.log(`Triggering workflow for ${owner}/${repo}`);
      const result = await this.octokit!.rest.actions.createWorkflowDispatch({
        owner,
        repo,
        workflow_id: 'rdp-deployment.yml',
        ref: 'main'
      });

      console.log('Workflow dispatch result:', result.status);
      return result;
    }, 'triggerWorkflow', 5); // More retries for workflow trigger
  }

  /**
   * Get workflow status
   */
  public async getWorkflowStatus(owner: string, repo: string): Promise<ApiResponse<WorkflowStatus>> {
    if (!this.octokit) {
      return {
        success: false,
        error: 'API service not initialized',
        timestamp: Date.now()
      };
    }

    return this.executeWithErrorHandling(async () => {
      // Get latest workflow run
      const { data: runs } = await this.octokit!.rest.actions.listWorkflowRuns({
        owner,
        repo,
        workflow_id: 'rdp-deployment.yml',
        per_page: 1
      });

      if (runs.workflow_runs.length === 0) {
        return {
          status: 'idle' as const,
          message: 'No workflow runs found'
        };
      }

      const run = runs.workflow_runs[0];
      const status = this.mapWorkflowStatus(run.status, run.conclusion);

      // Try to get connection details if workflow completed OR if it's running but connection details might be available
      let connectionDetails;
      if (status.status === 'completed' || status.status === 'deploying') {
        console.log(`Attempting to get connection details for ${owner}/${repo}, workflow status: ${status.status}`);

        const detailsResult = await this.getConnectionDetails(owner, repo);
        if (detailsResult.success) {
          connectionDetails = detailsResult.data;
          console.log('Connection details retrieved:', connectionDetails);

          // Enhanced logic for Tailscale and other providers
          // If we have valid connection details and workflow is still running,
          // it means RDP server is ready (in Keep Alive phase)
          if (status.status === 'deploying' && connectionDetails) {
            // Check if connection details are valid (not placeholder values)
            const hasValidHost = connectionDetails.host &&
                                connectionDetails.host !== 'Check workflow logs for tunnel URL' &&
                                connectionDetails.host !== 'Check workflow logs' &&
                                !connectionDetails.host.includes('Check workflow logs');

            if (hasValidHost) {
              console.log('Workflow still running but valid connection details available - marking as completed');
              status.status = 'completed';

              // Provide provider-specific success messages
              if (connectionDetails.provider === 'tailscale') {
                status.message = 'Tailscale VPN is ready! RDP server accessible via mesh network.';
              } else {
                status.message = 'RDP server is ready and accessible';
              }
            }
          }
        } else {
          console.log('Failed to get connection details:', detailsResult.error);
        }
      }

      return {
        ...status,
        repositoryUrl: `https://github.com/${owner}/${repo}`,
        startTime: new Date(run.created_at).getTime(),
        connectionDetails
      };
    }, 'getWorkflowStatus');
  }

  /**
   * Map GitHub workflow status to our status
   */
  private mapWorkflowStatus(status: string | null, conclusion: string | null): Pick<WorkflowStatus, 'status' | 'message'> {
    // Handle null status
    if (!status) {
      return { status: 'error', message: 'Unknown workflow status' };
    }

    if (status === 'completed') {
      if (conclusion === 'success') {
        return { status: 'completed', message: 'RDP server deployed successfully' };
      } else if (conclusion === 'failure') {
        return { status: 'error', message: 'Deployment failed. Check workflow logs for details.' };
      } else if (conclusion === 'cancelled') {
        return { status: 'error', message: 'Deployment was cancelled' };
      }
    }
    
    if (status === 'in_progress') {
      return { status: 'deploying', message: 'Deployment in progress...' };
    }
    
    if (status === 'queued') {
      return { status: 'deploying', message: 'Deployment queued...' };
    }

    return { status: 'error', message: `Unknown status: ${status}` };
  }

  /**
   * Get connection details from repository
   */
  private async getConnectionDetails(owner: string, repo: string): Promise<ApiResponse<any>> {
    return this.executeWithErrorHandling(async () => {
      try {
        const { data } = await this.octokit!.rest.repos.getContent({
          owner,
          repo,
          path: 'connection-details.json'
        });

        if ('content' in data) {
          const content = Buffer.from(data.content, 'base64').toString();
          console.log('Raw connection details content:', content);
          const parsed = JSON.parse(content);
          console.log('Parsed connection details:', parsed);

          // Enhanced parsing for different providers
          if (parsed) {
            // Handle Tailscale format
            if (parsed.provider === 'tailscale' && parsed.tailscaleIP) {
              return {
                host: parsed.tailscaleIP.replace(/\s+/g, ''), // Remove any whitespace
                port: '3389',
                username: parsed.username || 'runneradmin',
                password: parsed.password || 'P@ssw0rd!',
                provider: 'tailscale',
                connectionString: `${parsed.tailscaleIP.replace(/\s+/g, '')}:3389`,
                establishedAt: Date.now()
              };
            }

            // Handle tunnel URL format (ngrok, localexpose, etc.)
            if (parsed.tunnelUrl) {
              const url = new URL(parsed.tunnelUrl.replace('tcp://', 'http://'));
              return {
                host: url.hostname,
                port: url.port || '3389',
                username: parsed.username || 'runneradmin',
                password: parsed.password || 'P@ssw0rd!',
                provider: parsed.provider,
                connectionString: `${url.hostname}:${url.port || '3389'}`,
                establishedAt: Date.now()
              };
            }

            // Return as-is if already in correct format
            return parsed;
          }

          return parsed;
        }

        throw new Error('Connection details file not found');
      } catch (error: any) {
        if (error.status === 404) {
          throw new Error('Connection details not yet available');
        }
        throw error;
      }
    }, 'getConnectionDetails');
  }
}
