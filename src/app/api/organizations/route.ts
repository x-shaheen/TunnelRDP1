import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const githubToken = searchParams.get('token');

    if (!githubToken) {
      return NextResponse.json(
        { error: 'GitHub token is required' },
        { status: 400 }
      );
    }

    const octokit = new Octokit({
      auth: githubToken,
    });

    // Check token scopes first
    try {
      const tokenInfo = await octokit.request('GET /user');
      console.log('Token info response headers:', tokenInfo.headers);
      console.log('Token scopes:', tokenInfo.headers['x-oauth-scopes']);
    } catch (error) {
      console.error('Error checking token info:', error);
    }

    // Get user's organizations
    const { data: orgs } = await octokit.rest.orgs.listForAuthenticatedUser({
      per_page: 100,
    });

    console.log('GitHub API returned organizations:', orgs);
    console.log('Number of organizations found:', orgs.length);

    // Get user info for personal account option
    const { data: user } = await octokit.rest.users.getAuthenticated();

    console.log('User info:', { login: user.login, name: user.name });

    // Format organizations for the UI
    const organizations = orgs.map(org => ({
      id: org.id,
      login: org.login,
      name: (org as any).name || org.login,
      description: org.description,
      avatar_url: org.avatar_url,
      type: 'organization' as const,
      permissions: {
        admin: (org as any).permissions?.admin || false,
        push: (org as any).permissions?.push || false,
        pull: (org as any).permissions?.pull || false,
      }
    }));

    console.log('Formatted organizations:', organizations);

    // Add personal account as first option
    const personalAccount = {
      id: user.id,
      login: user.login,
      name: user.name || user.login,
      description: 'Personal account',
      avatar_url: user.avatar_url,
      type: 'user' as const,
      permissions: {
        admin: true,
        push: true,
        pull: true,
      }
    };

    return NextResponse.json({
      success: true,
      accounts: [personalAccount, ...organizations],
      user: {
        login: user.login,
        name: user.name,
        avatar_url: user.avatar_url,
      },
      templates: ORG_TEMPLATES,
      rateLimit: {
        remaining: Math.max(0, 2 - (creationLog.get(githubToken)?.length || 0)),
        resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching organizations:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 }
    );
  }
}

// Organization templates for legitimate use cases
const ORG_TEMPLATES = [
  {
    id: 'dev-environment',
    name: 'Development Environment',
    description: 'Development and testing environment for RDP automation',
    suffix: 'dev-env'
  },
  {
    id: 'client-work',
    name: 'Client Projects',
    description: 'Remote desktop solutions for client projects',
    suffix: 'client-rdp'
  },
  {
    id: 'testing-lab',
    name: 'Testing Laboratory',
    description: 'Isolated testing environment for RDP configurations',
    suffix: 'test-lab'
  },
  {
    id: 'project-workspace',
    name: 'Project Workspace',
    description: 'Dedicated workspace for RDP project development',
    suffix: 'workspace'
  }
];

// Rate limiting storage (in production, use Redis or database)
const creationLog = new Map<string, number[]>();

function checkRateLimit(userToken: string): boolean {
  const now = Date.now();
  const userCreations = creationLog.get(userToken) || [];

  // Remove entries older than 24 hours
  const recentCreations = userCreations.filter(time => now - time < 24 * 60 * 60 * 1000);

  // Update the log
  creationLog.set(userToken, recentCreations);

  // Allow max 2 organizations per 24 hours
  return recentCreations.length < 2;
}

function logCreation(userToken: string): void {
  const userCreations = creationLog.get(userToken) || [];
  userCreations.push(Date.now());
  creationLog.set(userToken, userCreations);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { githubToken, orgName, description, template, quickCreate } = body;

    if (!githubToken) {
      return NextResponse.json(
        { error: 'GitHub token is required' },
        { status: 400 }
      );
    }

    // Rate limiting for quick creation
    if (quickCreate && !checkRateLimit(githubToken)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. You can create maximum 2 organizations per day.' },
        { status: 429 }
      );
    }

    const octokit = new Octokit({
      auth: githubToken,
    });

    let finalOrgName = orgName;
    let finalDescription = description;

    // Handle quick creation with templates
    if (quickCreate) {
      const selectedTemplate = ORG_TEMPLATES.find(t => t.id === template) || ORG_TEMPLATES[0];
      const timestamp = Date.now().toString().slice(-6); // Last 6 digits for uniqueness

      finalOrgName = orgName || `${selectedTemplate.suffix}-${timestamp}`;
      finalDescription = description || selectedTemplate.description;
    }

    if (!finalOrgName) {
      return NextResponse.json(
        { error: 'Organization name is required' },
        { status: 400 }
      );
    }

    // Get user info for billing email
    const { data: user } = await octokit.rest.users.getAuthenticated();

    // GitHub doesn't support programmatic organization creation
    // Instead, we'll return instructions for manual creation
    return NextResponse.json({
      success: false,
      requiresManualCreation: true,
      instructions: {
        orgName: finalOrgName,
        description: finalDescription || 'Organization for RDP automation',
        steps: [
          'Go to GitHub.com and click your profile picture',
          'Select "Your organizations"',
          'Click "New organization"',
          `Enter organization name: "${finalOrgName}"`,
          `Enter description: "${finalDescription}"`,
          'Choose "Free" plan',
          'Complete the setup',
          'Return to this page and refresh'
        ],
        githubUrl: 'https://github.com/settings/organizations',
        directCreateUrl: `https://github.com/organizations/new?name=${encodeURIComponent(finalOrgName)}&description=${encodeURIComponent(finalDescription || 'Organization for RDP automation')}`
      }
    });



  } catch (error) {
    console.error('Error creating organization:', error);

    if (error instanceof Error) {
      // Handle specific GitHub API errors
      if (error.message.includes('name already exists')) {
        return NextResponse.json(
          { error: 'Organization name already exists. Please try a different name.' },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create organization' },
      { status: 500 }
    );
  }
}
