import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';

interface RequestBody {
  githubToken: string;
  owner: string;
  repo: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { githubToken, owner, repo } = body;

    if (!githubToken || !owner || !repo) {
      return NextResponse.json(
        { error: 'Missing required fields: githubToken, owner, repo' },
        { status: 400 }
      );
    }

    const octokit = new Octokit({
      auth: githubToken,
    });

    // Try to get connection details from the repository file
    try {
      const { data: fileData } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: 'connection-details.json',
      });

      if ('content' in fileData) {
        const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
        const details = JSON.parse(content);

        if (details.host && details.status === 'ready') {
          // Parse host and port
          const [host, port] = details.host.includes(':') ? details.host.split(':') : [details.host, '3389'];

          const connectionDetails = {
            host: host || details.host,
            port: port || '3389',
            username: details.username || 'runneradmin',
            password: details.password || 'P@ssw0rd!'
          };

          return NextResponse.json({
            success: true,
            connectionDetails,
            message: 'Connection details retrieved successfully'
          });
        } else {
          return NextResponse.json({
            success: false,
            message: 'Connection details not ready yet'
          });
        }
      } else {
        return NextResponse.json({
          success: false,
          message: 'Connection details file not found'
        });
      }
    } catch (error: any) {
      if (error.status === 404) {
        return NextResponse.json({
          success: false,
          message: 'Connection details file not found in repository'
        });
      }
      
      console.error('Error fetching connection details:', error);
      return NextResponse.json({
        success: false,
        message: 'Failed to fetch connection details from repository'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in get-credentials API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
