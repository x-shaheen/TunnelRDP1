import { NextRequest, NextResponse } from 'next/server';
import { ApiService } from '@/services/ApiService';
import { WorkflowStatus } from '@/types/tunneling';

interface RequestBody {
  githubToken: string;
  owner: string;
  repo: string;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Parse and validate request body
    let body: RequestBody;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON in request body',
          timestamp: Date.now()
        },
        { status: 400 }
      );
    }

    const { githubToken, owner, repo } = body;

    // Enhanced validation
    if (!githubToken || !owner || !repo) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: githubToken, owner, and repo are required',
          timestamp: Date.now()
        },
        { status: 400 }
      );
    }

    // Validate parameter formats
    if (!/^[a-zA-Z0-9._-]+$/.test(owner) || !/^[a-zA-Z0-9._-]+$/.test(repo)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid owner or repository name format',
          timestamp: Date.now()
        },
        { status: 400 }
      );
    }

    // Initialize API service
    const apiService = ApiService.getInstance();
    apiService.initialize(githubToken);

    // Get workflow status using enhanced API service
    const statusResult = await apiService.getWorkflowStatus(owner, repo);

    if (!statusResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: statusResult.error,
          details: statusResult.details,
          timestamp: statusResult.timestamp
        },
        { status: 500 }
      );
    }

    // Calculate response time
    const responseTime = Date.now() - startTime;

    const response = {
      success: true,
      data: statusResult.data,
      responseTime,
      timestamp: Date.now()
    };

    // Debug logging to see what we're sending to frontend
    console.log('Sending workflow status response to frontend:', JSON.stringify(response, null, 2));

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('Error fetching workflow status:', error);

    // Enhanced error handling
    let errorMessage = 'Failed to fetch workflow status';
    let statusCode = 500;

    if (error.status === 401) {
      errorMessage = 'GitHub authentication failed. Please check your token.';
      statusCode = 401;
    } else if (error.status === 403) {
      errorMessage = 'Permission denied. Please check repository access permissions.';
      statusCode = 403;
    } else if (error.status === 404) {
      errorMessage = 'Repository or workflow not found. Please verify the repository exists.';
      statusCode = 404;
    } else if (error.status === 429) {
      errorMessage = 'GitHub API rate limit exceeded. Please wait before retrying.';
      statusCode = 429;
    } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      errorMessage = 'Network connection error. Please check your internet connection.';
      statusCode = 503;
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: Date.now(),
        responseTime: Date.now() - startTime
      },
      { status: statusCode }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Workflow Status API - Production Ready',
    version: '2.0',
    features: [
      'Enhanced error handling',
      'Real-time status monitoring',
      'Automatic connection detail extraction',
      'Comprehensive validation',
      'Rate limiting protection'
    ],
    timestamp: Date.now()
  });
}
