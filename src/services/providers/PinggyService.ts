/**
 * Pinggy Tunneling Service
 * Isolated service for Pinggy tunnel management with no external dependencies
 */

import { BaseTunnelService, TunnelConnectionOptions, TunnelConnectionResult } from '../base/BaseTunnelService';
import { PROVIDER_CONFIGS, COMMON_SSH_OPTIONS, URL_PATTERNS, VALIDATION_PATTERNS } from '../base/TunnelServiceTypes';
import { spawn, ChildProcess } from 'child_process';

export class PinggyService extends BaseTunnelService {
  private readonly pinggyHosts = [
    'a.pinggy.io',
    'tcp@a.pinggy.io',
    'free.pinggy.io'
  ];

  constructor() {
    super(PROVIDER_CONFIGS.pinggy);
  }

  /**
   * Create Pinggy tunnel
   */
  public async createTunnel(options: TunnelConnectionOptions = {}): Promise<TunnelConnectionResult> {
    const sessionId = this.generateSessionId();
    const startTime = Date.now();

    this.logger.info(`Starting Pinggy tunnel creation`, this.config.provider, { sessionId, options });

    // Validate options
    const validation = this.validateOptions(options);
    if (!validation.valid) {
      const error = `Invalid options: ${validation.errors.join(', ')}`;
      this.logger.error(error, this.config.provider, undefined, { options, validation });
      return {
        success: false,
        provider: this.config.provider,
        error,
        duration: Date.now() - startTime
      };
    }

    // Try different connection strategies
    const strategies = this.getConnectionStrategies(options);
    
    for (let i = 0; i < strategies.length; i++) {
      const strategy = strategies[i];
      this.logger.debug(`Trying Pinggy strategy ${i + 1}/${strategies.length}`, this.config.provider, strategy);

      try {
        const result = await this.executeSSHConnection(strategy, sessionId, i + 1);
        
        if (result.success) {
          this.updateHealthStatus(true, Date.now() - startTime);
          return {
            ...result,
            duration: Date.now() - startTime
          };
        }

        // If not the last strategy, wait before trying next
        if (i < strategies.length - 1) {
          await this.delay(2000 * (i + 1)); // Exponential backoff
        }

      } catch (error: any) {
        this.logger.warn(`Pinggy strategy ${i + 1} failed`, this.config.provider, error);
      }
    }

    // All strategies failed
    const errorMessage = `All Pinggy connection strategies failed`;
    this.logger.error(errorMessage, this.config.provider, undefined, { sessionId, strategies: strategies.length });
    this.updateHealthStatus(false, Date.now() - startTime, errorMessage);

    return {
      success: false,
      provider: this.config.provider,
      error: errorMessage,
      duration: Date.now() - startTime,
      logs: this.getSessionLogs(sessionId)
    };
  }

  /**
   * Validate connection options
   */
  public validateOptions(options: TunnelConnectionOptions): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate port
    if (options.targetPort && (options.targetPort < 1 || options.targetPort > 65535)) {
      errors.push('Target port must be between 1 and 65535');
    }

    // Validate timeout
    if (options.timeout && options.timeout < 1000) {
      errors.push('Timeout must be at least 1000ms');
    }

    // Validate token format if provided
    if (options.token && !VALIDATION_PATTERNS.token.test(options.token)) {
      errors.push('Invalid token format');
    }

