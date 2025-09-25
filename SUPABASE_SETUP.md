# Supabase Database Setup Guide

This guide will help you set up the required database schema for the RDP Automation application.

## 🚨 Important: Database Schema Required

The application requires specific database tables to function properly. If users are not showing up in Supabase, it's likely because the database schema hasn't been created yet.

## 📋 Quick Setup

### Step 1: Run the Setup Script

```bash
cd rdp-automation
node scripts/setup-database.js --show-sql
```

This will display the SQL schema that needs to be executed in your Supabase project.

### Step 2: Execute the Schema in Supabase

1. **Open your Supabase project dashboard:**
   - Go to [https://supabase.com/dashboard/projects](https://supabase.com/dashboard/projects)
   - Select your project (`xlxfpqxgxzwniomwnpau`)

2. **Navigate to the SQL Editor:**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy and execute the schema:**
   - Copy the contents of `supabase-schema.sql` (or use the output from the setup script)
   - Paste into the SQL Editor
   - Click "Run" to execute

### Step 3: Verify Tables Were Created

1. **Check Table Editor:**
   - Go to "Table Editor" in the left sidebar
   - You should see two tables: `users` and `rdp_sessions`

2. **Verify Row Level Security:**
   - Go to "Authentication" → "Policies"
   - Both tables should have RLS policies enabled

## 📊 Database Schema Overview

### Users Table
- Stores GitHub user profiles
- Links GitHub OAuth to internal user IDs
- Includes email, username, avatar URL

### RDP Sessions Table
- Stores RDP connection details per user
- Tracks session status and expiration
- Isolated by user with RLS policies

## 🔧 Troubleshooting

### Issue: "relation 'public.users' does not exist"

**Solution:** The database schema hasn't been created. Follow the setup steps above.

### Issue: "permission denied for table users"

**Solution:** Row Level Security policies may not be set up correctly. Re-run the schema script.

### Issue: "new row violates row-level security policy"

**Solution:** The RLS policies are too restrictive for NextAuth. Run the migration:

1. Copy the contents of `supabase-migration-fix-rls.sql`
2. Execute in Supabase SQL Editor
3. This will disable RLS or create permissive policies

### Issue: Users still not appearing after schema creation

1. **Check browser console** for error messages
2. **Verify environment variables** in `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xlxfpqxgxzwniomwnpau.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```
3. **Test authentication flow** by signing in with GitHub
4. **Run database test**: `npm run test:database`

## 🧪 Testing the Setup

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Sign in with GitHub:**
   - Go to [http://localhost:3000](http://localhost:3000)
   - Click "AUTHENTICATE VIA GITHUB"
   - Complete the OAuth flow

3. **Check Supabase dashboard:**
   - Go to Table Editor → users
   - You should see your user record

4. **Check browser console:**
   - Look for success messages like "✅ User created successfully"
   - No error messages should appear

## 📝 Manual Schema Creation

If you prefer to create the schema manually, here are the essential tables:

```sql
-- Users table
CREATE TABLE public.users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    github_id VARCHAR(50) NOT NULL UNIQUE,
    github_username VARCHAR(100) NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RDP Sessions table
CREATE TABLE public.rdp_sessions (
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
```

## 🎉 Success!

Once the schema is created and you can see users appearing in the Supabase dashboard, your setup is complete! The application will now properly store user data and RDP session information.
