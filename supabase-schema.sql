-- Supabase Database Schema for RDP Automation
-- This file creates the required tables for user management and RDP session storage

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    github_id VARCHAR(50) NOT NULL UNIQUE,
    github_username VARCHAR(100) NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create rdp_sessions table
CREATE TABLE IF NOT EXISTS public.rdp_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    repository_url TEXT NOT NULL,
    repository_name VARCHAR(255) NOT NULL,
    connection_details JSONB,
    status VARCHAR(20) NOT NULL CHECK (status IN ('idle', 'creating', 'deploying', 'completed', 'error')),
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(user_id, repository_url)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_github_id ON public.users(github_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_rdp_sessions_user_id ON public.rdp_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_rdp_sessions_status ON public.rdp_sessions(status);
CREATE INDEX IF NOT EXISTS idx_rdp_sessions_expires_at ON public.rdp_sessions(expires_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at columns
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_rdp_sessions_updated_at ON public.rdp_sessions;
CREATE TRIGGER update_rdp_sessions_updated_at
    BEFORE UPDATE ON public.rdp_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Note: Row Level Security (RLS) is disabled for now since we're using NextAuth instead of Supabase Auth
-- In a production environment, you should implement proper RLS policies or use Supabase Auth
-- For now, we rely on application-level security through NextAuth and GitHub OAuth

-- Uncomment the following lines if you want to enable RLS with permissive policies:
-- ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.rdp_sessions ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow all operations" ON public.users FOR ALL USING (true);
-- CREATE POLICY "Allow all operations" ON public.rdp_sessions FOR ALL USING (true);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.users TO anon, authenticated;
GRANT ALL ON public.rdp_sessions TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Insert a comment for documentation
COMMENT ON TABLE public.users IS 'User profiles linked to GitHub OAuth authentication';
COMMENT ON TABLE public.rdp_sessions IS 'RDP session data with connection details and status tracking';
