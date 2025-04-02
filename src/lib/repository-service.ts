// Update the GitHub token header in API calls
import { Repository } from "@/types/repository";

export async function fetchRepositoryData(): Promise<Repository[]> {
  try {
    const githubToken = localStorage.getItem('github_token');
    const response = await fetch('/api/repositories', {
      headers: {
        'x-github-token': githubToken || '',
      }
    });
    if (!response.ok) {
      throw new Error(`Error fetching repositories: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch repository data:', error);
    return [];
  }
}

export async function refreshRepositoryData(): Promise<{ success: boolean; message: string }> {
  try {
    const githubToken = localStorage.getItem('github_token');
    const response = await fetch('/api/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-github-token': githubToken || '',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Error refreshing repositories: ${response.statusText}`);
    }
    
    const result = await response.json();
    return {
      success: result.success,
      message: result.message || 'Repository data refreshed successfully',
    };
  } catch (error) {
    console.error('Failed to refresh repository data:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export async function archiveRepositories(repoNames: string[]): Promise<{ success: boolean; message: string; archivePath?: string }> {
  try {
    const githubToken = localStorage.getItem('github_token');
    const response = await fetch('/api/archive', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-github-token': githubToken || '',
      },
      body: JSON.stringify({ repositories: repoNames }),
    });
    
    if (!response.ok) {
      throw new Error(`Error archiving repositories: ${response.statusText}`);
    }
    
    const result = await response.json();
    return {
      success: result.success,
      message: result.message || `Successfully archived ${repoNames.length} repositories`,
      archivePath: result.archivePath,
    };
  } catch (error) {
    console.error('Failed to archive repositories:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export async function deleteRepositories(repoNames: string[]): Promise<{ success: boolean; message: string; results?: Array<{ name: string; success: boolean; error?: string }> }> {
  try {
    const githubToken = localStorage.getItem('github_token');
    const response = await fetch('/api/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-github-token': githubToken || '',
      },
      body: JSON.stringify({ repositories: repoNames }),
    });
    
    if (!response.ok) {
      throw new Error(`Error deleting repositories: ${response.statusText}`);
    }
    
    const result = await response.json();
    return {
      success: result.success,
      message: result.message || `Successfully deleted ${repoNames.length} repositories`,
      results: result.results,
    };
  } catch (error) {
    console.error('Failed to delete repositories:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export function calculateRepositorySummary(repositories: Repository[]) {
  const totalRepos = repositories.length;
  const privateRepos = repositories.filter(repo => repo.visibility === 'PRIVATE').length;
  const publicRepos = repositories.filter(repo => repo.visibility === 'PUBLIC').length;
  const archivedRepos = repositories.filter(repo => repo.isArchived).length;
  const inactiveRepos = repositories.filter(repo => repo.inactive).length;
  const totalSizeMB = repositories.reduce((sum, repo) => sum + repo.diskUsageMB, 0);
  
  // Count repositories by language
  const languages: Record<string, number> = {};
  repositories.forEach(repo => {
    if (repo.primaryLanguage && repo.primaryLanguage !== 'None') {
      languages[repo.primaryLanguage] = (languages[repo.primaryLanguage] || 0) + 1;
    }
  });
  
  return {
    totalRepos,
    privateRepos,
    publicRepos,
    archivedRepos,
    inactiveRepos,
    totalSizeMB,
    languages,
  };
}
