import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';

export async function GET(request: NextRequest) {
  try {
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
    
    // Fetch repositories
    const { data: repos } = await octokit.repos.listForAuthenticatedUser({
      per_page: 100,
      sort: 'updated',
      direction: 'desc'
    });
    
    // Process repository data
    const now = new Date();
    const processedRepos = await Promise.all(repos.map(async (repo) => {
      // Get primary language
      let primaryLanguage = 'None';
      try {
        const { data: languages } = await octokit.repos.listLanguages({
          owner: repo.owner.login,
          repo: repo.name
        });
        
        const entries = Object.entries(languages);
        if (entries.length > 0) {
          // Sort by byte count (descending)
          entries.sort((a, b) => b[1] - a[1]);
          primaryLanguage = entries[0][0];
        }
      } catch (error) {
        console.error(`Error fetching languages for ${repo.name}:`, error);
      }
      
      const lastPushDate = new Date(repo.pushed_at);
      const daysSinceLastPush = Math.floor((now.getTime() - lastPushDate.getTime()) / (1000 * 60 * 60 * 24));
      
      return {
        name: repo.name,
        description: repo.description || '',
        url: repo.html_url,
        createdAt: repo.created_at,
        updatedAt: repo.updated_at,
        pushedAt: repo.pushed_at,
        isArchived: repo.archived,
        diskUsage: repo.size,
        diskUsageMB: repo.size / 1024, // Convert KB to MB
        visibility: repo.private ? 'PRIVATE' : 'PUBLIC',
        primaryLanguage,
        daysSinceLastPush,
        inactive: daysSinceLastPush > 180 // Inactive if no pushes in 6 months
      };
    }));
    
    // Trigger background insight generation
    // This is done after sending the response to avoid blocking the UI
    if (processedRepos.length > 0) {
      // We use setTimeout with 0 delay to move this to the next event loop iteration
      // This ensures the response is sent before we start generating insights
      setTimeout(async () => {
        try {
          console.log(`Starting background insight generation for ${processedRepos.length} repositories`);
          
          // We'll generate insights for the 10 most recently updated repositories
          // to avoid overloading the server and API rate limits
          const reposForInsights = processedRepos.slice(0, 10);
          
          for (const repo of reposForInsights) {
            try {
              // Call the insights API for each repository
              await fetch(`${request.nextUrl.origin}/api/insights`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  repositoryName: repo.name,
                  repositoryUrl: repo.url,
                  repositoryDescription: repo.description,
                  primaryLanguage: repo.primaryLanguage,
                  createdAt: repo.createdAt,
                  updatedAt: repo.updatedAt
                })
              });
              
              console.log(`Generated insights for repository: ${repo.name}`);
              
              // Add a small delay between requests to avoid rate limiting
              await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
              console.error(`Error generating insights for ${repo.name}:`, error);
              // Continue with the next repository even if one fails
            }
          }
          
          console.log('Background insight generation completed');
        } catch (error) {
          console.error('Error in background insight generation:', error);
        }
      }, 0);
    }
    
    return NextResponse.json(processedRepos);
  } catch (error) {
    console.error('Error fetching repositories:', error);
    return NextResponse.json(
      { success: false, message: `Error fetching repositories: ${error}` },
      { status: 500 }
    );
  }
}
