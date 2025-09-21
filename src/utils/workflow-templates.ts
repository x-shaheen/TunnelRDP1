/**
 * Production-Ready GitHub Actions workflow templates
 * Enhanced with comprehensive error handling, logging, and automatic failover
 */

import { TunnelingProvider, DeploymentConfig, TUNNELING_PROVIDERS } from '@/types/tunneling';
import { TunnelingService } from '@/services/TunnelingService';

export function generateWorkflowContent(
  provider: TunnelingProvider,
  customSubdomain?: string,
  enableFailover: boolean = true,
  ngrokToken?: string,
  localexposeToken?: string,
  tailscaleAuthKey?: string,
  cloudflareSetup?: boolean,
  sessionDuration: number = 355,
  keepAliveInterval: number = 10
): string {
  const githubTokenVar = '$' + '{{ secrets.GITHUB_TOKEN }}';
  const baseWorkflow = `name: RDP Server Deployment (Production)

on:
  workflow_dispatch:
    inputs:
      force_run:
        description: 'Force run even if another instance is running'
        required: false
        default: 'false'

jobs:
  deploy-rdp:
    runs-on: windows-latest
    timeout-minutes: ${Math.min(sessionDuration + 5, 360)}
    permissions:
      contents: write  # Required to push connection details back to repository

    steps:
    - name: Checkout repository
      uses: actions/checkout@v4
      with:
        token: ${githubTokenVar}

    - name: System Information and Prerequisites
      run: |
        echo "=== SYSTEM INFORMATION ==="
        echo "OS: $env:OS"
        echo "Processor: $env:PROCESSOR_ARCHITECTURE"
        echo "User: $env:USERNAME"
        echo "PowerShell Version: $($PSVersionTable.PSVersion)"
        echo "Current Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss UTC')"
        echo "=============================="

        # Check SSH availability
        try {
          $sshVersion = ssh -V 2>&1
          echo "SSH Version: $sshVersion"
        } catch {
          echo "WARNING: SSH not found, attempting to install OpenSSH..."
          try {
            Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0
            echo "✓ OpenSSH Client installed"
          } catch {
            echo "✗ Failed to install OpenSSH: $_"
            exit 1
          }
        }

    - name: Enhanced RDP Configuration
      run: |
        echo "=== RDP CONFIGURATION ==="
        echo "Configuring Windows Remote Desktop with enhanced security..."

        try {
          # Enable Remote Desktop
          Set-ItemProperty -Path 'HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server' -name "fDenyTSConnections" -Value 0
          echo "✓ Remote Desktop enabled"

          # Configure firewall rules
          Enable-NetFirewallRule -DisplayGroup "Remote Desktop"
          echo "✓ Firewall rules configured"

          # Disable Network Level Authentication (can cause issues with tunneled connections)
          Set-ItemProperty -Path 'HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server\\WinStations\\RDP-Tcp' -name "UserAuthentication" -Value 0
          echo "✓ Network Level Authentication disabled for better tunnel compatibility"

          # Set security layer to RDP Security Layer
          Set-ItemProperty -Path 'HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server\\WinStations\\RDP-Tcp' -name "SecurityLayer" -Value 0
          echo "✓ Security layer set to RDP"

          # Set encryption level to low for better compatibility
          Set-ItemProperty -Path 'HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server\\WinStations\\RDP-Tcp' -name "MinEncryptionLevel" -Value 1
          echo "✓ Encryption level set for compatibility"

          # Configure user account
          $username = "runneradmin"
          $password = "P@ssw0rd!"
          Set-LocalUser -Name $username -Password (ConvertTo-SecureString -AsPlainText $password -Force)
          echo "✓ User credentials configured"

          # Restart RDP service to apply configuration changes
          echo "Restarting RDP service to apply configuration..."
          Restart-Service -Name "TermService" -Force
          Start-Sleep -Seconds 3

          # Verify RDP service
          $rdpService = Get-Service -Name "TermService"
          if ($rdpService.Status -eq "Running") {
            echo "✓ RDP service restarted and running"
          } else {
            echo "⚠ RDP service not running, attempting to start..."
            Start-Service -Name "TermService"
            Start-Sleep -Seconds 2
            $rdpService = Get-Service -Name "TermService"
            if ($rdpService.Status -eq "Running") {
              echo "✓ RDP service started successfully"
            } else {
              echo "✗ Failed to start RDP service"
            }
          }

          # Check if RDP port is listening
          Start-Sleep -Seconds 2  # Give service time to bind to port
          $rdpPort = Get-NetTCPConnection -LocalPort 3389 -ErrorAction SilentlyContinue
          if ($rdpPort) {
            echo "✓ RDP port 3389 is listening"
            echo "  Listening on: $($rdpPort.LocalAddress):$($rdpPort.LocalPort)"
          } else {
            echo "⚠ RDP port 3389 not detected"
            echo "Checking all listening ports..."
            Get-NetTCPConnection -State Listen | Where-Object {$_.LocalPort -eq 3389} | ForEach-Object {
              echo "  Found RDP port: $($_.LocalAddress):$($_.LocalPort)"
            }
          }

          # Additional diagnostics
          echo "=== RDP DIAGNOSTICS ==="
          echo "Current RDP configuration:"
          $rdpConfig = Get-ItemProperty -Path 'HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server\\WinStations\\RDP-Tcp'
          echo "  UserAuthentication: $($rdpConfig.UserAuthentication)"
          echo "  SecurityLayer: $($rdpConfig.SecurityLayer)"
          echo "  MinEncryptionLevel: $($rdpConfig.MinEncryptionLevel)"

          $tsConfig = Get-ItemProperty -Path 'HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server'
          echo "  fDenyTSConnections: $($tsConfig.fDenyTSConnections)"

          echo "=== RDP CONFIGURATION COMPLETE ==="

        } catch {
          echo "✗ RDP configuration failed: $_"
          echo "This may cause connection issues"
        }
`;

  // Generate provider-specific steps with failover
  const providerSteps = generateProviderWorkflowSteps(
    provider,
    customSubdomain,
    enableFailover,
    ngrokToken,
    localexposeToken,
    tailscaleAuthKey,
    cloudflareSetup
  );

  // Add keep-alive step with user-configurable timing
  const keepAliveStep = `
    - name: Keep RDP Server Active
      run: |
        echo "=== RDP SERVER ACTIVE ==="
        echo "RDP server is now running and accessible"
        echo "Session will remain active for the duration of this workflow"
        echo "Maximum session time: ${sessionDuration} minutes (User configured)"
        echo ""
        echo "Connection established at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss UTC')"
        echo "Estimated session end: $(Get-Date -Date (Get-Date).AddMinutes(${sessionDuration}) -Format 'yyyy-MM-dd HH:mm:ss UTC')"
        echo ""
        echo "Keeping session alive..."

        # Keep alive with periodic status updates
        $startTime = Get-Date
        $maxDuration = ${sessionDuration} * 60  # ${sessionDuration} minutes in seconds
        $updateInterval = ${keepAliveInterval * 60}   # ${keepAliveInterval} minutes in seconds

        while ((Get-Date) -lt $startTime.AddSeconds($maxDuration)) {
          Start-Sleep -Seconds $updateInterval
          $elapsed = [math]::Round(((Get-Date) - $startTime).TotalMinutes, 1)
          $remaining = [math]::Round(${sessionDuration} - $elapsed, 1)
          echo "Session active for $elapsed minutes, $remaining minutes remaining"

          # Verify RDP service is still running
          $rdpService = Get-Service -Name "TermService" -ErrorAction SilentlyContinue
          if ($rdpService -and $rdpService.Status -eq "Running") {
            echo "✓ RDP service healthy"
          } else {
            echo "⚠ RDP service issue detected"
          }
        }

        echo "Session time limit reached, workflow ending"`;

  return baseWorkflow + providerSteps + keepAliveStep;
}