    // Validate subdomain if provided
    if (options.subdomain && !VALIDATION_PATTERNS.subdomain.test(options.subdomain)) {
      errors.push('Subdomain must contain only alphanumeric characters and hyphens');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Build SSH command for Pinggy
   */
  public buildCommand(options: TunnelConnectionOptions): { command: string; args: string[]; environment?: Record<string, string> } {
    const targetHost = options.targetHost || 'localhost';
    const targetPort = options.targetPort || 3389;
    
    // Base SSH arguments
    const args: string[] = [...COMMON_SSH_OPTIONS];
    
    // Add Pinggy-specific options
    args.push('-p', '443');
    args.push('-o', 'ExitOnForwardFailure=yes');
    
    // Add tunnel configuration
    if (options.subdomain) {
      args.push('-R', `${options.subdomain}:${targetPort}:${targetHost}:${targetPort}`);
    } else {
      args.push('-R', `0:${targetHost}:${targetPort}`);
    }

    // Determine host based on whether token is provided
    const host = options.token || 'tcp@a.pinggy.io';
    args.push(host);

    return {
      command: 'ssh',
      args,
      environment: {}
    };
  }

  /**
   * Get different connection strategies to try
   */
  private getConnectionStrategies(options: TunnelConnectionOptions): Array<{ command: string; args: string[]; description: string }> {
    const strategies = [];
    const targetHost = options.targetHost || 'localhost';
    const targetPort = options.targetPort || 3389;

    // Strategy 1: With token if provided
    if (options.token) {
      const args: string[] = [
        ...COMMON_SSH_OPTIONS,
        '-p', '443',
        '-o', 'ExitOnForwardFailure=yes',
        '-R', `0:${targetHost}:${targetPort}`,
        options.token
      ];
      strategies.push({
        command: 'ssh',
        args,
        description: 'Pinggy with token authentication'
      });
    }

    // Strategy 2: No authentication
    const noAuthArgs: string[] = [
      ...COMMON_SSH_OPTIONS,
      '-p', '443',
      '-o', 'PreferredAuthentications=none',
      '-o', 'PasswordAuthentication=no',
      '-o', 'PubkeyAuthentication=no',
      '-R', `0:${targetHost}:${targetPort}`,
      'tcp@a.pinggy.io'
    ];
    strategies.push({
      command: 'ssh',
      args: noAuthArgs,
      description: 'Pinggy without authentication'
    });

    // Strategy 3: Alternative host
    const altHostArgs: string[] = [
      ...COMMON_SSH_OPTIONS,
      '-p', '443',
      '-o', 'PreferredAuthentications=none',
      '-R', `0:${targetHost}:${targetPort}`,
      'a.pinggy.io'
    ];
    strategies.push({
      command: 'ssh',
      args: altHostArgs,
      description: 'Pinggy alternative host'
    });

    // Strategy 4: With subdomain if provided
    if (options.subdomain) {
      const subdomainArgs: string[] = [
        ...COMMON_SSH_OPTIONS,
        '-p', '443',
        '-R', `${options.subdomain}:${targetPort}:${targetHost}:${targetPort}`,
        'tcp@a.pinggy.io'
      ];
      strategies.push({
        command: 'ssh',
        args: subdomainArgs,
        description: 'Pinggy with custom subdomain'
      });
    }

    return strategies;
  }

  /**
   * Execute SSH connection
   */
  private async executeSSHConnection(
    strategy: { command: string; args: string[]; description: string },
    sessionId: string,
    attempt: number
  ): Promise<TunnelConnectionResult> {
    return new Promise((resolve) => {
      const { command, args, description } = strategy;
      const timeout = this.config.timeoutSeconds * 1000;

      this.addSessionLog(sessionId, `Attempt ${attempt}: ${description}`);
      this.addSessionLog(sessionId, `Command: ${command} ${args.join(' ')}`);

      // Spawn SSH process
      const process: ChildProcess = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false
      });

      this.activeProcesses.set(sessionId, process);

      let tunnelFound = false;
      let outputBuffer = '';

      // Set timeout
      const timeoutHandle = setTimeout(() => {
        if (!tunnelFound) {
          this.addSessionLog(sessionId, `Timeout after ${timeout}ms`);
          this.cleanupProcess(sessionId);
          resolve({
            success: false,
            provider: this.config.provider,
            error: `Timeout after ${timeout / 1000} seconds`,
            retryAttempt: attempt,
            logs: this.getSessionLogs(sessionId)
          });
        }
      }, timeout);

      // Handle stdout
      process.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        outputBuffer += output;
        this.addSessionLog(sessionId, `STDOUT: ${output}`);

        if (!tunnelFound) {
          const parseResult = this.parsePinggyOutput(outputBuffer);
          if (parseResult.success) {
            tunnelFound = true;
            clearTimeout(timeoutHandle);
            
            resolve({
              success: true,
              tunnelUrl: parseResult.tunnelUrl,
              hostname: parseResult.hostname,
              port: parseResult.port,
              provider: this.config.provider,
              processId: process.pid,
              retryAttempt: attempt,
              logs: this.getSessionLogs(sessionId)
            });
          }
        }
      });

