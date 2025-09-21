/**
 * LocalExpose Tunneling Service
 * Provides TCP tunneling through LocalExpose (LocalXpose) service
 * Supports both CLI and programmatic access with robust error handling
 */

import { BaseTunnelService, TunnelConnectionOptions, TunnelConnectionResult } from '../base/BaseTunnelService';
import { spawn, ChildProcess } from 'child_process';
import { LoggingService } from '../LoggingService';

export class LocalExposeService extends BaseTunnelService {
  private static readonly CLI_COMMAND = 'loclx';
  private static readonly ALTERNATIVE_COMMANDS = ['loclx.exe', 'localxpose'];
  
  constructor(logger: LoggingService) {
    super({
      provider: 'localexpose',
      requiresAuth: true,
      requiresInstallation: true,
      supportsTCP: true,
      supportsUDP: true,
      supportsCustomDomain: true,
      isFree: false, // Has free tier but requires account
      description: 'LocalExpose reverse proxy service with TCP/UDP support and custom domains',
      priority: 2, // Higher priority than SSH-based services
      maxRetries: 3,
      timeoutSeconds: 60,
      fallbackProviders: ['serveo', 'pinggy']
    });
  }

  /**
   * Create LocalExpose tunnel
   */
  public async createTunnel(options: TunnelConnectionOptions = {}): Promise<TunnelConnectionResult> {
    const sessionId = this.generateSessionId();
    const startTime = Date.now();

    this.logger.info(`Starting LocalExpose tunnel creation`, this.config.provider, { sessionId, options });

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

    try {
      // Check if LocalExpose CLI is available
      const cliPath = await this.findLocalExposeCLI();
      if (!cliPath) {
        const error = 'LocalExpose CLI not found. Please install LocalExpose from https://localxpose.io/docs';
        this.logger.error(error, this.config.provider);
        return {
          success: false,
          provider: this.config.provider,
          error,
          duration: Date.now() - startTime
        };
      }

      // Build command
      const commandResult = this.buildCommand(options);
      
      // Execute LocalExpose process
      const result = await this.executeLocalExposeProcess(cliPath, commandResult, sessionId, options);
      
      // Update health status
      this.updateHealthStatus(result.success, Date.now() - startTime, result.error);
      
      return {
        ...result,
        duration: Date.now() - startTime
      };

    } catch (error: any) {
      const errorMessage = `LocalExpose tunnel creation failed: ${error.message}`;
      this.logger.error(errorMessage, this.config.provider, error, { sessionId, options });
      this.updateHealthStatus(false, Date.now() - startTime, errorMessage);
      
      return {
        success: false,
        provider: this.config.provider,
        error: errorMessage,
        duration: Date.now() - startTime,
        logs: this.getSessionLogs(sessionId)
      };
    }
  }

  /**
   * Validate connection options for LocalExpose
   */
  public validateOptions(options: TunnelConnectionOptions): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check target port
    if (options.targetPort && (options.targetPort < 1 || options.targetPort > 65535)) {
      errors.push('Target port must be between 1 and 65535');
    }

    // Check timeout
    if (options.timeout && options.timeout < 1000) {
      errors.push('Timeout must be at least 1000ms');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Build LocalExpose command
   */
  public buildCommand(options: TunnelConnectionOptions): { command: string; args: string[]; environment?: Record<string, string> } {
    const targetPort = options.targetPort || 3389;
    const targetHost = options.targetHost || 'localhost';
    
    const args = [
      'tunnel',
      'tcp',
      `${targetHost}:${targetPort}`
    ];

    // Add region if specified
    if (options.subdomain) {
      args.push('--region', options.subdomain);
    }

    // Add custom domain if specified
    if (options.subdomain && options.subdomain.includes('.')) {
      args.push('--domain', options.subdomain);
    }

    const environment: Record<string, string> = {};
    
    // Add access token if provided
    if (options.token) {
      environment.LOCLX_ACCESS_TOKEN = options.token;
    }

    return {
      command: LocalExposeService.CLI_COMMAND,
      args,
      environment
    };
  }

  /**
   * Find LocalExpose CLI executable
   */
  private async findLocalExposeCLI(): Promise<string | null> {
    const commands = [LocalExposeService.CLI_COMMAND, ...LocalExposeService.ALTERNATIVE_COMMANDS];
    
    for (const command of commands) {
      try {
        const result = await this.executeCommand(command, ['--version'], { timeout: 5000 });
        if (result.success) {
          this.logger.debug(`Found LocalExpose CLI: ${command}`, this.config.provider);
          return command;
        }
      } catch (error) {
        // Continue to next command
      }
    }

    return null;
  }

  /**
   * Execute LocalExpose process and monitor output
   */
  private async executeLocalExposeProcess(
    cliPath: string,
    commandResult: { command: string; args: string[]; environment?: Record<string, string> },
    sessionId: string,
    options: TunnelConnectionOptions
  ): Promise<TunnelConnectionResult> {
    return new Promise((resolve) => {
      const { args, environment } = commandResult;
      const timeout = options.timeout || this.config.timeoutSeconds * 1000;

      this.addSessionLog(sessionId, `Starting LocalExpose: ${cliPath} ${args.join(' ')}`);

      // Spawn LocalExpose process
      const childProcess: ChildProcess = spawn(cliPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
        env: { ...process.env, ...environment }
      });

      let outputBuffer = '';
      let errorBuffer = '';
      let tunnelUrl: string | undefined;
      let resolved = false;

      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.addSessionLog(sessionId, 'LocalExpose process timed out');
          
          if (childProcess && !childProcess.killed) {
            childProcess.kill('SIGTERM');
          }
          
          resolve({
            success: false,
            provider: this.config.provider,
            error: `LocalExpose tunnel creation timed out after ${timeout}ms`,
            logs: this.getSessionLogs(sessionId)
          });
        }
      }, timeout);