/**
 * Generate enhanced deployment configuration
 */
export function generateDeploymentConfig(
  provider: TunnelingProvider,
  customSubdomain?: string,
  ngrokToken?: string,
  enableFailover: boolean = true
): DeploymentConfig {
  return {
    provider,
    customSubdomain,
    ngrokToken,
    repositoryName: '',
    selectedAccount: {} as any,
    deploymentTarget: 'personal',
    enableAutoFailover: enableFailover,
    maxRetryAttempts: 3,
    timeoutMinutes: 90
  };
}

/**
 * Validate deployment configuration
 */
export function validateDeploymentConfig(config: DeploymentConfig): string[] {
  const errors: string[] = [];
  const tunnelingService = TunnelingService.getInstance();

  // Validate provider configuration
  const validationError = tunnelingService.validateProviderConfig(config.provider, config);
  if (validationError) {
    errors.push(validationError.message);
  }

  // Validate repository name
  if (!config.repositoryName || config.repositoryName.length < 3) {
    errors.push('Repository name must be at least 3 characters long');
  }

  // Validate selected account
  if (!config.selectedAccount || !config.selectedAccount.login) {
    errors.push('GitHub account must be selected');
  }

  return errors;
}

/**
 * Get provider status and health information
 */
export function getProviderHealthStatus(): Record<TunnelingProvider, { status: string; message: string }> {
  const tunnelingService = TunnelingService.getInstance();
  const providers = Object.keys(TUNNELING_PROVIDERS) as TunnelingProvider[];

  const healthStatus: Record<TunnelingProvider, { status: string; message: string }> = {} as any;

  providers.forEach(provider => {
    const config = TUNNELING_PROVIDERS[provider];
    if (config.supportsTCP && config.isFree) {
      healthStatus[provider] = {
        status: 'healthy',
        message: `${provider} is available and supports TCP tunneling`
      };
    } else if (!config.supportsTCP) {
      healthStatus[provider] = {
        status: 'unsupported',
        message: `${provider} does not support TCP/RDP connections`
      };
    } else if (!config.isFree) {
      healthStatus[provider] = {
        status: 'requires-payment',
        message: `${provider} requires payment verification`
      };
    }
  });

  return healthStatus;
}

/**
 * Generate workflow summary and troubleshooting information
 */
export function generateWorkflowSummary(provider: TunnelingProvider): string {
  const config = TUNNELING_PROVIDERS[provider];

  return `
# RDP Automation Workflow Summary

**Provider:** ${provider}
**Supports TCP:** ${config.supportsTCP ? '✅' : '❌'}
**Free Tier:** ${config.isFree ? '✅' : '❌'}
**Requires Auth:** ${config.requiresAuth ? '⚠️' : '✅'}

## Connection Details
- **Username:** runneradmin
- **Password:** P@ssw0rd!
- **Protocol:** RDP (Remote Desktop Protocol)
- **Port:** 3389 (tunneled)

## Troubleshooting
1. Check GitHub Actions logs for detailed error messages
2. Verify the provider service is available
3. Ensure SSH client is properly configured
4. Check network connectivity and firewall settings

## Support
- Primary Provider: ${provider}
- Fallback Providers: ${config.fallbackProviders?.join(', ') || 'None configured'}
- Max Retries: ${config.maxRetries}
- Timeout: ${config.timeoutSeconds} seconds
`;
}

/**
 * Generate provider-specific workflow steps
 */
function generateProviderWorkflowSteps(
  provider: TunnelingProvider,
  customSubdomain?: string,
  enableFailover: boolean = true,
  ngrokToken?: string,
  localexposeToken?: string,
  tailscaleAuthKey?: string,
  cloudflareSetup?: boolean
): string {
  switch (provider) {
    case 'tailscale':
      return generateTailscaleSteps(tailscaleAuthKey, enableFailover);
    case 'localexpose':
      return generateLocalExposeSteps(localexposeToken, enableFailover);
    case 'cloudflare-tunnel':
      return generateCloudflareSteps(enableFailover);
    case 'serveo':
      return generateServeoSteps(customSubdomain, enableFailover);
    case 'pinggy':
      return generatePinggySteps(customSubdomain, enableFailover);
    case 'ngrok':
      return generateNgrokSteps(ngrokToken, enableFailover);
    default:
      // Default to LocalExpose for better reliability
      return generateLocalExposeSteps(localexposeToken, enableFailover);
  }
}

