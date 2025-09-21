/**
 * Common types and interfaces for tunneling services
 * Centralized type definitions to ensure consistency across all services
 */

export type TunnelProvider = 'serveo' | 'pinggy' | 'ngrok' | 'localhost.run' | 'localexpose' | 'tailscale' | 'cloudflare-tunnel';

export type TunnelStatus = 'idle' | 'connecting' | 'connected' | 'failed' | 'retrying' | 'timeout';

export enum TunnelErrorType {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  TIMEOUT = 'TIMEOUT',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  SSH_ERROR = 'SSH_ERROR',
  PARSING_ERROR = 'PARSING_ERROR',
  PROCESS_ERROR = 'PROCESS_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface TunnelError {
  type: TunnelErrorType;
  message: string;
  provider: string;
  details?: any;
  timestamp: number;
  retryable: boolean;
}

export interface TunnelParseResult {
  success: boolean;
  tunnelUrl?: string;
  hostname?: string;
  port?: number;
  provider?: string;
  rawOutput?: string;
  cleanedOutput?: string;
  error?: string;
  parseMethod?: string;
}

export interface ProcessExecutionResult {
  success: boolean;
  output: string[];
  errors: string[];
  exitCode?: number;
  duration: number;
  processId?: number;
}

export interface CommandResult {
  command: string;
  args: string[];
  fullCommand: string;
  environment?: Record<string, string>;
  provider: string;
}

export interface TunnelMetrics {
  totalAttempts: number;
  successfulConnections: number;
  failedConnections: number;
  averageConnectionTime: number;
  lastConnectionTime?: number;
  lastError?: TunnelError;
}

export interface ProviderCapabilities {
  supportsTCP: boolean;
  supportsUDP: boolean;
  supportsCustomDomain: boolean;
  requiresAuth: boolean;
  requiresInstallation: boolean;
  isFree: boolean;
  maxConnections?: number;
  bandwidthLimit?: string;
}

export interface TunnelServiceFactory {
  createService(provider: TunnelProvider): any;
  getSupportedProviders(): TunnelProvider[];
  getProviderCapabilities(provider: TunnelProvider): ProviderCapabilities;
}

// Constants for provider configurations
export const PROVIDER_CONFIGS = {
  serveo: {
    provider: 'serveo' as TunnelProvider,
    requiresAuth: false,
    requiresInstallation: false,
    supportsTCP: true,
    supportsUDP: false,
    supportsCustomDomain: true,
    isFree: true,
    description: 'Free SSH tunneling with custom subdomain support. Most reliable free option.',
    priority: 1,
    maxRetries: 3,
    timeoutSeconds: 45,
    fallbackProviders: ['pinggy']
  },
  pinggy: {
    provider: 'pinggy' as TunnelProvider,
    requiresAuth: false,
    requiresInstallation: false,
    supportsTCP: true,
    supportsUDP: true,
    supportsCustomDomain: true,
    isFree: true,
    description: 'Unlimited bandwidth, advanced features. Excellent fallback option.',
    priority: 2,
    maxRetries: 3,
    timeoutSeconds: 60,
    fallbackProviders: ['ngrok']
  },
  ngrok: {
    provider: 'ngrok' as TunnelProvider,
    requiresAuth: true,
    requiresInstallation: true,
    supportsTCP: true,
    supportsUDP: false,
    supportsCustomDomain: true,
    isFree: false,
    description: 'Premium tunneling with advanced features. Requires payment verification.',
    priority: 3,
    maxRetries: 2,
    timeoutSeconds: 30,
    fallbackProviders: []
  },
  'localhost.run': {
    provider: 'localhost.run' as TunnelProvider,
    requiresAuth: false,
    requiresInstallation: false,
    supportsTCP: false,
    supportsUDP: false,
    supportsCustomDomain: false,
    isFree: true,
    description: 'Free HTTP/HTTPS tunneling only. Does not support TCP/RDP connections.',
    priority: 99,
    maxRetries: 0,
    timeoutSeconds: 30,
    fallbackProviders: []
  },
  tailscale: {
    provider: 'tailscale' as TunnelProvider,
    requiresAuth: true,
    requiresInstallation: true,
    supportsTCP: true,
    supportsUDP: true,
    supportsCustomDomain: false,
    isFree: true,
    description: 'Tailscale VPN with Funnel feature for secure TCP forwarding and mesh networking',
    priority: 1,
    maxRetries: 2,
    timeoutSeconds: 45,
    fallbackProviders: ['localexpose', 'serveo']
  },
  localexpose: {
    provider: 'localexpose' as TunnelProvider,
    requiresAuth: true,
    requiresInstallation: true,
    supportsTCP: true,
    supportsUDP: true,
    supportsCustomDomain: true,
    isFree: false,
    description: 'LocalExpose reverse proxy service with TCP/UDP support and custom domains',
    priority: 2,
    maxRetries: 3,
    timeoutSeconds: 60,
    fallbackProviders: ['serveo', 'pinggy']
  },
  'cloudflare-tunnel': {
    provider: 'cloudflare-tunnel' as TunnelProvider,
    requiresAuth: true,
    requiresInstallation: true,
    supportsTCP: true,
    supportsUDP: false,
    supportsCustomDomain: true,
    isFree: true,
    description: 'Cloudflare Tunnel for enterprise-grade secure TCP tunneling with global edge network',
    priority: 3,
    maxRetries: 2,
    timeoutSeconds: 60,
    fallbackProviders: ['tailscale', 'localexpose']
  }
} as const;

