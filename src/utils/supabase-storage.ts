/**
 * Compatibility layer for Supabase storage
 * Maintains the same interface as the original storage.ts for minimal component changes
 */

import { SupabaseService, type StoredSession } from '@/services/SupabaseService';
import { type ConnectionDetails } from '@/lib/supabase';

// Re-export types for compatibility
export { type ConnectionDetails, type StoredSession };

const supabaseService = SupabaseService.getInstance();

// Global user context - will be set when user logs in
let currentUserId: string | null = null;

/**
 * Set the current user ID for storage operations
 */
export function setCurrentUserId(userId: string | null): void {
  currentUserId = userId;
}

/**
 * Get the current user ID
 */
export function getCurrentUserId(): string | null {
  return currentUserId;
}

/**
 * Save a session to Supabase (requires user to be logged in)
 */
export async function saveSession(session: Omit<StoredSession, 'id' | 'timestamp' | 'expiresAt'>): Promise<void> {
  if (!currentUserId) {
    console.warn('Cannot save session: user not logged in');
    return;
  }

  try {
    await supabaseService.saveSession(currentUserId, session);
  } catch (error) {
    console.error('Failed to save session:', error);
    // Fallback to localStorage for offline support
    try {
      const now = Date.now();
      const sessionWithTimestamp: StoredSession = {
        id: crypto.randomUUID(),
        ...session,
        timestamp: now,
        expiresAt: now + (6 * 60 * 60 * 1000) // 6 hours
      };

      const existingSessions = getSessionsFromLocalStorage();
      const updatedSessions = existingSessions.filter(s => s.repositoryUrl !== session.repositoryUrl);
      updatedSessions.push(sessionWithTimestamp);

      localStorage.setItem('rdp-automation-sessions', JSON.stringify(updatedSessions));
    } catch (localError) {
      console.error('Failed to save session to localStorage:', localError);
    }
  }
}

/**
 * Get all stored sessions (tries Supabase first, falls back to localStorage)
 */
export async function getSessions(): Promise<StoredSession[]> {
  if (!currentUserId) {
    // If user not logged in, try localStorage
    return getSessionsFromLocalStorage();
  }

  try {
    return await supabaseService.getSessions(currentUserId);
  } catch (error) {
    console.error('Failed to get sessions from Supabase:', error);
    // Fallback to localStorage
    return getSessionsFromLocalStorage();
  }
}

/**
 * Get a specific session by repository URL
 */
export async function getSession(repositoryUrl: string): Promise<StoredSession | null> {
  if (!currentUserId) {
    const sessions = getSessionsFromLocalStorage();
    return sessions.find(session => session.repositoryUrl === repositoryUrl) || null;
  }

  try {
    return await supabaseService.getSession(currentUserId, repositoryUrl);
  } catch (error) {
    console.error('Failed to get session from Supabase:', error);
    // Fallback to localStorage
    const sessions = getSessionsFromLocalStorage();
    return sessions.find(session => session.repositoryUrl === repositoryUrl) || null;
  }
}

/**
 * Update connection details for a session
 */
export async function updateSessionConnectionDetails(repositoryUrl: string, connectionDetails: ConnectionDetails): Promise<void> {
  if (!currentUserId) {
    console.warn('Cannot update session: user not logged in');
    return;
  }

  try {
    await supabaseService.updateSessionConnectionDetails(currentUserId, repositoryUrl, connectionDetails);
  } catch (error) {
    console.error('Failed to update session connection details:', error);
    // Fallback to localStorage
    try {
      const sessions = getSessionsFromLocalStorage();
      const sessionIndex = sessions.findIndex(s => s.repositoryUrl === repositoryUrl);
      
      if (sessionIndex !== -1) {
        sessions[sessionIndex] = {
          ...sessions[sessionIndex],
          connectionDetails,
          status: 'completed',
          message: 'RDP server is ready! Connection details retrieved.'
        };
        
        localStorage.setItem('rdp-automation-sessions', JSON.stringify(sessions));
      }
    } catch (localError) {
      console.error('Failed to update session in localStorage:', localError);
    }
  }
}

