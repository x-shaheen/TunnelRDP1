/**
 * Utility functions for persistent storage of RDP connection details
 */

export interface ConnectionDetails {
  host: string;
  port: string;
  username: string;
  password: string;
}

export interface StoredSession {
  repositoryUrl: string;
  repositoryName: string;
  connectionDetails?: ConnectionDetails;
  status: 'idle' | 'creating' | 'deploying' | 'completed' | 'error';
  message: string;
  timestamp: number;
  expiresAt: number; // 6 hours from creation
}

const STORAGE_KEY = 'rdp-automation-sessions';
const SESSION_DURATION = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

/**
 * Save a session to localStorage
 */
export function saveSession(session: Omit<StoredSession, 'timestamp' | 'expiresAt'>): void {
  try {
    const now = Date.now();
    const sessionWithTimestamp: StoredSession = {
      ...session,
      timestamp: now,
      expiresAt: now + SESSION_DURATION
    };

    const existingSessions = getSessions();
    const updatedSessions = existingSessions.filter(s => s.repositoryUrl !== session.repositoryUrl);
    updatedSessions.push(sessionWithTimestamp);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSessions));
  } catch (error) {
    console.error('Failed to save session:', error);
  }
}

/**
 * Get all stored sessions
 */
export function getSessions(): StoredSession[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const sessions: StoredSession[] = JSON.parse(stored);
    const now = Date.now();

    // Filter out expired sessions
    const validSessions = sessions.filter(session => session.expiresAt > now);

    // Update storage if we removed expired sessions
    if (validSessions.length !== sessions.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(validSessions));
    }

    return validSessions;
  } catch (error) {
    console.error('Failed to get sessions:', error);
    return [];
  }
}

/**
 * Get a specific session by repository URL
 */
export function getSession(repositoryUrl: string): StoredSession | null {
  const sessions = getSessions();
  return sessions.find(session => session.repositoryUrl === repositoryUrl) || null;
}

/**
 * Update connection details for a session
 */
export function updateSessionConnectionDetails(repositoryUrl: string, connectionDetails: ConnectionDetails): void {
  try {
    const sessions = getSessions();
    const sessionIndex = sessions.findIndex(s => s.repositoryUrl === repositoryUrl);
    
    if (sessionIndex !== -1) {
      sessions[sessionIndex] = {
        ...sessions[sessionIndex],
        connectionDetails,
        status: 'completed',
        message: 'RDP server is ready! Connection details retrieved.'
      };
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    }
  } catch (error) {
    console.error('Failed to update session connection details:', error);
  }
}

/**
 * Update session status
 */
export function updateSessionStatus(repositoryUrl: string, status: StoredSession['status'], message: string): void {
  try {
    const sessions = getSessions();
    const sessionIndex = sessions.findIndex(s => s.repositoryUrl === repositoryUrl);
    
    if (sessionIndex !== -1) {
      sessions[sessionIndex] = {
        ...sessions[sessionIndex],
        status,
        message
      };
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    }
  } catch (error) {
    console.error('Failed to update session status:', error);
  }
}

/**
 * Remove a session
 */
export function removeSession(repositoryUrl: string): void {
  try {
    const sessions = getSessions();
    const filteredSessions = sessions.filter(s => s.repositoryUrl !== repositoryUrl);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredSessions));
  } catch (error) {
    console.error('Failed to remove session:', error);
  }
}

/**
 * Clear all expired sessions
 */
export function clearExpiredSessions(): void {
  getSessions(); // This will automatically remove expired sessions
}

/**
 * Get the most recent active session
 */
export function getMostRecentSession(): StoredSession | null {
  const sessions = getSessions();
  if (sessions.length === 0) return null;
  
  return sessions.reduce((latest, current) => 
    current.timestamp > latest.timestamp ? current : latest
  );
}
