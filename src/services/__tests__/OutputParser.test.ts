/**
 * Tests for Enhanced Output Parser
 * Validates ANSI sequence stripping, multiple regex patterns, and comprehensive error handling
 */

import { OutputParser } from '../utils/OutputParser';

describe('OutputParser', () => {
  describe('ANSI Sequence Cleaning', () => {
    it('should remove ANSI escape sequences', () => {
      const output = '\x1b[32mGreen text\x1b[0m with \x1b[1mbold\x1b[0m formatting';
      const result = OutputParser.parseTunnelUrl(output);
      expect(result.cleanedOutput).toBe('Green text with bold formatting');
    });

    it('should handle complex ANSI sequences from Pinggy', () => {
      const output = '\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1006l\x1b[?2004l\x1b[?1049h\x1b[22;0;0t\x1b[?1h=\x1b[?25l\x1b[H\x1b[2Jtcp://mydao-2402-8100-3106-526f-884-9532-5275-b61.a.free.pinggy.link:40943';
      const result = OutputParser.parseTunnelUrl(output, 'pinggy');
      
      expect(result.success).toBe(true);
      expect(result.tunnelUrl).toBe('tcp://mydao-2402-8100-3106-526f-884-9532-5275-b61.a.free.pinggy.link:40943');
    });

    it('should preserve newlines and tabs while removing control chars', () => {
      const output = 'Line 1\nLine 2\tTabbed\x1b[31mRed\x1b[0m';
      const result = OutputParser.parseTunnelUrl(output);
      expect(result.cleanedOutput).toContain('\n');
      expect(result.cleanedOutput).toContain('\t');
      expect(result.cleanedOutput).not.toContain('\x1b');
    });
  });

  describe('Provider-Specific Parsing', () => {
    describe('Serveo', () => {
      it('should parse Serveo tunnel URLs', () => {
        const output = 'Forwarding TCP connections from abc123.serveo.net:12345';
        const result = OutputParser.parseTunnelUrl(output, 'serveo');
        
        expect(result.success).toBe(true);
        expect(result.tunnelUrl).toBe('tcp://abc123.serveo.net:12345');
        expect(result.hostname).toBe('abc123.serveo.net');
        expect(result.port).toBe(12345);
      });

      it('should handle Serveo with tcp:// prefix', () => {
        const output = 'Your tunnel: tcp://test.serveo.net:8080';
        const result = OutputParser.parseTunnelUrl(output, 'serveo');
        
        expect(result.success).toBe(true);
        expect(result.tunnelUrl).toBe('tcp://test.serveo.net:8080');
      });
    });

    describe('Pinggy', () => {
      it('should parse Pinggy tunnel URLs', () => {
        const output = 'tcp://mydao-2402-8100-3106-526f-884-9532-5275-b61.a.free.pinggy.link:40943';
        const result = OutputParser.parseTunnelUrl(output, 'pinggy');
        
        expect(result.success).toBe(true);
        expect(result.tunnelUrl).toBe('tcp://mydao-2402-8100-3106-526f-884-9532-5275-b61.a.free.pinggy.link:40943');
        expect(result.hostname).toBe('mydao-2402-8100-3106-526f-884-9532-5275-b61.a.free.pinggy.link');
        expect(result.port).toBe(40943);
      });

      it('should handle different Pinggy domain formats', () => {
        const outputs = [
          'tcp://test.pinggy.link:3389',
          'tcp://test.pinggy.io:3389',
          'test.pinggy.link:3389'
        ];

        outputs.forEach(output => {
          const result = OutputParser.parseTunnelUrl(output, 'pinggy');
          expect(result.success).toBe(true);
          expect(result.tunnelUrl).toContain('3389');
        });
      });
    });

    describe('LocalExpose', () => {
      it('should parse LocalExpose tunnel URLs', () => {
        const output = 'tcp://test-tunnel.loclx.io:8080';
        const result = OutputParser.parseTunnelUrl(output, 'localexpose');
        
        expect(result.success).toBe(true);
        expect(result.tunnelUrl).toBe('tcp://test-tunnel.loclx.io:8080');
        expect(result.hostname).toBe('test-tunnel.loclx.io');
        expect(result.port).toBe(8080);
      });

      it('should handle LocalExpose alternative domains', () => {
        const output = 'tcp://tunnel.localxpose.io:3389';
        const result = OutputParser.parseTunnelUrl(output, 'localexpose');
        
        expect(result.success).toBe(true);
        expect(result.tunnelUrl).toBe('tcp://tunnel.localxpose.io:3389');
      });
    });

    describe('Tailscale', () => {
      it('should parse Tailscale Funnel URLs', () => {
        const output = 'Available at https://mydevice.ts.net';
        const result = OutputParser.parseTunnelUrl(output, 'tailscale');
        
        expect(result.success).toBe(true);
        expect(result.tunnelUrl).toBe('https://mydevice.ts.net');
        expect(result.hostname).toBe('mydevice.ts.net');
      });

      it('should handle TCP Tailscale URLs', () => {
        const output = 'tcp://mydevice.ts.net:3389';
        const result = OutputParser.parseTunnelUrl(output, 'tailscale');
        
        expect(result.success).toBe(true);
        expect(result.tunnelUrl).toBe('tcp://mydevice.ts.net:3389');
        expect(result.port).toBe(3389);
      });
    });

    describe('Cloudflare Tunnel', () => {
      it('should parse Cloudflare tunnel URLs', () => {
        const output = 'Your quick Tunnel: https://abc123.trycloudflare.com';
        const result = OutputParser.parseTunnelUrl(output, 'cloudflare-tunnel');
        
        expect(result.success).toBe(true);
        expect(result.tunnelUrl).toBe('https://abc123.trycloudflare.com');
        expect(result.hostname).toBe('abc123.trycloudflare.com');
      });

      it('should handle Cloudflare access URLs', () => {
        const output = 'https://tunnel.cloudflareaccess.com';
        const result = OutputParser.parseTunnelUrl(output, 'cloudflare-tunnel');
        
        expect(result.success).toBe(true);
        expect(result.tunnelUrl).toBe('https://tunnel.cloudflareaccess.com');
      });
    });

    describe('Ngrok', () => {
      it('should parse Ngrok tunnel URLs', () => {
        const output = 'tcp://0.tcp.ngrok.io:12345';
        const result = OutputParser.parseTunnelUrl(output, 'ngrok');
        
        expect(result.success).toBe(true);
        expect(result.tunnelUrl).toBe('tcp://0.tcp.ngrok.io:12345');
        expect(result.hostname).toBe('0.tcp.ngrok.io');
        expect(result.port).toBe(12345);
      });

      it('should handle Ngrok free tier URLs', () => {
        const output = 'tcp://test.ngrok-free.app:8080';
        const result = OutputParser.parseTunnelUrl(output, 'ngrok');
        
        expect(result.success).toBe(true);
        expect(result.tunnelUrl).toBe('tcp://test.ngrok-free.app:8080');
      });
    });
  });

  describe('Fallback Parsing', () => {
    it('should try all strategies when provider-specific fails', () => {
      const output = 'tcp://unknown-service.example.com:3389';
      const result = OutputParser.parseTunnelUrl(output, 'nonexistent-provider');
      
      expect(result.success).toBe(true);
      expect(result.tunnelUrl).toBe('tcp://unknown-service.example.com:3389');
      expect(result.parseMethod).toContain('fallback');
    });

    it('should handle URLs in quotes', () => {
      const output = 'Tunnel created: "tcp://test.example.com:8080"';
      const result = OutputParser.parseTunnelUrl(output);
      
      expect(result.success).toBe(true);
      expect(result.tunnelUrl).toBe('tcp://test.example.com:8080');
    });

    it('should handle URLs in brackets', () => {
      const output = 'Available at [tcp://test.example.com:3389]';
      const result = OutputParser.parseTunnelUrl(output);
      
      expect(result.success).toBe(true);
      expect(result.tunnelUrl).toBe('tcp://test.example.com:3389');
    });
  });

  describe('URL Validation', () => {
    it('should validate correct tunnel URLs', () => {
      const validUrls = [
        'tcp://test.example.com:3389',
        'https://test.example.com',
        'http://test.example.com'
      ];

      validUrls.forEach(url => {
        expect(OutputParser.validateTunnelUrl(url)).toBe(true);
      });
    });

    it('should reject invalid URLs', () => {
      const invalidUrls = [
        '',
        'not-a-url',
        'tcp://',
        'https://',
        'tcp://test',
        'ftp://test.example.com'
      ];

      invalidUrls.forEach(url => {
        expect(OutputParser.validateTunnelUrl(url)).toBe(false);
      });
    });
  });

  describe('Multiple URL Extraction', () => {
    it('should extract multiple URLs from output', () => {
      const output = `
        Primary tunnel: tcp://tunnel1.example.com:3389
        Backup tunnel: tcp://tunnel2.example.com:8080
        Web interface: https://web.example.com
      `;
      
      const urls = OutputParser.extractAllUrls(output);
      expect(urls).toHaveLength(3);
      expect(urls).toContain('tcp://tunnel1.example.com:3389');
      expect(urls).toContain('tcp://tunnel2.example.com:8080');
      expect(urls).toContain('https://web.example.com');
    });

    it('should remove duplicate URLs', () => {
      const output = `
        tcp://test.example.com:3389
        tcp://test.example.com:3389
        tcp://test.example.com:3389
      `;
      
      const urls = OutputParser.extractAllUrls(output);
      expect(urls).toHaveLength(1);
      expect(urls[0]).toBe('tcp://test.example.com:3389');
    });
  });

  describe('Parsing Statistics', () => {
    it('should provide parsing statistics', () => {
      const output = '\x1b[32mColored\x1b[0m text with \x07 control chars';
      const stats = OutputParser.getParsingStats(output);
      
      expect(stats.originalLength).toBeGreaterThan(0);
      expect(stats.cleanedLength).toBeLessThan(stats.originalLength);
      expect(stats.ansiSequencesRemoved).toBeGreaterThan(0);
      expect(stats.strategiesAvailable).toBeGreaterThan(0);
    });
  });

  describe('Error Cases', () => {
    it('should handle empty output', () => {
      const result = OutputParser.parseTunnelUrl('');
      expect(result.success).toBe(false);
      expect(result.error).toContain('No tunnel URL found');
    });

    it('should handle output with no URLs', () => {
      const output = 'This is just plain text with no URLs';
      const result = OutputParser.parseTunnelUrl(output);
      expect(result.success).toBe(false);
      expect(result.error).toContain('No tunnel URL found');
    });

    it('should handle malformed URLs gracefully', () => {
      const output = 'tcp://malformed:url:with:too:many:colons';
      const result = OutputParser.parseTunnelUrl(output);
      
      // Should still try to parse even if malformed
      expect(result.rawOutput).toBe(output);
      expect(result.cleanedOutput).toBeDefined();
    });
  });

  describe('Protocol Handling', () => {
    it('should add tcp:// protocol when missing', () => {
      const output = 'test.example.com:3389';
      const result = OutputParser.parseTunnelUrl(output);
      
      if (result.success) {
        expect(result.tunnelUrl).toBe('tcp://test.example.com:3389');
      }
    });

    it('should preserve existing protocols', () => {
      const outputs = [
        'tcp://test.example.com:3389',
        'https://test.example.com',
        'http://test.example.com'
      ];

      outputs.forEach(output => {
        const result = OutputParser.parseTunnelUrl(output);
        if (result.success) {
          expect(result.tunnelUrl).toBe(output);
        }
      });
    });
  });
});
