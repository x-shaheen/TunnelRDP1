'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Github, Key, Zap, Monitor, CheckCircle, AlertCircle, Loader, Server, Shield, Users, Wifi, Globe, Plus, Cloud, Lock, Layers, Clock } from 'lucide-react';
import { Session } from 'next-auth';
import {
  saveSession
} from '@/utils/supabase-storage';
import { useSupabaseUser } from '@/hooks/useSupabaseUser';
import { TunnelingProvider, TUNNELING_PROVIDERS, FREE_PROVIDERS, VPN_PROVIDERS, DIRECT_PROVIDERS, SSH_PROVIDERS, RECOMMENDED_FREE_PROVIDER, ProviderFormData } from '@/types/tunneling';
import { TunnelRDPIcon } from './TunnelRDPIcon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface SetupWizardProps {
  onBack: () => void;
  session: Session;
}

interface GitHubAccount {
  id: number;
  login: string;
  name: string;
  description: string;
  avatar_url: string;
  type: 'user' | 'organization';
  permissions: {
    admin: boolean;
    push: boolean;
    pull: boolean;
  };
}

interface OrganizationTemplate {
  id: string;
  name: string;
  description: string;
  suffix: string;
}

interface FormData {
  provider: TunnelingProvider;
  ngrokToken: string;
  localexposeToken: string;
  tailscaleAuthKey: string;
  cloudflareSetup: boolean;
  repositoryName: string;
  customSubdomain: string;
  selectedAccount: GitHubAccount | null;
  deploymentTarget: 'personal' | 'organization';
  sessionDuration: number; // in minutes
  keepAliveInterval: number; // in minutes
}

interface WorkflowStatus {
  status: 'idle' | 'creating' | 'deploying' | 'completed' | 'error';
  message: string;
  repositoryUrl?: string;
  startTime?: number;
  connectionDetails?: {
    host: string;
    port: string;
    username: string;
    password: string;
  };
}

// Helper function to get the appropriate icon for each provider type
const getProviderIcon = (provider: TunnelingProvider) => {
  if (VPN_PROVIDERS.includes(provider)) {
    return Shield; // VPN providers get shield icon
  }
  if (DIRECT_PROVIDERS.includes(provider)) {
    return Cloud; // Direct providers get cloud icon
  }
  return Wifi; // SSH providers get wifi icon
};

