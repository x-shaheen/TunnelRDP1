/**
 * Jest Test Setup
 * Global test configuration and mocks
 */

import '@testing-library/jest-dom';

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
  }),
}));

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock NextAuth
jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: {
        name: 'Test User',
        email: 'test@example.com',
        image: 'https://test.com/avatar.jpg',
      },
      accessToken: 'test-access-token',
    },
    status: 'authenticated',
  }),
  signIn: jest.fn(),
  signOut: jest.fn(),
  getSession: jest.fn(),
}));

// Mock environment variables
process.env.NEXTAUTH_URL = 'http://localhost:3000';
process.env.NEXTAUTH_SECRET = 'test-secret';
process.env.GITHUB_CLIENT_ID = 'test-client-id';
process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';
(process.env as any).NODE_ENV = 'test';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
});

// Mock fetch
global.fetch = jest.fn();

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: jest.fn().mockResolvedValue(undefined),
    readText: jest.fn().mockResolvedValue(''),
  },
});

// Mock performance API
Object.defineProperty(window, 'performance', {
  value: {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByName: jest.fn(() => []),
    getEntriesByType: jest.fn(() => []),
  },
});

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock crypto for Node.js environment
if (typeof globalThis.crypto === 'undefined') {
  const { webcrypto } = require('crypto');
  globalThis.crypto = webcrypto as any;
}

// Mock libsodium-wrappers
jest.mock('libsodium-wrappers', () => ({
  ready: Promise.resolve(),
  from_string: jest.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
  from_base64: jest.fn().mockReturnValue(new Uint8Array([4, 5, 6])),
  crypto_box_seal: jest.fn().mockReturnValue(new Uint8Array([7, 8, 9])),
  to_base64: jest.fn().mockReturnValue('base64-encoded-value'),
  base64_variants: {
    ORIGINAL: 0,
  },
}));

// Mock console methods for cleaner test output
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Global test utilities
global.testUtils = {
  // Create mock deployment config
  createMockDeploymentConfig: (overrides = {}) => ({
    provider: 'serveo',
    repositoryName: 'test-repo',
    selectedAccount: {
      id: 123,
      login: 'testuser',
      name: 'Test User',
      description: 'Test Account',
      avatar_url: 'https://test.com/avatar.jpg',
      type: 'user',
      permissions: {
        admin: true,
        push: true,
        pull: true,
      },
    },
    deploymentTarget: 'personal',
    enableAutoFailover: true,
    maxRetryAttempts: 3,
    timeoutMinutes: 90,
    ...overrides,
  }),

  // Create mock workflow status
  createMockWorkflowStatus: (overrides = {}) => ({
    status: 'completed',
    message: 'RDP server deployed successfully',
    repositoryUrl: 'https://github.com/testuser/test-repo',
    startTime: Date.now() - 300000, // 5 minutes ago
    connectionDetails: {
      host: 'test.serveo.net',
      port: '3389',
      username: 'runneradmin',
      password: 'P@ssw0rd!',
      provider: 'serveo',
      connectionString: 'mstsc /v:test.serveo.net /u:runneradmin',
    },
    ...overrides,
  }),

  // Wait for async operations
  waitFor: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  // Mock API responses
  mockApiResponse: (data: any, success = true) => ({
    success,
    data: success ? data : undefined,
    error: success ? undefined : data,
    timestamp: Date.now(),
  }),
};

// Extend Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidWorkflow(): R;
      toContainProviderSetup(provider: string): R;
    }
  }

  var testUtils: {
    createMockDeploymentConfig: (overrides?: any) => any;
    createMockWorkflowStatus: (overrides?: any) => any;
    waitFor: (ms: number) => Promise<void>;
    mockApiResponse: (data: any, success?: boolean) => any;
  };
}

// Custom Jest matchers
expect.extend({
  toBeValidWorkflow(received: string) {
    const pass = received.includes('name: RDP Server Deployment') &&
                 received.includes('runs-on: windows-latest') &&
                 received.includes('Enable Remote Desktop');

    if (pass) {
      return {
        message: () => `Expected workflow not to be valid`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected workflow to be valid GitHub Actions workflow`,
        pass: false,
      };
    }
  },

  toContainProviderSetup(received: string, provider: string) {
    const providerSetups = {
      serveo: 'SERVEO TUNNEL SETUP',
      pinggy: 'PINGGY TUNNEL SETUP',
      ngrok: 'NGROK SETUP',
    };

    const expectedSetup = providerSetups[provider as keyof typeof providerSetups];
    const pass = received.includes(expectedSetup);

    if (pass) {
      return {
        message: () => `Expected workflow not to contain ${provider} setup`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected workflow to contain ${provider} setup (${expectedSetup})`,
        pass: false,
      };
    }
  },
});

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
  localStorageMock.clear();
  sessionStorageMock.clear();
});