/**
 * Update session status
 */
export async function updateSessionStatus(repositoryUrl: string, status: StoredSession['status'], message: string): Promise<void> {
  if (!currentUserId) {
    console.warn('Cannot update session status: user not logged in');
    return;
  }

  try {
    await supabaseService.updateSessionStatus(currentUserId, repositoryUrl, status, message);
  } catch (error) {
    console.error('Failed to update session status:', error);
    // Fallback to localStorage
    try {
      const sessions = getSessionsFromLocalStorage();
      const sessionIndex = sessions.findIndex(s => s.repositoryUrl === repositoryUrl);
      
      if (sessionIndex !== -1) {
        sessions[sessionIndex] = {
          ...sessions[sessionIndex],
          status,
          message
        };
        
        localStorage.setItem('rdp-automation-sessions', JSON.stringify(sessions));
      }
    } catch (localError) {
      console.error('Failed to update session status in localStorage:', localError);
    }
  }
}

/**
 * Remove a session
 */
export async function removeSession(repositoryUrl: string): Promise<void> {
  if (!currentUserId) {
    console.warn('Cannot remove session: user not logged in');
    return;
  }

  try {
    await supabaseService.removeSession(currentUserId, repositoryUrl);
  } catch (error) {
    console.error('Failed to remove session from Supabase:', error);
    // Fallback to localStorage
    try {
      const sessions = getSessionsFromLocalStorage();
      const filteredSessions = sessions.filter(s => s.repositoryUrl !== repositoryUrl);
      localStorage.setItem('rdp-automation-sessions', JSON.stringify(filteredSessions));
    } catch (localError) {
      console.error('Failed to remove session from localStorage:', localError);
    }
  }
}

/**
 * Clear all expired sessions
 */
export async function clearExpiredSessions(): Promise<void> {
  if (!currentUserId) {
    // Clear from localStorage
    getSessionsFromLocalStorage(); // This automatically removes expired sessions
    return;
  }

  try {
    await supabaseService.clearExpiredSessions(currentUserId);
  } catch (error) {
    console.error('Failed to clear expired sessions from Supabase:', error);
    // Fallback to localStorage
    getSessionsFromLocalStorage(); // This automatically removes expired sessions
  }
}

/**
 * Get the most recent active session
 */
export async function getMostRecentSession(): Promise<StoredSession | null> {
  if (!currentUserId) {
    const sessions = getSessionsFromLocalStorage();
    if (sessions.length === 0) return null;
    
    return sessions.reduce((latest, current) => 
      current.timestamp > latest.timestamp ? current : latest
    );
  }

  try {
    return await supabaseService.getMostRecentSession(currentUserId);
  } catch (error) {
    console.error('Failed to get most recent session from Supabase:', error);
    // Fallback to localStorage
    const sessions = getSessionsFromLocalStorage();
    if (sessions.length === 0) return null;
    
    return sessions.reduce((latest, current) => 
      current.timestamp > latest.timestamp ? current : latest
    );
  }
}

/**
 * Subscribe to real-time session updates
 */
export function subscribeToSessions(callback: (sessions: StoredSession[]) => void) {
  if (!currentUserId) {
    console.warn('Cannot subscribe to sessions: user not logged in');
    return null;
  }

  return supabaseService.subscribeToSessions(currentUserId, callback);
}

/**
 * Helper function to get sessions from localStorage (fallback)
 */
function getSessionsFromLocalStorage(): StoredSession[] {
  try {
    const stored = localStorage.getItem('rdp-automation-sessions');
    if (!stored) return [];

    const sessions: StoredSession[] = JSON.parse(stored);
    const now = Date.now();

    // Filter out expired sessions
    const validSessions = sessions.filter(session => session.expiresAt > now);

    // Update storage if we removed expired sessions
    if (validSessions.length !== sessions.length) {
      localStorage.setItem('rdp-automation-sessions', JSON.stringify(validSessions));
    }

    return validSessions;
  } catch (error) {
    console.error('Failed to get sessions from localStorage:', error);
    return [];
  }
}