// Helper function to get provider category badge
const getProviderCategory = (provider: TunnelingProvider) => {
  if (VPN_PROVIDERS.includes(provider)) {
    return { label: 'VPN', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
  }
  if (DIRECT_PROVIDERS.includes(provider)) {
    return { label: 'DIRECT', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' };
  }
  return { label: 'SSH', color: 'bg-green-500/20 text-green-400 border-green-500/30' };
};

export default function SetupWizard({ onBack, session }: SetupWizardProps) {
  const { isAuthenticated, supabaseUserId } = useSupabaseUser();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    provider: RECOMMENDED_FREE_PROVIDER,
    ngrokToken: '',
    localexposeToken: '',
    tailscaleAuthKey: '',
    cloudflareSetup: false,
    repositoryName: 'tunnelrdp-' + Math.random().toString(36).substring(2, 11),
    customSubdomain: '',
    selectedAccount: null,
    deploymentTarget: 'personal',
    sessionDuration: 355, // Default 355 minutes (GitHub Actions limit is 360 minutes / 6 hours)
    keepAliveInterval: 10 // Default 10 minutes
  });
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus>({
    status: 'idle',
    message: ''
  });
  const [availableAccounts, setAvailableAccounts] = useState<GitHubAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [orgTemplates, setOrgTemplates] = useState<OrganizationTemplate[]>([]);
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [showOrgCreator, setShowOrgCreator] = useState(false);
  const [rateLimit, setRateLimit] = useState<{remaining: number; resetTime: string} | null>(null);



  // Reset wizard to start fresh for new deployments
  useEffect(() => {
    // Always start fresh - don't auto-load previous sessions
    // Users can view active sessions in the Live RDP Dashboard
    setCurrentStep(1);
    setWorkflowStatus({
      status: 'idle',
      message: '',
      repositoryUrl: '',
      connectionDetails: undefined
    });
    setFormData({
      provider: RECOMMENDED_FREE_PROVIDER,
      ngrokToken: '',
      localexposeToken: '',
      tailscaleAuthKey: '',
      cloudflareSetup: false,
      repositoryName: '',
      customSubdomain: '',
      selectedAccount: null,
      deploymentTarget: 'personal',
      sessionDuration: 355,
      keepAliveInterval: 10
    });
  }, []);

  // Fetch available GitHub accounts (personal + organizations)
  const fetchAccounts = async () => {
    if (!session?.accessToken) return;

    setLoadingAccounts(true);
    try {
      const response = await fetch(`/api/organizations?token=${encodeURIComponent(session.accessToken)}`);
      const data = await response.json();

      console.log('API Response:', data);
      console.log('Response success:', data.success);
      console.log('Accounts:', data.accounts);

      if (data.success) {
        console.log('Loaded accounts:', data.accounts.length);
        setAvailableAccounts(data.accounts);
        setOrgTemplates(data.templates || []);
        setRateLimit(data.rateLimit);
        // Set personal account as default
        const personalAccount = data.accounts.find((acc: GitHubAccount) => acc.type === 'user');
        if (personalAccount) {
          console.log('Setting default account:', personalAccount.name);
          setFormData(prev => ({ ...prev, selectedAccount: personalAccount }));
        }
      } else {
        console.error('API returned success: false', data);
      }
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
    } finally {
      setLoadingAccounts(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [session?.accessToken]);

  // Save session whenever workflowStatus changes
  useEffect(() => {
    if (workflowStatus.repositoryUrl && isAuthenticated) {
      const sessionData = {
        repositoryUrl: workflowStatus.repositoryUrl,
        repositoryName: formData.repositoryName,
        connectionDetails: workflowStatus.connectionDetails,
        status: workflowStatus.status,
        message: workflowStatus.message
      };

      // Save session asynchronously
      saveSession(sessionData).catch(error => {
        console.error('Failed to save session:', error);
      });
    }
  }, [workflowStatus, formData.repositoryName, isAuthenticated]);

  const steps = [
    { id: 1, title: 'PROVIDER', icon: Server },
    { id: 2, title: 'ACCOUNT', icon: Users },
    { id: 3, title: 'CONFIG', icon: Key },
    { id: 4, title: 'DEPLOY', icon: Zap },
    { id: 5, title: 'CONNECT', icon: Monitor }
  ];

  const handleInputChange = (field: keyof FormData, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const createQuickOrganization = async (templateId: string) => {
    if (!session?.accessToken) return;

    setCreatingOrg(true);
    try {
      const template = orgTemplates.find(t => t.id === templateId);
      if (!template) throw new Error('Template not found');

      const response = await fetch('/api/organizations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          githubToken: session.accessToken,
          template: templateId,
          quickCreate: true
        }),
      });

      const data = await response.json();

      if (data.requiresManualCreation) {
        // Show manual creation instructions
        const instructions = data.instructions;
        const confirmCreate = confirm(
          `GitHub requires manual organization creation for security reasons.\n\n` +
          `Suggested name: ${instructions.orgName}\n` +
          `Description: ${instructions.description}\n\n` +
          `Click OK to open GitHub's organization creation page, or Cancel to try a different approach.`
        );

        if (confirmCreate) {
          // Open GitHub's organization creation page in a new tab
          window.open(instructions.directCreateUrl, '_blank');

          // Show follow-up instructions
          alert(
            `Organization creation page opened in a new tab.\n\n` +
            `After creating the organization:\n` +
            `1. Return to this page\n` +
            `2. Click "Refresh Accounts" to see your new organization\n` +
            `3. Select it and continue with deployment`
          );
        }
      } else if (!response.ok) {
        throw new Error(data.error || 'Failed to create organization');
      }
    } catch (error) {
      console.error('Failed to create organization:', error);
      alert(error instanceof Error ? error.message : 'Failed to create organization');
    } finally {
      setCreatingOrg(false);
      setShowOrgCreator(false);
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleDeploy = async () => {
    setWorkflowStatus({ status: 'creating', message: 'Creating GitHub repository...' });

    console.log('Session data:', session);
    console.log('Access token:', session.accessToken);

    try {
      // Call API to create repository and set up workflow
      const response = await fetch('/api/deploy-rdp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: formData.provider,
          ngrokToken: formData.ngrokToken,
          localexposeToken: formData.localexposeToken,
          tailscaleAuthKey: formData.tailscaleAuthKey,
          cloudflareSetup: formData.cloudflareSetup,
          repositoryName: formData.repositoryName,
          customSubdomain: formData.customSubdomain,
          githubToken: session.accessToken,
          selectedAccount: formData.selectedAccount,
          deploymentTarget: formData.deploymentTarget,
          sessionDuration: formData.sessionDuration,
          keepAliveInterval: formData.keepAliveInterval
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to deploy RDP server');
      }

      const result = await response.json();

      // Debug logging
      console.log('Deploy API response:', result);

      // Extract repository URL from the nested data structure
      const repositoryUrl = result.data?.repositoryUrl || result.repositoryUrl;

      if (!repositoryUrl) {
        console.error('Repository URL not found in response. Full response:', result);
        throw new Error('Repository URL not found in response');
      }

      console.log('Extracted repository URL:', repositoryUrl);

      setWorkflowStatus({
        status: 'deploying',
        message: 'Repository created! Deploying RDP server...',
        repositoryUrl: repositoryUrl
      });

      // Poll for workflow completion
      pollWorkflowStatus(repositoryUrl);
      
    } catch (error) {
      setWorkflowStatus({ 
        status: 'error', 
        message: error instanceof Error ? error.message : 'An error occurred'
      });
    }
  };

  const checkWorkflowStatus = async () => {
    if (!workflowStatus.repositoryUrl) return;

    const urlParts = workflowStatus.repositoryUrl.split('/');
    const owner = urlParts[urlParts.length - 2];
    const repo = urlParts[urlParts.length - 1];

    try {
      const response = await fetch('/api/workflow-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          githubToken: session.accessToken,
          owner,
          repo,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to check workflow status');
      }

      const result = await response.json();

      if (result.status === 'completed') {
        if (result.conclusion === 'success') {
          setWorkflowStatus({
            status: 'completed',
            message: result.message,
            repositoryUrl: workflowStatus.repositoryUrl,
            connectionDetails: result.connectionDetails
          });
          setCurrentStep(5);
        } else {
          setWorkflowStatus({
            status: 'error',
            message: result.message,
            repositoryUrl: workflowStatus.repositoryUrl
          });
        }
      } else {
        // Check if we have connection details
        if (result.connectionDetails && result.connectionDetails.host !== 'Check workflow logs for tunnel URL' && result.connectionDetails.host !== 'Check workflow logs') {
          setWorkflowStatus({
            status: 'completed',
            message: 'RDP server is ready! Connection details automatically retrieved.',
            repositoryUrl: workflowStatus.repositoryUrl,
            connectionDetails: result.connectionDetails
          });
          setCurrentStep(5);
        } else {
          setWorkflowStatus(prev => ({
            ...prev,
            message: result.message,
            connectionDetails: result.connectionDetails,
            startTime: prev.startTime || Date.now()
          }));
        }
      }
    } catch (error) {
      setWorkflowStatus(prev => ({
        ...prev,
        message: error instanceof Error ? error.message : 'Failed to check status'
      }));
    }
  };

  const pollWorkflowStatus = async (repoUrl: string) => {
    // Validate repository URL
    if (!repoUrl || typeof repoUrl !== 'string') {
      console.error('Invalid repository URL:', repoUrl);
      setWorkflowStatus(prev => ({
        ...prev,
        status: 'error',
        message: 'Invalid repository URL received from server'
      }));
      return;
    }

    // Extract owner and repo from URL
    const urlParts = repoUrl.split('/');
    if (urlParts.length < 2) {
      console.error('Malformed repository URL:', repoUrl);
      setWorkflowStatus(prev => ({
        ...prev,
        status: 'error',
        message: 'Malformed repository URL'
      }));
      return;
    }

    const owner = urlParts[urlParts.length - 2];
    const repo = urlParts[urlParts.length - 1];

    // Validate extracted values
    if (!owner || !repo) {
      console.error('Could not extract owner/repo from URL:', repoUrl);
      setWorkflowStatus(prev => ({
        ...prev,
        status: 'error',
        message: 'Could not parse repository information from URL'
      }));
      return;
    }

    // Enhanced polling with retry logic and better error handling
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 3;
    let totalPollingTime = 0;
    const maxPollingTime = 10 * 60 * 1000; // 10 minutes max polling

    const checkStatus = async () => {
      try {
        console.log(`[${new Date().toISOString()}] Polling workflow status for ${owner}/${repo} (errors: ${consecutiveErrors})`);

        const response = await fetch('/api/workflow-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            githubToken: session.accessToken,
            owner,
            repo,
          }),
        });

        if (!response.ok) {
          console.error('Workflow status API response not OK:', response.status, response.statusText);
          throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        // Reset error counter on successful response
        consecutiveErrors = 0;

        // Debug logging
        console.log(`[${new Date().toISOString()}] Workflow status response:`, result);

        // Extract data from nested structure
        const statusData = result.data || result;

        console.log(`[${new Date().toISOString()}] Extracted status data:`, statusData);
        console.log(`[${new Date().toISOString()}] Status: ${statusData.status}, Has connection details: ${!!statusData.connectionDetails}`);

        console.log(`[${new Date().toISOString()}] Processing status: ${statusData.status}`);

        if (statusData.status === 'completed') {
          console.log(`[${new Date().toISOString()}] Status is completed, updating UI`);
          setWorkflowStatus({
            status: 'completed',
            message: statusData.message || 'RDP server deployed successfully',
            repositoryUrl: repoUrl,
            connectionDetails: statusData.connectionDetails
          });
          setCurrentStep(5);
          console.log(`[${new Date().toISOString()}] UI updated to step 5 with completed status`);
          return; // Stop polling
        } else if (statusData.status === 'error') {
          console.log(`[${new Date().toISOString()}] Status is error, updating UI`);
          setWorkflowStatus({
            status: 'error',
            message: statusData.message || 'Deployment failed',
            repositoryUrl: repoUrl
          });
          return; // Stop polling
        } else {
          // Check if we have connection details even if workflow is still running
          if (statusData.connectionDetails &&
              statusData.connectionDetails.host &&
              statusData.connectionDetails.host !== 'Check workflow logs for tunnel URL' &&
              statusData.connectionDetails.host !== 'Check workflow logs' &&
              !statusData.connectionDetails.host.includes('Check workflow logs')) {

            console.log(`[${new Date().toISOString()}] Connection details found while status is ${statusData.status}:`, statusData.connectionDetails);

            setWorkflowStatus({
              status: 'completed',
              message: 'RDP server is ready! Connection details automatically retrieved.',
              repositoryUrl: repoUrl,
              connectionDetails: statusData.connectionDetails
            });
            setCurrentStep(5);
            console.log(`[${new Date().toISOString()}] UI updated to step 5 with connection details`);
            return; // Stop polling
          } else {
            console.log(`[${new Date().toISOString()}] Still waiting, status: ${statusData.status}, connection details available: ${!!statusData.connectionDetails}`);

            // Provide better status messages based on the current phase
            let statusMessage = statusData.message || 'Deployment in progress...';
            if (statusMessage.includes('Keeping session alive') || statusMessage.includes('RDP server is now running')) {
              statusMessage = 'RDP server is active and running! Finalizing connection details...';
            } else if (statusMessage.includes('TAILSCALE VPN READY') || statusMessage.includes('Tailscale IP:')) {
              statusMessage = 'Tailscale VPN successfully deployed! Server is ready for connections.';
            }

            setWorkflowStatus(prev => ({
              ...prev,
              message: statusMessage,
              connectionDetails: result.connectionDetails,
              startTime: prev.startTime || Date.now()
            }));

            // Continue polling with adaptive frequency
            const elapsed = Date.now() - (workflowStatus.startTime || Date.now());
            totalPollingTime = elapsed;

            // Check if we've been polling too long
            if (totalPollingTime > maxPollingTime) {
              console.log(`[${new Date().toISOString()}] Polling timeout reached, but checking for connection details one more time`);
              // Try one more time to get connection details before giving up
              try {
                const finalCheck = await fetch('/api/workflow-status', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ githubToken: session.accessToken, owner, repo }),
                });
                if (finalCheck.ok) {
                  const finalResult = await finalCheck.json();
                  const finalData = finalResult.data || finalResult;
                  if (finalData.connectionDetails && finalData.connectionDetails.host &&
                      !finalData.connectionDetails.host.includes('Check workflow logs')) {
                    setWorkflowStatus({
                      status: 'completed',
                      message: 'RDP server is ready! Connection details retrieved after extended polling.',
                      repositoryUrl: repoUrl,
                      connectionDetails: finalData.connectionDetails
                    });
                    setCurrentStep(5);
                    return;
                  }
                }
              } catch (e) {
                console.log('Final connection check failed:', e);
              }

              setWorkflowStatus(prev => ({
                ...prev,
                status: 'error',
                message: 'Polling timeout reached. The deployment may still be running. Check the repository for connection details.'
              }));
              return;
            }

            const pollInterval = elapsed < 120000 ? 3000 : 5000; // 3s for first 2 minutes, then 5s
            console.log(`[${new Date().toISOString()}] Continuing polling in ${pollInterval}ms (elapsed: ${elapsed}ms)`);
            setTimeout(checkStatus, pollInterval);
          }
        }
      } catch (error) {
        consecutiveErrors++;
        console.error(`[${new Date().toISOString()}] Polling error ${consecutiveErrors}/${maxConsecutiveErrors}:`, error);

        // Only fail after multiple consecutive errors
        if (consecutiveErrors >= maxConsecutiveErrors) {
          console.error(`[${new Date().toISOString()}] Too many consecutive errors, checking for connection details before failing`);

          // Before failing, try one more time to check for connection details
          try {
            const emergencyCheck = await fetch('/api/workflow-status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ githubToken: session.accessToken, owner, repo }),
            });

            if (emergencyCheck.ok) {
              const emergencyResult = await emergencyCheck.json();
              const emergencyData = emergencyResult.data || emergencyResult;

              if (emergencyData.connectionDetails && emergencyData.connectionDetails.host &&
                  !emergencyData.connectionDetails.host.includes('Check workflow logs')) {
                console.log(`[${new Date().toISOString()}] Found connection details during emergency check!`);
                setWorkflowStatus({
                  status: 'completed',
                  message: 'RDP server is ready! Connection details retrieved despite polling issues.',
                  repositoryUrl: repoUrl,
                  connectionDetails: emergencyData.connectionDetails
                });
                setCurrentStep(5);
                return;
              }
            }
          } catch (emergencyError) {
            console.error('Emergency connection check failed:', emergencyError);
          }

          setWorkflowStatus({
            status: 'error',
            message: `Polling failed after ${maxConsecutiveErrors} attempts. The deployment may still be running. Check the repository for connection details.`,
            repositoryUrl: repoUrl
          });
          return;
        } else {
          // Update status to show we're having issues but still trying
          setWorkflowStatus(prev => ({
            ...prev,
            message: `Deployment in progress... (polling issues, retrying ${consecutiveErrors}/${maxConsecutiveErrors})`
          }));

          // Retry with exponential backoff
          const retryDelay = Math.min(5000 * Math.pow(2, consecutiveErrors - 1), 30000);
          console.log(`[${new Date().toISOString()}] Retrying in ${retryDelay}ms`);
          setTimeout(checkStatus, retryDelay);
        }
      }
    };

    // Start polling after a short delay
    setTimeout(checkStatus, 5000);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className="relative inline-block mb-4">
                <div className="absolute inset-0 bg-[var(--accent-primary)] rounded-lg blur-sm opacity-20"></div>
                <div className="relative bg-gradient-to-br from-[var(--accent-primary)] to-blue-600 p-2 rounded-lg">
                  <Server className="h-8 w-8 text-black" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-[var(--text-primary)] mb-1">
                Choose Tunneling Provider
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Select your preferred tunneling service for RDP access
              </p>
            </div>

            {/* Enhanced Provider Categories */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="card p-4 bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/30">
                <div className="flex items-center space-x-3 mb-2">
                  <Shield className="h-5 w-5 text-blue-400" />
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">VPN Providers</h3>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  Enterprise-grade security with mesh networking and zero-trust architecture
                </p>
              </div>

              <div className="card p-4 bg-gradient-to-br from-purple-500/10 to-purple-600/10 border border-purple-500/30">
                <div className="flex items-center space-x-3 mb-2">
                  <Cloud className="h-5 w-5 text-purple-400" />
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">Direct Tunneling</h3>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  High-performance direct connections with custom domain support
                </p>
              </div>

              <div className="card p-4 bg-gradient-to-br from-green-500/10 to-green-600/10 border border-green-500/30">
                <div className="flex items-center space-x-3 mb-2">
                  <Wifi className="h-5 w-5 text-green-400" />
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">SSH Tunneling</h3>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  Traditional SSH-based tunneling with wide compatibility
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {FREE_PROVIDERS.map((provider) => {
                const config = TUNNELING_PROVIDERS[provider];
                return (
                  <div
                    key={provider}
                    className={`card p-4 cursor-pointer transition-all duration-200 border-2 ${
                      formData.provider === provider
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5'
                        : 'border-[var(--border-primary)] hover:border-[var(--accent-primary)]/50'
                    }`}
                    onClick={() => handleInputChange('provider', provider)}
                  >
                    <div className="flex items-start space-x-4">
                      <div className="relative">
                        <div className={`absolute inset-0 rounded-full blur-sm opacity-20 ${
                          formData.provider === provider ? 'bg-[var(--accent-primary)]' : 'bg-[var(--success)]'
                        }`}></div>
                        <div className={`relative p-2 rounded-full ${
                          formData.provider === provider
                            ? 'bg-gradient-to-br from-[var(--accent-primary)] to-blue-600'
                            : VPN_PROVIDERS.includes(provider)
                              ? 'bg-gradient-to-br from-blue-500 to-blue-600'
                              : DIRECT_PROVIDERS.includes(provider)
                                ? 'bg-gradient-to-br from-purple-500 to-purple-600'
                                : 'bg-gradient-to-br from-[var(--success)] to-green-600'
                        }`}>
                          {(() => {
                            const IconComponent = getProviderIcon(provider);
                            return <IconComponent className="h-5 w-5 text-white" />;
                          })()}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                            {provider}
                          </h3>
                          {(() => {
                            const category = getProviderCategory(provider);
                            return (
                              <Badge variant="outline" className={`text-xs ${category.color}`}>
                                {category.label}
                              </Badge>
                            );
                          })()}
                          {config.isFree && (
                            <Badge variant="outline" className="text-xs bg-[var(--success)]/20 text-[var(--success)] border-[var(--success)]/30">
                              FREE
                            </Badge>
                          )}
                          {provider === RECOMMENDED_FREE_PROVIDER && (
                            <Badge variant="default" className="text-xs bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border-[var(--accent-primary)]/30">
                              RECOMMENDED
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-[var(--text-secondary)] mb-3">
                          {config.description}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {config.supportsTCP && (
                            <Badge variant="secondary" className="text-xs bg-[var(--bg-tertiary)] text-[var(--text-muted)] border-[var(--border-primary)]">
                              TCP
                            </Badge>
                          )}
                          {config.supportsUDP && (
                            <Badge variant="secondary" className="text-xs bg-[var(--bg-tertiary)] text-[var(--text-muted)] border-[var(--border-primary)]">
                              UDP
                            </Badge>
                          )}
                          {config.supportsCustomDomain && (
                            <Badge variant="secondary" className="text-xs bg-[var(--bg-tertiary)] text-[var(--text-muted)] border-[var(--border-primary)]">
                              Custom Domain
                            </Badge>
                          )}
                          {!config.requiresAuth && (
                            <Badge variant="outline" className="text-xs bg-[var(--success)]/20 text-[var(--success)] border-[var(--success)]/30">
                              No Auth Required
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Ngrok option */}
              <div
                className={`card p-4 cursor-pointer transition-all duration-200 border-2 ${
                  formData.provider === 'ngrok'
                    ? 'border-[var(--warning)] bg-[var(--warning)]/5'
                    : 'border-[var(--border-primary)] hover:border-[var(--warning)]/50'
                }`}
                onClick={() => handleInputChange('provider', 'ngrok')}
              >
                <div className="flex items-start space-x-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-[var(--warning)] rounded-full blur-sm opacity-20"></div>
                    <div className="relative bg-gradient-to-br from-[var(--warning)] to-orange-600 p-2 rounded-full">
                      <Shield className="h-5 w-5 text-black" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                        ngrok
                      </h3>
                      <span className="px-2 py-1 text-xs bg-[var(--warning)]/20 text-[var(--warning)] rounded-full border border-[var(--warning)]/30">
                        REQUIRES PAYMENT VERIFICATION
                      </span>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)] mb-3">
                      {TUNNELING_PROVIDERS.ngrok.description}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2 py-1 text-xs bg-[var(--bg-tertiary)] text-[var(--text-muted)] rounded border border-[var(--border-primary)]">
                        TCP
                      </span>
                      <span className="px-2 py-1 text-xs bg-[var(--bg-tertiary)] text-[var(--text-muted)] rounded border border-[var(--border-primary)]">
                        Custom Domain
                      </span>
                      <span className="px-2 py-1 text-xs bg-[var(--warning)]/20 text-[var(--warning)] rounded border border-[var(--warning)]/30">
                        Auth Required
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className="relative inline-block mb-4">
                <div className="absolute inset-0 bg-[var(--accent-primary)] rounded-lg blur-sm opacity-20"></div>
                <div className="relative bg-gradient-to-br from-[var(--accent-primary)] to-blue-600 p-2 rounded-lg">
                  <Users className="h-8 w-8 text-black" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-[var(--text-primary)] mb-1">
                Select GitHub Account
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Choose where to deploy your RDP server
              </p>
              {formData.selectedAccount && (
                <div className="text-xs text-[var(--success)] mt-2">
                  Selected: {formData.selectedAccount.name} ({formData.selectedAccount.type})
                </div>
              )}
            </div>

            {loadingAccounts ? (
              <div className="flex items-center justify-center py-8">
                <Loader className="h-6 w-6 text-[var(--accent-primary)] animate-spin" />
                <span className="ml-2 text-sm text-[var(--text-secondary)]">Loading accounts...</span>
              </div>
            ) : (
              <div className="space-y-3">
                {availableAccounts.map((account) => {
                  const isSelected = formData.selectedAccount?.id === account.id;
                  return (
                    <div
                      key={account.id}
                      className={`card p-4 cursor-pointer transition-all duration-200 border-2 ${
                        isSelected
                          ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5'
                          : 'border-[var(--border-primary)] hover:border-[var(--accent-primary)]/50'
                      }`}
                    onClick={() => {
                      console.log('Selecting account:', account.name, 'ID:', account.id, 'Type:', account.type);
                      setFormData(prev => ({
                        ...prev,
                        selectedAccount: account,
                        deploymentTarget: account.type === 'user' ? 'personal' : 'organization'
                      }));
                    }}
                  >
                    <div className="flex items-center space-x-4">
                      <img
                        src={account.avatar_url}
                        alt={account.name}
                        className="w-10 h-10 rounded-full"
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="text-sm font-medium text-[var(--text-primary)]">
                            {account.name}
                          </h3>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            account.type === 'user'
                              ? 'bg-[var(--success)]/20 text-[var(--success)]'
                              : 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]'
                          }`}>
                            {account.type === 'user' ? 'Personal' : 'Organization'}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] mt-1">
                          @{account.login}
                        </p>
                        {account.description && (
                          <p className="text-xs text-[var(--text-secondary)] mt-1">
                            {account.description}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-[var(--text-secondary)]">
                          {account.type === 'user' ? '2,000 min/month' : '2,000 min/month'}
                        </div>
                        <div className="text-xs text-[var(--success)]">
                          Fresh quota
                        </div>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}

            {/* Quick Organization Creator */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-[var(--text-primary)]">
                  Need more quota? Create a new organization
                </h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => fetchAccounts()}
                    disabled={loadingAccounts}
                    className="btn-secondary text-xs px-3 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingAccounts ? 'Refreshing...' : 'Refresh Accounts'}
                  </button>
                  <button
                    onClick={() => setShowOrgCreator(!showOrgCreator)}
                    className="btn-secondary text-xs px-3 py-1"
                  >
                    {showOrgCreator ? 'Cancel' : 'Create New'}
                  </button>
                </div>
              </div>

              <div className="text-xs text-[var(--text-secondary)]">
                GitHub requires manual organization creation for security. We'll guide you through the process.
              </div>

              {showOrgCreator && (
                <div className="card p-4 border border-[var(--accent-primary)]/30">
                  <h4 className="text-sm font-medium text-[var(--text-primary)] mb-3">
                    Choose Organization Template
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {orgTemplates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => createQuickOrganization(template.id)}
                        disabled={creatingOrg}
                        className="card p-3 text-left hover:border-[var(--accent-primary)]/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="flex items-start space-x-3">
                          <div className="relative">
                            <div className="absolute inset-0 bg-[var(--accent-primary)] rounded-full blur-sm opacity-20"></div>
                            <div className="relative bg-gradient-to-br from-[var(--accent-primary)] to-blue-600 p-1.5 rounded-full">
                              <Plus className="h-3 w-3 text-black" />
                            </div>
                          </div>
                          <div className="flex-1">
                            <h5 className="text-xs font-medium text-[var(--text-primary)]">
                              {template.name}
                            </h5>
                            <p className="text-xs text-[var(--text-secondary)] mt-1">
                              {template.description}
                            </p>
                            {creatingOrg && (
                              <div className="flex items-center space-x-1 mt-2">
                                <Loader className="h-3 w-3 text-[var(--accent-primary)] animate-spin" />
                                <span className="text-xs text-[var(--accent-primary)]">Opening GitHub...</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 p-2 bg-[var(--bg-tertiary)] rounded text-xs text-[var(--text-secondary)]">
                    <strong>How it works:</strong> Click a template to open GitHub's organization creation page with pre-filled details.
                    After creating the organization, return here and click "Refresh Accounts" to see it in your list.
                  </div>
                </div>
              )}
            </div>

            <div className="card p-4 bg-gradient-to-r from-[var(--accent-primary)]/10 to-[var(--success)]/10 border border-[var(--accent-primary)]/30">
              <div className="flex items-start space-x-3">
                <div className="text-lg">💡</div>
                <div>
                  <h4 className="text-sm font-medium text-[var(--text-primary)] mb-1">
                    Cloud Deployment Quota
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Each account gets 2,000 free minutes per month. Organizations provide separate quotas
                    to extend your free usage. RDP sessions use 60 minutes each.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-5">
            <div className="text-center mb-6">
              <div className="relative inline-block mb-4">
                <div className="absolute inset-0 bg-[var(--accent-primary)] rounded-lg blur-sm opacity-20"></div>
                <div className="relative bg-gradient-to-br from-[var(--accent-primary)] to-blue-600 p-2 rounded-lg">
                  <Key className="h-8 w-8 text-black" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-[var(--text-primary)] mb-1">
                Configuration Setup
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Configure your deployment settings for {formData.provider}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
              <div className="card p-4">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="relative">
                    <div className="absolute inset-0 bg-[var(--accent-primary)] rounded-full blur-sm opacity-20"></div>
                    <div className="relative bg-gradient-to-br from-[var(--accent-primary)] to-blue-600 p-1.5 rounded-full">
                      <Github className="h-4 w-4 text-black" />
                    </div>
                  </div>
                  <Label htmlFor="repository-name" className="text-sm font-medium text-[var(--text-primary)]">Repository Name</Label>
                </div>
                <Input
                  id="repository-name"
                  type="text"
                  value={formData.repositoryName}
                  onChange={(e) => handleInputChange('repositoryName', e.target.value)}
                  placeholder="tunnelrdp-deployment"
                  className="w-full text-sm bg-[var(--bg-secondary)] border-[var(--border-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                />
              </div>

              <div className="card p-4">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="relative">
                    <div className="absolute inset-0 bg-purple-500 rounded-full blur-sm opacity-20"></div>
                    <div className="relative bg-gradient-to-br from-purple-500 to-purple-600 p-1.5 rounded-full">
                      <Clock className="h-4 w-4 text-white" />
                    </div>
                  </div>
                  <h3 className="text-sm font-medium text-[var(--text-primary)]">Session Configuration</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="session-duration" className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                      Session Duration (minutes)
                    </Label>
                    <Input
                      id="session-duration"
                      type="number"
                      min="30"
                      max="360"
                      value={formData.sessionDuration}
                      onChange={(e) => handleInputChange('sessionDuration', parseInt(e.target.value) || 355)}
                      className="w-full text-sm bg-[var(--bg-secondary)] border-[var(--border-primary)] text-[var(--text-primary)]"
                    />
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                      Current: {Math.floor(formData.sessionDuration / 60)}h {formData.sessionDuration % 60}m | Maximum: 360 minutes (6 hours)
                    </p>
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => handleInputChange('sessionDuration', 60)}
                        className="px-2 py-1 text-xs bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded transition-colors"
                      >
                        1h
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInputChange('sessionDuration', 180)}
                        className="px-2 py-1 text-xs bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded transition-colors"
                      >
                        3h
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInputChange('sessionDuration', 360)}
                        className="px-2 py-1 text-xs bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded transition-colors"
                      >
                        6h (Max)
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="keep-alive-interval" className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                      Keep-Alive Interval (minutes)
                    </Label>
                    <Input
                      id="keep-alive-interval"
                      type="number"
                      min="5"
                      max="30"
                      value={formData.keepAliveInterval}
                      onChange={(e) => handleInputChange('keepAliveInterval', parseInt(e.target.value) || 10)}
                      className="w-full text-sm bg-[var(--bg-secondary)] border-[var(--border-primary)] text-[var(--text-primary)]"
                    />
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                      How often to check server status (5-30 minutes)
                    </p>
                  </div>
                </div>
              </div>

              {formData.provider === 'ngrok' && (
                <div className="card p-4">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="relative">
                      <div className="absolute inset-0 bg-[var(--warning)] rounded-full blur-sm opacity-20"></div>
                      <div className="relative bg-gradient-to-br from-[var(--warning)] to-orange-600 p-1.5 rounded-full">
                        <Key className="h-4 w-4 text-black" />
                      </div>
                    </div>
                    <Label htmlFor="ngrok-token" className="text-sm font-medium text-[var(--text-primary)]">Ngrok Auth Token</Label>
                  </div>
                  <Input
                    id="ngrok-token"
                    type="password"
                    value={formData.ngrokToken}
                    onChange={(e) => handleInputChange('ngrokToken', e.target.value)}
                    placeholder="2xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx_xxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full text-sm bg-[var(--bg-secondary)] border-[var(--border-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                  />
                </div>
              )}

              {formData.provider === 'localexpose' && (
                <div className="card p-4">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="relative">
                      <div className="absolute inset-0 bg-purple-500 rounded-full blur-sm opacity-20"></div>
                      <div className="relative bg-gradient-to-br from-purple-500 to-purple-600 p-1.5 rounded-full">
                        <Key className="h-4 w-4 text-white" />
                      </div>
                    </div>
                    <Label htmlFor="localexpose-token" className="text-sm font-medium text-[var(--text-primary)]">LocalExpose Access Token</Label>
                  </div>
                  <Input
                    id="localexpose-token"
                    type="password"
                    value={formData.localexposeToken}
                    onChange={(e) => handleInputChange('localexposeToken', e.target.value)}
                    placeholder="loclx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full text-sm bg-[var(--bg-secondary)] border-[var(--border-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                  />
                  <p className="text-xs text-[var(--text-secondary)] mt-2">
                    Get your token from <a href="https://localxpose.io/dashboard" target="_blank" rel="noopener noreferrer" className="text-[var(--accent-primary)] hover:underline">LocalExpose Dashboard</a>
                  </p>
                </div>
              )}

              {formData.provider === 'tailscale' && (
                <div className="card p-4">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="relative">
                      <div className="absolute inset-0 bg-blue-500 rounded-full blur-sm opacity-20"></div>
                      <div className="relative bg-gradient-to-br from-blue-500 to-blue-600 p-1.5 rounded-full">
                        <Key className="h-4 w-4 text-white" />
                      </div>
                    </div>
                    <Label htmlFor="tailscale-auth-key" className="text-sm font-medium text-[var(--text-primary)]">Tailscale Auth Key</Label>
                  </div>
                  <Input
                    id="tailscale-auth-key"
                    type="password"
                    value={formData.tailscaleAuthKey}
                    onChange={(e) => handleInputChange('tailscaleAuthKey', e.target.value)}
                    placeholder="tskey-auth-kk4HBiCgaE11CNTRL-dyu5nfDi7vTkhmp9K7ZgvT94GHbQxrmb"
                    className="w-full text-sm bg-[var(--bg-secondary)] border-[var(--border-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] mb-3"
                  />
                  <div className="text-xs text-[var(--text-secondary)] space-y-1">
                    <p>1. Get your auth key from <a href="https://login.tailscale.com/admin/settings/keys" target="_blank" rel="noopener noreferrer" className="text-[var(--accent-primary)] hover:underline">Tailscale Admin Console</a></p>
                    <p>2. Create a new auth key with "Reusable" and "Ephemeral" options</p>
                    <p>3. The system will automatically install and authenticate Tailscale</p>
                    <p>4. RDP clients connect directly via Tailscale IP (100.x.x.x)</p>
                  </div>
                </div>
              )}

              {formData.provider === 'cloudflare-tunnel' && (
                <div className="card p-4">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="relative">
                      <div className="absolute inset-0 bg-orange-500 rounded-full blur-sm opacity-20"></div>
                      <div className="relative bg-gradient-to-br from-orange-500 to-orange-600 p-1.5 rounded-full">
                        <Cloud className="h-4 w-4 text-white" />
                      </div>
                    </div>
                    <h3 className="text-sm font-medium text-[var(--text-primary)]">Cloudflare Tunnel Setup</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="cloudflare-setup"
                        checked={formData.cloudflareSetup}
                        onChange={(e) => handleInputChange('cloudflareSetup', e.target.checked)}
                        className="w-4 h-4 text-[var(--accent-primary)] bg-[var(--bg-secondary)] border-[var(--border-primary)] rounded focus:ring-[var(--accent-primary)]"
                      />
                      <label htmlFor="cloudflare-setup" className="text-sm text-[var(--text-primary)]">
                        I have cloudflared installed and configured
                      </label>
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] space-y-1">
                      <p>1. Install cloudflared: <a href="https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/" target="_blank" rel="noopener noreferrer" className="text-[var(--accent-primary)] hover:underline">Download here</a></p>
                      <p>2. Test: <code className="bg-[var(--bg-tertiary)] px-1 rounded">cloudflared tunnel --url tcp://localhost:3389</code></p>
                    </div>
                  </div>
                </div>
              )}

              {(formData.provider === 'serveo' && TUNNELING_PROVIDERS[formData.provider].supportsCustomDomain) && (
                <div className="card p-4">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="relative">
                      <div className="absolute inset-0 bg-[var(--success)] rounded-full blur-sm opacity-20"></div>
                      <div className="relative bg-gradient-to-br from-[var(--success)] to-green-600 p-1.5 rounded-full">
                        <Globe className="h-4 w-4 text-black" />
                      </div>
                    </div>
                    <Label htmlFor="custom-subdomain" className="text-sm font-medium text-[var(--text-primary)]">Custom Subdomain (Optional)</Label>
                  </div>
                  <Input
                    id="custom-subdomain"
                    type="text"
                    value={formData.customSubdomain}
                    onChange={(e) => handleInputChange('customSubdomain', e.target.value)}
                    placeholder="my-rdp-server"
                    className="w-full text-sm bg-[var(--bg-secondary)] border-[var(--border-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="card p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="relative">
                    <div className="absolute inset-0 bg-[var(--success)] rounded-full blur-sm opacity-20"></div>
                    <div className="relative bg-gradient-to-br from-[var(--success)] to-green-600 p-1 rounded-full">
                      <CheckCircle className="h-3 w-3 text-black" />
                    </div>
                  </div>
                  <h4 className="text-sm font-medium text-[var(--text-primary)]">Get Ngrok Token</h4>
                </div>
                <ol className="text-xs text-[var(--text-secondary)] space-y-1 list-decimal list-inside ml-2">
                  <li>Visit <a href="https://dashboard.ngrok.com/get-started/your-authtoken" target="_blank" rel="noopener noreferrer" className="text-[var(--accent-primary)] hover:underline">Ngrok Dashboard</a></li>
                  <li>Sign up or log in</li>
                  <li>Copy your authtoken</li>
                </ol>
              </div>

              <div className="card p-4 bg-gradient-to-r from-[var(--warning)]/10 to-[var(--error)]/10 border border-[var(--warning)]/30">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="relative">
                    <div className="absolute inset-0 bg-[var(--warning)] rounded-full blur-sm opacity-20"></div>
                    <div className="relative bg-gradient-to-br from-[var(--warning)] to-orange-600 p-1 rounded-full">
                      <AlertCircle className="h-3 w-3 text-black" />
                    </div>
                  </div>
                  <h4 className="text-sm font-medium text-[var(--text-primary)]">Important</h4>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mb-2">
                  Ngrok requires card verification for TCP endpoints.
                </p>
                <ul className="text-xs text-[var(--text-secondary)] space-y-0.5 list-disc list-inside ml-2">
                  <li>No charges for basic usage</li>
                  <li>Verification only</li>
                </ul>
              </div>

              <div className="card p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Github className="h-4 w-4 text-[var(--accent-primary)]" />
                  <h4 className="text-sm font-medium text-[var(--text-primary)]">GitHub Connected</h4>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <img
                      src={session.user?.image || ''}
                      alt={session.user?.name || ''}
                      className="h-6 w-6 rounded-full border border-[var(--accent-primary)]"
                    />
                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[var(--success)] rounded-full"></div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-[var(--text-primary)]">
                      {session.user?.name}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      {session.user?.email}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );



      case 3:
        return (
          <div className="space-y-5">
            <div className="text-center mb-6">
              <div className="relative inline-block mb-4">
                <div className="absolute inset-0 bg-[var(--success)] rounded-lg blur-sm opacity-20"></div>
                <div className="relative bg-gradient-to-br from-[var(--success)] to-green-600 p-2 rounded-lg">
                  <Zap className="h-8 w-8 text-black" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-[var(--text-primary)] mb-1">Deploy RDP Server</h2>
              <p className="text-xs text-[var(--text-secondary)]">Ready to create your automated RDP server using {formData.provider}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-5">
              <div className="card p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="relative">
                    <div className="absolute inset-0 bg-[var(--accent-primary)] rounded-full blur-sm opacity-20"></div>
                    <div className="relative bg-gradient-to-br from-[var(--accent-primary)] to-blue-600 p-1 rounded-full">
                      <Server className="h-3 w-3 text-black" />
                    </div>
                  </div>
                  <h3 className="text-sm font-medium text-[var(--text-primary)]">Repository</h3>
                </div>
                <code className="block bg-[var(--bg-tertiary)] px-2 py-1 rounded text-[var(--accent-primary)] text-xs border border-[var(--border-primary)]">
                  {formData.repositoryName}
                </code>
              </div>

              <div className="card p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="relative">
                    <div className="absolute inset-0 bg-[var(--success)] rounded-full blur-sm opacity-20"></div>
                    <div className="relative bg-gradient-to-br from-[var(--success)] to-green-600 p-1 rounded-full">
                      <Github className="h-3 w-3 text-black" />
                    </div>
                  </div>
                  <h3 className="text-sm font-medium text-[var(--text-primary)]">GitHub Account</h3>
                </div>
                <code className="block bg-[var(--bg-tertiary)] px-2 py-1 rounded text-[var(--success)] text-xs border border-[var(--border-primary)]">
                  {session.user?.name}
                </code>
              </div>

              <div className="card p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="relative">
                    <div className="absolute inset-0 bg-[var(--warning)] rounded-full blur-sm opacity-20"></div>
                    <div className="relative bg-gradient-to-br from-[var(--warning)] to-orange-600 p-1 rounded-full">
                      <Wifi className="h-3 w-3 text-black" />
                    </div>
                  </div>
                  <h3 className="text-sm font-medium text-[var(--text-primary)]">Provider</h3>
                </div>
                <code className="block bg-[var(--bg-tertiary)] px-2 py-1 rounded text-[var(--warning)] text-xs border border-[var(--border-primary)]">
                  {formData.provider}
                </code>
              </div>
            </div>

            {workflowStatus.status === 'idle' && (
              <button
                onClick={handleDeploy}
                className="btn-primary w-full py-4 flex items-center justify-center space-x-2 text-sm"
              >
                <Zap className="h-5 w-5" />
                <span>DEPLOY RDP SERVER</span>
              </button>
            )}

            {workflowStatus.status !== 'idle' && (
              <div className="space-y-3">
                <div className="card p-4 bg-gradient-to-r from-[var(--accent-primary)]/10 to-[var(--success)]/10 border border-[var(--accent-primary)]/30">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      {workflowStatus.status === 'creating' && <Loader className="h-5 w-5 text-[var(--accent-primary)] animate-spin" />}
                      {workflowStatus.status === 'deploying' && <Loader className="h-5 w-5 text-[var(--success)] animate-spin" />}
                      {workflowStatus.status === 'completed' && <CheckCircle className="h-5 w-5 text-[var(--success)]" />}
                      {workflowStatus.status === 'error' && <AlertCircle className="h-5 w-5 text-[var(--error)]" />}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-[var(--text-primary)]">
                        {workflowStatus.status === 'creating' && 'Creating Repository...'}
                        {workflowStatus.status === 'deploying' && 'Deploying RDP Server...'}
                        {workflowStatus.status === 'completed' && 'Deployment Complete!'}
                        {workflowStatus.status === 'error' && 'Deployment Failed'}
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] mt-1">
                        {workflowStatus.message}
                      </div>
                    </div>
                    {workflowStatus.status === 'deploying' && (
                      <button
                        onClick={() => {
                          fetch(`/api/workflow-status?repositoryUrl=${encodeURIComponent(workflowStatus.repositoryUrl!)}`)
                          .then(res => res.json())
                          .then(result => {
                            if (result.connectionDetails && result.connectionDetails.host !== 'Check workflow logs for tunnel URL') {
                              setWorkflowStatus({
                                status: 'completed',
                                message: 'RDP server is ready! Connection details found.',
                                repositoryUrl: workflowStatus.repositoryUrl!,
                                connectionDetails: result.connectionDetails
                              });
                              setCurrentStep(5);
                            }
                          })
                          .catch(console.error);
                        }}
                        className="btn-secondary text-xs px-2 py-1"
                      >
                        Check Status
                      </button>
                    )}
                  </div>
                </div>

                {workflowStatus.repositoryUrl && (
                  <div className="card p-3 bg-gradient-to-r from-[var(--accent-primary)]/10 to-[var(--success)]/10 border border-[var(--accent-primary)]/30">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Github className="h-3 w-3 text-[var(--accent-primary)]" />
                        <span className="text-xs text-[var(--text-primary)]">Repository:</span>
                        <a href={workflowStatus.repositoryUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--accent-primary)] hover:underline">
                          {workflowStatus.repositoryUrl.split('/').slice(-2).join('/')}
                        </a>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Zap className="h-3 w-3 text-[var(--success)]" />
                        <span className="text-xs text-[var(--text-primary)]">Workflow:</span>
                        <a href={`${workflowStatus.repositoryUrl}/actions`} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--success)] hover:underline">
                          View Deployment
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-5">
            <div className="text-center mb-6">
              <div className="relative inline-block mb-4">
                <div className="absolute inset-0 bg-[var(--success)] rounded-lg blur-sm opacity-20"></div>
                <div className="relative bg-gradient-to-br from-[var(--success)] to-green-600 p-2 rounded-lg">
                  <Zap className="h-8 w-8 text-black" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-[var(--text-primary)] mb-1">Deploy RDP Server</h2>
              <p className="text-xs text-[var(--text-secondary)]">Ready to create your automated RDP server</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-5">
              <div className="card p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="relative">
                    <div className="absolute inset-0 bg-[var(--accent-primary)] rounded-full blur-sm opacity-20"></div>
                    <div className="relative bg-gradient-to-br from-[var(--accent-primary)] to-blue-600 p-1 rounded-full">
                      <Server className="h-3 w-3 text-black" />
                    </div>
                  </div>
                  <h3 className="text-sm font-medium text-[var(--text-primary)]">Provider</h3>
                </div>
                <code className="block bg-[var(--bg-tertiary)] px-2 py-1 rounded text-[var(--accent-primary)] text-xs border border-[var(--border-primary)]">
                  {formData.provider}
                </code>
              </div>

              <div className="card p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="relative">
                    <div className="absolute inset-0 bg-[var(--success)] rounded-full blur-sm opacity-20"></div>
                    <div className="relative bg-gradient-to-br from-[var(--success)] to-green-600 p-1 rounded-full">
                      <Users className="h-3 w-3 text-black" />
                    </div>
                  </div>
                  <h3 className="text-sm font-medium text-[var(--text-primary)]">Account</h3>
                </div>
                <code className="block bg-[var(--bg-tertiary)] px-2 py-1 rounded text-[var(--success)] text-xs border border-[var(--border-primary)]">
                  {formData.selectedAccount?.login}
                </code>
              </div>

              <div className="card p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="relative">
                    <div className="absolute inset-0 bg-[var(--warning)] rounded-full blur-sm opacity-20"></div>
                    <div className="relative bg-gradient-to-br from-[var(--warning)] to-orange-600 p-1 rounded-full">
                      <Github className="h-3 w-3 text-black" />
                    </div>
                  </div>
                  <h3 className="text-sm font-medium text-[var(--text-primary)]">Repository</h3>
                </div>
                <code className="block bg-[var(--bg-tertiary)] px-2 py-1 rounded text-[var(--warning)] text-xs border border-[var(--border-primary)]">
                  {formData.repositoryName}
                </code>
              </div>
            </div>

            {workflowStatus.status === 'idle' && (
              <button
                onClick={handleDeploy}
                className="btn-primary w-full py-4 flex items-center justify-center space-x-2 text-sm"
              >
                <Zap className="h-5 w-5" />
                <span>DEPLOY RDP SERVER</span>
              </button>
            )}

            {workflowStatus.status !== 'idle' && (
              <div className="space-y-3">
                <div className="card p-4 bg-gradient-to-r from-[var(--accent-primary)]/10 to-[var(--success)]/10 border border-[var(--accent-primary)]/30">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      {workflowStatus.status === 'creating' && <Loader className="h-5 w-5 text-[var(--accent-primary)] animate-spin" />}
                      {workflowStatus.status === 'deploying' && <Loader className="h-5 w-5 text-[var(--success)] animate-spin" />}
                      {workflowStatus.status === 'completed' && <CheckCircle className="h-5 w-5 text-[var(--success)]" />}
                      {workflowStatus.status === 'error' && <AlertCircle className="h-5 w-5 text-[var(--error)]" />}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-[var(--text-primary)]">
                        {workflowStatus.status === 'creating' && 'Creating Repository...'}
                        {workflowStatus.status === 'deploying' && 'Deploying RDP Server...'}
                        {workflowStatus.status === 'completed' && 'Deployment Complete!'}
                        {workflowStatus.status === 'error' && 'Deployment Failed'}
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] mt-1">
                        {workflowStatus.message}
                      </div>
                    </div>
                    {workflowStatus.status === 'deploying' && (
                      <button
                        onClick={checkWorkflowStatus}
                        className="btn-secondary text-xs px-2 py-1"
                      >
                        Check Status
                      </button>
                    )}
                  </div>
                </div>

                {workflowStatus.repositoryUrl && (
                  <div className="card p-3 bg-gradient-to-r from-[var(--accent-primary)]/10 to-[var(--success)]/10 border border-[var(--accent-primary)]/30">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Github className="h-3 w-3 text-[var(--accent-primary)]" />
                        <span className="text-xs text-[var(--text-primary)]">Repository:</span>
                        <a href={workflowStatus.repositoryUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--accent-primary)] hover:underline">
                          {workflowStatus.repositoryUrl.split('/').slice(-2).join('/')}
                        </a>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Zap className="h-3 w-3 text-[var(--success)]" />
                        <span className="text-xs text-[var(--text-primary)]">Workflow:</span>
                        <a href={`${workflowStatus.repositoryUrl}/actions`} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--success)] hover:underline">
                          View Deployment
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 5:
        return (
          <div className="space-y-8">
            <div className="text-center mb-8">
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-[var(--success)] rounded-full blur-lg opacity-20"></div>
                <div className="relative bg-gradient-to-br from-[var(--success)] to-green-600 p-4 rounded-full">
                  <Monitor className="h-16 w-16 text-black" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2 mt-6">RDP Connection Ready!</h2>
              <p className="text-[var(--text-secondary)]">Your Windows RDP server is ready to use</p>
            </div>

            {workflowStatus.connectionDetails && (
              <section className="bg-gray-50 py-8 dark:bg-transparent">
                <div className="mx-auto max-w-4xl">
                  <div className="text-center mb-8">
                    <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">
                      CONNECTION DETAILS
                    </h3>
                    <div className="text-sm text-[var(--text-secondary)] font-mono">
                      Secure credentials for your RDP server
                    </div>
                  </div>

                  <div className="relative">
                    <div className="relative z-10 grid grid-cols-6 gap-3">
                      <div className="relative col-span-full flex overflow-hidden lg:col-span-2">
                        <div className="card relative m-auto size-fit pt-6 w-full">
                          <div className="relative flex h-24 w-full items-center justify-center">
                            <svg className="text-muted absolute inset-0 size-full" viewBox="0 0 254 104" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path
                                d="M112.891 97.7022C140.366 97.0802 171.004 94.6715 201.087 87.5116C210.43 85.2881 219.615 82.6412 228.284 78.2473"
                                fill="url(#paint0_linear_host)"
                              />
                              <path className="text-success" d="M3 72H209" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
                              <defs>
                                <linearGradient id="paint0_linear_host" x1="106.385" y1="1.34375" x2="106" y2="72" gradientUnits="userSpaceOnUse">
                                  <stop stopColor="white" stopOpacity="0" />
                                  <stop className="text-success" offset="1" stopColor="currentColor" />
                                </linearGradient>
                              </defs>
                            </svg>
                            <div className="relative z-10">
                              <Server className="h-8 w-8 text-[var(--success)]" />
                            </div>
                          </div>
                          <div className="relative z-10 mt-4 space-y-1 text-center p-4">
                            <h2 className="text-base font-medium transition dark:text-white">Host Address</h2>
                            <code className="block bg-[var(--bg-tertiary)] px-2 py-1.5 rounded text-[var(--success)] font-mono text-xs border border-[var(--border-primary)]">
                              {workflowStatus.connectionDetails.host}
                            </code>
                          </div>
                        </div>
                      </div>

                      <div className="relative col-span-full overflow-hidden sm:col-span-3 lg:col-span-2">
                        <div className="card pt-6 h-full">
                          <div className="pt-6 lg:px-6">
                            <svg className="dark:text-muted-foreground w-full" viewBox="0 0 386 123" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <rect width="386" height="123" rx="10" />
                              <path
                                className="text-accent-primary"
                                d="M3 121.077C3 121.077 15.3041 93.6691 36.0195 87.756C56.7349 81.8429 66.6632 80.9723 66.6632 80.9723C66.6632 80.9723 80.0327 80.9723 91.4656 80.9723"
                                stroke="currentColor"
                                strokeWidth="3"
                              />
                              <circle className="text-accent-primary" cx="50" cy="50" r="12" fill="currentColor" />
                              <Users className="absolute top-12 left-12 h-6 w-6 text-white" />
                            </svg>
                          </div>
                          <div className="relative z-10 mt-8 space-y-1 text-center p-4">
                            <h2 className="text-base font-medium transition">Username</h2>
                            <code className="block bg-[var(--bg-tertiary)] px-2 py-1.5 rounded text-[var(--accent-primary)] font-mono text-xs border border-[var(--border-primary)]">
                              {workflowStatus.connectionDetails.username}
                            </code>
                          </div>
                        </div>
                      </div>

                      <div className="relative col-span-full overflow-hidden lg:col-span-2">
                        <div className="card grid h-full pt-6 sm:grid-cols-1">
                          <div className="relative z-10 flex flex-col justify-between space-y-6 lg:space-y-4 p-4">
                            <div className="relative flex aspect-square size-10 rounded-full border before:absolute before:-inset-2 before:rounded-full before:border dark:border-white/10 dark:before:border-white/5 mx-auto">
                              <Shield className="m-auto size-5 text-[var(--warning)]" strokeWidth={1} />
                            </div>
                            <div className="space-y-1 text-center">
                              <h2 className="text-base font-medium transition">Password</h2>
                              <code className="block bg-[var(--bg-tertiary)] px-2 py-1.5 rounded text-[var(--warning)] font-mono text-xs border border-[var(--border-primary)]">
                                {workflowStatus.connectionDetails.password}
                              </code>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            <div className="card p-6 bg-gradient-to-r from-[var(--accent-primary)]/10 to-[var(--success)]/10 border border-[var(--accent-primary)]/30">
              <div className="flex items-center space-x-3 mb-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-[var(--accent-primary)] rounded-full blur-md opacity-20"></div>
                  <div className="relative bg-gradient-to-br from-[var(--accent-primary)] to-blue-600 p-2 rounded-full">
                    <CheckCircle className="h-5 w-5 text-black" />
                  </div>
                </div>
                <h4 className="text-lg font-bold text-[var(--text-primary)]">How to Connect</h4>
              </div>
              <ol className="text-sm text-[var(--text-secondary)] space-y-2 list-decimal list-inside ml-4">
                <li>Open <span className="text-[var(--accent-primary)] font-semibold">Remote Desktop Connection</span> on Windows</li>
                <li>Enter the <span className="text-[var(--success)] font-semibold">host address</span> above</li>
                <li>Use the provided <span className="text-[var(--accent-primary)] font-semibold">username</span> and <span className="text-[var(--warning)] font-semibold">password</span></li>
                <li>Click <span className="text-[var(--success)] font-semibold">Connect</span>!</li>
              </ol>
            </div>

            {/* Telegram Support Group */}
            <div className="mt-8 p-6 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg">
              <div className="text-center">
                <div className="flex items-center justify-center mb-4">
                  <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0C5.374 0 0 5.373 0 12s5.374 12 12 12 12-5.373 12-12S18.626 0 12 0zm5.568 8.16c-.169 1.858-.896 6.728-.896 6.728-.896 6.728-1.268 7.928-1.268 7.928-.16.906-.576 1.08-.576 1.08s-.736.064-1.536-.576c-.8-.64-2.032-1.472-2.032-1.472s-2.848 1.856-3.2 2.112c-.352.256-.608.192-.608.192s-.128-.064-.128-.448c0-.384.032-2.496.032-2.496s4.608-4.096 4.864-4.352c.256-.256.128-.4-.192-.144-.32.256-3.936 2.496-3.936 2.496s-.448.288-.96.032c-.512-.256-1.12-.448-1.12-.448s-.832-.544.576-1.12c1.408-.576 6.624-2.56 6.624-2.56s1.216-.48 1.216.32z"/>
                    </svg>
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Need Help?</h3>
                <p className="text-[var(--text-secondary)] mb-4">
                  Join our Telegram group for support, troubleshooting, and community help
                </p>
                <a
                  href="https://t.me/tunnelrdp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors duration-200"
                >
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.374 0 0 5.373 0 12s5.374 12 12 12 12-5.373 12-12S18.626 0 12 0zm5.568 8.16c-.169 1.858-.896 6.728-.896 6.728-.896 6.728-1.268 7.928-1.268 7.928-.16.906-.576 1.08-.576 1.08s-.736.064-1.536-.576c-.8-.64-2.032-1.472-2.032-1.472s-2.848 1.856-3.2 2.112c-.352.256-.608.192-.608.192s-.128-.064-.128-.448c0-.384.032-2.496.032-2.496s4.608-4.096 4.864-4.352c.256-.256.128-.4-.192-.144-.32.256-3.936 2.496-3.936 2.496s-.448.288-.96.032c-.512-.256-1.12-.448-1.12-.448s-.832-.544.576-1.12c1.408-.576 6.624-2.56 6.624-2.56s1.216-.48 1.216.32z"/>
                  </svg>
                  Join @tunnelrdp
                </a>
                <p className="text-xs text-[var(--text-secondary)] mt-2">
                  Get instant help with any connection issues or questions
                </p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="border-b border-[var(--border-primary)]">
        <div className="container-custom py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={onBack}
              className="btn-secondary flex items-center space-x-2 text-sm px-3 py-2"
            >
              <ArrowLeft className="h-3 w-3" />
              <span>Back</span>
            </button>
            <div className="text-center">
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <TunnelRDPIcon size={20} />
                </div>
                <h1 className="text-sm font-semibold text-[var(--text-primary)]">
                  TUNNELRDP DEPLOYMENT
                </h1>
              </div>
              <div className="text-xs text-[var(--text-secondary)] mt-1">Configure and deploy secure RDP server</div>
            </div>
            <div className="w-[80px]"></div>
          </div>
        </div>
      </header>

      <div className="container-custom py-6">

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8 mt-8">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className="relative group">
                <div className={`absolute inset-0 rounded-full blur-sm opacity-20 transition-opacity duration-300 ${
                  currentStep >= step.id
                    ? 'bg-[var(--accent-primary)] group-hover:opacity-40'
                    : 'bg-[var(--border-primary)]'
                }`}></div>
                <div className={`relative flex items-center justify-center w-10 h-10 rounded-full border transition-all duration-300 ${
                  currentStep >= step.id
                    ? 'bg-gradient-to-br from-[var(--accent-primary)] to-blue-600 border-[var(--accent-primary)] text-black shadow-md'
                    : 'bg-[var(--bg-secondary)] border-[var(--border-primary)] text-[var(--text-muted)]'
                }`}>
                  <step.icon className="h-4 w-4" />
                </div>
              </div>
              <div className="ml-4 mr-8">
                <div className={`text-xs font-medium transition-colors duration-300 ${
                  currentStep >= step.id
                    ? 'text-[var(--accent-primary)]'
                    : 'text-[var(--text-muted)]'
                }`}>
                  Step {step.id}
                </div>
                <div className={`text-sm font-semibold transition-colors duration-300 tracking-tight ${
                  currentStep >= step.id
                    ? 'text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)]'
                }`}>
                  {step.title}
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-16 h-0.5 rounded-full transition-all duration-300 ${
                  currentStep > step.id
                    ? 'bg-gradient-to-r from-[var(--accent-primary)] to-blue-600'
                    : 'bg-[var(--border-primary)]'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="max-w-5xl mx-auto">
          <div className="card-elevated p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-[var(--accent-primary)] via-[var(--success)] to-[var(--warning)]"></div>

            {renderStepContent()}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8 pt-6 border-t border-[var(--border-primary)]">
              <button
                onClick={handlePrevious}
                disabled={currentStep === 1}
                className="btn-secondary flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Previous</span>
              </button>

              {currentStep < 4 && (
                <button
                  onClick={handleNext}
                  disabled={
                    (currentStep === 1 && !formData.provider) ||
                    (currentStep === 2 && !formData.selectedAccount) ||
                    (currentStep === 3 && (
                      !formData.repositoryName ||
                      (formData.provider === 'ngrok' && !formData.ngrokToken) ||
                      (formData.provider === 'localexpose' && !formData.localexposeToken) ||
                      (formData.provider === 'tailscale' && !formData.tailscaleAuthKey) ||
                      (formData.provider === 'cloudflare-tunnel' && !formData.cloudflareSetup)
                    ))
                  }
                  className="btn-primary flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm"
                >
                  <span>Next</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}

              {currentStep === 4 && workflowStatus.status !== 'completed' && (
                <button
                  onClick={onBack}
                  className="btn-secondary flex items-center space-x-2 px-4 py-2 text-sm"
                >
                  <span>Cancel</span>
                </button>
              )}

              {((currentStep === 4 && workflowStatus.status === 'completed') || currentStep === 5) && (
                <button
                  onClick={onBack}
                  className="btn-primary flex items-center space-x-2 px-4 py-2 text-sm"
                >
                  <span>Create Another</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
