/**
 * Serveo Tunneling Service
 * Isolated service for Serveo tunnel management with no external dependencies
 */

import { BaseTunnelService, TunnelConnectionOptions, TunnelConnectionResult } from '../base/BaseTunnelService';
import { PROVIDER_CONFIGS, COMMON_SSH_OPTIONS, URL_PATTERNS, VALIDATION_PATTERNS } from '../base/TunnelServiceTypes';
import { spawn, ChildProcess } from 'child_process';

export class ServeoService extends BaseTunnelService {
  private readonly serveoHost = 'serveo.net';

  constructor() {
    super(PROVIDER_CONFIGS.serveo);
  }

  /**
   * Create Serveo tunnel
   */
  public async createTunnel(options: TunnelConnectionOptions = {}): Promise<TunnelConnectionResult> {
    const sessionId = this.generateSessionId();
    const startTime = Date.now();

    this.logger.info(`Starting Serveo tunnel creation`, this.config.provider, { sessionId, options });

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
      this.logger.debug(`Trying Serveo strategy ${i + 1}/${strategies.length}`, this.config.provider, strategy);

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
          await this.delay(1500 * (i + 1)); // Exponential backoff
        }

      } catch (error: any) {
        this.logger.warn(`Serveo strategy ${i + 1} failed`, this.config.provider, error);
      }
    }

    // All strategies failed
    const errorMessage = `All Serveo connection strategies failed`;
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
   * Build SSH command for Serveo
   */
  public buildCommand(options: TunnelConnectionOptions): { command: string; args: string[]; environment?: Record<string, string> } {
    const targetHost = options.targetHost || 'localhost';
    const targetPort = options.targetPort || 3389;
    
    // Base SSH arguments
    const args: string[] = [...COMMON_SSH_OPTIONS];
    
    // Add Serveo-specific timeout
    args.push('-o', 'ConnectTimeout=20');
    
    // Add tunnel configuration
    if (options.subdomain) {
      args.push('-R', `${options.subdomain}:${targetPort}:${targetHost}:${targetPort}`);
    } else {
      args.push('-R', `0:${targetHost}:${targetPort}`);
    }

    // Add Serveo host
    args.push(this.serveoHost);

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

    // Strategy 1: With custom subdomain if provided
    if (options.subdomain) {
      const subdomainArgs: string[] = [
        ...COMMON_SSH_OPTIONS,
        '-o', 'ConnectTimeout=20',
        '-R', `${options.subdomain}:${targetPort}:${targetHost}:${targetPort}`,
        this.serveoHost
      ];
      strategies.push({
        command: 'ssh',
        args: subdomainArgs,
        description: `Serveo with custom subdomain: ${options.subdomain}`
      });
    }

    // Strategy 2: Random port assignment
    const randomPortArgs: string[] = [
      ...COMMON_SSH_OPTIONS,
      '-o', 'ConnectTimeout=20',
      '-R', `0:${targetHost}:${targetPort}`,
      this.serveoHost
    ];
    strategies.push({
      command: 'ssh',
      args: randomPortArgs,
      description: 'Serveo with random port assignment'
    });

    // Strategy 3: Alternative random port
    const altRandomArgs: string[] = [
      ...COMMON_SSH_OPTIONS,
      '-o', 'ConnectTimeout=25',
      '-o', 'ServerAliveInterval=60',
      '-R', `0:${targetHost}:${targetPort}`,
      this.serveoHost
    ];
    strategies.push({
      command: 'ssh',
      args: altRandomArgs,
      description: 'Serveo with extended timeouts'
    });

    // Strategy 4: Minimal options for maximum compatibility
    const minimalArgs = [
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'UserKnownHostsFile=/dev/null',
      '-o', 'BatchMode=yes',
      '-T',
      '-R', `0:${targetHost}:${targetPort}`,
      this.serveoHost
    ];
    strategies.push({
      command: 'ssh',
      args: minimalArgs,
      description: 'Serveo with minimal SSH options'
    });

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
          const parseResult = this.parseServeoOutput(outputBuffer);
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
        
        // Check for common Serveo errors
        if (error.includes('Connection refused') || error.includes('Connection timed out')) {
          this.addSessionLog(sessionId, 'Network connectivity issue detected');
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
   * Parse Serveo output for tunnel URL
   */
  private parseServeoOutput(output: string): { success: boolean; tunnelUrl?: string; hostname?: string; port?: number } {
    // Clean output of ANSI sequences
    const cleanedOutput = output.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/[\x00-\x1f\x7f-\x9f]/g, '');

    // Try Serveo-specific patterns
    for (const pattern of URL_PATTERNS.serveo) {
      pattern.lastIndex = 0;
      const match = pattern.exec(cleanedOutput);
      
      if (match) {
        const hostname = match[1];
        const port = match[2] ? parseInt(match[2], 10) : undefined;
        const tunnelUrl = port ? `tcp://${hostname}:${port}` : `tcp://${hostname}`;
        
        // Validate that this looks like a Serveo URL
        if (hostname.includes('serveo')) {
          return {
            success: true,
            tunnelUrl,
            hostname,
            port
          };
        }
      }
    }

    // Try line-by-line parsing for better accuracy
    const lines = cleanedOutput.split(/[\r\n]+/);
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      // Look for "Forwarding TCP connections from" pattern
      const forwardingMatch = trimmedLine.match(/Forwarding TCP connections from ([^\s\r\n]+)/i);
      if (forwardingMatch) {
        const fullUrl = forwardingMatch[1];
        const urlMatch = fullUrl.match(/([^:]+):(\d+)/);
        
        if (urlMatch && urlMatch[1].includes('serveo')) {
          return {
            success: true,
            tunnelUrl: `tcp://${fullUrl}`,
            hostname: urlMatch[1],
            port: parseInt(urlMatch[2], 10)
          };
        }
      }
    }

    return { success: false };
  }

  /**
   * Test connectivity to Serveo
   */
  public async testConnectivity(): Promise<{ success: boolean; responseTime?: number; error?: string }> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const process = spawn('ssh', [
        '-o', 'ConnectTimeout=10',
        '-o', 'BatchMode=yes',
        '-o', 'StrictHostKeyChecking=no',
        this.serveoHost,
        'exit'
      ], { stdio: 'pipe' });

      const timeout = setTimeout(() => {
        process.kill();
        resolve({ 
          success: false, 
          error: 'Connection timeout (10s)' 
        });
      }, 15000);

      process.on('exit', (code) => {
        clearTimeout(timeout);
        const responseTime = Date.now() - startTime;
        
        // For connectivity test, exit code 0 indicates successful connection
        if (code === 0) {
          resolve({ 
            success: true, 
            responseTime 
          });
        } else {
          resolve({ 
            success: false, 
            error: `Connection failed with exit code ${code}`,
            responseTime 
          });
        }
      });

      process.on('error', (error) => {
        clearTimeout(timeout);
        resolve({ 
          success: false, 
          error: error.message,
          responseTime: Date.now() - startTime
        });
      });
    });
  }

  /**
   * Check if a subdomain is available
   */
  public async checkSubdomainAvailability(subdomain: string): Promise<{ available: boolean; error?: string }> {
    if (!VALIDATION_PATTERNS.subdomain.test(subdomain)) {
      return {
        available: false,
        error: 'Invalid subdomain format'
      };
    }

    // For Serveo, we can't really check availability without creating a tunnel
    // This is a placeholder for future implementation
    return {
      available: true
    };
  }

  /**
   * Get recommended subdomains based on a base name
   */
  public getRecommendedSubdomains(baseName: string): string[] {
    const sanitized = baseName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const timestamp = Date.now().toString().slice(-6);
    
    return [
      sanitized,
      `${sanitized}-${timestamp}`,
      `${sanitized}-rdp`,
      `${sanitized}-tunnel`,
      `rdp-${sanitized}`
    ].filter(name => name.length >= 3 && name.length <= 20);
  }
}
