/**
 * Cloudflare Tunnel Service
 * Provides secure tunneling through Cloudflare's infrastructure using cloudflared
 * Supports TCP tunneling with enterprise-grade reliability and performance
 */

import { BaseTunnelService, TunnelConnectionOptions, TunnelConnectionResult } from '../base/BaseTunnelService';
import { spawn, ChildProcess } from 'child_process';
import { LoggingService } from '../LoggingService';

export class CloudflareTunnelService extends BaseTunnelService {
  private static readonly CLI_COMMAND = 'cloudflared';
  private static readonly ALTERNATIVE_COMMANDS = ['cloudflared.exe'];
  
  constructor(logger: LoggingService) {
    super({
      provider: 'cloudflare-tunnel',
      requiresAuth: true,
      requiresInstallation: true,
      supportsTCP: true,
      supportsUDP: false, // Cloudflare Tunnel primarily supports TCP/HTTP
      supportsCustomDomain: true,
      isFree: true, // Free tier available
      description: 'Cloudflare Tunnel for enterprise-grade secure TCP tunneling with global edge network',
      priority: 3, // Good reliability but requires more setup
      maxRetries: 2,
      timeoutSeconds: 60,
      fallbackProviders: ['tailscale', 'localexpose']
    });
  }

  /**
   * Create Cloudflare tunnel
   */
  public async createTunnel(options: TunnelConnectionOptions = {}): Promise<TunnelConnectionResult> {
    const sessionId = this.generateSessionId();
    const startTime = Date.now();

    this.logger.info(`Starting Cloudflare tunnel creation`, this.config.provider, { sessionId, options });

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
      // Check if cloudflared is available and authenticated
      const statusCheck = await this.checkCloudflaredStatus();
      if (!statusCheck.success) {
        return {
          success: false,
          provider: this.config.provider,
          error: statusCheck.error,
          duration: Date.now() - startTime
        };
      }

      // Create the tunnel
      const result = await this.createCloudflaredTunnel(sessionId, options);
      
      // Update health status
      this.updateHealthStatus(result.success, Date.now() - startTime, result.error);
      
      return {
        ...result,
        duration: Date.now() - startTime
      };

    } catch (error: any) {
      const errorMessage = `Cloudflare tunnel creation failed: ${error.message}`;
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
   * Validate connection options for Cloudflare Tunnel
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
   * Build Cloudflare tunnel command
   */
  public buildCommand(options: TunnelConnectionOptions): { command: string; args: string[]; environment?: Record<string, string> } {
    const targetPort = options.targetPort || 3389;
    const targetHost = options.targetHost || 'localhost';
    
    const args = [
      'tunnel',
      '--url', `tcp://${targetHost}:${targetPort}`
    ];

    // Add custom hostname if specified
    if (options.subdomain) {
      args.push('--hostname', options.subdomain);
    }

    const environment: Record<string, string> = {};
    
    // Add tunnel token if provided
    if (options.token) {
      environment.TUNNEL_TOKEN = options.token;
    }

    return {
      command: CloudflareTunnelService.CLI_COMMAND,
      args,
      environment
    };
  }

  /**
   * Check cloudflared status and authentication
   */
  private async checkCloudflaredStatus(): Promise<{ success: boolean; error?: string }> {
    try {
      const cliPath = await this.findCloudflaredCLI();
      if (!cliPath) {
        return {
          success: false,
          error: 'cloudflared CLI not found. Please install cloudflared from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/'
        };
      }

      // Check if cloudflared is working
      const versionResult = await this.executeCommand(cliPath, ['--version'], { timeout: 10000 });
      if (!versionResult.success) {
        return {
          success: false,
          error: 'cloudflared is not working properly. Please reinstall cloudflared.'
        };
      }

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: `cloudflared status check failed: ${error.message}`
      };
    }
  }

