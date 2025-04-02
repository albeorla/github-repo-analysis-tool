import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';

export async function POST(request: NextRequest) {
  try {
    const { repositories } = await request.json();
    
    if (!repositories || !Array.isArray(repositories) || repositories.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No repositories specified for deletion' },
        { status: 400 }
      );
    }
    
    // Get GitHub token from environment variable instead of request header
    const githubToken = process.env.GITHUB_TOKEN;
    
    if (!githubToken) {
      return NextResponse.json(
        { success: false, message: 'GitHub token is not configured in environment variables' },
        { status: 401 }
      );
    }
    
    // Initialize Octokit with the token
    const octokit = new Octokit({
      auth: githubToken
    });
    
    // Get authenticated user
    const { data: user } = await octokit.users.getAuthenticated();
    const username = user.login;
    
    // Delete each repository
    const results = await Promise.all(
      repositories.map(async (repoName) => {
        try {
          // Delete repository
          await octokit.repos.delete({
            owner: username,
            repo: repoName
          });
          
          return { name: repoName, success: true };
        } catch (error) {
          console.error(`Error deleting repository ${repoName}:`, error);
          return { 
            name: repoName, 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          };
        }
      })
    );
    
    const allSuccessful = results.every(result => result.success);
    
    if (allSuccessful) {
      return NextResponse.json({
        success: true,
        message: `Successfully deleted ${repositories.length} repositories`,
        results
      });
    } else {
      const failedRepos = results.filter(result => !result.success);
      return NextResponse.json({
        success: false,
        message: `Failed to delete ${failedRepos.length} out of ${repositories.length} repositories`,
        results
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error deleting repositories:', error);
    return NextResponse.json(
      { success: false, message: `Error deleting repositories: ${error}` },
      { status: 500 }
    );
  }
}