export const FREE_PROVIDERS: TunnelProvider[] = ['tailscale', 'serveo', 'pinggy', 'cloudflare-tunnel'];
export const TCP_PROVIDERS: TunnelProvider[] = ['tailscale', 'localexpose', 'cloudflare-tunnel', 'serveo', 'pinggy', 'ngrok'];
export const VPN_PROVIDERS: TunnelProvider[] = ['tailscale', 'cloudflare-tunnel'];
export const RECOMMENDED_FREE_PROVIDER: TunnelProvider = 'tailscale';
export const PROVIDER_PRIORITY_ORDER: TunnelProvider[] = ['tailscale', 'localexpose', 'cloudflare-tunnel', 'serveo', 'pinggy', 'ngrok'];

// Default connection options
export const DEFAULT_CONNECTION_OPTIONS = {
  targetHost: 'localhost',
  targetPort: 3389,
  timeout: 60000,
  retries: 3
} as const;

// Common SSH options
export const COMMON_SSH_OPTIONS = [
  '-o', 'StrictHostKeyChecking=no',
  '-o', 'UserKnownHostsFile=/dev/null',
  '-o', 'ServerAliveInterval=30',
  '-o', 'ServerAliveCountMax=3',
  '-o', 'ConnectTimeout=15',
  '-o', 'BatchMode=yes',
  '-T' // Disable pseudo-terminal allocation
] as const;

// Validation patterns
export const VALIDATION_PATTERNS = {
  subdomain: /^[a-zA-Z0-9\-]+$/,
  hostname: /^[a-zA-Z0-9\-\.]+$/,
  port: /^\d{1,5}$/,
  token: /^[a-zA-Z0-9@\-_\.]+$/
} as const;

// URL parsing patterns for different providers
export const URL_PATTERNS = {
  pinggy: [
    /tcp:\/\/([a-zA-Z0-9\-\.]+\.(?:pinggy\.link|pinggy\.io|free\.pinggy\.link)):(\d+)/gi,
    /([a-zA-Z0-9\-\.]+\.(?:pinggy\.link|pinggy\.io|free\.pinggy\.link)):(\d+)/gi
  ],
  serveo: [
    /Forwarding TCP connections from ([a-zA-Z0-9\-\.]+\.serveo\.net):(\d+)/gi,
    /tcp:\/\/([a-zA-Z0-9\-\.]+\.serveo\.net):(\d+)/gi,
    /([a-zA-Z0-9\-\.]+\.serveo\.net):(\d+)/gi
  ],
  ngrok: [
    /tcp:\/\/([a-zA-Z0-9\-\.]+\.ngrok\.io):(\d+)/gi,
    /([a-zA-Z0-9\-\.]+\.ngrok\.io):(\d+)/gi
  ],
  'localhost.run': [
    /https?:\/\/([a-zA-Z0-9\-\.]+\.localhost\.run)/gi
  ]
} as const;
