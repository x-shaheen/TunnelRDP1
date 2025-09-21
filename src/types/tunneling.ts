/**
 * Types and interfaces for tunneling providers - Production Ready
 */

export type TunnelingProvider = 'serveo' | 'pinggy' | 'ngrok' | 'localhost.run' | 'localexpose' | 'tailscale' | 'cloudflare-tunnel';

export type TunnelStatus = 'idle' | 'connecting' | 'connected' | 'failed' | 'retrying' | 'timeout';

export interface TunnelingConfig {
  provider: TunnelingProvider;
  requiresAuth: boolean;
  requiresInstallation: boolean;
  supportsTCP: boolean;
  supportsUDP: boolean;
  supportsCustomDomain: boolean;
  isFree: boolean;
  description: string;
  setupCommand: string;
  connectionPattern: RegExp;
  priority: number; // For automatic failover ordering
  maxRetries: number;
  timeoutSeconds: number;
  healthCheckCommand?: string;
  fallbackProviders?: TunnelingProvider[];
}

export interface ProviderFormData {
  provider: TunnelingProvider;
  ngrokToken?: string;
  customSubdomain?: string;
  repositoryName: string;
  selectedAccount?: GitHubAccount;
  deploymentTarget?: 'personal' | 'organization';
}

export interface GitHubAccount {
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

export interface TunnelConnectionResult {
  success: boolean;
  provider: TunnelingProvider;
  host?: string;
  port?: string;
  url?: string;
  error?: string;
  retryCount?: number;
  duration?: number;
  logs?: string[];
}

export interface TunnelHealthCheck {
  provider: TunnelingProvider;
  isHealthy: boolean;
  responseTime?: number;
  error?: string;
  lastChecked: number;
}

export const TUNNELING_PROVIDERS: Record<TunnelingProvider, TunnelingConfig> = {
  'serveo': {
    provider: 'serveo',
    requiresAuth: false,
    requiresInstallation: false,
    supportsTCP: true,
    supportsUDP: false,
    supportsCustomDomain: true,
    isFree: true,
    description: 'Free SSH tunneling with custom subdomain support. Most reliable free option.',
    setupCommand: 'ssh -R 3389:localhost:3389 serveo.net',
    connectionPattern: /Forwarding TCP connections from ([^\s\r\n]+)/i,
    priority: 1,
    maxRetries: 3,
    timeoutSeconds: 45,
    healthCheckCommand: 'ssh -o ConnectTimeout=5 -o BatchMode=yes serveo.net exit',
    fallbackProviders: ['pinggy']
  },
  'pinggy': {
    provider: 'pinggy',
    requiresAuth: false,
    requiresInstallation: false,
    supportsTCP: true,
    supportsUDP: true,
    supportsCustomDomain: true,
    isFree: true,
    description: 'Unlimited bandwidth, advanced features. Excellent fallback option.',
    setupCommand: 'ssh -p 443 -R 0:localhost:3389 -o StrictHostKeyChecking=no -o ServerAliveInterval=30 z1eCdrpxyxB@free.pinggy.io',
    connectionPattern: /tcp:\/\/([^\s\r\n]+)/i,
    priority: 2,
    maxRetries: 3,
    timeoutSeconds: 60,
    healthCheckCommand: 'ssh -p 443 -o ConnectTimeout=5 -o StrictHostKeyChecking=no z1eCdrpxyxB@free.pinggy.io exit',
    fallbackProviders: ['ngrok']
  },
  'ngrok': {
    provider: 'ngrok',
    requiresAuth: true,
    requiresInstallation: true,
    supportsTCP: true,
    supportsUDP: false,
    supportsCustomDomain: true,
    isFree: false,
    description: 'Premium tunneling with advanced features. Requires payment verification.',
    setupCommand: 'ngrok tcp 3389',
    connectionPattern: /tcp:\/\/([^\s\r\n]+)/i,
    priority: 3,
    maxRetries: 2,
    timeoutSeconds: 30,
    healthCheckCommand: 'curl -s http://localhost:4040/api/tunnels',
    fallbackProviders: []
  },
  'localhost.run': {
    provider: 'localhost.run',
    requiresAuth: false,
    requiresInstallation: false,
    supportsTCP: false,
    supportsUDP: false,
    supportsCustomDomain: false,
    isFree: true,
    description: 'Free HTTP/HTTPS tunneling only. Does not support TCP/RDP connections.',
    setupCommand: 'ssh -R 80:localhost:80 localhost.run',
    connectionPattern: /(?:tunnel available at |https:\/\/)?([^\s\r\n]+\.localhost\.run(?::\d+)?)/i,
    priority: 99, // Lowest priority - not suitable for RDP
    maxRetries: 0,
    timeoutSeconds: 30,
    fallbackProviders: []
  },
  'tailscale': {
    provider: 'tailscale',
    requiresAuth: true,
    requiresInstallation: true,
    supportsTCP: true,
    supportsUDP: true,
    supportsCustomDomain: false,
    isFree: true,
    description: 'VPN-based mesh networking with auth key authentication. Most reliable option for secure connections.',
    setupCommand: 'tailscale up --authkey=YOUR_AUTH_KEY',
    connectionPattern: /(\d+\.\d+\.\d+\.\d+)/i,
    priority: 1, // Highest priority - most reliable
    maxRetries: 2,
    timeoutSeconds: 45,
    healthCheckCommand: 'tailscale status',
    fallbackProviders: ['localexpose', 'serveo']
  },
  'localexpose': {
    provider: 'localexpose',
    requiresAuth: true,
    requiresInstallation: true,
    supportsTCP: true,
    supportsUDP: true,
    supportsCustomDomain: true,
    isFree: true,
    description: 'Direct tunneling service with multiple regions. Excellent reliability and custom domain support.',
    setupCommand: 'loclx tunnel tcp localhost:3389',
    connectionPattern: /tcp:\/\/([^\s\r\n]+\.loclx\.io:\d+)/i,
    priority: 2, // High priority - very reliable
    maxRetries: 3,
    timeoutSeconds: 60,
    healthCheckCommand: 'loclx --version',
    fallbackProviders: ['serveo', 'pinggy']
  },
  'cloudflare-tunnel': {
    provider: 'cloudflare-tunnel',
    requiresAuth: true,
    requiresInstallation: true,
    supportsTCP: true,
    supportsUDP: false,
    supportsCustomDomain: true,
    isFree: true,
    description: 'Enterprise-grade tunneling with global edge network. Best for production deployments.',
    setupCommand: 'cloudflared tunnel --url tcp://localhost:3389',
    connectionPattern: /Your quick Tunnel: (https:\/\/[^\s\r\n]+)/i,
    priority: 3, // High priority - enterprise grade
    maxRetries: 2,
    timeoutSeconds: 45,
    healthCheckCommand: 'cloudflared --version',
    fallbackProviders: ['tailscale', 'localexpose']
  }
};

export const FREE_PROVIDERS: TunnelingProvider[] = [
  'tailscale',
  'localexpose',
  'serveo',
  'pinggy'
];

export const VPN_PROVIDERS: TunnelingProvider[] = [
  'tailscale',
  'cloudflare-tunnel'
];

export const DIRECT_PROVIDERS: TunnelingProvider[] = [
  'localexpose'
];

export const SSH_PROVIDERS: TunnelingProvider[] = [
  'serveo',
  'pinggy',
  'ngrok'
];

export const RECOMMENDED_FREE_PROVIDER: TunnelingProvider = 'tailscale';

export const PROVIDER_PRIORITY_ORDER: TunnelingProvider[] = [
  'tailscale',
  'localexpose',
  'cloudflare-tunnel',
  'serveo',
  'pinggy',
  'ngrok'
];

// Error types for better error handling
export enum TunnelErrorType {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  TIMEOUT = 'TIMEOUT',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  INVALID_CONFIGURATION = 'INVALID_CONFIGURATION',
  NETWORK_ERROR = 'NETWORK_ERROR',
  SSH_ERROR = 'SSH_ERROR',
  PARSING_ERROR = 'PARSING_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface TunnelError {
  type: TunnelErrorType;
  message: string;
  provider: TunnelingProvider;
  details?: any;
  timestamp: number;
  retryable: boolean;
}

// Deployment configuration
export interface DeploymentConfig {
  provider: TunnelingProvider;
  customSubdomain?: string;
  ngrokToken?: string;
  localexposeToken?: string;
  tailscaleAuthKey?: string;
  cloudflareSetup?: boolean;
  repositoryName: string;
  selectedAccount: GitHubAccount;
  deploymentTarget: 'personal' | 'organization';
  enableAutoFailover: boolean;
  maxRetryAttempts: number;
  timeoutMinutes: number;
  sessionDuration?: number;
  keepAliveInterval?: number;
}

// Workflow status tracking
export interface WorkflowStatus {
  status: 'idle' | 'creating' | 'deploying' | 'completed' | 'error' | 'retrying';
  message: string;
  repositoryUrl?: string;
  startTime?: number;
  connectionDetails?: ConnectionDetails;
  errors?: TunnelError[];
  currentProvider?: TunnelingProvider;
  attemptedProviders?: TunnelingProvider[];
}

export interface ConnectionDetails {
  host: string;
  port: string;
  username: string;
  password: string;
  provider: TunnelingProvider;
  connectionString?: string;
  establishedAt?: number;
}