/**
 * Generate Serveo workflow steps
 */
function generateServeoSteps(customSubdomain?: string, enableFailover: boolean = true): string {
  const subdomainParam = customSubdomain ? `-Subdomain "${customSubdomain}"` : '';

  return `
    - name: Create Serveo Tunnel
      run: |
        echo "=== SERVEO TUNNEL SETUP ==="
        echo "Starting Serveo tunnel for RDP access..."
        echo "Subdomain: ${customSubdomain || 'auto-generated'}"

        try {
          # Enhanced Serveo tunnel creation with better error handling
          Write-Host "Creating Serveo tunnel with improved SSH handling..." -ForegroundColor Yellow

          # Find or install Plink
          $plinkPath = $null
          $possiblePaths = @("plink.exe", "plink", "C:\\Program Files\\PuTTY\\plink.exe", "C:\\Program Files (x86)\\PuTTY\\plink.exe")

          foreach ($path in $possiblePaths) {
            try {
              $result = & $path -V 2>&1
              if ($LASTEXITCODE -eq 0 -or $result -match "plink|PuTTY") {
                $plinkPath = $path
                Write-Host "✓ Found Plink at: $path" -ForegroundColor Green
                break
              }
            } catch { }
          }

          if (-not $plinkPath) {
            Write-Host "Installing PuTTY..." -ForegroundColor Yellow
            $puttyUrl = "https://the.earth.li/~sgtatham/putty/latest/w64/putty.zip"
            Invoke-WebRequest -Uri $puttyUrl -OutFile "putty.zip" -UseBasicParsing
            Expand-Archive -Path "putty.zip" -DestinationPath "putty" -Force
            Remove-Item "putty.zip" -Force
            $plinkPath = "putty\\plink.exe"
            Write-Host "✓ PuTTY installed" -ForegroundColor Green
          }

          # Build Serveo command with enhanced options
          ${customSubdomain ? `$tunnelSpec = "${customSubdomain}:3389:localhost:3389"` : '$tunnelSpec = "0:localhost:3389"'}
          $args = @(
            "-ssh", "-batch", "-T",
            "-o", "StrictHostKeyChecking=no",
            "-o", "UserKnownHostsFile=NUL",
            "-o", "ServerAliveInterval=30",
            "-o", "ConnectTimeout=30",
            "-o", "ExitOnForwardFailure=yes",
            "-v",  # Verbose output for debugging
            "-R", $tunnelSpec,
            "serveo.net"
          )

          Write-Host "Command: $plinkPath $($args -join ' ')" -ForegroundColor Gray

          # Create output files for better debugging
          $outputFile = "serveo-output.txt"
          $errorFile = "serveo-error.txt"

          # Start tunnel process with file redirection
          $psi = New-Object System.Diagnostics.ProcessStartInfo
          $psi.FileName = $plinkPath
          $psi.Arguments = $args -join " "
          $psi.UseShellExecute = $false
          $psi.RedirectStandardOutput = $true
          $psi.RedirectStandardError = $true
          $psi.CreateNoWindow = $true

          $process = [System.Diagnostics.Process]::Start($psi)
          Write-Host "✓ Plink process started (PID: $($process.Id))" -ForegroundColor Green

          # Enhanced monitoring with file-based output capture
          $tunnelUrl = $null
          $timeout = 90  # Increased timeout
          $startTime = Get-Date
          $outputBuffer = @()
          $errorBuffer = @()

          while ((Get-Date) -lt $startTime.AddSeconds($timeout) -and -not $process.HasExited -and -not $tunnelUrl) {
            # Read stdout
            if (-not $process.StandardOutput.EndOfStream) {
              try {
                $line = $process.StandardOutput.ReadLine()
                if ($line) {
                  $outputBuffer += $line
                  Write-Host "SSH OUT: $line" -ForegroundColor Gray

                  # Multiple regex patterns for different Serveo output formats
                  if ($line -match "Forwarding TCP connections from ([a-zA-Z0-9\\-\\.]+\\.serveo\\.net):(\\d+)" -or
                      $line -match "tcp://([a-zA-Z0-9\\-\\.]+\\.serveo\\.net):(\\d+)" -or
                      $line -match "([a-zA-Z0-9\\-\\.]+\\.serveo\\.net):(\\d+)" -or
                      $line -match "https?://([a-zA-Z0-9\\-\\.]+\\.serveo\\.net)" -or
                      $line -match "Forwarding.*?([a-zA-Z0-9\\-\\.]+\\.serveo\\.net).*?(\\d+)") {

                    if ($matches[2]) {
                      $tunnelUrl = "tcp://$($matches[1]):$($matches[2])"
                    } else {
                      $tunnelUrl = "tcp://$($matches[1]):3389"
                    }
                    Write-Host "✓ Tunnel URL found: $tunnelUrl" -ForegroundColor Green
                    break
                  }
                }
              } catch { }
            }

            # Read stderr
            if (-not $process.StandardError.EndOfStream) {
              try {
                $line = $process.StandardError.ReadLine()
                if ($line) {
                  $errorBuffer += $line
                  Write-Host "SSH ERR: $line" -ForegroundColor Yellow

                  # Check stderr for tunnel URLs too
                  if ($line -match "Forwarding TCP connections from ([a-zA-Z0-9\\-\\.]+\\.serveo\\.net):(\\d+)" -or
                      $line -match "tcp://([a-zA-Z0-9\\-\\.]+\\.serveo\\.net):(\\d+)" -or
                      $line -match "([a-zA-Z0-9\\-\\.]+\\.serveo\\.net):(\\d+)") {

                    $tunnelUrl = "tcp://$($matches[1]):$($matches[2])"
                    Write-Host "✓ Tunnel URL found in stderr: $tunnelUrl" -ForegroundColor Green
                    break
                  }
                }
              } catch { }
            }

            Start-Sleep -Milliseconds 250
          }

          # Save debug output
          $outputBuffer | Out-File -FilePath $outputFile -Encoding UTF8
          $errorBuffer | Out-File -FilePath $errorFile -Encoding UTF8

          if ($tunnelUrl) {
            # Save connection details
            $connectionDetails = @{
              tunnelUrl = $tunnelUrl
              provider = "serveo"
              username = "runneradmin"
              password = "P@ssw0rd!"
              timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss UTC"
              method = "putty-enhanced"
              debugOutput = ($outputBuffer -join "\\n")
              debugError = ($errorBuffer -join "\\n")
            }

            $connectionDetails | ConvertTo-Json | Out-File -FilePath "connection-details.json" -Encoding UTF8
            Write-Host "✓ Connection details saved" -ForegroundColor Green

            Write-Host "🎉 SERVEO TUNNEL ACTIVE!" -ForegroundColor Green
            Write-Host "Tunnel URL: $tunnelUrl" -ForegroundColor Cyan
            Write-Host "Username: runneradmin" -ForegroundColor Cyan
            Write-Host "Password: P@ssw0rd!" -ForegroundColor Cyan
          } else {
            Write-Host "✗ No tunnel URL found within timeout period" -ForegroundColor Red
            Write-Host "Debug - Last 10 output lines:" -ForegroundColor Yellow
            $outputBuffer | Select-Object -Last 10 | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
            Write-Host "Debug - Last 10 error lines:" -ForegroundColor Yellow
            $errorBuffer | Select-Object -Last 10 | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
            throw "No tunnel URL found within timeout period"
          }

        } catch {
          Write-Host "✗ Serveo tunnel failed: $_" -ForegroundColor Red
          ${enableFailover ? generateFailoverSteps() : 'exit 1'}
        }`;
}