  /**
   * Create Cloudflare tunnel
   */
  private async createCloudflaredTunnel(sessionId: string, options: TunnelConnectionOptions): Promise<TunnelConnectionResult> {
    const cliPath = await this.findCloudflaredCLI();
    if (!cliPath) {
      return {
        success: false,
        provider: this.config.provider,
        error: 'cloudflared CLI not found'
      };
    }

    const targetPort = options.targetPort || 3389;
    const targetHost = options.targetHost || 'localhost';

    this.addSessionLog(sessionId, `Creating Cloudflare tunnel for ${targetHost}:${targetPort}`);

    try {
      // Build command
      const commandResult = this.buildCommand(options);
      
      // Execute cloudflared
      const result = await this.executeCloudflaredProcess(cliPath, commandResult, sessionId, options);
      
      if (result.success && result.tunnelUrl) {
        this.addSessionLog(sessionId, `Cloudflare tunnel created: ${result.tunnelUrl}`);
      }

      return result;
    } catch (error: any) {
      return {
        success: false,
        provider: this.config.provider,
        error: `Cloudflare tunnel creation failed: ${error.message}`,
        logs: this.getSessionLogs(sessionId)
      };
    }
  }

  /**
   * Execute cloudflared process and monitor output
   */
  private async executeCloudflaredProcess(
    cliPath: string,
    commandResult: { command: string; args: string[]; environment?: Record<string, string> },
    sessionId: string,
    options: TunnelConnectionOptions
  ): Promise<TunnelConnectionResult> {
    return new Promise((resolve) => {
      const { args, environment } = commandResult;
      const timeout = options.timeout || this.config.timeoutSeconds * 1000;

      this.addSessionLog(sessionId, `Starting cloudflared: ${cliPath} ${args.join(' ')}`);

      // Spawn cloudflared process
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
          this.addSessionLog(sessionId, 'cloudflared process timed out');
          
          if (childProcess && !childProcess.killed) {
            childProcess.kill('SIGTERM');
          }
          
          resolve({
            success: false,
            provider: this.config.provider,
            error: `Cloudflare tunnel timed out after ${timeout}ms`,
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

          // Also check stderr for tunnel URLs (cloudflared sometimes outputs there)
          if (!tunnelUrl) {
            tunnelUrl = this.extractTunnelUrl(error);
            if (tunnelUrl && !resolved) {
              resolved = true;
              clearTimeout(timeoutHandle);
              
              this.addSessionLog(sessionId, `Tunnel URL found in stderr: ${tunnelUrl}`);
              
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

      // Handle process exit
      childProcess.on('exit', (code: number | null, signal: string | null) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutHandle);
          
          const error = `cloudflared process exited with code ${code}, signal ${signal}. Error: ${errorBuffer}`;
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
          
          const errorMessage = `cloudflared process error: ${error.message}`;
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
   * Find cloudflared CLI executable
   */
  private async findCloudflaredCLI(): Promise<string | null> {
    const commands = [CloudflareTunnelService.CLI_COMMAND, ...CloudflareTunnelService.ALTERNATIVE_COMMANDS];
    
    for (const command of commands) {
      try {
        const result = await this.executeCommand(command, ['--version'], { timeout: 5000 });
        if (result.success) {
          this.logger.debug(`Found cloudflared CLI: ${command}`, this.config.provider);
          return command;
        }
      } catch (error) {
        // Continue to next command
      }
    }

    return null;
  }

  /**
   * Extract tunnel URL from cloudflared output
   */
  private extractTunnelUrl(output: string): string | undefined {
    // Clean ANSI escape sequences
    const cleanOutput = this.stripAnsiSequences(output);
    
    // Patterns for Cloudflare tunnel URLs
    const patterns = [
      // Standard Cloudflare tunnel URL
      /https:\/\/([a-zA-Z0-9\-\.]+\.trycloudflare\.com)/i,
      // Custom domain
      /https:\/\/([a-zA-Z0-9\-\.]+\.cloudflareaccess\.com)/i,
      // TCP tunnel format
      /tcp:\/\/([a-zA-Z0-9\-\.]+\.trycloudflare\.com:\d+)/i,
      // URL in quotes
      /"(https:\/\/[^"]+\.trycloudflare\.com[^"]*)"/i,
      // Log format: "Your quick Tunnel: https://..."
      /Your quick Tunnel:\s+(https:\/\/[^\s\r\n]+)/i,
      // Plain URL detection
      /(https:\/\/[^\s\r\n]+\.trycloudflare\.com[^\s\r\n]*)/i
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
