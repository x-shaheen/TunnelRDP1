import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';
import sodium from 'libsodium-wrappers';
import { TunnelingProvider, DeploymentConfig } from '@/types/tunneling';
import { generateWorkflowContent, validateDeploymentConfig } from '@/utils/workflow-templates';
import { ApiService } from '@/services/ApiService';



interface GitHubAccount {
  id: number;
  login: string;
  name: string;
  description: string;
  avatar_url: string;
  type: 'user' | 'organization';
  permissions: {
    admin: boolean;
    push: boolean;
    pull: boolean;
  };
}

interface RequestBody {
  githubToken: string;
  ngrokToken?: string;
  localexposeToken?: string;
  tailscaleAuthKey?: string;
  cloudflareSetup?: boolean;
  repositoryName: string;
  provider: TunnelingProvider;
  customSubdomain?: string;
  selectedAccount: GitHubAccount;
  deploymentTarget: 'personal' | 'organization';
  sessionDuration?: number;
  keepAliveInterval?: number;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Parse and validate request body
    let body: RequestBody;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON in request body',
          timestamp: Date.now()
        },
        { status: 400 }
      );
    }

    const { githubToken, ngrokToken, repositoryName, provider, customSubdomain, selectedAccount, deploymentTarget } = body;

    console.log('Deploy RDP request received:', {
      hasGithubToken: !!githubToken,
      hasNgrokToken: !!ngrokToken,
      repositoryName,
      provider,
      customSubdomain,
      selectedAccount: selectedAccount?.login,
      deploymentTarget,
      githubTokenLength: githubToken?.length || 0
    });

    // Enhanced validation
    if (!githubToken || !repositoryName || !provider || !selectedAccount) {
      console.log('Missing required fields:', {
        githubToken: !!githubToken,
        repositoryName: !!repositoryName,
        provider: !!provider,
        selectedAccount: !!selectedAccount
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: githubToken, repositoryName, provider, and selectedAccount are required',
          timestamp: Date.now()
        },
        { status: 400 }
      );
    }

    // Validate repository name format
    if (!/^[a-zA-Z0-9._-]+$/.test(repositoryName) || repositoryName.length < 3) {
      return NextResponse.json(
        {
          success: false,
          error: 'Repository name must be at least 3 characters and contain only letters, numbers, dots, hyphens, and underscores',
          timestamp: Date.now()
        },
        { status: 400 }
      );
    }

    // Validate ngrok token if using ngrok provider
    if (provider === 'ngrok' && !ngrokToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Ngrok token is required for ngrok provider',
          timestamp: Date.now()
        },
        { status: 400 }
      );
    }

    // Create deployment configuration
    const deploymentConfig: DeploymentConfig = {
      provider,
      customSubdomain,
      ngrokToken,
      localexposeToken: body.localexposeToken,
      tailscaleAuthKey: body.tailscaleAuthKey,
      cloudflareSetup: body.cloudflareSetup,
      repositoryName,
      selectedAccount,
      deploymentTarget,
      enableAutoFailover: true,
      maxRetryAttempts: 3,
      timeoutMinutes: body.sessionDuration || 360,
      sessionDuration: body.sessionDuration || 355,
      keepAliveInterval: body.keepAliveInterval || 10
    };

    // Validate deployment configuration
    const validationErrors = validateDeploymentConfig(deploymentConfig);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Configuration validation failed: ${validationErrors.join(', ')}`,
          timestamp: Date.now()
        },
        { status: 400 }
      );
    }

    // Initialize API service
    const apiService = ApiService.getInstance();
    apiService.initialize(githubToken);

    // Deploy using the enhanced API service
    const deploymentResult = await apiService.deployRDP(deploymentConfig);

    if (!deploymentResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: deploymentResult.error,
          details: deploymentResult.details,
          timestamp: deploymentResult.timestamp
        },
        { status: 500 }
      );
    }

    // Calculate deployment time
    const deploymentTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      data: deploymentResult.data,
      deploymentTime,
      timestamp: Date.now(),
      message: 'RDP deployment initiated successfully'
    });

  } catch (error: any) {
    console.error('Deployment error:', error);

    // Enhanced error handling with specific error types
    let errorMessage = 'An unexpected error occurred during deployment';
    let statusCode = 500;

    if (error.name === 'ValidationError') {
      errorMessage = `Configuration validation failed: ${error.message}`;
      statusCode = 400;
    } else if (error.status === 422 && error.message?.includes('name already exists')) {
      errorMessage = 'Repository name already exists. Please choose a different name.';
      statusCode = 400;
    } else if (error.status === 403) {
      errorMessage = 'Permission denied. Please check your GitHub permissions and ensure you have access to create repositories.';
      statusCode = 403;
    } else if (error.status === 401) {
      errorMessage = 'GitHub authentication failed. Please check your GitHub token.';
      statusCode = 401;
    } else if (error.status === 429) {
      errorMessage = 'GitHub API rate limit exceeded. Please wait a few minutes before trying again.';
      statusCode = 429;
    } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      errorMessage = 'Network connection error. Please check your internet connection and try again.';
      statusCode = 503;
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: Date.now(),
        deploymentTime: Date.now() - startTime
      },
      { status: statusCode }
    );
  }
}

// Helper function to encrypt secrets for GitHub (kept for compatibility)
async function encryptSecret(secret: string, publicKey: string): Promise<string> {
  // Ensure sodium is ready
  await sodium.ready;

  // Convert the public key from base64
  const publicKeyBytes = sodium.from_base64(publicKey, sodium.base64_variants.ORIGINAL);

  // Convert the secret to bytes
  const secretBytes = sodium.from_string(secret);

  // Encrypt the secret using the public key (sealed box)
  const encryptedBytes = sodium.crypto_box_seal(secretBytes, publicKeyBytes);

  // Return the encrypted value as base64
  return sodium.to_base64(encryptedBytes, sodium.base64_variants.ORIGINAL);
}

export async function GET() {
  return NextResponse.json({
    message: 'RDP Deployment API - Production Ready',
    version: '2.0',
    features: [
      'Enhanced error handling',
      'Automatic failover',
      'Comprehensive validation',
      'Rate limiting',
      'Detailed logging'
    ],
    timestamp: Date.now()
  });
}
