/**
 * Enhanced Status Indicator Component
 * Provides real-time status updates with comprehensive feedback and user guidance
 */

'use client';

import React, { useState, useEffect } from 'react';
import { WorkflowStatus, TunnelingProvider } from '@/types/tunneling';
import { LoggingService } from '@/services/LoggingService';

interface EnhancedStatusIndicatorProps {
  status: WorkflowStatus;
  provider: TunnelingProvider;
  repositoryUrl?: string;
  onRetry?: () => void;
  onCancel?: () => void;
  className?: string;
}

interface StatusStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'skipped';
  duration?: number;
  error?: string;
}

export function EnhancedStatusIndicator({
  status,
  provider,
  repositoryUrl,
  onRetry,
  onCancel,
  className = ''
}: EnhancedStatusIndicatorProps) {
  const [steps, setSteps] = useState<StatusStep[]>([]);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const loggingService = LoggingService.getInstance();

  // Initialize deployment steps
  useEffect(() => {
    const deploymentSteps: StatusStep[] = [
      {
        id: 'validation',
        title: 'Configuration Validation',
        description: 'Validating deployment configuration and provider settings',
        status: 'pending'
      },
      {
        id: 'repository',
        title: 'Repository Creation',
        description: 'Creating GitHub repository with workflow files',
        status: 'pending'
      },
      {
        id: 'secrets',
        title: 'Secrets Configuration',
        description: 'Setting up authentication tokens and secrets',
        status: 'pending'
      },
      {
        id: 'workflow',
        title: 'Workflow Trigger',
        description: 'Initiating GitHub Actions workflow',
        status: 'pending'
      },
      {
        id: 'rdp-setup',
        title: 'RDP Server Setup',
        description: 'Configuring Windows RDP server and user accounts',
        status: 'pending'
      },
      {
        id: 'tunnel',
        title: `${provider} Tunnel`,
        description: `Establishing ${provider} tunnel for remote access`,
        status: 'pending'
      },
      {
        id: 'connection',
        title: 'Connection Ready',
        description: 'RDP server is ready for connections',
        status: 'pending'
      }
    ];

    setSteps(deploymentSteps);
  }, [provider]);

  // Update steps based on status
  useEffect(() => {
    updateStepsFromStatus(status);
  }, [status]);

  // Track elapsed time
  useEffect(() => {
    if (status.status === 'deploying' && status.startTime) {
      const interval = setInterval(() => {
        setElapsedTime(Date.now() - status.startTime!);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [status.status, status.startTime]);

  const updateStepsFromStatus = (currentStatus: WorkflowStatus) => {
    setSteps(prevSteps => {
      const newSteps = [...prevSteps];

      switch (currentStatus.status) {
        case 'creating':
          newSteps[0].status = 'completed';
          newSteps[1].status = 'in-progress';
          setCurrentStep('repository');
          break;

        case 'deploying':
          newSteps[0].status = 'completed';
          newSteps[1].status = 'completed';
          newSteps[2].status = 'completed';
          newSteps[3].status = 'completed';
          
          if (currentStatus.message?.includes('RDP')) {
            newSteps[4].status = 'in-progress';
            setCurrentStep('rdp-setup');
          } else if (currentStatus.message?.includes('tunnel')) {
            newSteps[4].status = 'completed';
            newSteps[5].status = 'in-progress';
            setCurrentStep('tunnel');
          }
          break;

        case 'completed':
          newSteps.forEach(step => {
            if (step.status !== 'failed') {
              step.status = 'completed';
            }
          });
          setCurrentStep('connection');
          break;

        case 'error':
          // Mark current step as failed
          const failedStepIndex = newSteps.findIndex(step => step.status === 'in-progress');
          if (failedStepIndex !== -1) {
            newSteps[failedStepIndex].status = 'failed';
            newSteps[failedStepIndex].error = currentStatus.message;
          }
          break;

        case 'retrying':
          // Reset failed steps to pending
          newSteps.forEach(step => {
            if (step.status === 'failed') {
              step.status = 'pending';
              step.error = undefined;
            }
          });
          break;
      }

      return newSteps;
    });
  };

  const getStatusIcon = (stepStatus: StatusStep['status']) => {
    switch (stepStatus) {
      case 'completed':
        return (
          <div className="flex-shrink-0 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        );
      case 'in-progress':
        return (
          <div className="flex-shrink-0 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
            <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
          </div>
        );
      case 'failed':
        return (
          <div className="flex-shrink-0 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        );
      case 'skipped':
        return (
          <div className="flex-shrink-0 w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="flex-shrink-0 w-6 h-6 bg-gray-600 rounded-full border-2 border-gray-500"></div>
        );
    }
  };

  const formatElapsedTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
  };

  const getOverallStatusColor = () => {
    switch (status.status) {
      case 'completed':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
      case 'deploying':
      case 'creating':
        return 'text-blue-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className={`bg-gray-800 rounded-lg p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className={`text-lg font-semibold ${getOverallStatusColor()}`}>
            Deployment Status
          </h3>
          <p className="text-sm text-gray-400">
            Provider: {provider} • {status.startTime && `Elapsed: ${formatElapsedTime(elapsedTime)}`}
          </p>
        </div>
        
        {status.status === 'error' && onRetry && (
          <button
            onClick={onRetry}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
          >
            Retry
          </button>
        )}
      </div>

      {/* Progress Steps */}
      <div className="space-y-4">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-start space-x-3">
            {getStatusIcon(step.status)}
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className={`text-sm font-medium ${
                  step.status === 'completed' ? 'text-green-400' :
                  step.status === 'in-progress' ? 'text-blue-400' :
                  step.status === 'failed' ? 'text-red-400' :
                  'text-gray-400'
                }`}>
                  {step.title}
                </h4>
                
                {step.status === 'in-progress' && (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                    <span className="text-xs text-blue-400">In Progress</span>
                  </div>
                )}
              </div>
              
              <p className="text-xs text-gray-500 mt-1">
                {step.description}
              </p>
              
              {step.error && (
                <div className="mt-2 p-2 bg-red-900/20 border border-red-500/20 rounded text-xs text-red-400">
                  {step.error}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Status Message */}
      {status.message && (
        <div className="mt-6 p-3 bg-gray-700 rounded-md">
          <p className="text-sm text-gray-300">{status.message}</p>
        </div>
      )}

      {/* Connection Details */}
      {status.connectionDetails && (
        <div className="mt-6 p-4 bg-green-900/20 border border-green-500/20 rounded-md">
          <h4 className="text-sm font-medium text-green-400 mb-2">Connection Ready!</h4>
          <div className="space-y-1 text-xs text-gray-300">
            <p><span className="text-gray-400">Host:</span> {status.connectionDetails.host}</p>
            <p><span className="text-gray-400">Username:</span> {status.connectionDetails.username}</p>
            <p><span className="text-gray-400">Password:</span> {status.connectionDetails.password}</p>
          </div>
        </div>
      )}

      {/* Repository Link */}
      {repositoryUrl && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <a
            href={repositoryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            View Repository →
          </a>
        </div>
      )}
    </div>
  );
}

export default EnhancedStatusIndicator;