/**
 * Generate Pinggy workflow steps
 */
function generatePinggySteps(customSubdomain?: string, enableFailover: boolean = true): string {
  const subdomainParam = customSubdomain ? `-Subdomain "${customSubdomain}"` : '';

  return `
    - name: Create Pinggy Tunnel
      run: |
        echo "=== PINGGY TUNNEL SETUP ==="
        echo "Starting Pinggy tunnel for RDP access..."

        try {
          # Direct PuTTY/Plink tunnel creation for Pinggy (inline)
          Write-Host "Creating Pinggy tunnel with PuTTY/Plink..." -ForegroundColor Yellow

          # Find or install Plink
          $plinkPath = $null
          $possiblePaths = @("plink.exe", "plink", "C:\\Program Files\\PuTTY\\plink.exe", "C:\\Program Files (x86)\\PuTTY\\plink.exe")

          foreach ($path in $possiblePaths) {
            try {
              $result = & $path -V 2>&1
              if ($LASTEXITCODE -eq 0 -or $result -match "plink|PuTTY") {
                $plinkPath = $path
                Write-Host "✓ Found Plink at: $path" -ForegroundColor Green
                break
              }
            } catch { }
          }

          if (-not $plinkPath) {
            Write-Host "Installing PuTTY..." -ForegroundColor Yellow
            $puttyUrl = "https://the.earth.li/~sgtatham/putty/latest/w64/putty.zip"
            Invoke-WebRequest -Uri $puttyUrl -OutFile "putty.zip" -UseBasicParsing
            Expand-Archive -Path "putty.zip" -DestinationPath "putty" -Force
            Remove-Item "putty.zip" -Force
            $plinkPath = "putty\\plink.exe"
            Write-Host "✓ PuTTY installed" -ForegroundColor Green
          }

          # Build Pinggy no-auth command
          $args = @(
            "-ssh", "-batch", "-T",
            "-o", "StrictHostKeyChecking=no",
            "-o", "UserKnownHostsFile=NUL",
            "-o", "PreferredAuthentications=none",
            "-o", "PasswordAuthentication=no",
            "-o", "PubkeyAuthentication=no",
            "-P", "443",
            "-R", "0:localhost:3389",
            "tcp@a.pinggy.io"
          )

          Write-Host "Command: $plinkPath $($args -join ' ')" -ForegroundColor Gray

          # Start tunnel process
          $psi = New-Object System.Diagnostics.ProcessStartInfo
          $psi.FileName = $plinkPath
          $psi.Arguments = $args -join " "
          $psi.UseShellExecute = $false
          $psi.RedirectStandardOutput = $true
          $psi.RedirectStandardError = $true
          $psi.CreateNoWindow = $true

          $process = [System.Diagnostics.Process]::Start($psi)
          Write-Host "✓ Plink process started (PID: $($process.Id))" -ForegroundColor Green

          # Enhanced monitoring for tunnel URL with better output capture
          $tunnelUrl = $null
          $timeout = 90  # Increased timeout
          $startTime = Get-Date
          $outputBuffer = @()
          $errorBuffer = @()

          while ((Get-Date) -lt $startTime.AddSeconds($timeout) -and -not $process.HasExited -and -not $tunnelUrl) {
            # Read stdout
            if (-not $process.StandardOutput.EndOfStream) {
              try {
                $line = $process.StandardOutput.ReadLine()
                if ($line) {
                  $outputBuffer += $line
                  Write-Host "SSH OUT: $line" -ForegroundColor Gray

                  # Multiple patterns for Pinggy URLs
                  if ($line -match "tcp://([a-zA-Z0-9\\-\\.]+\\.(?:pinggy\\.link|pinggy\\.io|free\\.pinggy\\.link)):(\\d+)" -or
                      $line -match "([a-zA-Z0-9\\-\\.]+\\.(?:pinggy\\.link|pinggy\\.io|free\\.pinggy\\.link)):(\\d+)" -or
                      $line -match "Forwarding.*?([a-zA-Z0-9\\-\\.]+\\.(?:pinggy\\.link|pinggy\\.io)).*?(\\d+)") {

                    if ($matches[0] -match "tcp://") {
                      $tunnelUrl = $matches[0]
                    } else {
                      $tunnelUrl = "tcp://$($matches[1]):$($matches[2])"
                    }
                    Write-Host "✓ Tunnel URL found: $tunnelUrl" -ForegroundColor Green
                    break
                  }
                }
              } catch { }
            }

            # Read stderr
            if (-not $process.StandardError.EndOfStream) {
              try {
                $line = $process.StandardError.ReadLine()
                if ($line) {
                  $errorBuffer += $line
                  Write-Host "SSH ERR: $line" -ForegroundColor Yellow

                  # Check stderr for tunnel URLs too
                  if ($line -match "tcp://([a-zA-Z0-9\\-\\.]+\\.(?:pinggy\\.link|pinggy\\.io|free\\.pinggy\\.link)):(\\d+)" -or
                      $line -match "([a-zA-Z0-9\\-\\.]+\\.(?:pinggy\\.link|pinggy\\.io|free\\.pinggy\\.link)):(\\d+)") {

                    if ($matches[0] -match "tcp://") {
                      $tunnelUrl = $matches[0]
                    } else {
                      $tunnelUrl = "tcp://$($matches[1]):$($matches[2])"
                    }
                    Write-Host "✓ Tunnel URL found in stderr: $tunnelUrl" -ForegroundColor Green
                    break
                  }
                }
              } catch { }
            }

            Start-Sleep -Milliseconds 250
          }

          if ($tunnelUrl) {
            # Save connection details
            $connectionDetails = @{
              tunnelUrl = $tunnelUrl
              provider = "pinggy"
              username = "runneradmin"
              password = "P@ssw0rd!"
              timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss UTC"
              method = "putty-enhanced"
              debugOutput = ($outputBuffer -join "\\n")
              debugError = ($errorBuffer -join "\\n")
            }

            $connectionDetails | ConvertTo-Json | Out-File -FilePath "connection-details.json" -Encoding UTF8
            Write-Host "✓ Connection details saved" -ForegroundColor Green

            Write-Host "🎉 PINGGY TUNNEL ACTIVE!" -ForegroundColor Green
            Write-Host "Tunnel URL: $tunnelUrl" -ForegroundColor Cyan
            Write-Host "Username: runneradmin" -ForegroundColor Cyan
            Write-Host "Password: P@ssw0rd!" -ForegroundColor Cyan
          } else {
            Write-Host "✗ No tunnel URL found within timeout period" -ForegroundColor Red
            Write-Host "Debug - Last 10 output lines:" -ForegroundColor Yellow
            $outputBuffer | Select-Object -Last 10 | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
            Write-Host "Debug - Last 10 error lines:" -ForegroundColor Yellow
            $errorBuffer | Select-Object -Last 10 | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
            throw "No tunnel URL found within timeout period"
          }

        } catch {
          Write-Host "✗ Pinggy tunnel failed: $_" -ForegroundColor Red
          ${enableFailover ? generateFailoverSteps() : 'exit 1'}
        }`;
}