      // Handle stderr
      process.stderr?.on('data', (data: Buffer) => {
        const error = data.toString();
        this.addSessionLog(sessionId, `STDERR: ${error}`);
        
        // Check for authentication errors
        if (error.includes('Permission denied') || error.includes('Authentication failed')) {
          this.addSessionLog(sessionId, 'Authentication error detected');
        }
      });

      // Handle process exit
      process.on('exit', (code: number | null) => {
        this.addSessionLog(sessionId, `Process exited with code: ${code}`);
        
        if (!tunnelFound) {
          clearTimeout(timeoutHandle);
          resolve({
            success: false,
            provider: this.config.provider,
            error: `SSH process exited with code ${code}`,
            retryAttempt: attempt,
            logs: this.getSessionLogs(sessionId)
          });
        }
      });

      // Handle process error
      process.on('error', (error: Error) => {
        this.addSessionLog(sessionId, `Process error: ${error.message}`);
        
        if (!tunnelFound) {
          clearTimeout(timeoutHandle);
          resolve({
            success: false,
            provider: this.config.provider,
            error: `Process error: ${error.message}`,
            retryAttempt: attempt,
            logs: this.getSessionLogs(sessionId)
          });
        }
      });
    });
  }

  /**
   * Parse Pinggy output for tunnel URL
   */
  private parsePinggyOutput(output: string): { success: boolean; tunnelUrl?: string; hostname?: string; port?: number } {
    // Clean output of ANSI sequences
    const cleanedOutput = output.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/[\x00-\x1f\x7f-\x9f]/g, '');

    // Try Pinggy-specific patterns
    for (const pattern of URL_PATTERNS.pinggy) {
      pattern.lastIndex = 0;
      const match = pattern.exec(cleanedOutput);
      
      if (match) {
        const hostname = match[1];
        const port = match[2] ? parseInt(match[2], 10) : undefined;
        const tunnelUrl = port ? `tcp://${hostname}:${port}` : `tcp://${hostname}`;
        
        // Validate that this looks like a Pinggy URL
        if (hostname.includes('pinggy')) {
          return {
            success: true,
            tunnelUrl,
            hostname,
            port
          };
        }
      }
    }

    // Try line-by-line parsing
    const lines = cleanedOutput.split(/[\r\n]+/);
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      for (const pattern of URL_PATTERNS.pinggy) {
        pattern.lastIndex = 0;
        const match = pattern.exec(trimmedLine);
        
        if (match) {
          const hostname = match[1];
          const port = match[2] ? parseInt(match[2], 10) : undefined;
          const tunnelUrl = port ? `tcp://${hostname}:${port}` : `tcp://${hostname}`;
          
          if (hostname.includes('pinggy')) {
            return {
              success: true,
              tunnelUrl,
              hostname,
              port
            };
          }
        }
      }
    }

    return { success: false };
  }

  /**
   * Test connectivity to Pinggy servers
   */
  public async testConnectivity(): Promise<{ success: boolean; host?: string; error?: string }> {
    for (const host of this.pinggyHosts) {
      try {
        const testResult = await this.testSingleHost(host);
        if (testResult.success) {
          return { success: true, host };
        }
      } catch (error: any) {
        this.logger.debug(`Connectivity test failed for ${host}`, this.config.provider, error);
      }
    }

    return {
      success: false,
      error: 'Unable to connect to any Pinggy servers'
    };
  }

  /**
   * Test connectivity to a single host
   */
  private async testSingleHost(host: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const process = spawn('ssh', [
        '-o', 'ConnectTimeout=5',
        '-o', 'BatchMode=yes',
        '-o', 'StrictHostKeyChecking=no',
        '-p', '443',
        host,
        'exit'
      ], { stdio: 'pipe' });

      const timeout = setTimeout(() => {
        process.kill();
        resolve({ success: false, error: 'Connection timeout' });
      }, 10000);

      process.on('exit', (code) => {
        clearTimeout(timeout);
        // For connectivity test, we just need to establish a connection
        // Exit code 0 or 1 both indicate successful connection
        resolve({ success: code !== null && code <= 1 });
      });

      process.on('error', (error) => {
        clearTimeout(timeout);
        resolve({ success: false, error: error.message });
      });
    });
  }
}