      // Handle process output
      if (childProcess.stdout) {
        childProcess.stdout.on('data', (data: Buffer) => {
          const output = data.toString();
          outputBuffer += output;
          this.addSessionLog(sessionId, `STDOUT: ${output.trim()}`);

          // Try to extract tunnel URL
          if (!tunnelUrl) {
            tunnelUrl = this.extractTunnelUrl(output);
            if (tunnelUrl && !resolved) {
              resolved = true;
              clearTimeout(timeoutHandle);
              
              this.addSessionLog(sessionId, `Tunnel URL found: ${tunnelUrl}`);
              
              resolve({
                success: true,
                provider: this.config.provider,
                tunnelUrl,
                processId: childProcess.pid,
                logs: this.getSessionLogs(sessionId)
              });
            }
          }
        });
      }

      // Handle process errors
      if (childProcess.stderr) {
        childProcess.stderr.on('data', (data: Buffer) => {
          const error = data.toString();
          errorBuffer += error;
          this.addSessionLog(sessionId, `STDERR: ${error.trim()}`);
        });
      }

      // Handle process exit
      childProcess.on('exit', (code: number | null, signal: string | null) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutHandle);
          
          const error = `LocalExpose process exited with code ${code}, signal ${signal}. Error: ${errorBuffer}`;
          this.addSessionLog(sessionId, error);
          
          resolve({
            success: false,
            provider: this.config.provider,
            error,
            logs: this.getSessionLogs(sessionId)
          });
        }
      });

      // Handle process errors
      childProcess.on('error', (error: Error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutHandle);
          
          const errorMessage = `LocalExpose process error: ${error.message}`;
          this.addSessionLog(sessionId, errorMessage);
          
          resolve({
            success: false,
            provider: this.config.provider,
            error: errorMessage,
            logs: this.getSessionLogs(sessionId)
          });
        }
      });
    });
  }

  /**
   * Extract tunnel URL from LocalExpose output
   */
  private extractTunnelUrl(output: string): string | undefined {
    // Clean ANSI escape sequences
    const cleanOutput = this.stripAnsiSequences(output);
    
    // Multiple patterns for LocalExpose URL formats
    const patterns = [
      // Standard LocalExpose TCP URL format
      /tcp:\/\/([a-zA-Z0-9\-\.]+\.loclx\.io:\d+)/i,
      // Alternative format
      /tcp:\/\/([a-zA-Z0-9\-\.]+:\d+)/i,
      // URL in quotes or brackets
      /"(tcp:\/\/[^"]+)"/i,
      /\[(tcp:\/\/[^\]]+)\]/i,
      // Plain URL detection
      /(tcp:\/\/[^\s\r\n]+)/i
    ];

    for (const pattern of patterns) {
      const match = cleanOutput.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }

    return undefined;
  }

  /**
   * Strip ANSI escape sequences from output
   */
  private stripAnsiSequences(text: string): string {
    // Remove ANSI escape sequences
    return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
  }

  /**
   * Execute a command with timeout
   */
  private executeCommand(command: string, args: string[], options: { timeout: number }): Promise<{ success: boolean; output: string }> {
    return new Promise((resolve) => {
      const childProcess = spawn(command, args, { stdio: 'pipe' });
      let output = '';
      let resolved = false;

      const timeoutHandle = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          childProcess.kill();
          resolve({ success: false, output: '' });
        }
      }, options.timeout);

      childProcess.stdout?.on('data', (data) => {
        output += data.toString();
      });

      childProcess.on('exit', (code) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutHandle);
          resolve({ success: code === 0, output });
        }
      });

      childProcess.on('error', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutHandle);
          resolve({ success: false, output: '' });
        }
      });
    });
  }
}