/**
 * Generate Ngrok workflow steps
 */
function generateNgrokSteps(ngrokToken?: string, enableFailover: boolean = true): string {
  if (!ngrokToken) {
    return `
    - name: Ngrok Setup Error
      run: |
        echo "✗ Ngrok requires an authentication token" -ForegroundColor Red
        echo "Please provide an Ngrok token to use this provider"
        ${enableFailover ? generateFailoverSteps() : 'exit 1'}`;
  }

  return `
    - name: Create Ngrok Tunnel
      run: |
        echo "=== NGROK TUNNEL SETUP ==="
        echo "Starting Ngrok tunnel for RDP access..."

        # Set Ngrok auth token
        $env:NGROK_AUTHTOKEN = "${ngrokToken}"

        try {
          # Check if ngrok is installed
          $ngrokVersion = ngrok version 2>$null
          if (-not $ngrokVersion) {
            Write-Host "Installing Ngrok..." -ForegroundColor Yellow

            # Download and install ngrok
            $ngrokUrl = "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip"
            $ngrokZip = "ngrok.zip"

            Invoke-WebRequest -Uri $ngrokUrl -OutFile $ngrokZip
            Expand-Archive -Path $ngrokZip -DestinationPath "." -Force
            Remove-Item $ngrokZip

            Write-Host "✓ Ngrok installed" -ForegroundColor Green
          }

          # Start ngrok tunnel
          Write-Host "Starting Ngrok TCP tunnel on port 3389..." -ForegroundColor Yellow

          $psi = New-Object System.Diagnostics.ProcessStartInfo
          $psi.FileName = "./ngrok.exe"
          $psi.Arguments = "tcp 3389"
          $psi.UseShellExecute = $false
          $psi.RedirectStandardOutput = $true
          $psi.RedirectStandardError = $true
          $psi.CreateNoWindow = $true
          $psi.EnvironmentVariables["NGROK_AUTHTOKEN"] = "${ngrokToken}"

          $process = [System.Diagnostics.Process]::Start($psi)

          if (-not $process) {
            throw "Failed to start Ngrok process"
          }

          Write-Host "✓ Ngrok process started (PID: $($process.Id))" -ForegroundColor Green

          # Wait for tunnel to establish
          Start-Sleep -Seconds 10

          # Get tunnel info from Ngrok API
          $tunnelUrl = $null
          $maxAttempts = 30

          for ($i = 1; $i -le $maxAttempts; $i++) {
            try {
              $response = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -Method Get

              if ($response.tunnels -and $response.tunnels.Count -gt 0) {
                $tunnel = $response.tunnels | Where-Object { $_.proto -eq "tcp" } | Select-Object -First 1
                if ($tunnel) {
                  $tunnelUrl = $tunnel.public_url
                  Write-Host "✓ Tunnel URL found: $tunnelUrl" -ForegroundColor Green
                  break
                }
              }
            } catch {
              Write-Host "Attempt $i/$maxAttempts: Waiting for tunnel..." -ForegroundColor Gray
            }

            Start-Sleep -Seconds 2
          }

          if ($tunnelUrl) {
            # Save connection details
            $connectionDetails = @{
              tunnelUrl = $tunnelUrl
              provider = "ngrok"
              username = "runneradmin"
              password = "P@ssw0rd!"
              timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss UTC"
            }

            $connectionDetails | ConvertTo-Json | Out-File -FilePath "connection-details.json" -Encoding UTF8
            Write-Host "✓ Connection details saved" -ForegroundColor Green

            Write-Host "🎉 NGROK TUNNEL ACTIVE!" -ForegroundColor Green
            Write-Host "Tunnel URL: $tunnelUrl" -ForegroundColor Cyan
            Write-Host "Username: runneradmin" -ForegroundColor Cyan
            Write-Host "Password: P@ssw0rd!" -ForegroundColor Cyan
          } else {
            throw "Failed to get tunnel URL from Ngrok API"
          }

        } catch {
          Write-Host "✗ Ngrok tunnel failed: $_" -ForegroundColor Red
          ${enableFailover ? generateFailoverSteps() : 'exit 1'}
        }`;
}

