'use client';

import { useState, useEffect } from 'react';
import { Monitor, Copy, Trash2, RefreshCw, Clock, Zap, CheckCircle, AlertCircle, Server, Shield, Users, History, Activity } from 'lucide-react';
import { Session } from 'next-auth';
import {
  getSessions,
  getAllRecentSessions,
  removeSession,
  updateSessionConnectionDetails,
  subscribeToSessions,
  type StoredSession
} from '@/utils/supabase-storage';
import { useSupabaseUser } from '@/hooks/useSupabaseUser';
import { useToast, ToastContainer } from './Toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface LiveRDPDashboardProps {
  session: Session;
  onBack: () => void;
}

type TabType = 'active' | 'history';

export default function LiveRDPDashboard({ session, onBack }: LiveRDPDashboardProps) {
  const { isAuthenticated, isLoading } = useSupabaseUser();
  const [activeSessions, setActiveSessions] = useState<StoredSession[]>([]);
  const [recentSessions, setRecentSessions] = useState<StoredSession[]>([]);
  const [currentTab, setCurrentTab] = useState<TabType>('active');
  const [refreshingSession, setRefreshingSession] = useState<string | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const { toasts, removeToast, showSuccess, showError } = useToast();

  useEffect(() => {
    if (isAuthenticated) {
      loadActiveSessions();
      loadRecentSessions();

      // Set up real-time subscription
      const subscription = subscribeToSessions((sessions) => {
        setActiveSessions(sessions);
        setLoadingError(null);
      });

      // Fallback: refresh sessions every 30 seconds
      const interval = setInterval(() => {
        loadActiveSessions();
        loadRecentSessions();
      }, 30000);

      return () => {
        clearInterval(interval);
        if (subscription) {
          subscription.unsubscribe();
        }
      };
    }
  }, [isAuthenticated]);

  const loadActiveSessions = async () => {
    if (!isAuthenticated) return;

    try {
      setLoadingError(null);
      const sessions = await getSessions();
      setActiveSessions(sessions);
    } catch (error) {
      console.error('Failed to load sessions:', error);
      setLoadingError('Failed to load sessions. Please check your connection.');
    }
  };

  const loadRecentSessions = async () => {
    if (!isAuthenticated) return;

    try {
      const sessions = await getAllRecentSessions();
      setRecentSessions(sessions);
    } catch (error) {
      console.error('Failed to load recent sessions:', error);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showSuccess('COPY_SUCCESS', `${label} copied to neural clipboard`);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      showError('COPY_ERROR', `Failed to copy ${label} to clipboard`);
    }
  };

  const deleteSession = async (repositoryUrl: string) => {
    try {
      await removeSession(repositoryUrl);
      await loadActiveSessions();
      await loadRecentSessions();
      showSuccess('SESSION_TERMINATED', 'RDP session removed from neural network');
    } catch (error) {
      console.error('Failed to delete session:', error);
      showError('DELETE_ERROR', 'Failed to remove session. Please try again.');
    }
  };

  const refreshSessionStatus = async (sessionData: StoredSession) => {
    if (!sessionData.repositoryUrl) return;
    
    setRefreshingSession(sessionData.repositoryUrl);
    
    try {
      const urlParts = sessionData.repositoryUrl.split('/');
      const owner = urlParts[urlParts.length - 2];
      const repo = urlParts[urlParts.length - 1];

      const response = await fetch('/api/get-credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          githubToken: session.accessToken,
          owner,
          repo
        })
      });

      const result = await response.json();
      if (result.success && result.connectionDetails) {
        await updateSessionConnectionDetails(sessionData.repositoryUrl, result.connectionDetails);
        await loadActiveSessions();
        showSuccess('REFRESH_SUCCESS', 'Session data synchronized from neural repository');
      } else {
        showError('REFRESH_ERROR', 'Failed to retrieve updated session data');
      }
    } catch (error) {
      console.error('Failed to refresh session:', error);
      showError('REFRESH_ERROR', 'Neural connection failed during refresh');
    } finally {
      setRefreshingSession(null);
    }
  };

  const getTimeRemaining = (session: StoredSession) => {
    const now = Date.now();
    const remaining = session.expiresAt - now;
    if (remaining <= 0) return 'Expired';

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const isSessionExpired = (session: StoredSession) => {
    return Date.now() > session.expiresAt;
  };

  const getSessionDisplayStatus = (session: StoredSession) => {
    if (isSessionExpired(session)) {
      if (session.status === 'completed') return 'completed';
      if (session.status === 'error') return 'failed';
      return 'expired';
    }
    return session.status;
  };

  const getSessionAge = (session: StoredSession) => {
    const now = Date.now();
    const age = now - session.timestamp;
    const days = Math.floor(age / (1000 * 60 * 60 * 24));
    const hours = Math.floor((age % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d ${hours}h ago`;
    if (hours > 0) return `${hours}h ago`;
    return 'Just now';
  };

  const getStatusColor = (status: StoredSession['status'] | 'expired' | 'failed' | 'completed') => {
    switch (status) {
      case 'completed': return 'text-[var(--success)]';
      case 'deploying': return 'text-[var(--accent-primary)]';
      case 'creating': return 'text-[var(--warning)]';
      case 'error':
      case 'failed': return 'text-[var(--error)]';
      case 'expired': return 'text-gray-500';
      default: return 'text-[var(--text-muted)]';
    }
  };

  const getStatusIcon = (status: StoredSession['status'] | 'expired' | 'failed' | 'completed') => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-5 w-5" />;
      case 'deploying': return <Zap className="h-5 w-5 animate-pulse" />;
      case 'creating': return <RefreshCw className="h-5 w-5 animate-spin" />;
      case 'error':
      case 'failed': return <AlertCircle className="h-5 w-5" />;
      case 'expired': return <Clock className="h-5 w-5" />;
      default: return <Clock className="h-5 w-5" />;
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <>
        <Card className="border-[var(--border-primary)] bg-[var(--bg-secondary)]">
          <CardContent className="p-12 text-center">
            <RefreshCw className="h-16 w-16 text-[var(--accent-primary)] mx-auto mb-6 opacity-50 animate-spin" />
            <CardTitle className="text-lg font-semibold text-[var(--text-primary)] mb-3">
              LOADING SESSIONS
            </CardTitle>
            <p className="text-xs text-[var(--text-secondary)]">
              Connecting to neural network...
            </p>
          </CardContent>
        </Card>
        <ToastContainer toasts={toasts} onClose={removeToast} />
      </>
    );
  }

  // Show error state
  if (loadingError) {
    return (
      <>
        <Card className="border-[var(--border-primary)] bg-[var(--bg-secondary)]">
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-16 w-16 text-[var(--error)] mx-auto mb-6 opacity-50" />
            <CardTitle className="text-lg font-semibold text-[var(--text-primary)] mb-3">
              CONNECTION ERROR
            </CardTitle>
            <p className="text-xs text-[var(--text-secondary)] mb-4">
              {loadingError}
            </p>
            <Button
              onClick={loadActiveSessions}
              className="bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              RETRY
            </Button>
          </CardContent>
        </Card>
        <ToastContainer toasts={toasts} onClose={removeToast} />
      </>
    );
  }

  const currentSessions = currentTab === 'active' ? activeSessions : recentSessions;
  const displaySessions = currentTab === 'active' ? currentSessions : currentSessions.map(session => ({
    ...session,
    displayStatus: getSessionDisplayStatus(session)
  }));

  return (
    <>
      <div className="space-y-6">
        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="flex bg-[var(--bg-secondary)] rounded-lg p-1 border border-[var(--border-primary)]">
            <button
              onClick={() => setCurrentTab('active')}
              className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all ${
                currentTab === 'active'
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Activity className="h-4 w-4 mr-2" />
              Active Sessions ({activeSessions.length})
            </button>
            <button
              onClick={() => setCurrentTab('history')}
              className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all ${
                currentTab === 'history'
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <History className="h-4 w-4 mr-2" />
              Session History ({recentSessions.length})
            </button>
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">
            {currentTab === 'active' ? 'ACTIVE SECRET SESSIONS' : 'SESSION HISTORY'}
          </h2>
          <p className="text-[var(--text-secondary)]">
            {currentTab === 'active'
              ? <>Active connections: <span className="text-[var(--success)] font-semibold">{activeSessions.length}</span></>
              : <>Recent sessions from last 30 days: <span className="text-[var(--accent-primary)] font-semibold">{recentSessions.length}</span></>
            }
          </p>
        </div>

        {/* Empty State */}
        {displaySessions.length === 0 && (
          <Card className="border-[var(--border-primary)] bg-[var(--bg-secondary)]">
            <CardContent className="p-12 text-center">
              <Monitor className="h-16 w-16 text-[var(--accent-primary)] mx-auto mb-6 opacity-50" />
              <CardTitle className="text-lg font-semibold text-[var(--text-primary)] mb-3">
                {currentTab === 'active' ? 'NO ACTIVE SESSIONS' : 'NO SESSION HISTORY'}
              </CardTitle>
              <p className="text-xs text-[var(--text-secondary)]">
                {currentTab === 'active'
                  ? 'Deploy your first covert RDP server to monitor connections'
                  : 'No recent sessions found in the last 30 days'
                }
              </p>
            </CardContent>
          </Card>
        )}

        {/* Sessions Grid */}
        <div className="grid gap-6">
          {displaySessions.map((sessionData: any) => {
            const isExpired = currentTab === 'history' && isSessionExpired(sessionData);
            const displayStatus = currentTab === 'history' ? sessionData.displayStatus : sessionData.status;

            return (
              <Card
                key={sessionData.repositoryUrl}
                className={`border-[var(--border-primary)] ${
                  isExpired ? 'bg-[var(--bg-secondary)]/50 opacity-75' : 'bg-[var(--bg-secondary)]'
                }`}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                        {sessionData.repositoryName}
                      </CardTitle>
                      <div className={`flex items-center space-x-2 ${getStatusColor(displayStatus)}`}>
                        {getStatusIcon(displayStatus)}
                        <Badge variant="outline" className={`capitalize ${getStatusColor(displayStatus)} border-current`}>
                          {displayStatus}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <div className="text-sm text-[var(--text-secondary)]">
                          {currentTab === 'active' ? 'Time Remaining' : 'Created'}
                        </div>
                        <div className={`font-semibold ${
                          currentTab === 'active' ? 'text-[var(--warning)]' : 'text-[var(--text-secondary)]'
                        }`}>
                          {currentTab === 'active' ? getTimeRemaining(sessionData) : getSessionAge(sessionData)}
                        </div>
                      </div>

                      {currentTab === 'active' && (
                        <Button
                          onClick={() => refreshSessionStatus(sessionData)}
                          disabled={refreshingSession === sessionData.repositoryUrl}
                          variant="outline"
                          size="icon"
                          className="border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                          title="Refresh session status"
                        >
                          <RefreshCw className={`h-4 w-4 ${
                            refreshingSession === sessionData.repositoryUrl ? 'animate-spin' : ''
                          }`} />
                        </Button>
                      )}

                      <Button
                        onClick={() => deleteSession(sessionData.repositoryUrl)}
                        variant="outline"
                        size="icon"
                        className="border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--error)]/10 hover:border-[var(--error)] hover:text-[var(--error)]"
                        title="Delete session"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

            {sessionData.connectionDetails && (
              <CardContent>
                <section className="bg-gray-50 py-8 dark:bg-transparent mt-6">
                <div className="mx-auto max-w-4xl">
                  <div className="text-center mb-8">
                    <h4 className="text-xl font-bold text-[var(--text-primary)] mb-2">
                      CONNECTION CREDENTIALS
                    </h4>
                    <div className="text-sm text-[var(--text-secondary)] font-mono">
                      Active RDP server credentials
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
                                fill="url(#paint0_linear_host_dash)"
                              />
                              <path className="text-success" d="M3 72H209" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
                              <defs>
                                <linearGradient id="paint0_linear_host_dash" x1="106.385" y1="1.34375" x2="106" y2="72" gradientUnits="userSpaceOnUse">
                                  <stop stopColor="white" stopOpacity="0" />
                                  <stop className="text-success" offset="1" stopColor="currentColor" />
                                </linearGradient>
                              </defs>
                            </svg>
                            <div className="relative z-10">
                              <Server className="h-8 w-8 text-[var(--success)]" />
                            </div>
                          </div>
                          <div className="relative z-10 mt-6 space-y-2 text-center p-6">
                            <h2 className="text-lg font-medium transition dark:text-white">Host Address</h2>
                            <div className="flex items-center justify-between bg-[var(--bg-tertiary)] px-3 py-2 rounded border border-[var(--border-primary)]">
                              <code className="text-[var(--success)] font-mono text-sm break-all">
                                {sessionData.connectionDetails.host}
                              </code>
                              <button
                                onClick={() => copyToClipboard(sessionData.connectionDetails!.host, 'Host')}
                                className="ml-2 p-1 hover:bg-[var(--success)]/10 rounded transition-colors"
                                title="Copy host"
                              >
                                <Copy className="h-4 w-4 text-[var(--success)]" />
                              </button>
                            </div>
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
                                d="M3 121.077C3 121.077 15.3041 93.6691 36.0195 87.756C56.7349 81.8429 66.6632 80.9723 66.6632 80.9723"
                                stroke="currentColor"
                                strokeWidth="3"
                              />
                              <circle className="text-accent-primary" cx="50" cy="50" r="12" fill="currentColor" />
                              <Users className="absolute top-12 left-12 h-6 w-6 text-white" />
                            </svg>
                          </div>
                          <div className="relative z-10 mt-14 space-y-2 text-center p-6">
                            <h2 className="text-lg font-medium transition">Username</h2>
                            <div className="flex items-center justify-between bg-[var(--bg-tertiary)] px-3 py-2 rounded border border-[var(--border-primary)]">
                              <code className="text-[var(--accent-primary)] font-mono text-sm">
                                {sessionData.connectionDetails.username}
                              </code>
                              <button
                                onClick={() => copyToClipboard(sessionData.connectionDetails!.username, 'Username')}
                                className="ml-2 p-1 hover:bg-[var(--accent-primary)]/10 rounded transition-colors"
                                title="Copy username"
                              >
                                <Copy className="h-4 w-4 text-[var(--accent-primary)]" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="relative col-span-full overflow-hidden lg:col-span-2">
                        <div className="card grid h-full pt-6 sm:grid-cols-1">
                          <div className="relative z-10 flex flex-col justify-between space-y-12 lg:space-y-6 p-6">
                            <div className="relative flex aspect-square size-12 rounded-full border before:absolute before:-inset-2 before:rounded-full before:border dark:border-white/10 dark:before:border-white/5 mx-auto">
                              <Shield className="m-auto size-6 text-[var(--warning)]" strokeWidth={1} />
                            </div>
                            <div className="space-y-2 text-center">
                              <h2 className="text-lg font-medium transition">Password</h2>
                              <div className="flex items-center justify-between bg-[var(--bg-tertiary)] px-3 py-2 rounded border border-[var(--border-primary)]">
                                <code className="text-[var(--warning)] font-mono text-sm">
                                  {sessionData.connectionDetails.password}
                                </code>
                                <button
                                  onClick={() => copyToClipboard(sessionData.connectionDetails!.password, 'Password')}
                                  className="ml-2 p-1 hover:bg-[var(--warning)]/10 rounded transition-colors"
                                  title="Copy password"
                                >
                                  <Copy className="h-4 w-4 text-[var(--warning)]" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="relative col-span-full overflow-hidden">
                        <Card className="border-[var(--border-primary)] bg-[var(--bg-secondary)]">
                          <CardHeader className="pb-4">
                            <div className="flex items-center space-x-3">
                              <div className="relative">
                                <div className="absolute inset-0 bg-[var(--accent-primary)] rounded-full blur-md opacity-20"></div>
                                <div className="relative bg-gradient-to-br from-[var(--accent-primary)] to-blue-600 p-2 rounded-full">
                                  <Monitor className="h-5 w-5 text-black" />
                                </div>
                              </div>
                              <CardTitle className="text-lg font-bold text-[var(--text-primary)]">Connection String</CardTitle>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div className="bg-[var(--bg-tertiary)] px-4 py-3 rounded border border-[var(--border-primary)] font-mono text-sm text-[var(--text-primary)] break-all">
                              mstsc /v:{sessionData.connectionDetails.host} /u:{sessionData.connectionDetails.username}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
              </CardContent>
            )}

            {!sessionData.connectionDetails && sessionData.status !== 'error' && (
              <CardContent>
                <div className="text-center py-8">
                  <Zap className="h-12 w-12 text-[var(--cyber-blue)] mx-auto mb-4 animate-pulse" />
                  <div className="text-[var(--cyber-blue)] font-mono">
                    NEURAL_DEPLOYMENT_IN_PROGRESS...
                  </div>
                </div>
              </CardContent>
            )}
              </Card>
            );
          })}
        </div>
      </div>
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  );
}
