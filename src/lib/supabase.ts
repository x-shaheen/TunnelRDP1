import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
})

// Types for our database schema
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          github_id: string
          github_username: string
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          github_id: string
          github_username: string
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          github_id?: string
          github_username?: string
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      rdp_sessions: {
        Row: {
          id: string
          user_id: string
          repository_url: string
          repository_name: string
          connection_details: {
            host: string
            port: string
            username: string
            password: string
          } | null
          status: 'idle' | 'creating' | 'deploying' | 'completed' | 'error'
          message: string | null
          created_at: string
          updated_at: string
          expires_at: string
        }
        Insert: {
          id?: string
          user_id: string
          repository_url: string
          repository_name: string
          connection_details?: {
            host: string
            port: string
            username: string
            password: string
          } | null
          status: 'idle' | 'creating' | 'deploying' | 'completed' | 'error'
          message?: string | null
          created_at?: string
          updated_at?: string
          expires_at: string
        }
        Update: {
          id?: string
          user_id?: string
          repository_url?: string
          repository_name?: string
          connection_details?: {
            host: string
            port: string
            username: string
            password: string
          } | null
          status?: 'idle' | 'creating' | 'deploying' | 'completed' | 'error'
          message?: string | null
          created_at?: string
          updated_at?: string
          expires_at?: string
        }
      }
    }
  }
}

export type User = Database['public']['Tables']['users']['Row']
export type RDPSession = Database['public']['Tables']['rdp_sessions']['Row']
export type ConnectionDetails = {
  host: string
  port: string
  username: string
  password: string
}
