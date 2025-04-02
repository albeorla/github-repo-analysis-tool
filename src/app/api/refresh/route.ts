import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Get GitHub token from request headers
  const githubToken = request.headers.get('x-github-token') || '';
  
  // If no token is provided, return static response
  if (!githubToken) {
    return NextResponse.json({
      success: true,
      message: `Successfully refreshed repository data (demo mode)`,
      timestamp: new Date().toISOString(),
      count: 3
    });
  }
  
  try {
    // Fetch repositories from GitHub API
    const response = await fetch('https://api.github.com/user/repos?per_page=100', {
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    
    const repos = await response.json();
    
    return NextResponse.json({
      success: true,
      message: `Successfully refreshed repository data`,
      timestamp: new Date().toISOString(),
      count: repos.length
    });
  } catch (error) {
    console.error('Error refreshing repository data:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: `Failed to refresh repositories: ${error instanceof Error ? error.message : 'Unknown error'}` 
      },
      { status: 500 }
    );
  }
}
