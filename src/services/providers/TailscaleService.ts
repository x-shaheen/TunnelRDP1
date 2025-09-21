/**
 * Tailscale VPN Tunneling Service
 * Provides secure VPN-based tunneling through Tailscale with Funnel feature
 * Supports TCP forwarding with programmatic control and mesh networking
 */

import { BaseTunnelService, TunnelConnectionOptions, TunnelConnectionResult } from '../base/BaseTunnelService';
import { spawn, ChildProcess } from 'child_process';
import { LoggingService } from '../LoggingService';

export class TailscaleService extends BaseTunnelService {
  private static readonly CLI_COMMAND = 'tailscale';
  private static readonly ALTERNATIVE_COMMANDS = ['tailscale.exe'];
  
  constructor(logger: LoggingService) {
    super({
      provider: 'tailscale',
      requiresAuth: true,
      requiresInstallation: true,
      supportsTCP: true,
      supportsUDP: true,
      supportsCustomDomain: false,
      isFree: true, // Free for personal use
      description: 'Tailscale VPN with Funnel feature for secure TCP forwarding and mesh networking',
      priority: 1, // Highest priority due to reliability
      maxRetries: 2,
      timeoutSeconds: 45,
      fallbackProviders: ['localexpose', 'serveo']
    });
  }

  /**
   * Create Tailscale tunnel using Funnel feature
   */
  public async createTunnel(options: TunnelConnectionOptions = {}): Promise<TunnelConnectionResult> {
    const sessionId = this.generateSessionId();
    const startTime = Date.now();

    this.logger.info(`Starting Tailscale tunnel creation`, this.config.provider, { sessionId, options });

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
      // Check if Tailscale is available and authenticated
      const statusCheck = await this.checkTailscaleStatus();
      if (!statusCheck.success) {
        return {
          success: false,
          provider: this.config.provider,
          error: statusCheck.error,
          duration: Date.now() - startTime
        };
      }

      // Enable Funnel if not already enabled
      const funnelSetup = await this.setupFunnel(sessionId);
      if (!funnelSetup.success) {
        return {
          success: false,
          provider: this.config.provider,
          error: funnelSetup.error,
          duration: Date.now() - startTime
        };
      }

      // Create the tunnel
      const result = await this.createFunnelTunnel(sessionId, options);
      
      // Update health status
      this.updateHealthStatus(result.success, Date.now() - startTime, result.error);
      
      return {
        ...result,
        duration: Date.now() - startTime
      };

    } catch (error: any) {
      const errorMessage = `Tailscale tunnel creation failed: ${error.message}`;
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
   * Validate connection options for Tailscale
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
   * Build Tailscale command (not directly used but required by interface)
   */
  public buildCommand(options: TunnelConnectionOptions): { command: string; args: string[]; environment?: Record<string, string> } {
    const targetPort = options.targetPort || 3389;
    
    return {
      command: TailscaleService.CLI_COMMAND,
      args: ['funnel', '--tcp', targetPort.toString()],
      environment: {}
    };
  }

  /**
   * Check Tailscale status and authentication
   */
  private async checkTailscaleStatus(): Promise<{ success: boolean; error?: string }> {
    try {
      const cliPath = await this.findTailscaleCLI();
      if (!cliPath) {
        return {
          success: false,
          error: 'Tailscale CLI not found. Please install Tailscale from https://tailscale.com/download'
        };
      }

      // Check if Tailscale is running and authenticated
      const statusResult = await this.executeCommand(cliPath, ['status'], { timeout: 10000 });
      if (!statusResult.success) {
        return {
          success: false,
          error: 'Tailscale is not running or not authenticated. Please run "tailscale up" first.'
        };
      }

      // Check if we're connected to a tailnet
      if (statusResult.output.includes('Logged out') || statusResult.output.includes('Not connected')) {
        return {
          success: false,
          error: 'Tailscale is not connected to a tailnet. Please authenticate with "tailscale up".'
        };
      }

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: `Tailscale status check failed: ${error.message}`
      };
    }
  }

