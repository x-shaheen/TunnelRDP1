/**
 * Supabase service for persistent storage of RDP connection details
 * Replaces localStorage with cloud storage and user isolation
 */

import { supabase, type Database, type User, type RDPSession, type ConnectionDetails } from '@/lib/supabase';

export interface StoredSession {
  id: string;
  repositoryUrl: string;
  repositoryName: string;
  connectionDetails?: ConnectionDetails;
  status: 'idle' | 'creating' | 'deploying' | 'completed' | 'error';
  message: string;
  timestamp: number;
  expiresAt: number;
}

const SESSION_DURATION = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

export class SupabaseService {
  private static instance: SupabaseService;

  private constructor() {}

  public static getInstance(): SupabaseService {
    if (!SupabaseService.instance) {
      SupabaseService.instance = new SupabaseService();
    }
    return SupabaseService.instance;
  }

  /**
   * Create or update user profile from GitHub session
   */
  async createOrUpdateUser(githubUser: {
    id: string;
    email: string;
    login: string;
    avatar_url?: string;
  }): Promise<User | null> {
    try {
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('github_id', githubUser.id.toString())
        .single();

      if (existingUser) {
        // Update existing user
        const { data, error } = await supabase
          .from('users')
          .update({
            email: githubUser.email,
            github_username: githubUser.login,
            avatar_url: githubUser.avatar_url || null,
          })
          .eq('github_id', githubUser.id.toString())
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create new user
        const { data, error } = await supabase
          .from('users')
          .insert({
            email: githubUser.email,
            github_id: githubUser.id.toString(),
            github_username: githubUser.login,
            avatar_url: githubUser.avatar_url || null,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    } catch (error) {
      console.error('Failed to create/update user:', error);
      return null;
    }
  }

  /**
   * Get user by GitHub ID
   */
  async getUserByGithubId(githubId: string): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('github_id', githubId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to get user:', error);
      return null;
    }
  }

  /**
   * Save a session to Supabase
   */
  async saveSession(userId: string, session: Omit<StoredSession, 'id' | 'timestamp' | 'expiresAt'>): Promise<boolean> {
    try {
      const now = Date.now();
      const expiresAt = new Date(now + SESSION_DURATION).toISOString();

      const { error } = await supabase
        .from('rdp_sessions')
        .upsert({
          user_id: userId,
          repository_url: session.repositoryUrl,
          repository_name: session.repositoryName,
          connection_details: session.connectionDetails || null,
          status: session.status,
          message: session.message,
          expires_at: expiresAt,
        }, {
          onConflict: 'user_id,repository_url'
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to save session:', error);
      return false;
    }
  }

  /**
   * Get all stored sessions for a user
   */
  async getSessions(userId: string): Promise<StoredSession[]> {
    try {
      const { data, error } = await supabase
        .from('rdp_sessions')
        .select('*')
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data.map(this.mapRDPSessionToStoredSession);
    } catch (error) {
      console.error('Failed to get sessions:', error);
      return [];
    }
  }

  /**
   * Get a specific session by repository URL
   */
  async getSession(userId: string, repositoryUrl: string): Promise<StoredSession | null> {
    try {
      const { data, error } = await supabase
        .from('rdp_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('repository_url', repositoryUrl)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error) throw error;
      return this.mapRDPSessionToStoredSession(data);
    } catch (error) {
      console.error('Failed to get session:', error);
      return null;
    }
  }

  /**
   * Update connection details for a session
   */
  async updateSessionConnectionDetails(
    userId: string, 
    repositoryUrl: string, 
    connectionDetails: ConnectionDetails
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('rdp_sessions')
        .update({
          connection_details: connectionDetails,
          status: 'completed',
          message: 'RDP server is ready! Connection details retrieved.',
        })
        .eq('user_id', userId)
        .eq('repository_url', repositoryUrl);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to update session connection details:', error);
      return false;
    }
  }

  /**
   * Update session status
   */
  async updateSessionStatus(
    userId: string, 
    repositoryUrl: string, 
    status: StoredSession['status'], 
    message: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('rdp_sessions')
        .update({
          status,
          message,
        })
        .eq('user_id', userId)
        .eq('repository_url', repositoryUrl);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to update session status:', error);
      return false;
    }
  }

  /**
   * Remove a session
   */
  async removeSession(userId: string, repositoryUrl: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('rdp_sessions')
        .delete()
        .eq('user_id', userId)
        .eq('repository_url', repositoryUrl);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to remove session:', error);
      return false;
    }
  }

  /**
   * Clear all expired sessions for a user
   */
  async clearExpiredSessions(userId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('rdp_sessions')
        .delete()
        .eq('user_id', userId)
        .lt('expires_at', new Date().toISOString())
        .select('id');

      if (error) throw error;
      return data?.length || 0;
    } catch (error) {
      console.error('Failed to clear expired sessions:', error);
      return 0;
    }
  }

  /**
   * Get the most recent active session for a user
   */
  async getMostRecentSession(userId: string): Promise<StoredSession | null> {
    try {
      const { data, error } = await supabase
        .from('rdp_sessions')
        .select('*')
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      return this.mapRDPSessionToStoredSession(data);
    } catch (error) {
      console.error('Failed to get most recent session:', error);
      return null;
    }
  }

  /**
   * Subscribe to real-time changes for user sessions
   */
  subscribeToSessions(userId: string, callback: (sessions: StoredSession[]) => void) {
    return supabase
      .channel('rdp_sessions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rdp_sessions',
          filter: `user_id=eq.${userId}`,
        },
        async () => {
          // Fetch updated sessions when changes occur
          const sessions = await this.getSessions(userId);
          callback(sessions);
        }
      )
      .subscribe();
  }

  /**
   * Map RDPSession to StoredSession format
   */
  private mapRDPSessionToStoredSession(session: RDPSession): StoredSession {
    return {
      id: session.id,
      repositoryUrl: session.repository_url,
      repositoryName: session.repository_name,
      connectionDetails: session.connection_details || undefined,
      status: session.status,
      message: session.message || '',
      timestamp: new Date(session.created_at).getTime(),
      expiresAt: new Date(session.expires_at).getTime(),
    };
  }
}
