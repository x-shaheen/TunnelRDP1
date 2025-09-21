/**
 * Jest Global Setup
 * Runs once before all tests
 */

export default async function globalSetup() {
  console.log('🚀 Starting RDP Automation Test Suite');
  
  // Set test environment variables
  (process.env as any).NODE_ENV = 'test';
  process.env.NEXTAUTH_URL = 'http://localhost:3000';
  process.env.NEXTAUTH_SECRET = 'test-secret-key-for-testing';
  
  // Initialize test database or external services if needed
  // For now, we'll just log the setup
  console.log('✅ Test environment configured');
  console.log('✅ Environment variables set');
  console.log('✅ Global setup complete');
}
