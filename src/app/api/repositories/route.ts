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
    
    return NextResponse.json(processedRepos);
  } catch (error) {
    console.error('Error fetching repositories:', error);
    return NextResponse.json(
      { success: false, message: `Error fetching repositories: ${error}` },
      { status: 500 }
    );
  }
}
