#!/usr/bin/env node

/**
 * Production Validation Script
 * Validates the entire RDP automation system for production readiness
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 RDP Automation Production Validation');
console.log('=====================================\n');

let validationErrors = [];
let validationWarnings = [];

// Check Node.js version
function checkNodeVersion() {
  console.log('📋 Checking Node.js version...');
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  if (majorVersion < 18) {
    validationErrors.push(`Node.js version ${nodeVersion} is not supported. Requires Node.js 18+`);
  } else {
    console.log(`✅ Node.js ${nodeVersion} is supported`);
  }
}

// Check required files
function checkRequiredFiles() {
  console.log('\n📋 Checking required files...');
  
  const requiredFiles = [
    'package.json',
    'next.config.js',
    'tailwind.config.ts',
    'tsconfig.json',
    'jest.config.js',
    'src/services/TunnelingService.ts',
    'src/services/ApiService.ts',
    'src/services/LoggingService.ts',
    'src/components/EnhancedErrorBoundary.tsx',
    'src/components/EnhancedStatusIndicator.tsx',
    'src/tests/TunnelingService.test.ts',
    'src/tests/ApiService.test.ts',
    'src/tests/integration.test.ts'
  ];

  requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`✅ ${file}`);
    } else {
      validationErrors.push(`Missing required file: ${file}`);
    }
  });
}

// Check package.json configuration
function checkPackageJson() {
  console.log('\n📋 Checking package.json configuration...');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    // Check required scripts
    const requiredScripts = ['dev', 'build', 'start', 'test', 'test:coverage', 'validate'];
    requiredScripts.forEach(script => {
      if (packageJson.scripts && packageJson.scripts[script]) {
        console.log(`✅ Script: ${script}`);
      } else {
        validationErrors.push(`Missing required script: ${script}`);
      }
    });

    // Check required dependencies
    const requiredDeps = ['next', 'react', '@octokit/rest', 'libsodium-wrappers'];
    requiredDeps.forEach(dep => {
      if (packageJson.dependencies && packageJson.dependencies[dep]) {
        console.log(`✅ Dependency: ${dep}`);
      } else {
        validationErrors.push(`Missing required dependency: ${dep}`);
      }
    });

    // Check required dev dependencies
    const requiredDevDeps = ['jest', '@testing-library/react', 'typescript'];
    requiredDevDeps.forEach(dep => {
      if (packageJson.devDependencies && packageJson.devDependencies[dep]) {
        console.log(`✅ Dev Dependency: ${dep}`);
      } else {
        validationErrors.push(`Missing required dev dependency: ${dep}`);
      }
    });

  } catch (error) {
    validationErrors.push(`Error reading package.json: ${error.message}`);
  }
}

// Check TypeScript configuration
function checkTypeScriptConfig() {
  console.log('\n📋 Checking TypeScript configuration...');
  
  try {
    const tsConfig = JSON.parse(fs.readFileSync('tsconfig.json', 'utf8'));
    
    if (tsConfig.compilerOptions && tsConfig.compilerOptions.strict) {
      console.log('✅ TypeScript strict mode enabled');
    } else {
      validationWarnings.push('TypeScript strict mode is not enabled');
    }

    if (tsConfig.compilerOptions && tsConfig.compilerOptions.baseUrl) {
      console.log('✅ TypeScript baseUrl configured');
    } else {
      validationWarnings.push('TypeScript baseUrl not configured');
    }

  } catch (error) {
    validationErrors.push(`Error reading tsconfig.json: ${error.message}`);
  }
}

// Run tests
function runTests() {
  console.log('\n📋 Running test suite...');
  
  try {
    execSync('npm run test:ci', { stdio: 'pipe' });
    console.log('✅ All tests passed');
  } catch (error) {
    validationErrors.push('Test suite failed. Run `npm run test` for details.');
  }
}

// Check build
function checkBuild() {
  console.log('\n📋 Checking production build...');
  
  try {
    execSync('npm run build', { stdio: 'pipe' });
    console.log('✅ Production build successful');
    
    // Check if build output exists
    if (fs.existsSync('.next')) {
      console.log('✅ Build output directory exists');
    } else {
      validationErrors.push('Build output directory not found');
    }
    
  } catch (error) {
    validationErrors.push('Production build failed. Run `npm run build` for details.');
  }
}

// Check environment configuration
function checkEnvironment() {
  console.log('\n📋 Checking environment configuration...');
  
  const envExample = '.env.example';
  const envLocal = '.env.local';
  
  if (fs.existsSync(envExample)) {
    console.log('✅ Environment example file exists');
  } else {
    validationWarnings.push('Environment example file (.env.example) not found');
  }

  if (fs.existsSync(envLocal)) {
    console.log('✅ Local environment file exists');
  } else {
    validationWarnings.push('Local environment file (.env.local) not found');
  }
}

// Check security configuration
function checkSecurity() {
  console.log('\n📋 Checking security configuration...');
  
  // Check for sensitive files that shouldn't be committed
  const sensitiveFiles = ['.env', '.env.local', '.env.production'];
  let foundSensitiveFiles = false;
  
  sensitiveFiles.forEach(file => {
    if (fs.existsSync(file)) {
      foundSensitiveFiles = true;
    }
  });

  if (!foundSensitiveFiles) {
    console.log('✅ No sensitive files found in repository');
  } else {
    validationWarnings.push('Sensitive environment files found. Ensure they are in .gitignore');
  }

  // Check .gitignore
  if (fs.existsSync('.gitignore')) {
    const gitignore = fs.readFileSync('.gitignore', 'utf8');
    if (gitignore.includes('.env') && gitignore.includes('node_modules')) {
      console.log('✅ .gitignore properly configured');
    } else {
      validationWarnings.push('.gitignore may not be properly configured');
    }
  } else {
    validationWarnings.push('.gitignore file not found');
  }
}

// Check documentation
function checkDocumentation() {
  console.log('\n📋 Checking documentation...');
  
  const docFiles = ['README.md', 'README-PRODUCTION.md'];
  docFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`✅ ${file} exists`);
    } else {
      validationWarnings.push(`Documentation file ${file} not found`);
    }
  });
}

// Main validation function
async function validateProduction() {
  try {
    checkNodeVersion();
    checkRequiredFiles();
    checkPackageJson();
    checkTypeScriptConfig();
    checkEnvironment();
    checkSecurity();
    checkDocumentation();
    runTests();
    checkBuild();

    console.log('\n🎯 Validation Summary');
    console.log('====================');

    if (validationErrors.length === 0) {
      console.log('✅ All validation checks passed!');
      
      if (validationWarnings.length > 0) {
        console.log(`\n⚠️  ${validationWarnings.length} warnings:`);
        validationWarnings.forEach(warning => {
          console.log(`   • ${warning}`);
        });
      }
      
      console.log('\n🚀 System is ready for production deployment!');
      console.log('\nNext steps:');
      console.log('1. Set up production environment variables');
      console.log('2. Configure GitHub OAuth application');
      console.log('3. Deploy to your hosting platform');
      console.log('4. Run health checks after deployment');
      
      process.exit(0);
    } else {
      console.log(`❌ ${validationErrors.length} validation errors found:`);
      validationErrors.forEach(error => {
        console.log(`   • ${error}`);
      });
      
      if (validationWarnings.length > 0) {
        console.log(`\n⚠️  ${validationWarnings.length} warnings:`);
        validationWarnings.forEach(warning => {
          console.log(`   • ${warning}`);
        });
      }
      
      console.log('\n❌ System is NOT ready for production deployment.');
      console.log('Please fix the errors above and run validation again.');
      
      process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 Validation failed with error:', error.message);
    process.exit(1);
  }
}

// Run validation
validateProduction();
