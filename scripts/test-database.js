#!/usr/bin/env node

/**
 * Database Connection Test Script
 * 
 * This script tests the Supabase connection and verifies that the required tables exist.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    
    lines.forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }
}

async function testDatabaseConnection() {
  console.log('🧪 Testing Supabase Database Connection');
  console.log('=====================================\n');

  // Load environment variables
  loadEnvFile();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.log('❌ Missing Supabase configuration');
    console.log('   Please check your .env.local file\n');
    return false;
  }

  console.log('🔗 Connecting to Supabase...');
  console.log(`   URL: ${supabaseUrl}`);
  console.log(`   Key: ${supabaseKey.substring(0, 20)}...\n`);

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Test 1: Check if users table exists
    console.log('📋 Testing users table...');
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('count', { count: 'exact', head: true });

    if (usersError) {
      console.log('❌ Users table test failed:', usersError.message);
      if (usersError.code === '42P01') {
        console.log('   → Table does not exist. Run: npm run setup:database:sql\n');
      }
      return false;
    } else {
      console.log('✅ Users table exists');
      console.log(`   → Current user count: ${usersData || 0}\n`);
    }

    // Test 2: Check if rdp_sessions table exists
    console.log('📋 Testing rdp_sessions table...');
    const { data: sessionsData, error: sessionsError } = await supabase
      .from('rdp_sessions')
      .select('count', { count: 'exact', head: true });

    if (sessionsError) {
      console.log('❌ RDP sessions table test failed:', sessionsError.message);
      if (sessionsError.code === '42P01') {
        console.log('   → Table does not exist. Run: npm run setup:database:sql\n');
      }
      return false;
    } else {
      console.log('✅ RDP sessions table exists');
      console.log(`   → Current session count: ${sessionsData || 0}\n`);
    }

    // Test 3: Test basic insert/delete (cleanup after)
    console.log('🧪 Testing database operations...');
    const testUser = {
      email: 'test@example.com',
      github_id: 'test-' + Date.now(),
      github_username: 'test-user',
      avatar_url: null
    };

    const { data: insertData, error: insertError } = await supabase
      .from('users')
      .insert(testUser)
      .select()
      .single();

    if (insertError) {
      console.log('❌ Insert test failed:', insertError.message);
      return false;
    }

    console.log('✅ Insert test passed');

    // Cleanup test data
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', insertData.id);

    if (deleteError) {
      console.log('⚠️  Cleanup warning:', deleteError.message);
    } else {
      console.log('✅ Cleanup completed\n');
    }

    console.log('🎉 All database tests passed!');
    console.log('   Your Supabase setup is working correctly.\n');
    return true;

  } catch (error) {
    console.log('💥 Connection test failed:', error.message);
    return false;
  }
}

// Run the test
if (require.main === module) {
  testDatabaseConnection()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Test script error:', error);
      process.exit(1);
    });
}

module.exports = { testDatabaseConnection };