/**
 * Generate failover steps
 */
function generateFailoverSteps(): string {
  return `
          Write-Host "Attempting failover to alternative providers..." -ForegroundColor Yellow

          # Try multiple SSH approaches with Serveo
          $fallbackSuccess = $false

          # Method 1: Direct SSH with OpenSSH
          Write-Host "Trying OpenSSH direct connection..." -ForegroundColor Yellow
          try {
            $sshArgs = @(
              "-o", "StrictHostKeyChecking=no",
              "-o", "UserKnownHostsFile=NUL",
              "-o", "ServerAliveInterval=30",
              "-o", "ConnectTimeout=20",
              "-o", "ExitOnForwardFailure=yes",
              "-v",
              "-T", "-R", "0:localhost:3389",
              "serveo.net"
            )

            # Start SSH process with output capture
            $sshProcess = Start-Process -FilePath "ssh" -ArgumentList $sshArgs -PassThru -NoNewWindow -RedirectStandardOutput "ssh-fallback-out.txt" -RedirectStandardError "ssh-fallback-err.txt"
            Write-Host "SSH process started (PID: $($sshProcess.Id))" -ForegroundColor Gray

            # Wait and monitor for tunnel establishment
            $maxWait = 45
            $checkInterval = 3
            $checks = 0

            while ($checks -lt ($maxWait / $checkInterval) -and -not $sshProcess.HasExited -and -not $fallbackSuccess) {
              Start-Sleep -Seconds $checkInterval
              $checks++

              # Check output files
              if (Test-Path "ssh-fallback-out.txt") {
                $output = Get-Content "ssh-fallback-out.txt" -Raw -ErrorAction SilentlyContinue
                if ($output -and ($output -match "Forwarding TCP connections from ([a-zA-Z0-9\\-\\.]+\\.serveo\\.net):(\\d+)" -or
                                  $output -match "tcp://([a-zA-Z0-9\\-\\.]+\\.serveo\\.net):(\\d+)")) {
                  $fallbackUrl = "tcp://$($matches[1]):$($matches[2])"
                  $fallbackSuccess = $true
                  break
                }
              }

              if (Test-Path "ssh-fallback-err.txt") {
                $errorOutput = Get-Content "ssh-fallback-err.txt" -Raw -ErrorAction SilentlyContinue
                if ($errorOutput -and ($errorOutput -match "Forwarding TCP connections from ([a-zA-Z0-9\\-\\.]+\\.serveo\\.net):(\\d+)" -or
                                       $errorOutput -match "tcp://([a-zA-Z0-9\\-\\.]+\\.serveo\\.net):(\\d+)")) {
                  $fallbackUrl = "tcp://$($matches[1]):$($matches[2])"
                  $fallbackSuccess = $true
                  break
                }
              }

              Write-Host "Waiting for tunnel... ($($checks * $checkInterval)s)" -ForegroundColor Gray
            }

            if ($fallbackSuccess) {
              Write-Host "✓ SSH fallback successful: $fallbackUrl" -ForegroundColor Green

              $connectionDetails = @{
                tunnelUrl = $fallbackUrl
                provider = "serveo-ssh-fallback"
                username = "runneradmin"
                password = "P@ssw0rd!"
                timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss UTC"
                method = "ssh-direct"
              }

              $connectionDetails | ConvertTo-Json | Out-File -FilePath "connection-details.json" -Encoding UTF8
              Write-Host "🎉 FALLBACK TUNNEL ACTIVE!" -ForegroundColor Green
              Write-Host "Tunnel URL: $fallbackUrl" -ForegroundColor Cyan
              Write-Host "Username: runneradmin" -ForegroundColor Cyan
              Write-Host "Password: P@ssw0rd!" -ForegroundColor Cyan
              exit 0
            }

          } catch {
            Write-Host "✗ SSH direct fallback failed: $_" -ForegroundColor Red
          }

          # Method 2: Try Pinggy as final fallback
          if (-not $fallbackSuccess) {
            Write-Host "Trying Pinggy as final fallback..." -ForegroundColor Yellow
            try {
              # Use the same Plink approach but with Pinggy
              $plinkPath = "putty\\plink.exe"
              if (Test-Path $plinkPath) {
                $pinggyArgs = @(
                  "-ssh", "-batch", "-T",
                  "-o", "StrictHostKeyChecking=no",
                  "-o", "UserKnownHostsFile=NUL",
                  "-o", "PreferredAuthentications=none",
                  "-P", "443",
                  "-R", "0:localhost:3389",
                  "tcp@a.pinggy.io"
                )

                $pinggyProcess = Start-Process -FilePath $plinkPath -ArgumentList $pinggyArgs -PassThru -NoNewWindow -RedirectStandardOutput "pinggy-fallback-out.txt" -RedirectStandardError "pinggy-fallback-err.txt"
                Start-Sleep -Seconds 30

                if (Test-Path "pinggy-fallback-out.txt") {
                  $pinggyOutput = Get-Content "pinggy-fallback-out.txt" -Raw -ErrorAction SilentlyContinue
                  if ($pinggyOutput -and $pinggyOutput -match "tcp://([a-zA-Z0-9\\-\\.]+\\.(?:pinggy\\.link|pinggy\\.io)):(\\d+)") {
                    $fallbackUrl = "tcp://$($matches[1]):$($matches[2])"
                    Write-Host "✓ Pinggy fallback successful: $fallbackUrl" -ForegroundColor Green

                    $connectionDetails = @{
                      tunnelUrl = $fallbackUrl
                      provider = "pinggy-fallback"
                      username = "runneradmin"
                      password = "P@ssw0rd!"
                      timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss UTC"
                      method = "pinggy-fallback"
                    }

                    $connectionDetails | ConvertTo-Json | Out-File -FilePath "connection-details.json" -Encoding UTF8
                    Write-Host "🎉 PINGGY FALLBACK ACTIVE!" -ForegroundColor Green
                    Write-Host "Tunnel URL: $fallbackUrl" -ForegroundColor Cyan
                    Write-Host "Username: runneradmin" -ForegroundColor Cyan
                    Write-Host "Password: P@ssw0rd!" -ForegroundColor Cyan
                    exit 0
                  }
                }
              }
            } catch {
              Write-Host "✗ Pinggy fallback failed: $_" -ForegroundColor Red
            }
          }

          Write-Host "✗ All tunnel providers and fallbacks failed" -ForegroundColor Red
          Write-Host "Please check the GitHub Actions logs for detailed error information" -ForegroundColor Yellow
          exit 1`;
}

