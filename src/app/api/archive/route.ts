import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';

export async function POST(request: NextRequest) {
  try {
    const { repositories } = await request.json();
    
    if (!repositories || !Array.isArray(repositories) || repositories.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No repositories specified for archiving' },
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
    
    // Archive each repository
    const results = await Promise.all(
      repositories.map(async (repoName) => {
        try {
          // Update repository to archived state
          await octokit.repos.update({
            owner: username,
            repo: repoName,
            archived: true
          });
          
          return { name: repoName, success: true };
        } catch (error) {
          console.error(`Error archiving repository ${repoName}:`, error);
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
        message: `Successfully archived ${repositories.length} repositories`,
        results
      });
    } else {
      const failedRepos = results.filter(result => !result.success);
      return NextResponse.json({
        success: false,
        message: `Failed to archive ${failedRepos.length} out of ${repositories.length} repositories`,
        results
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error archiving repositories:', error);
    return NextResponse.json(
      { success: false, message: `Error archiving repositories: ${error}` },
      { status: 500 }
    );
  }
}
