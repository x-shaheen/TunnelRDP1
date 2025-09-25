#!/usr/bin/env node

/**
 * Database Setup Script for RDP Automation
 * 
 * This script helps set up the Supabase database schema.
 * Run this after creating a new Supabase project.
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 RDP Automation - Database Setup');
console.log('=====================================\n');

// Check if required environment variables are set
function checkEnvironment() {
  console.log('📋 Checking environment configuration...');
  
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];
  
  const missing = [];
  
  // Try to load from .env.local
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    requiredEnvVars.forEach(varName => {
      if (!envContent.includes(varName) && !process.env[varName]) {
        missing.push(varName);
      }
    });
  } else {
    console.log('⚠️  .env.local file not found');
    missing.push(...requiredEnvVars);
  }
  
  if (missing.length > 0) {
    console.log('❌ Missing required environment variables:');
    missing.forEach(varName => {
      console.log(`   - ${varName}`);
    });
    console.log('\n📝 Please ensure your .env.local file contains all required Supabase configuration.');
    return false;
  }
  
  console.log('✅ Environment configuration looks good!\n');
  return true;
}

// Display setup instructions
function showSetupInstructions() {
  console.log('📖 Database Setup Instructions');
  console.log('==============================\n');
  
  console.log('1. 🌐 Open your Supabase project dashboard:');
  console.log('   https://supabase.com/dashboard/projects\n');
  
  console.log('2. 📊 Navigate to the SQL Editor:');
  console.log('   Dashboard → SQL Editor → New Query\n');
  
  console.log('3. 📋 Copy and execute the schema:');
  console.log('   Copy the contents of: supabase-schema.sql');
  console.log('   Paste into the SQL Editor and click "Run"\n');
  
  console.log('4. ✅ Verify tables were created:');
  console.log('   Dashboard → Table Editor');
  console.log('   You should see: users, rdp_sessions\n');
  
  console.log('5. 🔐 Check Row Level Security:');
  console.log('   Dashboard → Authentication → Policies');
  console.log('   Policies should be enabled for both tables\n');
  
  console.log('6. 🧪 Test the application:');
  console.log('   npm run dev');
  console.log('   Sign in with GitHub and verify user creation\n');
}

// Display schema file content
function showSchemaContent() {
  const schemaPath = path.join(__dirname, '..', 'supabase-schema.sql');
  
  if (!fs.existsSync(schemaPath)) {
    console.log('❌ Schema file not found: supabase-schema.sql');
    console.log('   Please ensure the file exists in the project root.\n');
    return false;
  }
  
  console.log('📄 Schema File Content');
  console.log('======================\n');
  console.log(`File: ${schemaPath}`);
  console.log('Copy the following SQL and execute it in your Supabase SQL Editor:\n');
  console.log('--- BEGIN SQL ---');
  
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  console.log(schemaContent);
  
  console.log('--- END SQL ---\n');
  return true;
}

// Main execution
function main() {
  const envOk = checkEnvironment();
  
  if (!envOk) {
    console.log('🔧 Setup your environment first, then run this script again.\n');
    process.exit(1);
  }
  
  showSetupInstructions();
  
  const args = process.argv.slice(2);
  if (args.includes('--show-sql') || args.includes('-s')) {
    showSchemaContent();
  } else {
    console.log('💡 Tip: Run with --show-sql to display the schema content');
    console.log('   node scripts/setup-database.js --show-sql\n');
  }
  
  console.log('🎉 Setup complete! Follow the instructions above to create your database schema.');
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  checkEnvironment,
  showSetupInstructions,
  showSchemaContent
};