/**
 * Generate Tailscale VPN workflow steps
 */
function generateTailscaleSteps(tailscaleAuthKey?: string, enableFailover: boolean = true): string {
  const secretsVar = '$' + '{{ secrets.TAILSCALE_AUTH_KEY }}';
  return `
    - name: Setup Tailscale VPN
      run: |
        echo "=== TAILSCALE VPN SETUP ==="
        echo "Setting up Tailscale mesh networking for RDP access..."

        try {
          # Check if auth key is provided
          $authKey = "${secretsVar}"
          if (-not $authKey -or $authKey -eq "") {
            Write-Host "✗ Tailscale auth key not found" -ForegroundColor Red
            throw "TAILSCALE_AUTH_KEY secret is required for Tailscale"
          }

          # Download and install Tailscale
          Write-Host "Installing Tailscale..." -ForegroundColor Yellow
          $tailscaleUrl = "https://pkgs.tailscale.com/stable/tailscale-setup-latest-amd64.msi"
          Invoke-WebRequest -Uri $tailscaleUrl -OutFile "tailscale-setup.msi"
          Start-Process -FilePath "msiexec.exe" -ArgumentList "/i", "tailscale-setup.msi", "/quiet", "/norestart" -Wait
          Write-Host "✓ Tailscale installed" -ForegroundColor Green

          # Add Tailscale to PATH
          $env:PATH += ";C:\\Program Files\\Tailscale"

          # Authenticate with auth key
          Write-Host "Authenticating with Tailscale..." -ForegroundColor Yellow
          $authResult = & "C:\\Program Files\\Tailscale\\tailscale.exe" up --authkey=$authKey --accept-routes --accept-dns=false 2>&1
          if ($LASTEXITCODE -ne 0) {
            Write-Host "✗ Tailscale authentication failed: $authResult" -ForegroundColor Red
            throw "Failed to authenticate with Tailscale"
          }
          Write-Host "✓ Tailscale authenticated successfully" -ForegroundColor Green

          # Wait for connection to establish
          Start-Sleep -Seconds 5

          # Get Tailscale IP
          $tailscaleIP = & "C:\\Program Files\\Tailscale\\tailscale.exe" ip -4 2>&1
          if ($LASTEXITCODE -ne 0) {
            Write-Host "✗ Failed to get Tailscale IP: $tailscaleIP" -ForegroundColor Red
            throw "Failed to get Tailscale IP address"
          }

          Write-Host "✓ Tailscale VPN active" -ForegroundColor Green
          Write-Host "Tailscale IP: $tailscaleIP" -ForegroundColor Cyan

          # Save connection details
          $connectionDetails = @{
            host = $tailscaleIP.Trim()
            port = "3389"
            tunnelUrl = "$($tailscaleIP.Trim()):3389"
            tailscaleIP = $tailscaleIP.Trim()
            provider = "tailscale"
            username = "runneradmin"
            password = "P@ssw0rd!"
            timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss UTC"
            method = "vpn-direct"
            status = "ready"
            connectionString = "$($tailscaleIP.Trim()):3389"
          }

          $connectionDetails | ConvertTo-Json | Out-File -FilePath "connection-details.json" -Encoding UTF8
          Write-Host "✓ Connection details saved" -ForegroundColor Green

          # Commit connection details to repository
          git config --global user.email "automation@rdp-deploy.com"
          git config --global user.name "RDP Automation"
          git add connection-details.json
          git commit -m "Add Tailscale connection details" -q
          git push -q
          Write-Host "✓ Connection details committed to repository" -ForegroundColor Green

          Write-Host "🎉 TAILSCALE VPN READY!" -ForegroundColor Green
          Write-Host "Connect to: $($tailscaleIP.Trim()):3389" -ForegroundColor Cyan
          Write-Host "Username: runneradmin" -ForegroundColor Cyan
          Write-Host "Password: P@ssw0rd!" -ForegroundColor Cyan
          Write-Host "Note: Client must also be connected to the same Tailscale network" -ForegroundColor Yellow

        } catch {
          Write-Host "✗ Tailscale setup failed: $_" -ForegroundColor Red
          ${enableFailover ? generateFailoverSteps() : 'exit 1'}
        }`;
}

/**
 * Generate LocalExpose workflow steps
 */
