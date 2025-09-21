/**
 * Ngrok Tunneling Service
 * Isolated service for Ngrok tunnel management with no external dependencies
 */

import { BaseTunnelService, TunnelConnectionOptions, TunnelConnectionResult } from '../base/BaseTunnelService';
import { PROVIDER_CONFIGS, TunnelErrorType, URL_PATTERNS, VALIDATION_PATTERNS } from '../base/TunnelServiceTypes';
import { spawn, ChildProcess } from 'child_process';

export class NgrokService extends BaseTunnelService {
  private ngrokApiUrl = 'http://localhost:4040/api/tunnels';

  constructor() {
    super(PROVIDER_CONFIGS.ngrok);
  }

  /**
   * Create Ngrok tunnel
   */
  public async createTunnel(options: TunnelConnectionOptions = {}): Promise<TunnelConnectionResult> {
    const sessionId = this.generateSessionId();
    const startTime = Date.now();

    this.logger.info(`Starting Ngrok tunnel creation`, this.config.provider, { sessionId, options });

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
      // Build command
      const commandResult = this.buildCommand(options);
      
      // Execute Ngrok process
      const result = await this.executeNgrokProcess(commandResult, sessionId, options);
      
      // Update health status
      this.updateHealthStatus(result.success, Date.now() - startTime, result.error);
      
      return {
        ...result,
        duration: Date.now() - startTime
      };

    } catch (error: any) {
      const errorMessage = `Ngrok tunnel creation failed: ${error.message}`;
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
   * Validate connection options
   */
  public validateOptions(options: TunnelConnectionOptions): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required token
    if (!options.token) {
      errors.push('Ngrok requires an authentication token');
    } else if (!VALIDATION_PATTERNS.token.test(options.token)) {
      errors.push('Invalid token format');
    }

    // Validate port
    if (options.targetPort && (options.targetPort < 1 || options.targetPort > 65535)) {
      errors.push('Target port must be between 1 and 65535');
    }

    // Validate timeout
    if (options.timeout && options.timeout < 1000) {
      errors.push('Timeout must be at least 1000ms');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Build Ngrok command
   */
  public buildCommand(options: TunnelConnectionOptions): { command: string; args: string[]; environment?: Record<string, string> } {
    const targetPort = options.targetPort || 3389;
    const args = ['tcp', targetPort.toString()];

    // Add subdomain if specified
    if (options.subdomain) {
      args.push('--subdomain', options.subdomain);
    }

    return {
      command: 'ngrok',
      args,
      environment: {
        NGROK_AUTHTOKEN: options.token || ''
      }
    };
  }

  /**
   * Execute Ngrok process
   */
  private async executeNgrokProcess(
    commandResult: { command: string; args: string[]; environment?: Record<string, string> },
    sessionId: string,
    options: TunnelConnectionOptions
  ): Promise<TunnelConnectionResult> {
    return new Promise((resolve) => {
      const { command, args, environment } = commandResult;
      const timeout = options.timeout || this.config.timeoutSeconds * 1000;

      this.addSessionLog(sessionId, `Starting Ngrok: ${command} ${args.join(' ')}`);

      // Spawn Ngrok process
      const childProcess: ChildProcess = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
        env: { ...process.env, ...environment }
      });

      this.activeProcesses.set(sessionId, childProcess);

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
            logs: this.getSessionLogs(sessionId)
          });
        }
      }, timeout);

      // Handle stdout
      childProcess.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        outputBuffer += output;
        this.addSessionLog(sessionId, `STDOUT: ${output}`);

        if (!tunnelFound) {
          const parseResult = this.parseNgrokOutput(outputBuffer);
          if (parseResult.success) {
            tunnelFound = true;
            clearTimeout(timeoutHandle);

            resolve({
              success: true,
              tunnelUrl: parseResult.tunnelUrl,
              hostname: parseResult.hostname,
              port: parseResult.port,
              provider: this.config.provider,
              processId: childProcess.pid,
              logs: this.getSessionLogs(sessionId)
            });
          }
        }
      });

      // Handle stderr
      childProcess.stderr?.on('data', (data: Buffer) => {
        const error = data.toString();
        this.addSessionLog(sessionId, `STDERR: ${error}`);
      });

      // Handle process exit
      childProcess.on('exit', (code: number | null) => {
        this.addSessionLog(sessionId, `Process exited with code: ${code}`);
        
        if (!tunnelFound) {
          clearTimeout(timeoutHandle);
          
          // Try API fallback before giving up
          this.tryApiExtraction(sessionId).then((apiResult) => {
            if (apiResult.success) {
              resolve(apiResult);
            } else {
              resolve({
                success: false,
                provider: this.config.provider,
                error: `Ngrok process exited with code ${code}`,
                logs: this.getSessionLogs(sessionId)
              });
            }
          });
        }
      });

      // Handle process error
      childProcess.on('error', (error: Error) => {
        this.addSessionLog(sessionId, `Process error: ${error.message}`);
        
        if (!tunnelFound) {
          clearTimeout(timeoutHandle);
          resolve({
            success: false,
            provider: this.config.provider,
            error: `Process error: ${error.message}`,
            logs: this.getSessionLogs(sessionId)
          });
        }
      });
    });
  }

  /**
   * Parse Ngrok output for tunnel URL
   */
  private parseNgrokOutput(output: string): { success: boolean; tunnelUrl?: string; hostname?: string; port?: number } {
    // Clean output
    const cleanedOutput = output.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/[\x00-\x1f\x7f-\x9f]/g, '');

    // Try Ngrok-specific patterns
    for (const pattern of URL_PATTERNS.ngrok) {
      pattern.lastIndex = 0;
      const match = pattern.exec(cleanedOutput);
      
      if (match) {
        const hostname = match[1];
        const port = match[2] ? parseInt(match[2], 10) : undefined;
        const tunnelUrl = port ? `tcp://${hostname}:${port}` : `tcp://${hostname}`;
        
        return {
          success: true,
          tunnelUrl,
          hostname,
          port
        };
      }
    }

    return { success: false };
  }

  /**
   * Try to extract tunnel info from Ngrok API
   */
  private async tryApiExtraction(sessionId: string): Promise<TunnelConnectionResult> {
    try {
      this.addSessionLog(sessionId, 'Attempting API extraction from Ngrok');
      
      // Use dynamic import to avoid bundling issues
      const axios = await import('axios');
      const response = await axios.default.get(this.ngrokApiUrl, { timeout: 5000 });
      
      if (response.data && response.data.tunnels && response.data.tunnels.length > 0) {
        const tcpTunnel = response.data.tunnels.find((tunnel: any) => 
          tunnel.proto === 'tcp' && tunnel.public_url
        );
        
        if (tcpTunnel) {
          const url = tcpTunnel.public_url;
          const match = url.match(/tcp:\/\/([^:]+):(\d+)/);
          
          if (match) {
            this.addSessionLog(sessionId, `API extraction successful: ${url}`);
            return {
              success: true,
              tunnelUrl: url,
              hostname: match[1],
              port: parseInt(match[2], 10),
              provider: this.config.provider,
              logs: this.getSessionLogs(sessionId)
            };
          }
        }
      }
    } catch (error: any) {
      this.addSessionLog(sessionId, `API extraction failed: ${error.message}`);
    }

    return {
      success: false,
      provider: this.config.provider,
      error: 'Failed to extract tunnel URL from API',
      logs: this.getSessionLogs(sessionId)
    };
  }

  /**
   * Check if Ngrok is installed
   */
  public async checkInstallation(): Promise<{ installed: boolean; version?: string; error?: string }> {
    try {
      const { spawn } = await import('child_process');
      
      return new Promise((resolve) => {
        const childProcess = spawn('ngrok', ['version'], { stdio: 'pipe' });

        let output = '';
        childProcess.stdout?.on('data', (data) => {
          output += data.toString();
        });

        childProcess.on('exit', (code) => {
          if (code === 0) {
            const versionMatch = output.match(/ngrok version ([\d\.]+)/);
            resolve({
              installed: true,
              version: versionMatch ? versionMatch[1] : 'unknown'
            });
          } else {
            resolve({
              installed: false,
              error: 'Ngrok not found or not executable'
            });
          }
        });

        childProcess.on('error', (error) => {
          resolve({
            installed: false,
            error: error.message
          });
        });
      });
    } catch (error: any) {
      return {
        installed: false,
        error: error.message
      };
    }
  }
}
