import { NextRequest, NextResponse } from 'next/server';

// Fallback static data for when no token is provided
const staticRepositories = [
  {
    name: "example-repo-1",
    url: "https://github.com/user/example-repo-1",
    description: "An example repository for demonstration",
    isArchived: false,
    diskUsage: 1024,
    diskUsageMB: 1.02,
    visibility: "PUBLIC",
    createdAt: "2023-01-15T10:30:00Z",
    updatedAt: "2023-03-20T14:45:00Z",
    pushedAt: "2023-03-20T14:45:00Z",
    daysSinceLastPush: 378,
    inactive: true,
    primaryLanguage: "JavaScript"
  },
  {
    name: "example-repo-2",
    url: "https://github.com/user/example-repo-2",
    description: "Another example repository",
    isArchived: false,
    diskUsage: 2048,
    diskUsageMB: 2.05,
    visibility: "PRIVATE",
    createdAt: "2023-02-10T09:15:00Z",
    updatedAt: "2023-12-05T11:30:00Z",
    pushedAt: "2023-12-05T11:30:00Z",
    daysSinceLastPush: 118,
    inactive: false,
    primaryLanguage: "TypeScript"
  },
  {
    name: "archived-repo",
    url: "https://github.com/user/archived-repo",
    description: "An archived repository",
    isArchived: true,
    diskUsage: 512,
    diskUsageMB: 0.51,
    visibility: "PUBLIC",
    createdAt: "2022-05-20T16:45:00Z",
    updatedAt: "2022-08-15T13:20:00Z",
    pushedAt: "2022-08-15T13:20:00Z",
    daysSinceLastPush: 595,
    inactive: true,
    primaryLanguage: "Python"
  }
];

interface GitHubRepo {
  name: string;
  html_url: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  archived: boolean;
  size: number;
  private: boolean;
  languages_url: string;
}

interface LanguageData {
  [key: string]: number;
}

async function fetchRepositoriesFromGitHub(token: string): Promise<GitHubRepo[]> {
  try {
    const response = await fetch('https://api.github.com/user/repos?per_page=100', {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching repositories from GitHub:', error);
    throw error;
  }
}

async function fetchRepositoryLanguages(repo: GitHubRepo, token: string): Promise<LanguageData> {
  try {
    const response = await fetch(repo.languages_url, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error fetching languages for ${repo.name}:`, error);
    return {};
  }
}

async function processRepositoryData(repos: GitHubRepo[], token: string) {
  const now = new Date();
  const processedRepos = [];
  
  for (const repo of repos) {
    // Get primary language
    let primaryLanguage = 'None';
    try {
      const languages = await fetchRepositoryLanguages(repo, token);
      const entries = Object.entries(languages);
      if (entries.length > 0) {
        // Sort by byte count (descending)
        entries.sort((a, b) => b[1] - a[1]);
        primaryLanguage = entries[0][0];
      }
    } catch (error) {
      console.error(`Error processing languages for ${repo.name}:`, error);
    }
    
    const lastPushDate = new Date(repo.pushed_at);
    const daysSinceLastPush = Math.floor((now.getTime() - lastPushDate.getTime()) / (1000 * 60 * 60 * 24));
    
    processedRepos.push({
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
    });
  }
  
  return processedRepos;
}

export async function GET(request: NextRequest) {
  // Get GitHub token from request headers
  const githubToken = request.headers.get('x-github-token') || '';
  
  // If no token is provided, return static data
  if (!githubToken) {
    return NextResponse.json(staticRepositories);
  }
  
  try {
    // Fetch repositories from GitHub API
    const repos = await fetchRepositoriesFromGitHub(githubToken);
    
    // Process repository data
    const processedRepos = await processRepositoryData(repos, githubToken);
    
    return NextResponse.json(processedRepos);
  } catch (error) {
    console.error('Error processing repository data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch repositories', message: String(error) },
      { status: 500 }
    );
  }
}