  /**
   * Setup Funnel feature for TCP forwarding
   */
  private async setupFunnel(sessionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const cliPath = await this.findTailscaleCLI();
      if (!cliPath) {
        return {
          success: false,
          error: 'Tailscale CLI not found'
        };
      }

      this.addSessionLog(sessionId, 'Setting up Tailscale Funnel...');

      // Check if Funnel is available
      const funnelCheck = await this.executeCommand(cliPath, ['funnel', 'status'], { timeout: 10000 });
      
      if (funnelCheck.success || funnelCheck.output.includes('Funnel not running')) {
        this.addSessionLog(sessionId, 'Funnel is available');
        return { success: true };
      }

      // Try to enable Funnel
      const enableResult = await this.executeCommand(cliPath, ['funnel', '--help'], { timeout: 5000 });
      if (!enableResult.success) {
        return {
          success: false,
          error: 'Funnel feature is not available. Please ensure you have a Tailscale account with Funnel access.'
        };
      }

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: `Funnel setup failed: ${error.message}`
      };
    }
  }

  /**
   * Create Funnel tunnel for TCP forwarding
   */
  private async createFunnelTunnel(sessionId: string, options: TunnelConnectionOptions): Promise<TunnelConnectionResult> {
    const cliPath = await this.findTailscaleCLI();
    if (!cliPath) {
      return {
        success: false,
        provider: this.config.provider,
        error: 'Tailscale CLI not found'
      };
    }

    const targetPort = options.targetPort || 3389;
    const targetHost = options.targetHost || 'localhost';

    this.addSessionLog(sessionId, `Creating Funnel tunnel for ${targetHost}:${targetPort}`);

    try {
      // Start Funnel for TCP forwarding
      const funnelArgs = ['funnel', '--tcp', `${targetHost}:${targetPort}`];
      
      const result = await this.executeTailscaleFunnel(cliPath, funnelArgs, sessionId, options);
      
      if (result.success && result.tunnelUrl) {
        this.addSessionLog(sessionId, `Tailscale Funnel tunnel created: ${result.tunnelUrl}`);
      }

      return result;
    } catch (error: any) {
      return {
        success: false,
        provider: this.config.provider,
        error: `Funnel tunnel creation failed: ${error.message}`,
        logs: this.getSessionLogs(sessionId)
      };
    }
  }

  /**
   * Execute Tailscale Funnel command and monitor output
   */
  private async executeTailscaleFunnel(
    cliPath: string,
    args: string[],
    sessionId: string,
    options: TunnelConnectionOptions
  ): Promise<TunnelConnectionResult> {
    return new Promise((resolve) => {
      const timeout = options.timeout || this.config.timeoutSeconds * 1000;

      this.addSessionLog(sessionId, `Starting Tailscale Funnel: ${cliPath} ${args.join(' ')}`);

      // Spawn Tailscale process
      const childProcess: ChildProcess = spawn(cliPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false
      });

      let outputBuffer = '';
      let errorBuffer = '';
      let tunnelUrl: string | undefined;
      let resolved = false;

      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.addSessionLog(sessionId, 'Tailscale Funnel process timed out');
          
          if (childProcess && !childProcess.killed) {
            childProcess.kill('SIGTERM');
          }
          
          resolve({
            success: false,
            provider: this.config.provider,
            error: `Tailscale Funnel timed out after ${timeout}ms`,
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
          
          const error = `Tailscale process exited with code ${code}, signal ${signal}. Error: ${errorBuffer}`;
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
          
          const errorMessage = `Tailscale process error: ${error.message}`;
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
   * Find Tailscale CLI executable
   */
  private async findTailscaleCLI(): Promise<string | null> {
    const commands = [TailscaleService.CLI_COMMAND, ...TailscaleService.ALTERNATIVE_COMMANDS];
    
    for (const command of commands) {
      try {
        const result = await this.executeCommand(command, ['version'], { timeout: 5000 });
        if (result.success) {
          this.logger.debug(`Found Tailscale CLI: ${command}`, this.config.provider);
          return command;
        }
      } catch (error) {
        // Continue to next command
      }
    }

    return null;
  }

  /**
   * Extract tunnel URL from Tailscale output
   */
  private extractTunnelUrl(output: string): string | undefined {
    // Clean ANSI escape sequences
    const cleanOutput = this.stripAnsiSequences(output);

    // Patterns for Tailscale VPN IP addresses and Funnel URLs
    const patterns = [
      // Tailscale VPN IP addresses (100.x.x.x range)
      /Connect to: (100\.\d+\.\d+\.\d+):3389/i,
      /Tailscale IP: (100\.\d+\.\d+\.\d+)/i,
      /connectionString.*?(100\.\d+\.\d+\.\d+):3389/i,
      /(100\.\d+\.\d+\.\d+):3389/i,
      /(100\.\d+\.\d+\.\d+)/i,
      // Legacy Tailscale Funnel URLs (for backward compatibility)
      /https:\/\/([a-zA-Z0-9\-\.]+\.ts\.net)/i,
      /tcp:\/\/([a-zA-Z0-9\-\.]+\.ts\.net:\d+)/i,
      /"(https:\/\/[^"]+\.ts\.net[^"]*)"/i,
      /(https:\/\/[^\s\r\n]+\.ts\.net[^\s\r\n]*)/i
    ];

    for (const pattern of patterns) {
      const match = cleanOutput.match(pattern);
      if (match) {
        let result = match[1] || match[0];
        // If it's just an IP, add the port
        if (/^100\.\d+\.\d+\.\d+$/.test(result)) {
          result = `${result}:3389`;
        }
        return result;
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
