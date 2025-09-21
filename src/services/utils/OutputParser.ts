/**
 * Enhanced Output Parser for Tunnel Services
 * Provides robust parsing with ANSI sequence stripping, multiple regex patterns,
 * and comprehensive error handling to address the parsing failures identified in the analysis
 */

export interface ParseResult {
  success: boolean;
  tunnelUrl?: string;
  hostname?: string;
  port?: number;
  provider?: string;
  parseMethod?: string;
  rawOutput?: string;
  cleanedOutput?: string;
  error?: string;
}

export interface ParsingStrategy {
  name: string;
  patterns: RegExp[];
  preprocess?: (text: string) => string;
  postprocess?: (url: string) => string;
}

export class OutputParser {
  private static readonly ANSI_ESCAPE_REGEX = /\x1b\[[0-9;]*[a-zA-Z]/g;
  private static readonly CONTROL_CHARS_REGEX = /[\x00-\x1F\x7F-\x9F]/g;
  
  /**
   * Parsing strategies for different tunnel providers
   */
  private static readonly PARSING_STRATEGIES: Record<string, ParsingStrategy> = {
    serveo: {
      name: 'Serveo SSH Tunnel',
      patterns: [
        /Forwarding TCP connections from ([^\s\r\n]+)/i,
        /tcp:\/\/([a-zA-Z0-9\-\.]+\.serveo\.net:\d+)/i,
        /([a-zA-Z0-9\-\.]+\.serveo\.net:\d+)/i
      ]
    },
    
    pinggy: {
      name: 'Pinggy Tunnel',
      patterns: [
        /tcp:\/\/([a-zA-Z0-9\-\.]+\.a\.free\.pinggy\.link:\d+)/i,
        /tcp:\/\/([a-zA-Z0-9\-\.]+\.pinggy\.link:\d+)/i,
        /tcp:\/\/([a-zA-Z0-9\-\.]+\.pinggy\.io:\d+)/i,
        /([a-zA-Z0-9\-\.]+\.pinggy\.link:\d+)/i,
        /([a-zA-Z0-9\-\.]+\.pinggy\.io:\d+)/i
      ]
    },
    
    ngrok: {
      name: 'Ngrok Tunnel',
      patterns: [
        /tcp:\/\/([a-zA-Z0-9\-\.]+\.ngrok\.io:\d+)/i,
        /tcp:\/\/([a-zA-Z0-9\-\.]+\.ngrok-free\.app:\d+)/i,
        /([a-zA-Z0-9\-\.]+\.ngrok\.io:\d+)/i,
        /([a-zA-Z0-9\-\.]+\.ngrok-free\.app:\d+)/i
      ]
    },
    
    localexpose: {
      name: 'LocalExpose Tunnel',
      patterns: [
        /tcp:\/\/([a-zA-Z0-9\-\.]+\.loclx\.io:\d+)/i,
        /tcp:\/\/([a-zA-Z0-9\-\.]+\.localxpose\.io:\d+)/i,
        /([a-zA-Z0-9\-\.]+\.loclx\.io:\d+)/i,
        /([a-zA-Z0-9\-\.]+\.localxpose\.io:\d+)/i
      ]
    },
    
    tailscale: {
      name: 'Tailscale VPN',
      patterns: [
        // Tailscale VPN IP addresses (100.x.x.x range)
        /Connect to: (100\.\d+\.\d+\.\d+):3389/i,
        /Tailscale IP: (100\.\d+\.\d+\.\d+)/i,
        /connectionString.*?(100\.\d+\.\d+\.\d+):3389/i,
        /(100\.\d+\.\d+\.\d+):3389/i,
        // Legacy Tailscale Funnel URLs (for backward compatibility)
        /https:\/\/([a-zA-Z0-9\-\.]+\.ts\.net)/i,
        /tcp:\/\/([a-zA-Z0-9\-\.]+\.ts\.net:\d+)/i,
        /([a-zA-Z0-9\-\.]+\.ts\.net)/i
      ],
      postprocess: (url: string) => {
        // If it's just an IP, add the port
        if (/^100\.\d+\.\d+\.\d+$/.test(url)) {
          return `${url}:3389`;
        }
        return url;
      }
    },
    
    'cloudflare-tunnel': {
      name: 'Cloudflare Tunnel',
      patterns: [
        /https:\/\/([a-zA-Z0-9\-\.]+\.trycloudflare\.com)/i,
        /https:\/\/([a-zA-Z0-9\-\.]+\.cloudflareaccess\.com)/i,
        /tcp:\/\/([a-zA-Z0-9\-\.]+\.trycloudflare\.com:\d+)/i,
        /Your quick Tunnel:\s+(https:\/\/[^\s\r\n]+)/i,
        /([a-zA-Z0-9\-\.]+\.trycloudflare\.com)/i
      ]
    },
    
    generic: {
      name: 'Generic URL Detection',
      patterns: [
        // Generic TCP URL patterns
        /tcp:\/\/([a-zA-Z0-9\-\.]+:\d+)/i,
        /https:\/\/([a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,})/i,
        // URLs in quotes or brackets
        /"(tcp:\/\/[^"]+)"/i,
        /"(https:\/\/[^"]+)"/i,
        /\[(tcp:\/\/[^\]]+)\]/i,
        /\[(https:\/\/[^\]]+)\]/i,
        // Hostname:port patterns
        /([a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,}:\d+)/i
      ]
    }
  };

  /**
   * Parse tunnel URL from output with multiple strategies
   */
  public static parseTunnelUrl(
    output: string, 
    provider?: string, 
    fallbackStrategies: boolean = true
  ): ParseResult {
    const rawOutput = output;
    
    // Clean the output
    const cleanedOutput = this.cleanOutput(output);
    
    // Try provider-specific strategy first
    if (provider && this.PARSING_STRATEGIES[provider]) {
      const result = this.tryParsingStrategy(
        cleanedOutput, 
        this.PARSING_STRATEGIES[provider], 
        provider
      );
      
      if (result.success) {
        return {
          ...result,
          rawOutput,
          cleanedOutput
        };
      }
    }
    
    // Try all strategies if fallback is enabled
    if (fallbackStrategies) {
      for (const [strategyProvider, strategy] of Object.entries(this.PARSING_STRATEGIES)) {
        if (strategyProvider === provider) continue; // Already tried
        
        const result = this.tryParsingStrategy(cleanedOutput, strategy, strategyProvider);
        if (result.success) {
          return {
            ...result,
            rawOutput,
            cleanedOutput,
            parseMethod: `fallback-${strategy.name}`
          };
        }
      }
    }
    
    return {
      success: false,
      error: 'No tunnel URL found in output',
      rawOutput,
      cleanedOutput
    };
  }

  /**
   * Try a specific parsing strategy
   */
  private static tryParsingStrategy(
    output: string, 
    strategy: ParsingStrategy, 
    provider: string
  ): ParseResult {
    let processedOutput = output;
    
    // Apply preprocessing if defined
    if (strategy.preprocess) {
      processedOutput = strategy.preprocess(processedOutput);
    }
    
    // Try each pattern in the strategy
    for (let i = 0; i < strategy.patterns.length; i++) {
      const pattern = strategy.patterns[i];
      const match = processedOutput.match(pattern);
      
      if (match) {
        let tunnelUrl = match[1] || match[0];
        
        // Apply postprocessing if defined
        if (strategy.postprocess) {
          tunnelUrl = strategy.postprocess(tunnelUrl);
        }
        
        // Ensure URL has protocol
        if (!tunnelUrl.startsWith('tcp://') && !tunnelUrl.startsWith('https://') && !tunnelUrl.startsWith('http://')) {
          // Default to tcp:// for most tunnel services
          tunnelUrl = `tcp://${tunnelUrl}`;
        }
        
        // Parse hostname and port
        const urlParts = this.parseUrlComponents(tunnelUrl);
        
        return {
          success: true,
          tunnelUrl,
          hostname: urlParts.hostname,
          port: urlParts.port,
          provider,
          parseMethod: `${strategy.name}-pattern-${i + 1}`
        };
      }
    }
    
    return {
      success: false,
      error: `No match found with ${strategy.name} patterns`
    };
  }

  /**
   * Clean output by removing ANSI sequences and control characters
   */
  private static cleanOutput(output: string): string {
    return output
      // Remove ANSI escape sequences
      .replace(this.ANSI_ESCAPE_REGEX, '')
      // Remove other control characters but keep newlines and tabs
      .replace(this.CONTROL_CHARS_REGEX, (char) => {
        return char === '\n' || char === '\t' ? char : '';
      })
      // Normalize whitespace
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Remove excessive whitespace but preserve structure
      .replace(/[ \t]+/g, ' ')
      .trim();
  }

  /**
   * Parse URL components (hostname and port)
   */
  private static parseUrlComponents(url: string): { hostname?: string; port?: number } {
    try {
      // Handle tcp:// URLs
      if (url.startsWith('tcp://')) {
        const hostPort = url.substring(6); // Remove 'tcp://'
        const parts = hostPort.split(':');
        if (parts.length >= 2) {
          return {
            hostname: parts[0],
            port: parseInt(parts[1], 10)
          };
        }
        return { hostname: parts[0] };
      }
      
      // Handle HTTP/HTTPS URLs
      const urlObj = new URL(url);
      return {
        hostname: urlObj.hostname,
        port: urlObj.port ? parseInt(urlObj.port, 10) : undefined
      };
    } catch (error) {
      // Fallback parsing for malformed URLs
      const parts = url.replace(/^https?:\/\//, '').replace(/^tcp:\/\//, '').split(':');
      if (parts.length >= 2) {
        return {
          hostname: parts[0],
          port: parseInt(parts[1], 10)
        };
      }
      return { hostname: parts[0] };
    }
  }

  /**
   * Validate if a URL looks like a valid tunnel URL
   */
  public static validateTunnelUrl(url: string): boolean {
    if (!url) return false;
    
    // Check for common tunnel URL patterns
    const validPatterns = [
      /^tcp:\/\/[a-zA-Z0-9\-\.]+:\d+$/,
      /^https:\/\/[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,}$/,
      /^http:\/\/[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,}$/
    ];
    
    return validPatterns.some(pattern => pattern.test(url));
  }

  /**
   * Extract multiple URLs from output (for cases where multiple tunnels are created)
   */
  public static extractAllUrls(output: string): string[] {
    const cleanedOutput = this.cleanOutput(output);
    const urls: string[] = [];
    
    // Collect all patterns from all strategies
    const allPatterns: RegExp[] = [];
    Object.values(this.PARSING_STRATEGIES).forEach(strategy => {
      allPatterns.push(...strategy.patterns);
    });
    
    // Find all matches
    for (const pattern of allPatterns) {
      const matches = cleanedOutput.match(new RegExp(pattern.source, 'gi'));
      if (matches) {
        urls.push(...matches);
      }
    }
    
    // Remove duplicates and validate
    return [...new Set(urls)].filter(url => this.validateTunnelUrl(url));
  }

  /**
   * Get parsing statistics for debugging
   */
  public static getParsingStats(output: string): {
    originalLength: number;
    cleanedLength: number;
    ansiSequencesRemoved: number;
    controlCharsRemoved: number;
    strategiesAvailable: number;
  } {
    const originalLength = output.length;
    const ansiMatches = output.match(this.ANSI_ESCAPE_REGEX);
    const controlMatches = output.match(this.CONTROL_CHARS_REGEX);
    const cleanedOutput = this.cleanOutput(output);
    
    return {
      originalLength,
      cleanedLength: cleanedOutput.length,
      ansiSequencesRemoved: ansiMatches ? ansiMatches.length : 0,
      controlCharsRemoved: controlMatches ? controlMatches.length : 0,
      strategiesAvailable: Object.keys(this.PARSING_STRATEGIES).length
    };
  }
}
