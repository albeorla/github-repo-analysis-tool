import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { repositories } = await request.json();
    
    if (!repositories || !Array.isArray(repositories) || repositories.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No repositories specified' },
        { status: 400 }
      );
    }

    // Get GitHub token from request headers or localStorage
    const githubToken = request.headers.get('x-github-token') || '';
    
    if (!githubToken) {
      return NextResponse.json(
        { success: false, message: 'GitHub token is required' },
        { status: 401 }
      );
    }

    // Delete each repository
    const results = [];
    for (const repo of repositories) {
      const repoName = typeof repo === 'string' ? repo : repo.name;
      
      try {
        // Use GitHub API to delete the repository
        const response = await fetch(`https://api.github.com/repos/${repoName}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        
        if (response.status === 204) {
          results.push({ name: repoName, success: true });
        } else {
          const errorData = await response.json().catch(() => ({}));
          results.push({ 
            name: repoName, 
            success: false, 
            error: `GitHub API returned status ${response.status}: ${errorData.message || 'Unknown error'}` 
          });
        }
      } catch (error) {
        console.error(`Error deleting ${repoName}:`, error);
        results.push({ name: repoName, success: false, error: String(error) });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed deletion of ${repositories.length} repositories`,
      results
    });
  } catch (error) {
    console.error('Error processing delete request:', error);
    return NextResponse.json(
      { success: false, message: `Error processing request: ${error}` },
      { status: 500 }
    );
  }
}