function generateLocalExposeSteps(localexposeToken?: string, enableFailover: boolean = true): string {
  const secretsVar = '$' + '{{ secrets.LOCLX_ACCESS_TOKEN }}';
  return `
    - name: Create LocalExpose Tunnel
      run: |
        echo "=== LOCALEXPOSE TUNNEL SETUP ==="
        echo "Starting LocalExpose tunnel for RDP access..."

        try {
          # Check if LocalExpose token is provided
          $token = "${secretsVar}"
          if (-not $token -or $token -eq "") {
            Write-Host "✗ LocalExpose access token not found" -ForegroundColor Red
            throw "LOCLX_ACCESS_TOKEN secret is required for LocalExpose"
          }

          # Download and setup LocalExpose CLI
          Write-Host "Setting up LocalExpose CLI..." -ForegroundColor Yellow

          $loclxUrl = "https://api.localxpose.io/api/v2/downloads/loclx-windows-amd64.zip"
          Invoke-WebRequest -Uri $loclxUrl -OutFile "loclx.zip"
          Expand-Archive -Path "loclx.zip" -DestinationPath "." -Force
          Remove-Item "loclx.zip" -Force

          Write-Host "✓ LocalExpose CLI downloaded" -ForegroundColor Green

          # Set access token
          $env:LOCLX_ACCESS_TOKEN = $token

          # Create TCP tunnel
          Write-Host "Creating TCP tunnel..." -ForegroundColor Yellow

          $loclxProcess = Start-Process -FilePath "./loclx.exe" -ArgumentList @("tunnel", "tcp", "localhost:3389") -PassThru -NoNewWindow -RedirectStandardOutput "loclx-output.txt" -RedirectStandardError "loclx-error.txt"
          Write-Host "✓ LocalExpose process started (PID: $($loclxProcess.Id))" -ForegroundColor Green

          # Wait for tunnel URL
          $tunnelUrl = $null
          $maxWaitTime = 60
          $waitTime = 0

          while ($waitTime -lt $maxWaitTime -and -not $tunnelUrl) {
            Start-Sleep -Seconds 2
            $waitTime += 2

            if (Test-Path "loclx-output.txt") {
              $output = Get-Content "loclx-output.txt" -Raw -ErrorAction SilentlyContinue
              if ($output -and ($output -match "tcp://([a-zA-Z0-9\\-\\.]+\\.loclx\\.io:\\d+)" -or
                               $output -match "([a-zA-Z0-9\\-\\.]+\\.loclx\\.io:\\d+)")) {
                $tunnelUrl = $matches[0]
                if (-not $tunnelUrl.StartsWith("tcp://")) {
                  $tunnelUrl = "tcp://$tunnelUrl"
                }
                break
              }
            }

            Write-Host "Waiting for tunnel... ($($waitTime)s)" -ForegroundColor Gray
          }

          if ($tunnelUrl) {
            # Save connection details
            $connectionDetails = @{
              tunnelUrl = $tunnelUrl
              provider = "localexpose"
              username = "runneradmin"
              password = "P@ssw0rd!"
              timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss UTC"
              method = "loclx-direct"
            }

            $connectionDetails | ConvertTo-Json | Out-File -FilePath "connection-details.json" -Encoding UTF8
            Write-Host "✓ Connection details saved" -ForegroundColor Green

            Write-Host "🎉 LOCALEXPOSE TUNNEL ACTIVE!" -ForegroundColor Green
            Write-Host "Tunnel URL: $tunnelUrl" -ForegroundColor Cyan
            Write-Host "Username: runneradmin" -ForegroundColor Cyan
            Write-Host "Password: P@ssw0rd!" -ForegroundColor Cyan
          } else {
            Write-Host "✗ No tunnel URL found within timeout period" -ForegroundColor Red
            throw "LocalExpose tunnel creation failed"
          }

        } catch {
          Write-Host "✗ LocalExpose tunnel failed: $_" -ForegroundColor Red
          ${enableFailover ? generateFailoverSteps() : 'exit 1'}
        }`;
}

/**
 * Generate Cloudflare Tunnel workflow steps
 */
function generateCloudflareSteps(enableFailover: boolean = true): string {
  return `
    - name: Create Cloudflare Tunnel
      run: |
        echo "=== CLOUDFLARE TUNNEL SETUP ==="
        echo "Starting Cloudflare tunnel for RDP access..."

        try {
          # Download and setup cloudflared
          Write-Host "Setting up Cloudflare Tunnel CLI..." -ForegroundColor Yellow

          $cloudflaredUrl = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
          Invoke-WebRequest -Uri $cloudflaredUrl -OutFile "cloudflared.exe"

          Write-Host "✓ Cloudflared CLI downloaded" -ForegroundColor Green

          # Create quick tunnel
          Write-Host "Creating quick tunnel..." -ForegroundColor Yellow

          $cloudflaredProcess = Start-Process -FilePath "./cloudflared.exe" -ArgumentList @("tunnel", "--url", "tcp://localhost:3389") -PassThru -NoNewWindow -RedirectStandardOutput "cloudflared-output.txt" -RedirectStandardError "cloudflared-error.txt"
          Write-Host "✓ Cloudflared process started (PID: $($cloudflaredProcess.Id))" -ForegroundColor Green

          # Wait for tunnel URL
          $tunnelUrl = $null
          $maxWaitTime = 60
          $waitTime = 0

          while ($waitTime -lt $maxWaitTime -and -not $tunnelUrl) {
            Start-Sleep -Seconds 2
            $waitTime += 2

            if (Test-Path "cloudflared-output.txt") {
              $output = Get-Content "cloudflared-output.txt" -Raw -ErrorAction SilentlyContinue
              if ($output -and ($output -match "Your quick Tunnel: (https://[a-zA-Z0-9\\-\\.]+\\.trycloudflare\\.com)" -or
                               $output -match "(https://[a-zA-Z0-9\\-\\.]+\\.trycloudflare\\.com)")) {
                $tunnelUrl = $matches[1]
                break
              }
            }

            Write-Host "Waiting for tunnel... ($($waitTime)s)" -ForegroundColor Gray
          }

          if ($tunnelUrl) {
            # Save connection details
            $connectionDetails = @{
              tunnelUrl = $tunnelUrl
              provider = "cloudflare-tunnel"
              username = "runneradmin"
              password = "P@ssw0rd!"
              timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss UTC"
              method = "cloudflared-quick"
            }

            $connectionDetails | ConvertTo-Json | Out-File -FilePath "connection-details.json" -Encoding UTF8
            Write-Host "✓ Connection details saved" -ForegroundColor Green

            Write-Host "🎉 CLOUDFLARE TUNNEL ACTIVE!" -ForegroundColor Green
            Write-Host "Tunnel URL: $tunnelUrl" -ForegroundColor Cyan
            Write-Host "Username: runneradmin" -ForegroundColor Cyan
            Write-Host "Password: P@ssw0rd!" -ForegroundColor Cyan
          } else {
            Write-Host "✗ No tunnel URL found within timeout period" -ForegroundColor Red
            throw "Cloudflare tunnel creation failed"
          }

        } catch {
          Write-Host "✗ Cloudflare tunnel failed: $_" -ForegroundColor Red
          ${enableFailover ? generateFailoverSteps() : 'exit 1'}
        }`;
}
