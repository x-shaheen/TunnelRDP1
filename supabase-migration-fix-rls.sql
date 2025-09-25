-- Migration to fix RLS policies for NextAuth compatibility
-- Run this in your Supabase SQL Editor to fix the user creation issue

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view own sessions" ON public.rdp_sessions;
DROP POLICY IF EXISTS "Users can insert own sessions" ON public.rdp_sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON public.rdp_sessions;
DROP POLICY IF EXISTS "Users can delete own sessions" ON public.rdp_sessions;

-- Option 1: Disable RLS completely (simplest for NextAuth)
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdp_sessions DISABLE ROW LEVEL SECURITY;

-- Option 2: If you prefer to keep RLS enabled with permissive policies, uncomment these lines:
-- CREATE POLICY "Allow all operations" ON public.users FOR ALL USING (true);
-- CREATE POLICY "Allow all operations" ON public.rdp_sessions FOR ALL USING (true);

-- Verify the changes
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'rdp_sessions');
