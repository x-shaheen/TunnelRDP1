/**
 * Hook to manage Supabase user state and storage context
 */

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { setCurrentUserId } from '@/utils/supabase-storage';

export function useSupabaseUser() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'authenticated' && session?.supabaseUserId) {
      // Set the current user ID for storage operations
      setCurrentUserId(session.supabaseUserId);
    } else if (status === 'unauthenticated') {
      // Clear the user ID when logged out
      setCurrentUserId(null);
    }
  }, [session, status]);

  return {
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading',
    supabaseUserId: session?.supabaseUserId || null,
    githubUser: session?.user || null,
  };
}
